import {
  parseContributionCalendar,
  type CiObservation,
} from "@/packages/core/src/index";
import {
  calculateGitHubCiState,
  toJsonCiSignal,
} from "./adapters";
import type {
  ContributionDay,
  ContributionSnapshot,
  LanguageSignal,
  ProfileSnapshot,
  ProjectBoardSnapshot,
  ProjectCiSignal,
  ProjectLifecycle,
  ProjectReleaseSignal,
  ProjectSnapshot,
} from "./types";
import {
  isRecord,
  safeHttpsUrl,
  stringField,
} from "./validation";

const API_ORIGIN = "https://api.github.com";
const GRAPHQL_URL = "https://api.github.com/graphql";
const API_VERSION = "2026-03-10";
const MAX_RESPONSE_BYTES = 1_500_000;
const REQUEST_DEADLINE_MS = 12_000;
const PROJECT_CONCURRENCY = 2;

export class GitHubApiError extends Error {
  constructor(
    readonly code: "github_unavailable" | "github_rate_limited" | "token_required" | "invalid_response" | "private_data",
    message: string,
    readonly status = 502,
    readonly retryAfter: string | null = null,
  ) {
    super(message);
  }
}

interface GitHubClientOptions {
  token?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  deadlineMs?: number;
}

export class GitHubClient {
  private readonly token: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly deadlineAt: number;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token?.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.deadlineAt = Date.now() + (options.deadlineMs ?? REQUEST_DEADLINE_MS);
  }

  async fetchProfile(login: string): Promise<ProfileSnapshot> {
    const [user, repositories] = await Promise.all([
      this.getJson(`/users/${encodeURIComponent(login)}`),
      this.getJson(`/users/${encodeURIComponent(login)}/repos?type=owner&sort=updated&per_page=100`),
    ]);
    if (!isRecord(user) || !Array.isArray(repositories)) {
      throw new GitHubApiError("invalid_response", "GitHub returned an unexpected profile shape");
    }

    if (repositories.some((repository) => !isRecord(repository))) {
      throw new GitHubApiError("invalid_response", "GitHub returned an invalid repository list");
    }
    const parsedRepositories = repositories;
    if (parsedRepositories.some((repository) => repository.private === true)) {
      throw privateDataError("GitHub returned a private repository in a public profile response");
    }
    const languageCounts = new Map<string, number>();
    let stars = 0;
    let forks = 0;
    let latestPushAt: string | null = null;

    for (const repository of parsedRepositories) {
      stars += requiredMetric(repository, "stargazers_count");
      forks += requiredMetric(repository, "forks_count");
      const language = stringField(repository, "language");
      if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
      const pushedAt = stringField(repository, "pushed_at");
      if (pushedAt && (!latestPushAt || pushedAt > latestPushAt)) latestPushAt = pushedAt;
    }

    return {
      version: 1,
      login: stringField(user, "login") ?? login,
      name: stringField(user, "name"),
      profileUrl: safeHttpsUrl(user.html_url) ?? `https://github.com/${encodeURIComponent(login)}`,
      publicRepositories: requiredMetric(user, "public_repos"),
      followers: requiredMetric(user, "followers"),
      following: requiredMetric(user, "following"),
      stars,
      forks,
      primaryLanguages: toLanguageSignals(languageCounts),
      latestPushAt,
      repositoriesTruncated: requiredMetric(user, "public_repos") > parsedRepositories.length,
      freshness: {
        generatedAt: this.now().toISOString(),
        source: "github-rest",
        mode: "live",
      },
    };
  }

  async fetchContributions(login: string, days = 365): Promise<ContributionSnapshot> {
    if (!this.token) {
      throw new GitHubApiError(
        "token_required",
        "Contribution cards require a server-side GitHub token or static Action generation",
        503,
      );
    }
    await this.assertPublicContributionCredentials();
    const to = this.now();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - Math.min(Math.max(days, 1), 365));

    const payload = await this.graphql(CONTRIBUTIONS_QUERY, {
      login,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const user = nestedRecord(payload, "data", "user");
    const collection = user && isRecord(user.contributionsCollection)
      ? user.contributionsCollection
      : null;
    const calendar = collection && isRecord(collection.contributionCalendar)
      ? collection.contributionCalendar
      : null;
    if (!collection || !calendar) {
      throw new GitHubApiError("invalid_response", "GitHub returned no contribution calendar");
    }
    assertPublicContributionCollection(collection);

    if (!Array.isArray(calendar.weeks) || calendar.weeks.some((week) => !isRecord(week))) {
      throw new GitHubApiError("invalid_response", "GitHub returned an invalid contribution calendar");
    }
    const weeks = calendar.weeks as Record<string, unknown>[];
    const contributionDays: ContributionDay[] = [];
    for (const week of weeks) {
      if (!Array.isArray(week.contributionDays) || week.contributionDays.some((day) => !isRecord(day))) {
        throw new GitHubApiError("invalid_response", "GitHub returned invalid contribution days");
      }
      const weekDays = week.contributionDays as Record<string, unknown>[];
      for (const day of weekDays) {
        const date = stringField(day, "date");
        if (!date) throw new GitHubApiError("invalid_response", "GitHub returned a contribution day without a date");
        contributionDays.push({ date, count: requiredMetric(day, "contributionCount") });
      }
    }

    let calendarDays: ContributionDay[];
    try {
      calendarDays = parseContributionCalendar({ version: 1, days: contributionDays }).days;
    } catch {
      throw new GitHubApiError("invalid_response", "GitHub returned an invalid contribution calendar");
    }
    return {
      version: 1,
      login,
      totalContributions: calendarDays.reduce((total, day) => total + day.count, 0),
      commits: requiredMetric(collection, "totalCommitContributions"),
      issues: requiredMetric(collection, "totalIssueContributions"),
      pullRequests: requiredMetric(collection, "totalPullRequestContributions"),
      reviews: requiredMetric(collection, "totalPullRequestReviewContributions"),
      days: calendarDays.map(({ date, count }) => ({ date, count })),
      freshness: {
        generatedAt: this.now().toISOString(),
        source: "github-graphql",
        mode: "live",
      },
    };
  }

  async fetchProjects(
    owner: string,
    repositories: readonly string[],
    lifecycles: ReadonlyMap<string, ProjectLifecycle>,
  ): Promise<ProjectBoardSnapshot> {
    for (const repository of repositories) {
      const lifecycle = lifecycles.get(repository.toLowerCase());
      if (!lifecycle) {
        throw new GitHubApiError("invalid_response", "Every project requires an explicit core lifecycle", 400);
      }
    }
    const projects = await mapWithConcurrency(repositories, PROJECT_CONCURRENCY, async (repository) => {
      const lifecycle = lifecycles.get(repository.toLowerCase());
      if (!lifecycle) throw new GitHubApiError("invalid_response", "Every project requires an explicit core lifecycle", 400);
      return this.fetchProject(owner, repository, lifecycle);
    });
    return {
      version: 1,
      owner,
      projects,
      freshness: {
        generatedAt: this.now().toISOString(),
        source: "github-rest",
        mode: projects.some((project) => project.ci.state === "unavailable") ? "partial" : "live",
      },
    };
  }

  private async fetchProject(
    owner: string,
    repository: string,
    configuredLifecycle: ProjectLifecycle,
  ): Promise<ProjectSnapshot> {
    const repo = await this.getJson(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`);
    if (!isRecord(repo)) throw new GitHubApiError("invalid_response", "GitHub returned an invalid repository");
    if (repo.private === true) throw privateDataError("CommitAtlas only serves public GitHub repositories");

    const defaultBranch = stringField(repo, "default_branch") ?? "main";
    const [release, ci] = await Promise.all([
      this.fetchLatestRelease(owner, repository),
      this.fetchLatestRun(owner, repository, defaultBranch),
    ]);
    const license = isRecord(repo.license) ? stringField(repo.license, "spdx_id") : null;

    return {
      repo: `${owner}/${repository}`,
      name: stringField(repo, "name") ?? repository,
      description: stringField(repo, "description"),
      sourceUrl: safeHttpsUrl(repo.html_url) ?? `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
      websiteUrl: safeHttpsUrl(repo.homepage),
      lifecycle: configuredLifecycle,
      primaryLanguage: stringField(repo, "language"),
      stars: requiredMetric(repo, "stargazers_count"),
      forks: requiredMetric(repo, "forks_count"),
      openIssues: requiredMetric(repo, "open_issues_count"),
      pushedAt: stringField(repo, "pushed_at"),
      license: license === "NOASSERTION" ? null : license,
      ci,
      release,
    };
  }

  private async fetchLatestRelease(owner: string, repository: string): Promise<ProjectReleaseSignal | null> {
    const result = await this.getJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/releases/latest`,
      true,
    );
    if (result === null || !isRecord(result)) return null;
    const assets = Array.isArray(result.assets) ? result.assets.filter(isRecord) : [];
    const firstAsset = assets.find((asset) => safeHttpsUrl(asset.browser_download_url));
    const url = safeHttpsUrl(result.html_url);
    const publishedAt = stringField(result, "published_at");
    const tag = stringField(result, "tag_name");
    if (!url || !publishedAt || !tag) return null;
    return {
      tag,
      name: stringField(result, "name") ?? tag,
      url,
      publishedAt,
      download: firstAsset
        ? {
            name: stringField(firstAsset, "name") ?? "Release asset",
            url: safeHttpsUrl(firstAsset.browser_download_url)!,
          }
        : null,
    };
  }

  private async fetchLatestRun(owner: string, repository: string, branch: string): Promise<ProjectCiSignal> {
    const result = await this.getJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=1&exclude_pull_requests=true`,
      true,
    );
    if (result === null || !isRecord(result)) {
      return toJsonCiSignal(calculateGitHubCiState({ available: false, configured: false }, this.now()), null, null);
    }
    const runs = Array.isArray(result.workflow_runs) ? result.workflow_runs.filter(isRecord) : [];
    const run = runs[0];
    if (!run) {
      return toJsonCiSignal(calculateGitHubCiState({ available: true, configured: false }, this.now()), null, null);
    }
    const status = calculateGitHubCiState(workflowObservation(run), this.now());
    return toJsonCiSignal(status, safeHttpsUrl(run.html_url), stringField(run, "head_sha"));
  }

  private async graphql(query: string, variables: Record<string, string>): Promise<Record<string, unknown>> {
    const response = await this.fetchWithDeadline(GRAPHQL_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ query, variables }),
    });
    const payload = await this.readResponse(response, false);
    if (!isRecord(payload)) {
      throw new GitHubApiError("invalid_response", "GitHub returned an invalid GraphQL response");
    }
    return payload;
  }

  /**
   * The public endpoint may use a classic token only when GitHub proves that
   * it cannot read private repository data. This authenticated REST check is
   * intentionally made before the viewer-scoped GraphQL contribution query.
   */
  private async assertPublicContributionCredentials(): Promise<void> {
    const response = await this.fetchWithDeadline(new URL("/rate_limit", API_ORIGIN), {
      headers: this.headers(),
    });
    const scopes = response.headers.get("x-oauth-scopes");
    await response.body?.cancel();
    if (!response.ok || !hasOnlyPublicClassicScopes(scopes)) {
      throw privateDataError("Contribution data requires a GitHub token limited to public repository access");
    }
  }

  private async getJson(path: string, allowMissing = false): Promise<unknown> {
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/")) {
      throw new GitHubApiError("invalid_response", "Refused a non-GitHub API target");
    }
    const response = await this.fetchWithDeadline(url, {
      headers: this.headers(),
    });
    return this.readResponse(response, allowMissing);
  }

  private headers(): Headers {
    const headers = new Headers({
      Accept: "application/vnd.github+json",
      "User-Agent": "CommitAtlas/0.1",
      "X-GitHub-Api-Version": API_VERSION,
    });
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    return headers;
  }

  private async readResponse(response: Response, allowMissing: boolean): Promise<Record<string, unknown> | unknown[] | null> {
    if (allowMissing && (response.status === 403 || response.status === 404)) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) {
      await response.body?.cancel();
      const limited = response.status === 403 || response.status === 429;
      throw new GitHubApiError(
        limited ? "github_rate_limited" : "github_unavailable",
        limited ? "GitHub rate limit reached; retry after the reset window" : "GitHub data is currently unavailable",
        limited ? 429 : 502,
        retryAfterValue(response.headers, this.now()),
      );
    }
    const declaredLength = response.headers.get("content-length");
    if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new GitHubApiError("invalid_response", "GitHub response exceeded the allowed size");
    }
    const payload = await this.readBoundedJson(response);
    if (!isRecord(payload) && !Array.isArray(payload)) {
      throw new GitHubApiError("invalid_response", "GitHub returned invalid JSON data");
    }
    if (isRecord(payload) && Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw new GitHubApiError("github_unavailable", "GitHub could not satisfy the requested data", 502);
    }
    return payload;
  }

  private async fetchWithDeadline(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    const timeout = AbortSignal.timeout(this.remainingDeadline());
    try {
      return await this.withRemainingDeadline(this.fetchImpl(input, { ...init, signal: timeout }));
    } catch (error) {
      if (error instanceof GitHubApiError) throw error;
      throw new GitHubApiError("github_unavailable", "GitHub did not respond before the request deadline");
    }
  }

  private async readBoundedJson(response: Response): Promise<unknown> {
    if (!response.body) {
      throw new GitHubApiError("invalid_response", "GitHub returned an empty response body");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    try {
      while (true) {
        const { done, value } = await this.withRemainingDeadline(reader.read());
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > MAX_RESPONSE_BYTES) {
          throw new GitHubApiError("invalid_response", "GitHub response exceeded the allowed size");
        }
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel();
      if (error instanceof GitHubApiError) throw error;
      throw new GitHubApiError("github_unavailable", "GitHub did not respond before the request deadline");
    }
    const payloadText = new TextDecoder().decode(concatChunks(chunks, byteLength));
    try {
      return JSON.parse(payloadText) as unknown;
    } catch {
      throw new GitHubApiError("invalid_response", "GitHub returned invalid JSON data");
    }
  }

  private async withRemainingDeadline<T>(operation: Promise<T>): Promise<T> {
    const remaining = this.remainingDeadline();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(() => reject(new GitHubApiError("github_unavailable", "GitHub did not respond before the request deadline")), remaining);
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  private remainingDeadline(): number {
    const remaining = this.deadlineAt - Date.now();
    if (remaining <= 0) {
      throw new GitHubApiError("github_unavailable", "GitHub did not respond before the request deadline");
    }
    return remaining;
  }
}

function nestedRecord(record: Record<string, unknown>, first: string, second: string): Record<string, unknown> | null {
  const level = record[first];
  return isRecord(level) && isRecord(level[second]) ? level[second] : null;
}

function toLanguageSignals(counts: ReadonlyMap<string, number>): LanguageSignal[] {
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([name, repositories]) => ({
      name,
      repositories,
      share: Math.round((repositories / total) * 1000) / 10,
    }));
}

