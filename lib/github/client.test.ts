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
              weeks: [{ contributionDays: [{ date: "2026-08-19", contributionCount: 2 }] }],
            },
          },
        },
      },
    });
  };

  const contributions = await new GitHubClient({ token: "server-secret", fetchImpl, now: () => NOW }).fetchContributions("octocat", 1);
  assert.match(graphQlBody, /hasAnyRestrictedContributions/);
  assert.match(graphQlBody, /restrictedContributionsCount/);
  assert.equal(JSON.parse(graphQlBody).variables.to, NOW.toISOString());
  assert.equal(contributions.totalContributions, 2);
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

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
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
