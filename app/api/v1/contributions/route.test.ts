import assert from "node:assert/strict";
import test from "node:test";
import { GitHubClient } from "@/lib/github/client";
import { demoContributions } from "@/lib/github/demo";
import { GET } from "./route";

const PUBLIC_CACHE_CONTROL = /^public, max-age=60, s-maxage=3600$/;

async function withGitHubToken<T>(token: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.GITHUB_TOKEN;
  if (token === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = token;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous;
  }
}

test("serves automatic demo windows trimmed to the observed history", async () => {
  const response = await GET(new Request("https://example.test/api/v1/contributions?user=octocat&demo=true&days=auto"));
  assert.equal(response.status, 200);
  const payload = await response.json() as { days: { date: string; count: number }[]; totalContributions: number };
  assert.equal(payload.days.length, 730);
  assert.equal(payload.days.at(-1)?.date, new Date().toISOString().slice(0, 10));
  assert.equal(payload.totalContributions, payload.days.reduce((sum, day) => sum + day.count, 0));
});

test("serves two-year demo windows and rejects wider ones", async () => {
  const response = await GET(new Request("https://example.test/api/v1/contributions?user=octocat&demo=true&days=730"));
  assert.equal(response.status, 200);
  const payload = await response.json() as { days: unknown[] };
  assert.equal(payload.days.length, 730);
});

test("rejects contribution windows outside one week to two years", async () => {
  for (const days of ["6", "731"]) {
    const response = await GET(new Request(`https://example.test/api/v1/contributions?user=octocat&demo=true&days=${days}`));
    assert.equal(response.status, 400);
    const payload = await response.json() as { error?: { code?: string; message?: string } };
    assert.equal(payload.error?.code, "invalid_input");
    assert.match(payload.error?.message ?? "", /days must be an integer from 7 to 730/);
  }
});

test("marks demo contributions as publicly cacheable", async () => {
  await withGitHubToken(undefined, async () => {
    const response = await GET(new Request("https://example.test/api/v1/contributions?user=octocat&demo=true&days=7"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Cache-Control") ?? "", /^public/);
    assert.match(response.headers.get("Cache-Control") ?? "", PUBLIC_CACHE_CONTROL);
  });
});

test("never marks token-backed contributions as public", async (t) => {
  const fetched = t.mock.method(GitHubClient.prototype, "fetchContributions", async (login: string, days: number | "auto") =>
    demoContributions(login, days === "auto" ? 7 : days));
  const profileFetched = t.mock.method(GitHubClient.prototype, "fetchPublicProfileContributions", async (login: string, days: number | "auto") =>
    demoContributions(login, days === "auto" ? 7 : days));
  await withGitHubToken("test-token-not-real", async () => {
    const response = await GET(new Request("https://example.test/api/v1/contributions?user=octocat&days=7"));
    assert.equal(response.status, 200);
    assert.equal(fetched.mock.callCount(), 1, "token-backed request must use the authenticated fetch");
    assert.equal(profileFetched.mock.callCount(), 0, "token-backed request must not use the public profile fetch");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.doesNotMatch(response.headers.get("Cache-Control") ?? "", /public/);
  });
});

test("marks non-demo contributions without a token as publicly cacheable", async (t) => {
  const profileFetched = t.mock.method(GitHubClient.prototype, "fetchPublicProfileContributions", async (login: string, days: number | "auto") =>
    demoContributions(login, days === "auto" ? 7 : days));
  const fetched = t.mock.method(GitHubClient.prototype, "fetchContributions", async (login: string, days: number | "auto") =>
    demoContributions(login, days === "auto" ? 7 : days));
  await withGitHubToken(undefined, async () => {
    const response = await GET(new Request("https://example.test/api/v1/contributions?user=octocat&days=7"));
    assert.equal(response.status, 200);
    assert.equal(profileFetched.mock.callCount(), 1);
    assert.equal(fetched.mock.callCount(), 0);
    assert.match(response.headers.get("Cache-Control") ?? "", PUBLIC_CACHE_CONTROL);
  });
});
