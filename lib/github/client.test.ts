import assert from "node:assert/strict";
import test from "node:test";
import { GitHubApiError, GitHubClient } from "./client";

const NOW = new Date("2026-08-19T00:00:00.000Z");
const LIFECYCLES = new Map([["atlas", "active" as const], ["old", "maintenance" as const]]);
const WORKFLOWS = new Map([["atlas", "ci.yml"], ["old", "ci.yml"]]);

test("normalizes a public profile without inventing contribution data", async () => {
  const calls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url);
    if (url.pathname === "/users/octocat") {
      return json({
        login: "octocat",
        name: "The Octocat",
        html_url: "https://github.com/octocat",
        public_repos: 2,
        followers: 10,
        following: 3,
      });
    }
    return json([
      { stargazers_count: 5, forks_count: 2, language: "TypeScript", pushed_at: "2026-08-18T10:00:00Z" },
      { stargazers_count: 7, forks_count: 1, language: "Python", pushed_at: "2026-08-17T10:00:00Z" },
    ]);
  };

  const profile = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat");
  assert.equal(profile.stars, 12);
  assert.equal(profile.forks, 3);
  assert.deepEqual(profile.primaryLanguages.map((language) => language.name), ["Python", "TypeScript"]);
  assert.equal(profile.freshness.mode, "live");
  assert.ok(calls.every((url) => url.origin === "https://api.github.com"));
  assert.deepEqual(calls.map((url) => url.pathname).sort(), ["/users/octocat", "/users/octocat/repos"]);
});

test("requires a server-side token for contribution calendars", async () => {
  await assert.rejects(
    new GitHubClient({ now: () => NOW }).fetchContributions("octocat"),
    (error: unknown) => error instanceof GitHubApiError && error.code === "token_required",
  );
});

test("reads the credential-free public profile calendar and labelled activity percentages", async () => {
  const calls: { url: URL; authorization: string | null }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push({ url, authorization: new Headers(init?.headers).get("authorization") });
    return html(publicContributionHtml(2026, {
      "2026-08-17": 3,
      "2026-08-18": 0,
      "2026-08-19": 7,
    }, { Commits: 70, "Pull requests": 15, Issues: 10, "Code review": 5 }));
  };

  const contributions = await new GitHubClient({
    token: "must-not-leave-process",
    fetchImpl,
    now: () => NOW,
  }).fetchPublicProfileContributions("octocat", 3);

  assert.deepEqual(calls.map(({ url }) => url.origin), ["https://github.com"]);
  assert.equal(calls[0]?.url.pathname, "/users/octocat/contributions");
  assert.equal(calls[0]?.authorization, null);
  assert.equal(contributions.totalContributions, 10);
  assert.equal(contributions.breakdownBasis, "public-profile-percentages");
  assert.deepEqual(
    { commits: contributions.commits, pullRequests: contributions.pullRequests, issues: contributions.issues, reviews: contributions.reviews },
    { commits: 70, pullRequests: 15, issues: 10, reviews: 5 },
  );
  assert.deepEqual(contributions.days.map(({ date, count }) => ({ date, count })), [
    { date: "2026-08-17", count: 3 },
    { date: "2026-08-18", count: 0 },
    { date: "2026-08-19", count: 7 },
  ]);
  assert.equal(contributions.freshness.source, "github-profile-html");
});

test("fails closed when GitHub public contribution markup is incomplete", async () => {
  await assert.rejects(
    new GitHubClient({
      fetchImpl: async () => html('<div data-percentages="{&quot;Commits&quot;:100,&quot;Pull requests&quot;:0,&quot;Issues&quot;:0,&quot;Code review&quot;:0}"></div>'),
      now: () => NOW,
    }).fetchPublicProfileContributions("octocat", 1),
    (error: unknown) => error instanceof GitHubApiError && error.code === "invalid_response",
  );
});

test("accepts a complete zero public profile calendar when GitHub omits activity percentages", async () => {
  const body = publicContributionHtml(2026, {}, {
    Commits: 0,
    "Pull requests": 0,
    Issues: 0,
    "Code review": 0,
  }).replace(/ data-percentages="[^"]+"/, "");
  const contributions = await new GitHubClient({
    fetchImpl: async () => html(body),
    now: () => NOW,
  }).fetchPublicProfileContributions("octocat", 3);

  assert.equal(contributions.totalContributions, 0);
  assert.deepEqual(
    { commits: contributions.commits, pullRequests: contributions.pullRequests, issues: contributions.issues, reviews: contributions.reviews },
    { commits: 0, pullRequests: 0, issues: 0, reviews: 0 },
  );
});

test("rejects a nonzero public profile calendar without activity percentages", async () => {
  const body = publicContributionHtml(2026, { "2026-08-19": 1 }, {
    Commits: 100,
    "Pull requests": 0,
    Issues: 0,
    "Code review": 0,
  }).replace(/ data-percentages="[^"]+"/, "");
  await assert.rejects(
    new GitHubClient({ fetchImpl: async () => html(body), now: () => NOW })
      .fetchPublicProfileContributions("octocat", 3),
    (error: unknown) => error instanceof GitHubApiError
      && error.code === "invalid_response"
      && error.message.includes("no public activity breakdown"),
  );
});

