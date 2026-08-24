import {
  parseContributionCalendar,
  type CiObservation,
} from "@commit-atlas/core";
import {
  calculateGitHubCiState,
  toJsonCiSignal,
} from "./adapters.js";
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
} from "./types.js";
import {
  isRecord,
  safeHttpsUrl,
  stringField as rawStringField,
} from "./validation.js";

const API_ORIGIN = "https://api.github.com";
const WEB_ORIGIN = "https://github.com";
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
    readonly code: "github_unavailable" | "github_rate_limited" | "github_not_found" | "token_required" | "invalid_response" | "private_data",
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
    const requestedDays = Math.min(Math.max(days, 1), 365);
    const to = this.now();
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    from.setUTCDate(from.getUTCDate() - (requestedDays - 1));

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
        contributionDays.push({
          date,
          count: requiredMetric(day, "contributionCount"),
          level: contributionLevel(day.contributionLevel),
        });
      }
    }

    let calendarDays: ContributionDay[];
    try {
      calendarDays = parseContributionCalendar({ version: 1, days: contributionDays }).days;
    } catch {
      throw new GitHubApiError("invalid_response", "GitHub returned an invalid contribution calendar");
    }
    const requestedFrom = from.toISOString().slice(0, 10);
    const requestedTo = to.toISOString().slice(0, 10);
    if (calendarDays.some(({ date }) => date > requestedTo)) {
      throw new GitHubApiError("invalid_response", "GitHub returned a contribution day after the requested end date");
    }
    calendarDays = calendarDays.filter(({ date }) => date >= requestedFrom && date <= requestedTo);
    assertRequestedContributionWindow(calendarDays, to, requestedDays);
    return {
      version: 1,
      login,
      totalContributions: calendarDays.reduce((total, day) => total + day.count, 0),
      commits: requiredMetric(collection, "totalCommitContributions"),
      issues: requiredMetric(collection, "totalIssueContributions"),
      pullRequests: requiredMetric(collection, "totalPullRequestContributions"),
      reviews: requiredMetric(collection, "totalPullRequestReviewContributions"),
      breakdownBasis: "exact-counts",
      days: calendarDays.map(({ date, count, level }) => ({ date, count, level })),
      freshness: {
        generatedAt: to.toISOString(),
        source: "github-graphql",
        mode: "live",
      },
    };
  }

  /**
   * Read the same contribution calendar GitHub deliberately exposes to a
   * logged-out profile visitor. No credential is sent, even when this client
   * also has one for another operation. The activity breakdown is the
   * percentage mix published by that view, not a fabricated exact count.
   */
  async fetchPublicProfileContributions(login: string, days = 365): Promise<ContributionSnapshot> {
    const requestedDays = Math.min(Math.max(days, 1), 365);
    const to = this.now();
    const toDate = to.toISOString().slice(0, 10);
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    from.setUTCDate(from.getUTCDate() - (requestedDays - 1));
    const fromDate = from.toISOString().slice(0, 10);
    const years = Array.from(
      { length: to.getUTCFullYear() - from.getUTCFullYear() + 1 },
      (_, index) => from.getUTCFullYear() + index,
    );

    const pages = await Promise.all(years.map(async (year) => {
      const url = new URL(`/users/${encodeURIComponent(login)}/contributions`, WEB_ORIGIN);
      url.searchParams.set("from", `${year}-01-01`);
      url.searchParams.set("to", `${year}-12-31`);
      if (url.origin !== WEB_ORIGIN || !url.pathname.startsWith("/users/")) {
        throw new GitHubApiError("invalid_response", "Refused a non-GitHub profile target");
      }
      const response = await this.fetchWithDeadline(url, {
        redirect: "error",
        headers: new Headers({
          Accept: "text/html",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "CommitAtlas/0.2 (+https://github.com/Chris0Jeky/CommitAtlas)",
        }),
      });
      const html = await this.readHtmlResponse(response);
      return parsePublicContributionPage(html, year);
    }));

    const byDate = new Map<string, ContributionDay>();
    for (const page of pages) {
      for (const day of page.days) {
        if (day.date < fromDate || day.date > toDate) continue;
        if (byDate.has(day.date)) {
          throw new GitHubApiError("invalid_response", "GitHub returned duplicate public contribution days");
        }
        byDate.set(day.date, day);
      }
    }
    const calendarDays = [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
    assertRequestedContributionWindow(calendarDays, to, requestedDays);
    const totalContributions = calendarDays.reduce((total, day) => total + day.count, 0);
    const weightedMix = weightedPublicActivityMix(pages, fromDate, toDate);

    return {
      version: 1,
      login,
      totalContributions,
      commits: weightedMix.commits,
      issues: weightedMix.issues,
      pullRequests: weightedMix.pullRequests,
      reviews: weightedMix.reviews,
      breakdownBasis: "public-profile-percentages",
      days: calendarDays,
      freshness: {
        generatedAt: to.toISOString(),
        source: "github-profile-html",
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
      openIssuesAndPullRequests: requiredMetric(repo, "open_issues_count"),
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
    // A 200 whose workflow_runs is missing or not an array is an unreadable
    // observation, not an observed absence of runs. Report it as unavailable so
    // a malformed payload can never present as configured-and-clean or as
    // "Not configured".
    if (!Array.isArray(result.workflow_runs)) {
      return toJsonCiSignal(calculateGitHubCiState({ available: false, configured: true }, this.now()), workflow, null, null);
    }
    const runs = result.workflow_runs.filter(isRecord);
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
    // GraphQL classifies its own payload errors so a partial not-found answer
    // is recognised before the generic error path collapses it into an outage.
    const payload = await this.readResponse(response, false, true);
    if (!isRecord(payload)) {
      throw new GitHubApiError("invalid_response", "GitHub returned an invalid GraphQL response");
    }
    assertGraphqlPayload(payload);
    return payload;
  }

  /**
   * Public routes may use a token only when GitHub explicitly proves its
   * classic OAuth scope evidence is public-only. This raw preflight must stay
   * outside getJson/graphql so it cannot recursively preflight itself.
   */
  private async assertPublicCredentials(): Promise<void> {
    const token = this.token;
    if (!token) return;
    this.publicCredentialProof ??= this.provePublicCredentials(token);
    await this.publicCredentialProof;
  }

  private async provePublicCredentials(token: string): Promise<void> {
    const response = await this.fetchWithDeadline(new URL("/rate_limit", API_ORIGIN), {
      headers: this.headers(),
    });
    const hasScopeEvidence = response.headers.has("x-oauth-scopes");
    const scopes = response.headers.get("x-oauth-scopes");
    await response.body?.cancel();
    if (!response.ok || !hasScopeEvidence || !hasOnlyPublicClassicScopes(token, scopes)) {
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

  private async readResponse(
    response: Response,
    allowMissing: boolean,
    allowPayloadErrors = false,
  ): Promise<Record<string, unknown> | unknown[] | null> {
    // Only 404 proves an optional resource is absent. A 403 or 429 is a refusal
    // or a rate limit, and reporting it as "no release" or "no workflow run"
    // would turn an unknown signal into an observed one.
    if (allowMissing && response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw this.transportError(response, "GitHub data is currently unavailable");
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
    if (!allowPayloadErrors && isRecord(payload) && Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw new GitHubApiError("github_unavailable", "GitHub could not satisfy the requested data", 502);
    }
    return payload;
  }

  private async readHtmlResponse(response: Response): Promise<string> {
    if (!response.ok) {
      await response.body?.cancel();
      throw this.transportError(response, "GitHub public profile is currently unavailable");
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.startsWith("text/html")) {
      await response.body?.cancel();
      throw new GitHubApiError("invalid_response", "GitHub returned a non-HTML public profile response");
    }
    const declaredLength = response.headers.get("content-length");
    if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new GitHubApiError("invalid_response", "GitHub response exceeded the allowed size");
    }
    return this.readBoundedText(response);
  }

  /**
   * Keep the three upstream failure meanings separate: a rate limit carries
   * retry guidance, a 404 is the non-disclosing not-found contract, and every
   * other failure stays an upstream outage.
   */
  private transportError(response: Response, unavailableMessage: string): GitHubApiError {
    if (response.status === 403 || response.status === 429) {
      return new GitHubApiError(
        "github_rate_limited",
        "GitHub rate limit reached; retry after the reset window",
        429,
        retryAfterValue(response.headers, this.now()),
      );
    }
    if (response.status === 404) return notFoundError();
    return new GitHubApiError(
      "github_unavailable",
      unavailableMessage,
      502,
      retryAfterValue(response.headers, this.now()),
    );
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
    const payloadText = await this.readBoundedText(response);
    try {
      return JSON.parse(payloadText) as unknown;
    } catch {
      throw new GitHubApiError("invalid_response", "GitHub returned invalid JSON data");
    }
  }

  private async readBoundedText(response: Response): Promise<string> {
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
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(concatChunks(chunks, byteLength));
    } catch {
      throw new GitHubApiError("invalid_response", "GitHub returned invalid UTF-8 data");
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

/**
 * GitHub answers 404 identically for a resource that does not exist and one
 * that exists but is not visible to the caller. This contract therefore states
 * only that no public resource matched, never which of the two happened, and
 * carries no resource identity. Every not-found path shares this one message so
 * a caller cannot probe for private repositories by comparing responses.
 */
function notFoundError(): GitHubApiError {
  return new GitHubApiError("github_not_found", "No public GitHub resource matched this request", 404);
}

/**
 * GitHub reports an unknown login as a partial success rather than a transport
 * error: HTTP 200 carrying `data.user: null` alongside a NOT_FOUND entry in
 * `errors`. Recognise exactly that shape before the generic GraphQL error path
 * so it yields the same not-found contract as every REST route. The upstream
 * message quotes the login that was probed, so it is discarded in favour of the
 * one shared not-found message. Any other error, or a mix, stays an outage.
 */
function assertGraphqlPayload(payload: Record<string, unknown>): void {
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const missingUser = isRecord(payload.data) && payload.data.user === null;
  const onlyNotFound = errors.every((error) => isRecord(error) && error.type === "NOT_FOUND");
  if (missingUser && onlyNotFound) throw notFoundError();
  if (errors.length > 0) {
    throw new GitHubApiError("github_unavailable", "GitHub could not satisfy the requested data", 502);
  }
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
  if (retryAfter !== null) {
    const normalizedRetryAfter = retryAfter.trim();
    if (/^\d+$/.test(normalizedRetryAfter) || isHttpDate(normalizedRetryAfter, now)) {
      return normalizedRetryAfter;
    }
  }

  const reset = headers.get("x-ratelimit-reset");
  const normalizedReset = reset?.trim() ?? "";
  if (!/^\d+$/.test(normalizedReset)) return null;
  const resetEpoch = Number(normalizedReset);
  if (!Number.isSafeInteger(resetEpoch)) return null;
  const nowEpoch = Math.floor(now.getTime() / 1000);
  return String(Math.max(0, resetEpoch - nowEpoch));
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const LONG_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function isHttpDate(value: string, now: Date): boolean {
  const imf = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(value);
  if (imf) return matchesUtcDate(imf[1]!, imf[4]!, imf[3]!, imf[2]!, imf[5]!, imf[6]!, imf[7]!);

  const rfc850 = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(value);
  if (rfc850) {
    let year = 2000 + Number(rfc850[4]);
    if (year > now.getUTCFullYear() + 50) year -= 100;
    const weekday = SHORT_WEEKDAYS[LONG_WEEKDAYS.indexOf(rfc850[1] as typeof LONG_WEEKDAYS[number])];
    return matchesUtcDate(weekday!, String(year), rfc850[3]!, rfc850[2]!, rfc850[5]!, rfc850[6]!, rfc850[7]!);
  }

  const asctime = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (?:(\d{2})| (\d)) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/.exec(value);
  return Boolean(asctime && matchesUtcDate(
    asctime[1]!, asctime[8]!, asctime[2]!, asctime[3] ?? asctime[4]!, asctime[5]!, asctime[6]!, asctime[7]!,
  ));
}

function matchesUtcDate(
  weekday: string,
  yearText: string,
  monthText: string,
  dayText: string,
  hourText: string,
  minuteText: string,
  secondText: string,
): boolean {
  const year = Number(yearText);
  const month = MONTHS.indexOf(monthText as typeof MONTHS[number]);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 0 || hour > 23 || minute > 59 || second > 60) return false;

  const date = new Date(Date.UTC(year, month, day, hour, minute, Math.min(second, 59)));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === Math.min(second, 59)
    && SHORT_WEEKDAYS[date.getUTCDay()] === weekday;
}

function requiredMetric(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new GitHubApiError("invalid_response", `GitHub returned an invalid ${key} metric`);
  }
  return value;
}

interface PublicContributionPage {
  readonly year: number;
  readonly days: ContributionDay[];
  readonly mix: { commits: number; issues: number; pullRequests: number; reviews: number };
}

function parsePublicContributionPage(html: string, expectedYear: number): PublicContributionPage {
  const dayPattern = /<td\b([^>]*\bdata-date="(\d{4}-\d{2}-\d{2})"[^>]*)><\/td>\s*<tool-tip\b[^>]*>([\s\S]*?)<\/tool-tip>/g;
  const days: ContributionDay[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(dayPattern)) {
    const attributes = match[1] ?? "";
    const date = match[2] ?? "";
    if (!date.startsWith(`${expectedYear}-`)) continue;
    if (seen.has(date)) throw new GitHubApiError("invalid_response", "GitHub returned duplicate public contribution days");
    const levelMatch = /\bdata-level="([0-4])"/.exec(attributes);
    if (!levelMatch) throw new GitHubApiError("invalid_response", "GitHub returned a public contribution day without an intensity");
    const tooltip = stripHtml(decodeHtml(match[3] ?? "")).trim();
    const countMatch = /^(?:No contributions|([\d,]+) contributions?)\s+on\b/.exec(tooltip);
    if (!countMatch) throw new GitHubApiError("invalid_response", "GitHub returned an unrecognized public contribution count");
    const count = countMatch[1] ? Number(countMatch[1].replaceAll(",", "")) : 0;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new GitHubApiError("invalid_response", "GitHub returned an invalid public contribution count");
    }
    seen.add(date);
    days.push({ date, count, level: Number(levelMatch[1]) });
  }
  const expectedDates = datesInYear(expectedYear);
  if (days.length !== expectedDates.length || expectedDates.some((date) => !seen.has(date))) {
    throw new GitHubApiError("invalid_response", "GitHub returned an incomplete public contribution year");
  }

  const mixMatch = /\bdata-percentages="([^"]+)"/.exec(html);
  if (!mixMatch) {
    const total = days.reduce((sum, day) => sum + day.count, 0);
    if (total === 0) {
      return {
        year: expectedYear,
        days,
        mix: { commits: 0, issues: 0, pullRequests: 0, reviews: 0 },
      };
    }
    throw new GitHubApiError("invalid_response", "GitHub returned no public activity breakdown");
  }
  let rawMix: unknown;
  try {
    rawMix = JSON.parse(decodeHtml(mixMatch[1] ?? ""));
  } catch {
    throw new GitHubApiError("invalid_response", "GitHub returned an invalid public activity breakdown");
  }
  if (!isRecord(rawMix)) throw new GitHubApiError("invalid_response", "GitHub returned an invalid public activity breakdown");
  const mix = {
    commits: publicPercentage(rawMix, "Commits"),
    issues: publicPercentage(rawMix, "Issues"),
    pullRequests: publicPercentage(rawMix, "Pull requests"),
    reviews: publicPercentage(rawMix, "Code review"),
  };
  const totalPercentage = Object.values(mix).reduce((sum, value) => sum + value, 0);
  if (totalPercentage < 99 || totalPercentage > 101) {
    throw new GitHubApiError("invalid_response", "GitHub returned an inconsistent public activity breakdown");
  }
  return { year: expectedYear, days, mix };
}

function datesInYear(year: number): string[] {
  const dates: string[] = [];
  const date = new Date(Date.UTC(year, 0, 1));
  while (date.getUTCFullYear() === year) {
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
}

function weightedPublicActivityMix(
  pages: readonly PublicContributionPage[],
  from: string,
  to: string,
): PublicContributionPage["mix"] {
  const weighted = { commits: 0, issues: 0, pullRequests: 0, reviews: 0 };
  let total = 0;
  for (const page of pages) {
    const pageTotal = page.days
      .filter((day) => day.date >= from && day.date <= to)
      .reduce((sum, day) => sum + day.count, 0);
    total += pageTotal;
    weighted.commits += pageTotal * page.mix.commits;
    weighted.issues += pageTotal * page.mix.issues;
    weighted.pullRequests += pageTotal * page.mix.pullRequests;
    weighted.reviews += pageTotal * page.mix.reviews;
  }
  if (total === 0) return { commits: 0, issues: 0, pullRequests: 0, reviews: 0 };
  return {
    commits: Number((weighted.commits / total).toFixed(1)),
    issues: Number((weighted.issues / total).toFixed(1)),
    pullRequests: Number((weighted.pullRequests / total).toFixed(1)),
    reviews: Number((weighted.reviews / total).toFixed(1)),
  };
}

function publicPercentage(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new GitHubApiError("invalid_response", `GitHub returned an invalid ${key} activity percentage`);
  }
  return value;
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
}

function contributionLevel(value: unknown): number {
  const levels: Readonly<Record<string, number>> = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
  };
  return typeof value === "string" ? levels[value] ?? 0 : 0;
}

function assertRequestedContributionWindow(
  calendarDays: readonly ContributionDay[],
  to: Date,
  requestedDays: number,
): void {
  const available = new Set(calendarDays.map(({ date }) => date));
  const end = to.toISOString().slice(0, 10);
  if (calendarDays.some(({ date }) => date > end)) {
    throw new GitHubApiError("invalid_response", "GitHub returned a contribution day after the requested end date");
  }
  const first = new Date(to);
  first.setUTCDate(first.getUTCDate() - (requestedDays - 1));
  for (let offset = 0; offset < requestedDays; offset += 1) {
    const expected = new Date(first);
    expected.setUTCDate(expected.getUTCDate() + offset);
    if (!available.has(expected.toISOString().slice(0, 10))) {
      throw new GitHubApiError("invalid_response", "GitHub returned an incomplete contribution window");
    }
  }
  // The window starts on `to - (requestedDays - 1)` inclusive, so a complete
  // window holds exactly the requested UTC day count. Anything longer means a
  // duplicated or out-of-window day survived filtering.
  if (calendarDays.length !== requestedDays) {
    throw new GitHubApiError("invalid_response", "GitHub returned more contribution days than the requested window");
  }
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
            contributionDays { date contributionCount contributionLevel }
          }
        }
      }
    }
  }
`;