function privateDataError(message: string): GitHubApiError {
  return new GitHubApiError("private_data", message, 403);
}

function hasOnlyPublicClassicScopes(scopes: string | null): boolean {
  if (scopes === null) return false;
  const normalized = scopes.trim();
  if (normalized === "") return true;
  return normalized.split(",").every((scope) => scope.trim() === "public_repo");
}

function assertPublicContributionCollection(collection: Record<string, unknown>): void {
  const hasRestrictedContributions = collection.hasAnyRestrictedContributions;
  if (typeof hasRestrictedContributions !== "boolean") {
    throw new GitHubApiError("invalid_response", "GitHub returned an invalid restricted-contribution flag");
  }
  const restrictedContributions = requiredMetric(collection, "restrictedContributionsCount");
  if (hasRestrictedContributions || restrictedContributions > 0) {
    throw privateDataError("GitHub returned restricted contribution data");
  }
}

function retryAfterValue(headers: Headers, now: Date): string | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter !== null) return retryAfter;

  const reset = headers.get("x-ratelimit-reset");
  const normalizedReset = reset?.trim() ?? "";
  if (!/^\d+$/.test(normalizedReset)) return null;
  const resetEpoch = Number(normalizedReset);
  if (!Number.isSafeInteger(resetEpoch)) return null;
  const nowEpoch = Math.floor(now.getTime() / 1000);
  return String(Math.max(0, resetEpoch - nowEpoch));
}

