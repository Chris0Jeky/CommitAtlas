import assert from "node:assert/strict";
import test from "node:test";
import { GitHubApiError, GitHubClient } from "./client";

const NOW = new Date("2026-08-19T00:00:00.000Z");
const LIFECYCLES = new Map([["atlas", "active" as const], ["old", "maintenance" as const]]);

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
});

test("requires a server-side token for contribution calendars", async () => {
  await assert.rejects(
    new GitHubClient({ now: () => NOW }).fetchContributions("octocat"),
    (error: unknown) => error instanceof GitHubApiError && error.code === "token_required",
  );
});

test("exposes only the validated public contribution calendar schema", async () => {
  let graphQlBody = "";
  const fetchImpl: typeof fetch = async (_input, init) => {
    graphQlBody = String(init?.body);
    return json({
      data: {
        user: {
          contributionsCollection: {
            totalCommitContributions: 2,
            totalIssueContributions: 1,
            totalPullRequestContributions: 1,
            totalPullRequestReviewContributions: 1,
            restrictedContributionsCount: 99,
            contributionCalendar: {
              totalContributions: 101,
              weeks: [{ contributionDays: [{ date: "2026-08-18", contributionCount: 2 }] }],
            },
          },
        },
      },
    });
  };

  const contributions = await new GitHubClient({ token: "server-secret", fetchImpl, now: () => NOW }).fetchContributions("octocat", 7);
  assert.equal(graphQlBody.includes("restrictedContributionsCount"), false);
  assert.equal(contributions.totalContributions, 2);
  assert.equal("restrictedContributions" in contributions, false);
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
    if (url.pathname.endsWith("/actions/runs")) {
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
  const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects("acme", ["old"], LIFECYCLES);
  assert.equal(board.projects[0].ci.state, "stale");
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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