test("rejects a zero leap-year page that omits February 29", async () => {
  const leapNow = new Date("2024-03-01T12:00:00.000Z");
  const missingLeapDay = '<td data-date="2024-02-29" data-level="0"></td><tool-tip>No contributions on 2024-02-29.</tool-tip>';
  const body = publicContributionHtml(2024, {}, {
    Commits: 0,
    "Pull requests": 0,
    Issues: 0,
    "Code review": 0,
  }).replace(missingLeapDay, "").replace(/ data-percentages="[^"]+"/, "");

  await assert.rejects(
    new GitHubClient({ fetchImpl: async () => html(body), now: () => leapNow })
      .fetchPublicProfileContributions("octocat", 1),
    (error: unknown) => error instanceof GitHubApiError
      && error.code === "invalid_response"
      && error.message.includes("incomplete public contribution year"),
  );
});

test("weights public activity percentages across a year boundary", async () => {
  const yearBoundary = new Date("2026-01-02T09:00:00.000Z");
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const year = Number(url.searchParams.get("from")?.slice(0, 4));
    return year === 2025
      ? html(publicContributionHtml(2025, { "2025-12-31": 10 }, { Commits: 100, "Pull requests": 0, Issues: 0, "Code review": 0 }))
      : html(publicContributionHtml(2026, { "2026-01-01": 10 }, { Commits: 0, "Pull requests": 0, Issues: 100, "Code review": 0 }));
  };
  const value = await new GitHubClient({ fetchImpl, now: () => yearBoundary })
    .fetchPublicProfileContributions("octocat", 3);
  assert.deepEqual(value.days.map(({ date }) => date), ["2025-12-31", "2026-01-01", "2026-01-02"]);
  assert.equal(value.commits, 50);
  assert.equal(value.issues, 50);
});

test("exposes only a scope-proven public contribution calendar", async () => {
  let graphQlBody = "";
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer server-secret");
      return json({}, 200, { "x-oauth-scopes": "public_repo" });
    }
    graphQlBody = String(init?.body);
    return json({
      data: {
        user: {
          contributionsCollection: {
            totalCommitContributions: 2,
            totalIssueContributions: 1,
            totalPullRequestContributions: 1,
            totalPullRequestReviewContributions: 1,
            hasAnyRestrictedContributions: false,
            restrictedContributionsCount: 0,
            contributionCalendar: {
              weeks: [{ contributionDays: [
                { date: "2026-08-18", contributionCount: 0, contributionLevel: "NONE" },
                { date: "2026-08-19", contributionCount: 2, contributionLevel: "SECOND_QUARTILE" },
              ] }],
            },
          },
        },
      },
    });
  };

  const contributions = await new GitHubClient({ token: "server-secret", fetchImpl, now: () => NOW }).fetchContributions("octocat", 1);
  assert.match(graphQlBody, /hasAnyRestrictedContributions/);
  assert.match(graphQlBody, /restrictedContributionsCount/);
  assert.match(graphQlBody, /contributionLevel/);
  assert.equal(JSON.parse(graphQlBody).variables.to, NOW.toISOString());
  assert.equal(contributions.totalContributions, 2);
  assert.deepEqual(contributions.days, [{ date: "2026-08-19", count: 2, level: 2 }]);
  assert.equal(contributions.freshness.generatedAt, NOW.toISOString());
  assert.equal("restrictedContributions" in contributions, false);
});

test("rejects a contribution window that ends before the requested UTC date", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return json({}, 200, { "x-oauth-scopes": "" });
    return json({
      data: { user: { contributionsCollection: {
        totalCommitContributions: 1,
        totalIssueContributions: 0,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        hasAnyRestrictedContributions: false,
        restrictedContributionsCount: 0,
        contributionCalendar: { weeks: [{ contributionDays: [
          { date: "2026-08-16", contributionCount: 0 },
          { date: "2026-08-17", contributionCount: 0 },
          { date: "2026-08-18", contributionCount: 1 },
        ] }] },
      } } },
    });
  };
  await assert.rejects(
    new GitHubClient({ token: "ghp_public-only", fetchImpl, now: () => NOW }).fetchContributions("octocat", 3),
    (error: unknown) => error instanceof GitHubApiError && error.code === "invalid_response",
  );
});

test("rejects future contribution days even when the requested window is complete", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return json({}, 200, { "x-oauth-scopes": "" });
    return json({
      data: { user: { contributionsCollection: {
        totalCommitContributions: 0,
        totalIssueContributions: 0,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        hasAnyRestrictedContributions: false,
        restrictedContributionsCount: 0,
        contributionCalendar: { weeks: [{ contributionDays: [
          { date: "2026-08-16", contributionCount: 0 },
          { date: "2026-08-17", contributionCount: 0 },
          { date: "2026-08-18", contributionCount: 0 },
          { date: "2026-08-19", contributionCount: 0 },
          { date: "2026-08-20", contributionCount: 0 },
        ] }] },
      } } },
    });
  };
  await assert.rejects(
    new GitHubClient({ token: "ghp_public-only", fetchImpl, now: () => NOW }).fetchContributions("octocat", 3),
    (error: unknown) => error instanceof GitHubApiError && error.code === "invalid_response",
  );
});

