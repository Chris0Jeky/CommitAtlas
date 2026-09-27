import assert from "node:assert/strict";
import test from "node:test";
import { GitHubClient } from "./client";

const NOW = new Date("2026-08-19T00:00:00.000Z");
const OBSERVED_AT = "2026-08-18T23:00:00Z";

for (const expected of [
  { conclusion: "startup_failure", state: "failing", label: "Failing" },
  { conclusion: "skipped", state: "unavailable", label: "CI unavailable" },
] as const) {
  test(`maps ${expected.conclusion} workflow conclusions honestly`, async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/repos/acme/atlas") return json(projectRepository());
      if (url.pathname.endsWith("/releases/latest")) return json({}, 404);
      if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) {
        return json({ workflow_runs: [{
          status: "completed",
          conclusion: expected.conclusion,
          updated_at: OBSERVED_AT,
        }] });
      }
      assert.fail(`unexpected lookup: ${url.pathname}`);
    };

    const board = await new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects(
      "acme",
      ["atlas"],
      new Map([["atlas", "active"]]),
      new Map([["atlas", "ci.yml"]]),
    );

    assert.equal(board.projects[0]?.ci.state, expected.state);
    assert.equal(board.projects[0]?.ci.label, expected.label);
    assert.equal(board.projects[0]?.ci.checkedAt, OBSERVED_AT);
  });
}

function projectRepository(): Record<string, unknown> {
  return {
    name: "atlas",
    html_url: "https://github.com/acme/atlas",
    private: false,
    archived: false,
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    default_branch: "main",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
