import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/v1/profile/route";
import { demoProfile } from "@/lib/github/demo";
import { GitHubClient, type ProfileSnapshot } from "@/lib/github/client";
import { withWorkerEnv } from "@/lib/runtime-env";

const PUBLIC_CACHE = "public, max-age=60, s-maxage=900";

interface ErrorPayload {
  status?: string;
  error?: { code?: string; message?: string };
}

function stubFetchProfile(implementation: (login: string) => Promise<ProfileSnapshot>): () => void {
  const original = GitHubClient.prototype.fetchProfile;
  GitHubClient.prototype.fetchProfile = implementation;
  return () => {
    GitHubClient.prototype.fetchProfile = original;
  };
}

function getProfile(url: string): Promise<Response> {
  return withWorkerEnv({ GITHUB_TOKEN: "" }, () => GET(new Request(url)));
}

test("rejects an unknown query parameter with a bounded 400 naming it", async () => {
  const restore = stubFetchProfile(async () => {
    throw new Error("unknown parameters must be rejected before any fetch");
  });
  try {
    const response = await getProfile("https://example.test/api/v1/profile?user=octocat&bogus=1");

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const payload = (await response.json()) as ErrorPayload;
    assert.equal(payload.status, "error");
    assert.equal(payload.error?.code, "invalid_input");
    assert.match(payload.error?.message ?? "", /bogus/);
  } finally {
    restore();
  }
});

test("rejects an invalid user handle with a bounded 400", async () => {
  const restore = stubFetchProfile(async () => {
    throw new Error("invalid handles must be rejected before any fetch");
  });
  try {
    const response = await getProfile("https://example.test/api/v1/profile?user=not+a+handle!");

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const payload = (await response.json()) as ErrorPayload;
    assert.equal(payload.status, "error");
    assert.equal(payload.error?.code, "invalid_input");
  } finally {
    restore();
  }
});

test("demo=true serves the synthetic demo profile without fetching", async () => {
  let fetchCalls = 0;
  const restore = stubFetchProfile(async () => {
    fetchCalls += 1;
    throw new Error("demo responses must not fetch from GitHub");
  });
  try {
    const response = await getProfile("https://example.test/api/v1/profile?user=octocat&demo=true");

    assert.equal(fetchCalls, 0);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), PUBLIC_CACHE);
    const body = (await response.json()) as ProfileSnapshot;
    const expected = demoProfile("octocat");
    assert.equal(body.login, "octocat");
    assert.equal(body.freshness.mode, "demo");
    assert.equal(body.freshness.source, "synthetic-demo");
    assert.deepEqual(body.primaryLanguages, expected.primaryLanguages);
    assert.equal(body.stars, expected.stars);
    assert.equal(body.profileUrl, expected.profileUrl);
  } finally {
    restore();
  }
});

test("without demo the route delegates to GitHubClient.fetchProfile", async () => {
  const sentinel = { version: 1, login: "octocat", marker: "live-profile-sentinel" };
  const seen: string[] = [];
  const restore = stubFetchProfile(async (login: string) => {
    seen.push(login);
    return sentinel as unknown as ProfileSnapshot;
  });
  try {
    const response = await getProfile("https://example.test/api/v1/profile?user=octocat");

    assert.deepEqual(seen, ["octocat"]);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), PUBLIC_CACHE);
    assert.deepEqual(await response.json(), sentinel);
  } finally {
    restore();
  }
});
