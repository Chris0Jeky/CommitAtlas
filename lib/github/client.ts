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
  ProjectWorkflow,
} from "./types";
import {
  isRecord,
  safeHttpsUrl,
  stringField as rawStringField,
} from "./validation";

const API_ORIGIN = "https://api.github.com";
const GRAPHQL_URL = "https://api.github.com/graphql";
const API_VERSION = "2026-03-10";
const MAX_RESPONSE_BYTES = 1_500_000;
const REQUEST_DEADLINE_MS = 12_000;
const PROJECT_CONCURRENCY = 2;
const GITHUB_TEXT_LIMITS = {
  profileLogin: 39,
  profileName: 200,
  repositoryName: 100,
  repositoryDescription: 500,
  language: 80,
  branch: 255,
  timestamp: 35,
  license: 100,
  releaseTag: 200,
  releaseName: 200,
  assetName: 255,
  workflowStatus: 32,
  workflowConclusion: 64,
  commitSha: 64,
  contributionDate: 10,
} as const;

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
  private publicCredentialProof: Promise<void> | undefined;

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
      const language = textField(repository, "language", GITHUB_TEXT_LIMITS.language);
      if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
      const pushedAt = textField(repository, "pushed_at", GITHUB_TEXT_LIMITS.timestamp);
      if (pushedAt && (!latestPushAt || pushedAt > latestPushAt)) latestPushAt = pushedAt;
    }

    return {
      version: 1,
      login: textField(user, "login", GITHUB_TEXT_LIMITS.profileLogin) ?? login,
      name: textField(user, "name", GITHUB_TEXT_LIMITS.profileName),
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
        const date = textField(day, "date", GITHUB_TEXT_LIMITS.contributionDate);
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
    workflows: ReadonlyMap<string, ProjectWorkflow> = new Map(),
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
      return this.fetchProject(owner, repository, lifecycle, workflows.get(repository.toLowerCase()));
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
    configuredWorkflow: ProjectWorkflow | undefined,
  ): Promise<ProjectSnapshot> {
    const repo = await this.getJson(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`);
    if (!isRecord(repo)) throw new GitHubApiError("invalid_response", "GitHub returned an invalid repository");
    if (repo.private === true) throw privateDataError("CommitAtlas only serves public GitHub repositories");

    const defaultBranch = textField(repo, "default_branch", GITHUB_TEXT_LIMITS.branch) ?? "main";
    const [release, ci] = await Promise.all([
      this.fetchLatestRelease(owner, repository),
      configuredWorkflow
        ? this.fetchLatestRun(owner, repository, defaultBranch, configuredWorkflow)
        : Promise.resolve(toJsonCiSignal(
          calculateGitHubCiState({ available: true, configured: false }, this.now()),
          null,
          null,
          null,
        )),
    ]);
    const license = isRecord(repo.license) ? textField(repo.license, "spdx_id", GITHUB_TEXT_LIMITS.license) : null;

    return {
      repo: `${owner}/${repository}`,
      name: textField(repo, "name", GITHUB_TEXT_LIMITS.repositoryName) ?? repository,
      description: textField(repo, "description", GITHUB_TEXT_LIMITS.repositoryDescription),
      sourceUrl: safeHttpsUrl(repo.html_url) ?? `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
      websiteUrl: safeHttpsUrl(repo.homepage),
      lifecycle: configuredLifecycle,
      primaryLanguage: textField(repo, "language", GITHUB_TEXT_LIMITS.language),
      stars: requiredMetric(repo, "stargazers_count"),
      forks: requiredMetric(repo, "forks_count"),
      openIssues: requiredMetric(repo, "open_issues_count"),
      pushedAt: textField(repo, "pushed_at", GITHUB_TEXT_LIMITS.timestamp),
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
    const publishedAt = textField(result, "published_at", GITHUB_TEXT_LIMITS.timestamp);
    const tag = textField(result, "tag_name", GITHUB_TEXT_LIMITS.releaseTag);
    if (!url || !publishedAt || !tag) return null;
    return {
      tag,
      name: textField(result, "name", GITHUB_TEXT_LIMITS.releaseName) ?? tag,
      url,
      publishedAt,
      download: firstAsset
        ? {
            name: textField(firstAsset, "name", GITHUB_TEXT_LIMITS.assetName) ?? "Release asset",
            url: safeHttpsUrl(firstAsset.browser_download_url)!,
          }
        : null,
    };
  }

  private async fetchLatestRun(
    owner: string,
    repository: string,
    branch: string,
    workflow: ProjectWorkflow,
  ): Promise<ProjectCiSignal> {
    const result = await this.getJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/workflows/${encodeURIComponent(workflow)}/runs?branch=${encodeURIComponent(branch)}&per_page=1&exclude_pull_requests=true`,
      true,
    );
    if (result === null || !isRecord(result)) {
      return toJsonCiSignal(calculateGitHubCiState({ available: false, configured: true }, this.now()), workflow, null, null);
    }
    const runs = Array.isArray(result.workflow_runs) ? result.workflow_runs.filter(isRecord) : [];
    const run = runs[0];
    if (!run) {
      return toJsonCiSignal(calculateGitHubCiState({ available: true, configured: true }, this.now()), workflow, null, null);
    }
    const status = calculateGitHubCiState(workflowObservation(run), this.now());
    return toJsonCiSignal(
      status,
      workflow,
      safeHttpsUrl(run.html_url),
      textField(run, "head_sha", GITHUB_TEXT_LIMITS.commitSha),
    );
  }

  private async graphql(query: string, variables: Record<string, string>): Promise<Record<string, unknown>> {
    await this.assertPublicCredentials();
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
   * Public routes may use a token only when GitHub explicitly proves its
   * classic OAuth scope evidence is public-only. This raw preflight must stay
   * outside getJson/graphql so it cannot recursively preflight itself.
   */
  private async assertPublicCredentials(): Promise<void> {
    if (!this.token) return;
    this.publicCredentialProof ??= this.provePublicCredentials();
    await this.publicCredentialProof;
  }

  private async provePublicCredentials(): Promise<void> {
    const response = await this.fetchWithDeadline(new URL("/rate_limit", API_ORIGIN), {
      headers: this.headers(),
    });
    const hasScopeEvidence = response.headers.has("x-oauth-scopes");
    const scopes = response.headers.get("x-oauth-scopes");
    await response.body?.cancel();
    if (!response.ok || !hasScopeEvidence || !hasOnlyPublicClassicScopes(this.token, scopes)) {
      throw privateDataError("Public GitHub routes require a token with explicit public-only classic OAuth scopes");
    }
  }

  private async getJson(path: string, allowMissing = false): Promise<unknown> {
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/")) {
      throw new GitHubApiError("invalid_response", "Refused a non-GitHub API target");
    }
    await this.assertPublicCredentials();
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

function hasOnlyPublicClassicScopes(token: string, scopes: string | null): boolean {
  if (scopes === null) return false;
  const normalized = scopes.trim();
  if (normalized === "") return token.startsWith("ghp_") || token.startsWith("gho_");
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

function textField(record: Record<string, unknown>, key: string, maxCodePoints: number): string | null {
  const value = rawStringField(record, key);
  if (value !== null && [...value].length > maxCodePoints) {
    throw new GitHubApiError("invalid_response", `GitHub returned an oversized ${key} field`);
  }
  return value;
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
    conclusion: toCoreConclusion(
      textField(run, "status", GITHUB_TEXT_LIMITS.workflowStatus),
      textField(run, "conclusion", GITHUB_TEXT_LIMITS.workflowConclusion),
    ),
    updatedAt: textField(run, "updated_at", GITHUB_TEXT_LIMITS.timestamp) ?? undefined,
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