test("accepts complete zero contribution days across a leap day", async () => {
  const leapNow = new Date("2024-03-01T12:00:00.000Z");
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return json({}, 200, { "x-oauth-scopes": "" });
    return json({
      data: { user: { contributionsCollection: {
        totalCommitContributions: 0,
        totalIssueContributions: 0,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        hasAnyRestrictedContributions: false,
        restrictedContributionsCount: 0,
        contributionCalendar: { weeks: [{ contributionDays: [
          { date: "2024-02-28", contributionCount: 0 },
          { date: "2024-02-29", contributionCount: 0 },
          { date: "2024-03-01", contributionCount: 0 },
        ] }] },
      } } },
    });
  };
  const contributions = await new GitHubClient({ token: "ghp_public-only", fetchImpl, now: () => leapNow }).fetchContributions("octocat", 3);
  assert.equal(contributions.totalContributions, 0);
  assert.deepEqual(contributions.days.map(({ date }) => date), ["2024-02-28", "2024-02-29", "2024-03-01"]);
});

test("rejects contribution tokens without explicit public-only classic scopes before GraphQL", async () => {
  for (const scopes of [null, "repo", "read:user", "public_repo, repo"]) {
    let graphQlRequests = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/rate_limit") {
        return json({}, 200, scopes === null ? {} : { "x-oauth-scopes": scopes });
      }
      graphQlRequests += 1;
      return json({});
    };
    await assert.rejects(
      new GitHubClient({ token: "server-secret", fetchImpl, now: () => NOW }).fetchContributions("octocat"),
      (error: unknown) => error instanceof GitHubApiError && error.code === "private_data" && error.status === 403,
    );
    assert.equal(graphQlRequests, 0);
  }
});

test("rejects repo-scoped or missing-scope tokens before every public resource lookup", async () => {
  for (const scopes of ["repo", null]) {
    const calls: string[] = [];
    const client = new GitHubClient({
      token: "server-secret",
      fetchImpl: async (input) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        calls.push(url.pathname);
        if (url.pathname === "/rate_limit") return json({}, 200, scopes === null ? {} : { "x-oauth-scopes": scopes });
        assert.fail(`unsafe credential reached GitHub resource ${url.pathname}`);
      },
      now: () => NOW,
    });

    for (const lookup of [
      () => client.fetchProfile("guessed-private"),
      () => client.fetchProjects("acme", ["guessed-private"], new Map([["guessed-private", "active"]])),
      () => client.fetchContributions("guessed-private"),
    ]) {
      await assert.rejects(lookup(), (error: unknown) => error instanceof GitHubApiError && error.code === "private_data" && error.status === 403);
    }
    assert.deepEqual(calls, ["/rate_limit"]);
  }
});

test("caches a public-scope proof while permitting token-backed REST resources", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url.pathname);
    if (url.pathname === "/rate_limit") return json({}, 200, { "x-oauth-scopes": "public_repo" });
    if (url.pathname === "/users/octocat") {
      return json({ login: "octocat", public_repos: 0, followers: 0, following: 0 });
    }
    if (url.pathname.endsWith("/repos")) return json([]);
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  };

  await new GitHubClient({ token: "server-secret", fetchImpl, now: () => NOW }).fetchProfile("octocat");
  assert.deepEqual(calls.sort(), ["/rate_limit", "/users/octocat", "/users/octocat/repos"]);
});

test("accepts empty classic scope evidence only for documented OAuth token prefixes", async () => {
  for (const token of ["ghp_public-only", "gho_public-only"]) {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      calls.push(url.pathname);
      if (url.pathname === "/rate_limit") return json({}, 200, { "x-oauth-scopes": "" });
      if (url.pathname === "/users/octocat") return json({ login: "octocat", public_repos: 0, followers: 0, following: 0 });
      if (url.pathname.endsWith("/repos")) return json([]);
      assert.fail(`unexpected GitHub route: ${url.pathname}`);
    };
    await new GitHubClient({ token, fetchImpl, now: () => NOW }).fetchProfile("octocat");
    assert.deepEqual(calls.sort(), ["/rate_limit", "/users/octocat", "/users/octocat/repos"]);
  }
});

test("rejects empty scope evidence for fine-grained, App, unknown, and missing-scope credentials", async () => {
  for (const token of ["github_pat_private", "ghu_user", "ghs_server", "ghr_refresh", "server-secret"]) {
    const calls: string[] = [];
    const client = new GitHubClient({
      token,
      fetchImpl: async (input) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        calls.push(url.pathname);
        if (url.pathname === "/rate_limit") return json({}, 200, { "x-oauth-scopes": "" });
        assert.fail(`unsafe empty-scope credential reached GitHub resource ${url.pathname}`);
      },
      now: () => NOW,
    });
    await assert.rejects(
      client.fetchProfile("guessed-private"),
      (error: unknown) => error instanceof GitHubApiError && error.code === "private_data" && error.status === 403,
    );
    assert.deepEqual(calls, ["/rate_limit"]);
  }
});

