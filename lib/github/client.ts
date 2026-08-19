import type {
  CiState,
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
  numberField,
  safeHttpsUrl,
  stringField,
} from "./validation";

const API_ORIGIN = "https://api.github.com";
const GRAPHQL_URL = "https://api.github.com/graphql";
const API_VERSION = "2026-03-10";
const MAX_RESPONSE_BYTES = 1_500_000;

export class GitHubApiError extends Error {
  constructor(
    readonly code: "github_unavailable" | "github_rate_limited" | "token_required" | "invalid_response",
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
}

export class GitHubClient {
  private readonly token: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token?.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async fetchProfile(login: string): Promise<ProfileSnapshot> {
    const user = await this.getJson(`/users/${encodeURIComponent(login)}`);
    const repositories = await this.getJson(
      `/users/${encodeURIComponent(login)}/repos?type=owner&sort=updated&per_page=100`,
    );
    if (!isRecord(user) || !Array.isArray(repositories)) {
      throw new GitHubApiError("invalid_response", "GitHub returned an unexpected profile shape");
    }

    const parsedRepositories = repositories.filter(isRecord);
    const languageCounts = new Map<string, number>();
    let stars = 0;
    let forks = 0;
    let latestPushAt: string | null = null;

    for (const repository of parsedRepositories) {
      stars += numberField(repository, "stargazers_count");
      forks += numberField(repository, "forks_count");
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
      publicRepositories: numberField(user, "public_repos"),
      followers: numberField(user, "followers"),
      following: numberField(user, "following"),
      stars,
      forks,
      primaryLanguages: toLanguageSignals(languageCounts),
      latestPushAt,
      repositoriesTruncated: numberField(user, "public_repos") > parsedRepositories.length,
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

    const weeks = Array.isArray(calendar.weeks) ? calendar.weeks.filter(isRecord) : [];
    const contributionDays: ContributionDay[] = [];
    for (const week of weeks) {
      const weekDays = Array.isArray(week.contributionDays)
        ? week.contributionDays.filter(isRecord)
        : [];
      for (const day of weekDays) {
        const date = stringField(day, "date");
        if (date) contributionDays.push({ date, count: numberField(day, "contributionCount") });
      }
    }

    return {
      version: 1,
      login,
      totalContributions: numberField(calendar, "totalContributions"),
      commits: numberField(collection, "totalCommitContributions"),
      issues: numberField(collection, "totalIssueContributions"),
      pullRequests: numberField(collection, "totalPullRequestContributions"),
      reviews: numberField(collection, "totalPullRequestReviewContributions"),
      restrictedContributions: numberField(collection, "restrictedContributionsCount"),
      days: contributionDays.sort((a, b) => a.date.localeCompare(b.date)),
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
    lifecycles: ReadonlyMap<string, ProjectLifecycle> = new Map(),
  ): Promise<ProjectBoardSnapshot> {
    const projects: ProjectSnapshot[] = [];
    for (const repository of repositories) {
      projects.push(await this.fetchProject(owner, repository, lifecycles.get(repository.toLowerCase())));
    }
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
    configuredLifecycle: ProjectLifecycle = "unknown",
  ): Promise<ProjectSnapshot> {
    const repo = await this.getJson(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`);
    if (!isRecord(repo)) throw new GitHubApiError("invalid_response", "GitHub returned an invalid repository");

    const defaultBranch = stringField(repo, "default_branch") ?? "main";
    const release = await this.fetchLatestRelease(owner, repository);
    const ci = await this.fetchLatestRun(owner, repository, defaultBranch);
    const archived = repo.archived === true;
    const license = isRecord(repo.license) ? stringField(repo.license, "spdx_id") : null;

    return {
      repo: `${owner}/${repository}`,
      name: stringField(repo, "name") ?? repository,
      description: stringField(repo, "description"),
      sourceUrl: safeHttpsUrl(repo.html_url) ?? `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
      websiteUrl: safeHttpsUrl(repo.homepage),
      lifecycle: archived ? "archived" : configuredLifecycle,
      primaryLanguage: stringField(repo, "language"),
      stars: numberField(repo, "stargazers_count"),
      forks: numberField(repo, "forks_count"),
      openIssues: numberField(repo, "open_issues_count"),
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
    if (result === null || !isRecord(result)) return unavailableCi();
    const runs = Array.isArray(result.workflow_runs) ? result.workflow_runs.filter(isRecord) : [];
    const run = runs[0];
    if (!run) {
      return { state: "unconfigured", label: "No workflow run", url: null, checkedAt: null, headSha: null };
    }
    const checkedAt = stringField(run, "updated_at");
    const state = mapCiState(stringField(run, "status"), stringField(run, "conclusion"), checkedAt, this.now());
    return {
      state,
      label: ciLabel(state),
      url: safeHttpsUrl(run.html_url),
      checkedAt,
      headSha: stringField(run, "head_sha"),
    };
  }

  private async graphql(query: string, variables: Record<string, string>): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(GRAPHQL_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await this.readResponse(response, false);
    if (!isRecord(payload)) {
      throw new GitHubApiError("invalid_response", "GitHub returned an invalid GraphQL response");
    }
    return payload;
  }

  private async getJson(path: string, allowMissing = false): Promise<unknown> {
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/")) {
      throw new GitHubApiError("invalid_response", "Refused a non-GitHub API target");
    }
    const response = await this.fetchImpl(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
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
        response.headers.get("retry-after") ?? response.headers.get("x-ratelimit-reset"),
      );
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new GitHubApiError("invalid_response", "GitHub response exceeded the allowed size");
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload) && !Array.isArray(payload)) {
      throw new GitHubApiError("invalid_response", "GitHub returned invalid JSON data");
    }
    if (isRecord(payload) && Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw new GitHubApiError("github_unavailable", "GitHub could not satisfy the requested data", 502);
    }
    return payload;
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

function unavailableCi(): ProjectCiSignal {
  return { state: "unavailable", label: "CI unavailable", url: null, checkedAt: null, headSha: null };
}

function mapCiState(status: string | null, conclusion: string | null, checkedAt: string | null, now: Date): CiState {
  if (status === "queued" || status === "requested" || status === "waiting" || status === "pending") return "queued";
  if (status === "in_progress") return "running";
  if (status !== "completed") return "unavailable";
  if (conclusion === "cancelled") return "cancelled";
  if (conclusion === "skipped" || conclusion === "neutral") return "skipped";
  if (conclusion === "stale") return "stale";
  if (["failure", "timed_out", "action_required", "startup_failure"].includes(conclusion ?? "")) return "failing";
  if (conclusion === "success") {
    const age = checkedAt ? now.getTime() - new Date(checkedAt).getTime() : Number.POSITIVE_INFINITY;
    return age > 30 * 24 * 60 * 60 * 1000 ? "stale" : "passing";
  }
  return "unavailable";
}

function ciLabel(state: CiState): string {
  const labels: Record<CiState, string> = {
    passing: "Passing",
    failing: "Failing",
    running: "Running",
    queued: "Queued",
    cancelled: "Cancelled",
    skipped: "Skipped",
    stale: "Stale result",
    unconfigured: "Not configured",
    unavailable: "CI unavailable",
  };
  return labels[state];
}

const CONTRIBUTIONS_QUERY = `
  query CommitAtlasContributions($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays { date contributionCount }
          }
        }
      }
    }
  }
`;
