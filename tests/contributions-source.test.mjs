import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/v1/contributions/route";
import { GitHubClient } from "@/lib/github/client";
import { withWorkerEnv } from "@/lib/runtime-env";

// Run with: npx tsx --test tests/contributions-source.test.mjs
// Labels are observed through real HTTP cache headers: jsonResponse maps
// publicData true to `public, max-age=60, s-maxage=<edgeSeconds>` and
// publicData false to `private, no-store`.

// A token exported in the developer shell must not flip the branches under test.
delete process.env.GITHUB_TOKEN;

const PUBLIC_CACHE = "public, max-age=60, s-maxage=3600";
const PRIVATE_CACHE = "private, no-store";

function stubContributionFetches(overrides) {
  const originals = {
    fetchContributions: GitHubClient.prototype.fetchContributions,
    fetchPublicProfileContributions: GitHubClient.prototype.fetchPublicProfileContributions,
  };
  if (overrides.fetchContributions !== undefined) {
    GitHubClient.prototype.fetchContributions = overrides.fetchContributions;
  }
  if (overrides.fetchPublicProfileContributions !== undefined) {
    GitHubClient.prototype.fetchPublicProfileContributions =
      overrides.fetchPublicProfileContributions;
  }
  return () => {
    GitHubClient.prototype.fetchContributions = originals.fetchContributions;
    GitHubClient.prototype.fetchPublicProfileContributions =
      originals.fetchPublicProfileContributions;
  };
}

function unexpectedLiveCall(name) {
  return async () => {
    throw new Error(`${name} must not run on this branch`);
  };
}

test("demo=true takes the publicData true path without touching the live client", async () => {
  const restore = stubContributionFetches({
    fetchContributions: unexpectedLiveCall("fetchContributions"),
    fetchPublicProfileContributions: unexpectedLiveCall("fetchPublicProfileContributions"),
  });
  try {
    const response = await withWorkerEnv(
      { GITHUB_TOKEN: "" },
      () => GET(new Request("https://example.test/api/v1/contributions?user=octocat&demo=true")),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), PUBLIC_CACHE);
    const payload = await response.json();
    assert.equal(payload.freshness?.mode, "demo");
    assert.equal(payload.freshness?.source, "synthetic-demo");
  } finally {
    restore();
  }
});

test("authed live (demo=false with token) takes the publicData false path", async () => {
  const sentinel = { version: 1, login: "octocat", marker: "live-contributions-sentinel" };
  const seen = [];
  let publicProfileCalls = 0;
  const restore = stubContributionFetches({
    fetchContributions: async (login, days) => {
      seen.push([login, days]);
      return sentinel;
    },
    fetchPublicProfileContributions: async () => {
      publicProfileCalls += 1;
      throw new Error("fetchPublicProfileContributions must not run when a token is configured");
    },
  });
  try {
    const response = await withWorkerEnv(
      { GITHUB_TOKEN: "test-token" },
      () => GET(new Request("https://example.test/api/v1/contributions?user=octocat&demo=false")),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), sentinel);
    assert.deepEqual(seen, [["octocat", 365]]);
    assert.equal(publicProfileCalls, 0);
    assert.equal(response.headers.get("cache-control"), PRIVATE_CACHE);
  } finally {
    restore();
  }
});

test("public contributions responses carry the 3600s edge window", async () => {
  const restore = stubContributionFetches({
    fetchContributions: unexpectedLiveCall("fetchContributions"),
    fetchPublicProfileContributions: unexpectedLiveCall("fetchPublicProfileContributions"),
  });
  try {
    const response = await withWorkerEnv(
      { GITHUB_TOKEN: "" },
      () => GET(new Request("https://example.test/api/v1/contributions?user=octocat&demo=true&days=30")),
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /s-maxage=3600/);
    assert.equal(response.headers.get("cache-control"), PUBLIC_CACHE);
  } finally {
    restore();
  }
});