test("rejects contribution collections that report restricted activity", async () => {
  for (const restricted of [
    { hasAnyRestrictedContributions: true, restrictedContributionsCount: 0 },
    { hasAnyRestrictedContributions: false, restrictedContributionsCount: 1 },
  ]) {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/rate_limit") return json({}, 200, { "x-oauth-scopes": "" });
      return json({
        data: {
          user: {
            contributionsCollection: {
              totalCommitContributions: 0,
              totalIssueContributions: 0,
              totalPullRequestContributions: 0,
              totalPullRequestReviewContributions: 0,
              ...restricted,
              contributionCalendar: { weeks: [{ contributionDays: [{ date: "2026-08-18", contributionCount: 0 }] }] },
            },
          },
        },
      });
    };
    await assert.rejects(
      new GitHubClient({ token: "ghp_public-only", fetchImpl, now: () => NOW }).fetchContributions("octocat"),
      (error: unknown) => error instanceof GitHubApiError && error.code === "private_data" && error.status === 403,
    );
  }
});

test("rejects private repository responses instead of projecting them", async () => {
  const fetchImpl: typeof fetch = async () => json({ private: true });
  await assert.rejects(
    new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects("acme", ["private-repo"], new Map([["private-repo", "active"]])),
    (error: unknown) => error instanceof GitHubApiError && error.code === "private_data" && error.status === 403,
  );
});

test("maps exact workflow evidence and missing releases honestly", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/repos/acme/atlas") {
      return json({
        name: "atlas",
        description: "Maps the work",
        html_url: "https://github.com/acme/atlas",
        homepage: "javascript:alert(1)",
        archived: false,
        language: "TypeScript",
        stargazers_count: 21,
        forks_count: 4,
        open_issues_count: 3,
        pushed_at: "2026-08-18T00:00:00Z",
        default_branch: "main",
        license: { spdx_id: "NOASSERTION" },
      });
    }
    if (url.pathname.endsWith("/releases/latest")) return json({}, 404);
    if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) {
      return json({
        workflow_runs: [{
          status: "completed",
          conclusion: "success",
          updated_at: "2026-08-18T23:00:00Z",
          html_url: "https://github.com/acme/atlas/actions/runs/1",
          head_sha: "abc123",
        }],
      });
    }
    return json({}, 500);
  };

  const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects(
    "acme",
    ["atlas"],
    LIFECYCLES,
    WORKFLOWS,
  );
  assert.equal(board.projects[0].lifecycle, "active");
  assert.equal(board.projects[0].ci.state, "passing");
  assert.equal(board.projects[0].release, null);
  assert.equal(board.projects[0].websiteUrl, null);
  assert.equal(board.projects[0].license, null);
});

test("marks old successful CI as stale", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/repos/acme/old") {
      return json({
        name: "old",
        html_url: "https://github.com/acme/old",
        default_branch: "main",
        stargazers_count: 0,
        forks_count: 0,
        open_issues_count: 0,
      });
    }
    if (url.pathname.endsWith("/releases/latest")) return json({}, 404);
    return json({
      workflow_runs: [{ status: "completed", conclusion: "success", updated_at: "2025-01-01T00:00:00Z" }],
    });
  };
  const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects("acme", ["old"], LIFECYCLES, WORKFLOWS);
  assert.equal(board.projects[0].ci.state, "stale");
});

test("leaves CI unconfigured without inspecting arbitrary repository workflows", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url.pathname);
    if (url.pathname === "/repos/acme/atlas") return json(projectRepository("atlas"));
    if (url.pathname.endsWith("/releases/latest")) return json({}, 404);
    assert.fail(`unexpected workflow lookup: ${url.pathname}`);
  };
  const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects(
    "acme",
    ["atlas"],
    new Map([["atlas", "active"]]),
  );
  assert.equal(board.projects[0].ci.state, "unconfigured");
  assert.equal(board.projects[0].ci.workflow, null);
  assert.equal(calls.some((path) => path.includes("/actions/")), false);
});

test("queries only the configured workflow rather than the repository-wide runs endpoint", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url.pathname);
    if (url.pathname === "/repos/acme/atlas") return json(projectRepository("atlas"));
    if (url.pathname.endsWith("/releases/latest")) return json({}, 404);
    if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) {
      return json({ workflow_runs: [{ status: "completed", conclusion: "success", updated_at: "2026-08-18T23:00:00Z" }] });
    }
    assert.fail(`unexpected workflow lookup: ${url.pathname}`);
  };
  const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects(
    "acme",
    ["atlas"],
    new Map([["atlas", "active"]]),
    new Map([["atlas", "ci.yml"]]),
  );
  assert.equal(board.projects[0].ci.state, "passing");
  assert.equal(board.projects[0].ci.workflow, "ci.yml");
  assert.equal(calls.some((path) => path.endsWith("/actions/runs")), false);
  assert.equal(calls.includes("/repos/acme/atlas/actions/workflows/ci.yml/runs"), true);
});

