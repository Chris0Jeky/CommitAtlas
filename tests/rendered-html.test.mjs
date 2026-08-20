import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function request(path, extraEnv = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...extraEnv },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the CommitAtlas product surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>CommitAtlas/);
  assert.match(html, /Your GitHub work/);
  assert.match(html, /Project signals/);
  assert.match(html, /GitHub username/);
  assert.match(html, /aria-label="Primary navigation"/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/);
});

test("serves a versioned synthetic profile without a token", async () => {
  const response = await request("/api/v1/profile?user=octocat&demo=true");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  const payload = await response.json();
  assert.equal(payload.version, 1);
  assert.equal(payload.login, "octocat");
  assert.equal(payload.freshness.mode, "demo");
});

test("fails closed on unknown API parameters", async () => {
  const response = await request("/api/v1/profile?user=octocat&token=do-not-accept");
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "invalid_input");
});

test("returns stable conditional ETags for public demo data", async () => {
  const first = await request("/api/v1/contributions?user=octocat&days=7&demo=true");
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "public, max-age=60, s-maxage=3600");
  const etag = first.headers.get("etag");
  assert.ok(etag);
  const payload = await first.json();
  assert.equal(payload.days.length, 7);

  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-etag`);
  const { default: worker } = await import(workerUrl.href);
  const conditional = await worker.fetch(
    new Request("http://localhost/api/v1/contributions?user=octocat&days=7&demo=true", {
      headers: { "if-none-match": etag },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
});

test("fails closed for unsafe or unproven contribution credentials in the built Worker", async () => {
  for (const [scopes, token, expectedStatus] of [
    ["public_repo", "server-secret", 200],
    [null, "server-secret", 403],
    ["repo", "server-secret", 403],
    ["", "github_pat_private", 403],
  ]) {
    const calls = [];
    const response = await withMockedFetch(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      calls.push(url.pathname);
      if (url.pathname === "/rate_limit") {
        return new Response("{}", { headers: scopes === null ? {} : { "x-oauth-scopes": scopes } });
      }
      assert.equal(init?.method, "POST");
      return githubJson(publicContributionPayload());
    }, () => request("/api/v1/contributions?user=octocat&days=7", { GITHUB_TOKEN: token }));
    assert.equal(response.status, expectedStatus);
    assert.equal(response.headers.get("cache-control"), expectedStatus === 200 ? "private, no-store" : "no-store");
    if (expectedStatus === 200) {
      assert.deepEqual(calls, ["/rate_limit", "/graphql"]);
    } else {
      assert.deepEqual(calls, ["/rate_limit"]);
      assert.equal((await response.json()).error.code, "private_data");
    }
  }
});

test("makes token-backed profile and project guesses indistinguishable before GitHub resource lookup", async () => {
  for (const [scopes, token] of [["repo", "server-secret"], [null, "server-secret"], ["", "github_pat_private"]]) {
    const calls = [];
    const responseFor = (path) => withMockedFetch(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      calls.push(url.pathname);
      if (url.pathname === "/rate_limit") {
        return new Response("{}", { headers: scopes === null ? {} : { "x-oauth-scopes": scopes } });
      }
      assert.fail(`unsafe credential reached GitHub resource ${url.pathname}`);
    }, () => request(path, { GITHUB_TOKEN: token }));

    const privateGuess = await responseFor("/api/v1/projects?owner=acme&repos=private-guess&states=private-guess:active");
    const missingGuess = await responseFor("/api/v1/projects?owner=acme&repos=missing-guess&states=missing-guess:active");
    const profileGuess = await responseFor("/api/v1/profile?user=guessed-private");

    for (const response of [privateGuess, missingGuess, profileGuess]) {
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal((await response.json()).error.code, "private_data");
    }
    assert.deepEqual(calls, ["/rate_limit", "/rate_limit", "/rate_limit"]);
  }
});

test("rejects restricted contribution collections in the built Worker", async () => {
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return new Response("{}", { headers: { "x-oauth-scopes": "" } });
    return githubJson(publicContributionPayload({ hasAnyRestrictedContributions: true }));
  }, () => request("/api/v1/contributions?user=octocat&days=7", { GITHUB_TOKEN: "ghp_public-only" }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "private_data");
});

test("uses only aligned configured workflows in the built Worker project route", async () => {
  const configuredCalls = [];
  const configured = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    configuredCalls.push(url.pathname);
    if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
    if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
    if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) return githubJson(workflowRuns("success"));
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:ci.yml"));
  assert.equal(configured.status, 200);
  assert.deepEqual((await configured.json()).projects[0].ci, {
    state: "passing", label: "Passing", workflow: "ci.yml", url: null, checkedAt: "2026-08-18T23:00:00Z", headSha: null,
  });
  assert.equal(configuredCalls.some((path) => path.endsWith("/actions/runs")), false);

  const noWorkflowCalls = [];
  const unconfigured = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    noWorkflowCalls.push(url.pathname);
    if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
    if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active"));
  assert.equal(unconfigured.status, 200);
  assert.equal((await unconfigured.json()).projects[0].ci.state, "unconfigured");
  assert.equal(noWorkflowCalls.some((path) => path.includes("/actions/")), false);

  const wrongWorkflow = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
    if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
    if (url.pathname.endsWith("/actions/workflows/docs.yml/runs")) return githubJson(workflowRuns("failure"));
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:docs.yml"));
  assert.equal(wrongWorkflow.status, 200);
  const wrongPayload = await wrongWorkflow.json();
  assert.equal(wrongPayload.projects[0].ci.workflow, "docs.yml");
  assert.equal(wrongPayload.projects[0].ci.state, "failing");
});

test("rejects path-normalizing workflow identities before the built Worker requests GitHub", async () => {
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    assert.fail(`invalid workflow reached GitHub resource ${url.pathname}`);
  }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:%2E%2E"));

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "invalid_input");
});

test("rejects oversized GitHub text before the built Worker emits a snapshot", async () => {
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/users/octocat") {
      return githubJson({ login: "octocat", name: "x".repeat(201), public_repos: 0, followers: 0, following: 0 });
    }
    if (url.pathname.endsWith("/repos")) return githubJson([]);
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => request("/api/v1/profile?user=octocat"));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "invalid_response");
});

async function withMockedFetch(fetchImpl, operation) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await operation();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function publicContributionPayload(restrictions = {}) {
  return {
    data: {
      user: {
        contributionsCollection: {
          totalCommitContributions: 2,
          totalIssueContributions: 1,
          totalPullRequestContributions: 1,
          totalPullRequestReviewContributions: 1,
          hasAnyRestrictedContributions: false,
          restrictedContributionsCount: 0,
          ...restrictions,
          contributionCalendar: { weeks: [{ contributionDays: [{ date: "2026-08-18", contributionCount: 2 }] }] },
        },
      },
    },
  };
}

function githubJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function publicProjectPayload() {
  return {
    name: "atlas",
    html_url: "https://github.com/acme/atlas",
    default_branch: "main",
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
  };
}

function workflowRuns(conclusion) {
  return {
    workflow_runs: [{ status: "completed", conclusion, updated_at: "2026-08-18T23:00:00Z" }],
  };
}