function requiredMetric(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new GitHubApiError("invalid_response", `GitHub returned an invalid ${key} metric`);
  }
  return value;
}

function concatChunks(chunks: readonly Uint8Array[], byteLength: number): Uint8Array {
  const combined = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function workflowObservation(run: Record<string, unknown>): CiObservation {
  return {
    available: true,
    configured: true,
    conclusion: toCoreConclusion(stringField(run, "status"), stringField(run, "conclusion")),
    updatedAt: stringField(run, "updated_at") ?? undefined,
  };
}

function toCoreConclusion(status: string | null, conclusion: string | null): CiObservation["conclusion"] {
  if (status === "queued" || status === "requested" || status === "waiting" || status === "pending") return "queued";
  if (status === "in_progress") return "in_progress";
  if (status !== "completed") return undefined;
  if (conclusion === "success" || conclusion === "failure" || conclusion === "cancelled" || conclusion === "neutral" || conclusion === "timed_out" || conclusion === "action_required") return conclusion;
  if (conclusion === "skipped") return "neutral";
  if (conclusion === "startup_failure") return "failure";
  return undefined;
}

const CONTRIBUTIONS_QUERY = `
  query CommitAtlasContributions($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        hasAnyRestrictedContributions
        restrictedContributionsCount
        contributionCalendar {
          weeks {
            contributionDays { date contributionCount }
          }
        }
      }
    }
  }
`;
