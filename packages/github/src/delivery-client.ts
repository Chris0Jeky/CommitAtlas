import { GitHubApiError } from "./client.js";
import {
  buildDeliveryQueryPlan,
  deriveDeliverySnapshot,
  type DeliveryBenchmark,
  type DeliverySnapshot,
} from "./delivery.js";

const GRAPHQL_URL = "https://api.github.com/graphql";
const API_VERSION = "2026-03-10";
const MAX_RESPONSE_BYTES = 1_500_000;
const DEFAULT_DEADLINE_MS = 12_000;

export interface FetchDeliverySnapshotOptions {
  readonly token: string;
  readonly login: string;
  readonly repositories: readonly string[];
  readonly benchmark?: DeliveryBenchmark | null;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  readonly deadlineMs?: number;
}

/**
 * Fetch aggregate pull-request counts for one explicitly configured public portfolio.
 *
 * This transport is deliberately separate from `GitHubClient`: the general client accepts a token
 * only after GitHub proves classic public-only OAuth scopes, while GitHub Actions supplies a
 * short-lived repository token without that classic-scope evidence. Delivery collection does not
 * widen that general invariant. Instead, every search variable is generated from strict
 * owner/repository identifiers and names the complete configured scope. Only `issueCount` fields
 * and a per-configured-repository `isPrivate` guard are requested. Renames are not followed;
 * every guard must be false (public). Guard values are discarded, and only validated aggregate
 * integers survive the response boundary.
 */
export async function fetchDeliverySnapshot(
  options: FetchDeliverySnapshotOptions,
): Promise<DeliverySnapshot> {
  const token = options.token.trim();
  if (!token) {
    throw new GitHubApiError(
      "token_required",
      "Delivery evidence requires a short-lived GitHub token during static generation",
      503,
    );
  }
  const plan = buildDeliveryQueryPlan({
    login: options.login,
    repositories: options.repositories,
    asOf: (options.now ?? (() => new Date()))(),
  });
  const variables = Object.fromEntries(plan.queries.map((query, index) => [`query${index}`, query.search]));
  const declarations = plan.queries.map((_, index) => `$query${index}: String!`).join(", ");
  const selections = plan.queries.map((query, index) => (
    `${query.alias}: search(query: $query${index}, type: ISSUE, first: 1) { issueCount }`
  )).join("\n  ");
  // The public-only search filter is not proof that every configured name exists
  // and is public. Request only the visibility bit, never repository content.
  const scopeSelections = plan.repositories.map((repository, index) => {
    const [owner, name] = repository.split("/");
    return `scopeRepository${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}, followRenames: false) { isPrivate }`;
  }).join("\n  ");
  const query = `query DeliveryCounts(${declarations}) {\n  ${selections}\n  ${scopeSelections}\n}`;
  const response = await requestGraphql({
    token,
    query,
    variables,
    fetchImpl: options.fetchImpl ?? fetch,
    deadlineMs: options.deadlineMs ?? DEFAULT_DEADLINE_MS,
  });
  if (Array.isArray(response.errors) && response.errors.length > 0) {
    throw new GitHubApiError(
      "github_unavailable",
      "GitHub could not satisfy the requested delivery counts",
      502,
    );
  }
  if (!isRecord(response.data)) {
    throw new GitHubApiError("invalid_response", "GitHub returned invalid delivery count data");
  }
  for (let index = 0; index < plan.repositories.length; index += 1) {
    const repository = response.data[`scopeRepository${index}`];
    // GitHub's isPrivate includes internal repositories. Only literal false is
    // affirmative public evidence; missing, null, or malformed bits fail closed.
    if (!isRecord(repository) || repository.isPrivate !== false) {
      throw new GitHubApiError(
        "invalid_response",
        "GitHub did not confirm public visibility for every configured delivery repository",
      );
    }
  }
  const counts: Record<string, number> = {};
  for (const item of plan.queries) {
    const connection = response.data[item.alias];
    if (!isRecord(connection) || !("issueCount" in connection)) {
      throw new GitHubApiError("invalid_response", `Delivery count evidence is missing ${item.alias}`);
    }
    const value = connection.issueCount;
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
      throw new GitHubApiError(
        "invalid_response",
        `Delivery count ${item.alias} must be a safe non-negative integer`,
      );
    }
    counts[item.alias] = value as number;
  }
  return deriveDeliverySnapshot({
    plan,
    counts,
    ...(options.benchmark ? { benchmark: options.benchmark } : {}),
  });
}

async function requestGraphql(input: {
  readonly token: string;
  readonly query: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly fetchImpl: typeof fetch;
  readonly deadlineMs: number;
}): Promise<Record<string, unknown>> {
  if (!Number.isSafeInteger(input.deadlineMs) || input.deadlineMs <= 0 || input.deadlineMs > 60_000) {
    throw new GitHubApiError("invalid_response", "Delivery request deadline is invalid", 400);
  }
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${input.token}`,
    "Content-Type": "application/json",
    "User-Agent": "CommitAtlas/0.4",
    "X-GitHub-Api-Version": API_VERSION,
  });
  let response: Response;
  try {
    response = await input.fetchImpl(GRAPHQL_URL, {
      method: "POST",
      redirect: "error",
      headers,
      body: JSON.stringify({ query: input.query, variables: input.variables }),
      signal: AbortSignal.timeout(input.deadlineMs),
    });
  } catch {
    throw new GitHubApiError(
      "github_unavailable",
      "GitHub did not respond before the delivery request deadline",
      502,
    );
  }
  if (!response.ok) {
    const rateLimited = response.status === 429
      || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
    await response.body?.cancel();
    if (rateLimited) {
      throw new GitHubApiError(
        "github_rate_limited",
        "GitHub rate limit reached while collecting delivery evidence",
        429,
        response.headers.get("retry-after"),
      );
    }
    throw new GitHubApiError(
      "github_unavailable",
      "GitHub delivery evidence is currently unavailable",
      502,
    );
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("application/json")) {
    await response.body?.cancel();
    throw new GitHubApiError("invalid_response", "GitHub returned a non-JSON delivery response");
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new GitHubApiError("invalid_response", "GitHub delivery response exceeded the allowed size");
  }
  const body = await readBoundedText(response);
  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    throw new GitHubApiError("invalid_response", "GitHub returned invalid delivery JSON");
  }
  if (!isRecord(payload)) {
    throw new GitHubApiError("invalid_response", "GitHub returned an invalid delivery response");
  }
  return payload;
}

async function readBoundedText(response: Response): Promise<string> {
  if (!response.body) {
    throw new GitHubApiError("invalid_response", "GitHub returned an empty delivery response");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_RESPONSE_BYTES) {
        throw new GitHubApiError("invalid_response", "GitHub delivery response exceeded the allowed size");
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof GitHubApiError) throw error;
    throw new GitHubApiError("github_unavailable", "GitHub delivery response could not be read");
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new GitHubApiError("invalid_response", "GitHub returned invalid UTF-8 delivery data");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