test("reports a declared but unavailable workflow as unavailable", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/repos/acme/atlas") return json(projectRepository("atlas"));
    if (url.pathname.endsWith("/releases/latest")) return json({}, 404);
    if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) return json({}, 404);
    assert.fail(`unexpected lookup: ${url.pathname}`);
  };
  const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects(
    "acme",
    ["atlas"],
    new Map([["atlas", "active"]]),
    new Map([["atlas", "ci.yml"]]),
  );
  assert.equal(board.projects[0].ci.state, "unavailable");
  assert.equal(board.projects[0].ci.workflow, "ci.yml");
});

test("rejects malformed required metrics rather than treating them as zero", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    return url.pathname.endsWith("/repos")
      ? json([])
      : json({ login: "octocat", public_repos: "not-a-number", followers: 1, following: 2 });
  };
  await assert.rejects(
    new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat"),
    (error: unknown) => error instanceof GitHubApiError && error.code === "invalid_response",
  );
});

test("rejects oversized GitHub names, descriptions, languages, and release metadata", async () => {
  const profileFetch: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname.endsWith("/repos")) return json([]);
    return json({ login: "octocat", name: "x".repeat(201), public_repos: 0, followers: 0, following: 0 });
  };
  await assert.rejects(
    new GitHubClient({ fetchImpl: profileFetch, now: () => NOW }).fetchProfile("octocat"),
    isInvalidResponse,
  );

  for (const fields of [
    { description: "x".repeat(501) },
    { language: "😀".repeat(81) },
  ]) {
    await assert.rejects(
      new GitHubClient({ fetchImpl: projectTextFetch(fields), now: () => NOW }).fetchProjects("acme", ["atlas"], new Map([["atlas", "active"]])),
      isInvalidResponse,
    );
  }

  await assert.rejects(
    new GitHubClient({
      fetchImpl: projectTextFetch({}, {
        html_url: "https://github.com/acme/atlas/releases/tag/v1",
        published_at: "2026-08-18T00:00:00Z",
        tag_name: "x".repeat(201),
        assets: [],
      }),
      now: () => NOW,
    }).fetchProjects("acme", ["atlas"], new Map([["atlas", "active"]])),
    isInvalidResponse,
  );
});

test("prefers upstream Retry-After for 403 rate limits", async () => {
  const fetchImpl: typeof fetch = async () => new Response(null, {
    status: 403,
    headers: { "retry-after": "17", "x-ratelimit-reset": "9999999999" },
  });
  await assert.rejects(
    new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat"),
    (error: unknown) => {
      assert.ok(error instanceof GitHubApiError);
      assert.equal(error.code, "github_rate_limited");
      assert.equal(error.status, 429);
      assert.equal(error.retryAfter, "17");
      return true;
    },
  );
});

test("accepts each HTTP Retry-After form", async () => {
  for (const retryAfter of [
    "Wed, 21 Oct 2015 07:28:00 GMT",
    "Sunday, 06-Nov-94 08:49:37 GMT",
    "Sun Nov  6 08:49:37 1994",
  ]) {
    const fetchImpl: typeof fetch = async () => new Response(null, {
      status: 429,
      headers: { "retry-after": retryAfter },
    });
    await assert.rejects(
      new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat"),
      (error: unknown) => error instanceof GitHubApiError && error.retryAfter === retryAfter,
    );
  }
});

test("rejects malformed Retry-After values and uses a valid reset fallback", async () => {
  for (const retryAfter of [
    "soon",
    "12.5",
    "-1",
    "Sun, 31 Feb 2026 00:00:00 GMT",
    "Mon, 21 Oct 2015 07:28:00 GMT",
  ]) {
    const fetchImpl: typeof fetch = async () => new Response(null, {
      status: 429,
      headers: {
        "retry-after": retryAfter,
        "x-ratelimit-reset": String(NOW.getTime() / 1000 + 45),
      },
    });
    await assert.rejects(
      new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat"),
      (error: unknown) => error instanceof GitHubApiError && error.retryAfter === "45",
    );
  }
});

test("converts the x-ratelimit-reset epoch to a 429 retry delta", async () => {
  const fetchImpl: typeof fetch = async () => new Response(null, {
    status: 429,
    headers: { "x-ratelimit-reset": String(NOW.getTime() / 1000 + 45) },
  });
  await assert.rejects(
    new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat"),
    (error: unknown) => {
      assert.ok(error instanceof GitHubApiError);
      assert.equal(error.code, "github_rate_limited");
      assert.equal(error.status, 429);
      assert.equal(error.retryAfter, "45");
      return true;
    },
  );
});

test("clamps past reset epochs to zero for 403 and 429 rate limits", async () => {
  for (const status of [403, 429]) {
    const fetchImpl: typeof fetch = async () => new Response(null, {
      status,
      headers: { "x-ratelimit-reset": String(NOW.getTime() / 1000 - 45) },
    });
    await assert.rejects(
      new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat"),
      (error: unknown) => {
        assert.ok(error instanceof GitHubApiError);
        assert.equal(error.code, "github_rate_limited");
        assert.equal(error.status, 429);
        assert.equal(error.retryAfter, "0");
        return true;
      },
    );
  }
});

