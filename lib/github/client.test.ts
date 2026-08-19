import assert from "node:assert/strict";
import test from "node:test";
import { GitHubApiError, GitHubClient } from "./client";

const NOW = new Date("2026-08-19T00:00:00.000Z");

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
    new Map([["atlas", "active"]]),
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
      return json({ name: "old", html_url: "https://github.com/acme/old", default_branch: "main" });
    }
    if (url.pathname.endsWith("/releases/latest")) return json({}, 404);
    return json({
      workflow_runs: [{ status: "completed", conclusion: "success", updated_at: "2025-01-01T00:00:00Z" }],
    });
  };
  const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects("acme", ["old"]);
  assert.equal(board.projects[0].ci.state, "stale");
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
