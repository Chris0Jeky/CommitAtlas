import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/v1/projects/route";
import { GitHubClient } from "@/lib/github/client";
import { demoProjects } from "@/lib/github/demo";
import { withWorkerEnv } from "@/lib/runtime-env";
import type {
  ProjectBoardSnapshot,
  ProjectLifecycle,
  ProjectWorkflow,
} from "@commit-atlas/github";

interface ErrorPayload {
  status?: string;
  error?: { code?: string; message?: string };
}

async function getProjects(query: string): Promise<Response> {
  return withWorkerEnv(
    { GITHUB_TOKEN: "" },
    () => GET(new Request(`https://example.test/api/v1/projects${query}`)),
  );
}

function assertBoundedInputError(response: Response, body: ErrorPayload): void {
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
  assert.equal(body.status, "error");
  assert.equal(body.error?.code, "invalid_input");
}

test("rejects unknown query parameters with a bounded error", async () => {
  const response = await getProjects(
    "?owner=octocat&repos=atlas&states=atlas:active&demo=true&surprise=1",
  );
  const body = (await response.json()) as ErrorPayload;

  assertBoundedInputError(response, body);
  assert.match(body.error?.message ?? "", /unknown query parameter: surprise/);
});

test("rejects a lifecycle map that does not cover exactly the requested repositories", async () => {
  for (const [states, message] of [
    ["b:done", /states/],
    ["b:active", /exactly one lifecycle/],
  ] as const) {
    const response = await getProjects(`?owner=octocat&repos=a&states=${states}&demo=true`);
    const body = (await response.json()) as ErrorPayload;

    assertBoundedInputError(response, body);
    assert.match(body.error?.message ?? "", message, states);
  }
});

test("rejects a workflow map that names an unrequested repository", async () => {
  const response = await getProjects(
    "?owner=octocat&repos=atlas&states=atlas:active&workflows=other:ci.yml&demo=true",
  );
  const body = (await response.json()) as ErrorPayload;

  assertBoundedInputError(response, body);
  assert.match(body.error?.message ?? "", /requested repositories/);
});

test("serves the demo board without touching the live client", async () => {
  const original = GitHubClient.prototype.fetchProjects;
  GitHubClient.prototype.fetchProjects = async function (): Promise<ProjectBoardSnapshot> {
    throw new Error("live fetchProjects must not run for demo=true");
  };
  try {
    const response = await getProjects(
      "?owner=octocat&repos=atlas,quiet" +
        "&states=atlas:active,quiet:maintenance" +
        "&workflows=atlas:ci.yml&demo=true",
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
    const payload = (await response.json()) as ProjectBoardSnapshot;
    const expected = demoProjects(
      "octocat",
      ["atlas", "quiet"],
      new Map<string, ProjectLifecycle>([
        ["atlas", "active"],
        ["quiet", "maintenance"],
      ]),
      new Map<string, ProjectWorkflow>([["atlas", "ci.yml"]]),
    );

    // generatedAt carries the wall clock, so normalize it before comparing.
    assert.deepEqual(normalizeGeneratedAt(payload), normalizeGeneratedAt(expected));
    assert.equal(payload.freshness.source, "synthetic-demo");
    assert.equal(payload.freshness.mode, "demo");
  } finally {
    GitHubClient.prototype.fetchProjects = original;
  }
});

test("delegates the live path to fetchProjects with the parsed maps", async () => {
  const liveSnapshot: ProjectBoardSnapshot = {
    version: 1,
    owner: "octocat",
    projects: [],
    freshness: {
      generatedAt: "2026-08-20T00:00:00.000Z",
      source: "github-rest",
      mode: "live",
    },
  };
  const calls: Array<{
    owner: string;
    repositories: readonly string[];
    lifecycles: ReadonlyMap<string, ProjectLifecycle>;
    workflows: ReadonlyMap<string, ProjectWorkflow>;
  }> = [];
  const original = GitHubClient.prototype.fetchProjects;
  GitHubClient.prototype.fetchProjects = async function (
    owner: string,
    repositories: readonly string[],
    lifecycles: ReadonlyMap<string, ProjectLifecycle>,
    workflows: ReadonlyMap<string, ProjectWorkflow> = new Map<string, ProjectWorkflow>(),
  ): Promise<ProjectBoardSnapshot> {
    calls.push({ owner, repositories, lifecycles, workflows });
    return liveSnapshot;
  };
  try {
    const response = await getProjects(
      "?owner=octocat&repos=atlas,quiet" +
        "&states=atlas:active,quiet:maintenance" +
        "&workflows=quiet:ci.yml",
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
    assert.deepEqual(await response.json(), liveSnapshot);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.owner, "octocat");
    assert.deepEqual(calls[0]?.repositories, ["atlas", "quiet"]);
    assert.deepEqual(
      [...(calls[0]?.lifecycles ?? [])],
      [
        ["atlas", "active"],
        ["quiet", "maintenance"],
      ],
    );
    assert.deepEqual([...(calls[0]?.workflows ?? [])], [["quiet", "ci.yml"]]);
  } finally {
    GitHubClient.prototype.fetchProjects = original;
  }
});

function normalizeGeneratedAt(snapshot: ProjectBoardSnapshot): ProjectBoardSnapshot {
  return {
    ...snapshot,
    freshness: { ...snapshot.freshness, generatedAt: "normalized" },
  };
}