test("omits malformed x-ratelimit-reset retry hints", async () => {
  for (const reset of ["not-an-epoch", "123.5", "-1", "999999999999999999999"]) {
    const fetchImpl: typeof fetch = async () => new Response(null, {
      status: 429,
      headers: { "x-ratelimit-reset": reset },
    });
    await assert.rejects(
      new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat"),
      (error: unknown) => {
        assert.ok(error instanceof GitHubApiError);
        assert.equal(error.retryAfter, null);
        return true;
      },
    );
  }
});

test("enforces the response limit for chunked bodies without Content-Length", async () => {
  const oversizedJson = JSON.stringify({ payload: "x".repeat(1_500_000) });
  const fetchImpl: typeof fetch = async () => streamedJson(oversizedJson);
  await assert.rejects(
    new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat"),
    (error: unknown) => error instanceof GitHubApiError && error.code === "invalid_response",
  );
});

test("applies one deadline across all GitHub calls", async () => {
  const fetchImpl: typeof fetch = async () => new Promise<Response>(() => undefined);
  await assert.rejects(
    new GitHubClient({ fetchImpl, deadlineMs: 5 }).fetchProfile("octocat"),
    (error: unknown) => error instanceof GitHubApiError && error.code === "github_unavailable",
  );
});

test("bounds concurrent project lookups below the Worker connection limit", async () => {
  let activeRepositoryLookups = 0;
  let peakRepositoryLookups = 0;
  const lifecycles = new Map([
    ["one", "active" as const],
    ["two", "active" as const],
    ["three", "maintenance" as const],
  ]);
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (/^\/repos\/acme\/(one|two|three)$/.test(url.pathname)) {
      activeRepositoryLookups += 1;
      peakRepositoryLookups = Math.max(peakRepositoryLookups, activeRepositoryLookups);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeRepositoryLookups -= 1;
      return json({
        name: url.pathname.split("/").at(-1),
        html_url: `https://github.com${url.pathname}`,
        default_branch: "main",
        stargazers_count: 0,
        forks_count: 0,
        open_issues_count: 0,
      });
    }
    if (url.pathname.endsWith("/releases/latest")) return json({}, 404);
    return json({ workflow_runs: [] });
  };
  const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects(
    "acme",
    ["one", "two", "three"],
    lifecycles,
  );
  assert.equal(board.projects.length, 3);
  assert.equal(peakRepositoryLookups, 2);
});

test("returns one non-disclosing not-found contract for every missing public resource", async () => {
  const notFound: typeof fetch = async () => json({ message: "Not Found" }, 404);
  const contracts: { code: string; status: number; message: string; retryAfter: string | null }[] = [];
  for (const lookup of [
    () => new GitHubClient({ fetchImpl: notFound, now: () => NOW }).fetchProfile("unknown-user"),
    () => new GitHubClient({ fetchImpl: notFound, now: () => NOW })
      .fetchProjects("acme", ["unknown-repo"], new Map([["unknown-repo", "active" as const]])),
    // A repository that exists privately answers with the same upstream 404 as
    // one that does not exist, so both must produce the identical contract.
    () => new GitHubClient({ fetchImpl: notFound, now: () => NOW })
      .fetchProjects("acme", ["private-repo"], new Map([["private-repo", "active" as const]])),
    () => new GitHubClient({ fetchImpl: async () => html("Not Found", 404), now: () => NOW })
      .fetchPublicProfileContributions("unknown-user", 7),
    // The token-backed GraphQL path reports an unknown login as a partial
    // HTTP 200 answer rather than a 404, and must land on the same contract.
    () => new GitHubClient({
      token: "ghp_public-only",
      fetchImpl: graphqlFetch(graphqlNotFoundPayload("unknown-user")),
      now: () => NOW,
    }).fetchContributions("unknown-user", 7),
  ]) {
    await assert.rejects(lookup(), (error: unknown) => {
      assert.ok(error instanceof GitHubApiError);
      contracts.push({ code: error.code, status: error.status, message: error.message, retryAfter: error.retryAfter });
      return true;
    });
  }
  assert.equal(contracts.length, 5);
  for (const contract of contracts) {
    assert.deepEqual(contract, {
      code: "github_not_found",
      status: 404,
      message: "No public GitHub resource matched this request",
      retryAfter: null,
    });
  }
  assert.equal(contracts.every((contract) => !/private|exists|unknown-repo|private-repo|unknown-user/i.test(contract.message)), true);
});

test("recognizes the partial GraphQL not-found answer before the generic error path", async () => {
  const contributions = (payload: unknown) =>
    new GitHubClient({ token: "ghp_public-only", fetchImpl: graphqlFetch(payload), now: () => NOW })
      .fetchContributions("unknown-user", 7);

  // The live API answers an unknown login with HTTP 200 carrying BOTH a null
  // user and a NOT_FOUND error entry. A fixture with only the null user would
  // never exercise the generic error path this has to run ahead of.
  const contracts: string[] = [];
  for (const payload of [graphqlNotFoundPayload("unknown-user"), { data: { user: null } }]) {
    await assert.rejects(contributions(payload), (error: unknown) => {
      assert.ok(error instanceof GitHubApiError);
      contracts.push(JSON.stringify({ code: error.code, status: error.status, message: error.message, retryAfter: error.retryAfter }));
      // The upstream message quotes the probed login; ours must not.
      assert.doesNotMatch(error.message, /unknown-user|resolve|login/i);
      return true;
    });
  }
  assert.equal(new Set(contracts).size, 1);
  assert.equal(
    contracts[0],
    JSON.stringify({ code: "github_not_found", status: 404, message: "No public GitHub resource matched this request", retryAfter: null }),
  );

  for (const [label, payload] of [
    ["non-not-found error", { data: { user: null }, errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded" }] }],
    ["mixed errors", { data: { user: null }, errors: [{ type: "NOT_FOUND" }, { type: "SERVICE_UNAVAILABLE" }] }],
    ["error with a resolved user", { data: { user: { contributionsCollection: null } }, errors: [{ type: "SERVICE_UNAVAILABLE" }] }],
  ] as const) {
    await assert.rejects(contributions(payload), (error: unknown) => {
      assert.ok(error instanceof GitHubApiError, label);
      assert.equal(error.code, "github_unavailable", label);
      assert.equal(error.status, 502, label);
      return true;
    });
  }
});

test("keeps rate-limit and upstream-outage semantics distinct from not found", async () => {
  const reset = String(NOW.getTime() / 1000 + 30);
  for (const [status, code, errorStatus, retryAfter] of [
    [404, "github_not_found", 404, null],
    [500, "github_unavailable", 502, "30"],
    [502, "github_unavailable", 502, "30"],
    [403, "github_rate_limited", 429, "30"],
    [429, "github_rate_limited", 429, "30"],
  ] as const) {
    const fetchImpl: typeof fetch = async () => new Response(null, { status, headers: { "x-ratelimit-reset": reset } });
    await assert.rejects(
      new GitHubClient({ fetchImpl, now: () => NOW }).fetchProfile("octocat"),
      (error: unknown) => {
        assert.ok(error instanceof GitHubApiError, `status ${status}`);
        assert.equal(error.code, code, `status ${status}`);
        assert.equal(error.status, errorStatus, `status ${status}`);
        assert.equal(error.retryAfter, retryAfter, `status ${status}`);
        return true;
      },
    );
  }
});

test("treats only 404 as an absent optional release or workflow run", async () => {
  const optionalPath = (pathname: string): boolean =>
    pathname.endsWith("/releases/latest") || pathname.endsWith("/actions/workflows/ci.yml/runs");
  const optionalFetch = (optional: () => Response): typeof fetch => async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/repos/acme/atlas") return json(projectRepository("atlas"));
    if (optionalPath(url.pathname)) return optional();
    assert.fail(`unexpected lookup: ${url.pathname}`);
  };
  const board = await new GitHubClient({ fetchImpl: optionalFetch(() => json({ message: "Not Found" }, 404)), now: () => NOW })
    .fetchProjects("acme", ["atlas"], new Map([["atlas", "active"]]), new Map([["atlas", "ci.yml"]]));
  assert.equal(board.projects[0].release, null);
  assert.equal(board.projects[0].ci.state, "unavailable");
  assert.equal(board.projects[0].ci.label, "CI unavailable");

  for (const [status, retryAfterHeader, expectedRetryAfter] of [
    [403, { "x-ratelimit-reset": String(NOW.getTime() / 1000 + 30) }, "30"],
    [429, { "retry-after": "31" }, "31"],
  ] as const) {
    await assert.rejects(
      new GitHubClient({
        fetchImpl: optionalFetch(() => new Response(null, { status, headers: retryAfterHeader })),
        now: () => NOW,
      }).fetchProjects("acme", ["atlas"], new Map([["atlas", "active"]]), new Map([["atlas", "ci.yml"]])),
      (error: unknown) => {
        assert.ok(error instanceof GitHubApiError, `status ${status}`);
        assert.equal(error.code, "github_rate_limited", `status ${status}`);
        assert.equal(error.status, 429, `status ${status}`);
        assert.equal(error.retryAfter, expectedRetryAfter, `status ${status}`);
        return true;
      },
    );
  }
});

test("reports missing or non-array workflow_runs as unavailable rather than unconfigured", async () => {
  for (const body of [
    {},
    { workflow_runs: null },
    { workflow_runs: "boom" },
    { workflow_runs: { 0: { status: "completed", conclusion: "success", updated_at: "2026-08-18T23:00:00Z" } } },
    { workflow_runs: [] },
    { workflow_runs: ["not-a-run"] },
  ]) {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/repos/acme/atlas") return json(projectRepository("atlas"));
      if (url.pathname.endsWith("/releases/latest")) return json({}, 404);
      if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) return json(body);
      assert.fail(`unexpected lookup: ${url.pathname}`);
    };
    const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects(
      "acme",
      ["atlas"],
      new Map([["atlas", "active"]]),
      new Map([["atlas", "ci.yml"]]),
    );
    const label = JSON.stringify(body);
    assert.equal(board.projects[0].ci.state, "unavailable", label);
    assert.equal(board.projects[0].ci.label, "CI unavailable", label);
    assert.notEqual(board.projects[0].ci.state, "unconfigured", label);
    assert.equal(board.projects[0].ci.checkedAt, null, label);
    assert.equal(board.freshness.mode, "partial", label);
  }
});

test("returns exactly the requested inclusive UTC contribution window", async () => {
  for (const requestedDays of [1, 7, 30]) {
    // GitHub may answer with a wider calendar than the request; the window is
    // defined by the request, not by whatever the upstream page happens to hold.
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/rate_limit") return json({}, 200, { "x-oauth-scopes": "" });
      const { variables } = JSON.parse(String(init?.body)) as { variables: { from: string } };
      const start = new Date(variables.from);
      start.setUTCDate(start.getUTCDate() - 4);
      const contributionDays = Array.from({ length: requestedDays + 4 }, (_, offset) => {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + offset);
        return { date: date.toISOString().slice(0, 10), contributionCount: 1 };
      });
      return json({ data: { user: { contributionsCollection: {
        totalCommitContributions: 1,
        totalIssueContributions: 0,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        hasAnyRestrictedContributions: false,
        restrictedContributionsCount: 0,
        contributionCalendar: { weeks: [{ contributionDays }] },
      } } } });
    };
    const snapshot = await new GitHubClient({ token: "ghp_public-only", fetchImpl, now: () => NOW })
      .fetchContributions("octocat", requestedDays);
    assert.equal(snapshot.days.length, requestedDays, `graphql days=${requestedDays}`);
    assert.equal(snapshot.days.at(-1)?.date, "2026-08-19", `graphql days=${requestedDays}`);
    assert.equal(snapshot.days[0]?.date, inclusiveWindowStart(NOW, requestedDays), `graphql days=${requestedDays}`);
    assert.equal(snapshot.totalContributions, requestedDays, `graphql days=${requestedDays}`);
  }

  for (const requestedDays of [1, 7, 30]) {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const year = Number(url.searchParams.get("from")?.slice(0, 4));
      return html(fullYearContributionHtml(year));
    };
    const snapshot = await new GitHubClient({ fetchImpl, now: () => NOW })
      .fetchPublicProfileContributions("octocat", requestedDays);
    assert.equal(snapshot.days.length, requestedDays, `html days=${requestedDays}`);
    assert.equal(snapshot.days.at(-1)?.date, "2026-08-19", `html days=${requestedDays}`);
    assert.equal(snapshot.days[0]?.date, inclusiveWindowStart(NOW, requestedDays), `html days=${requestedDays}`);
  }
});

function inclusiveWindowStart(to: Date, requestedDays: number): string {
  const start = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (requestedDays - 1));
  return start.toISOString().slice(0, 10);
}

function fullYearContributionHtml(year: number): string {
  return publicContributionHtml(
    year,
    Object.fromEntries(datesInYear(year).map((date) => [date, 1])),
    { Commits: 100, "Pull requests": 0, Issues: 0, "Code review": 0 },
  );
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

/** The exact partial answer api.github.com/graphql returns for an unknown login. */
function graphqlNotFoundPayload(login: string): Record<string, unknown> {
  return {
    data: { user: null },
    errors: [{
      type: "NOT_FOUND",
      path: ["user"],
      locations: [{ line: 3, column: 5 }],
      message: `Could not resolve to a User with the login of '${login}'.`,
    }],
  };
}

function graphqlFetch(payload: unknown): typeof fetch {
  return async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return json({}, 200, { "x-oauth-scopes": "" });
    return json(payload);
  };
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function html(body: string, status = 200, headers: HeadersInit = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

function publicContributionHtml(
  year: number,
  counts: Readonly<Record<string, number>>,
  mix: Readonly<Record<"Commits" | "Pull requests" | "Issues" | "Code review", number>>,
): string {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const cells: string[] = [];
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10);
    const count = counts[day] ?? 0;
    const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 9 ? 3 : 4;
    const label = count === 0 ? `No contributions on ${day}.` : `${count.toLocaleString("en-US")} contribution${count === 1 ? "" : "s"} on ${day}.`;
    cells.push(`<td data-date="${day}" data-level="${level}"></td><tool-tip>${label}</tool-tip>`);
  }
  const encodedMix = JSON.stringify(mix).replaceAll('"', "&quot;");
  return `<div data-percentages="${encodedMix}">${cells.join("")}</div>`;
}

function projectRepository(name: string): Record<string, unknown> {
  return {
    name,
    html_url: `https://github.com/acme/${name}`,
    default_branch: "main",
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
  };
}

function projectTextFetch(repositoryFields: Record<string, unknown>, release: Record<string, unknown> | null = null): typeof fetch {
  return async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/repos/acme/atlas") return json({ ...projectRepository("atlas"), ...repositoryFields });
    if (url.pathname.endsWith("/releases/latest")) return release ? json(release) : json({}, 404);
    assert.fail(`unexpected lookup: ${url.pathname}`);
  };
}

function isInvalidResponse(error: unknown): boolean {
  return error instanceof GitHubApiError && error.code === "invalid_response";
}

function streamedJson(body: string): Response {
  const encoded = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < encoded.byteLength; offset += 32_768) {
        controller.enqueue(encoded.slice(offset, offset + 32_768));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/json" } });
}
