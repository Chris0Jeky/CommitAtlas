import assert from "node:assert/strict";
import test from "node:test";
import {
  InputError,
  MAX_LIFECYCLE_MAP_LENGTH,
  MAX_WORKFLOW_MAP_LENGTH,
  parseGitHubHandle,
  parseLifecycleMap,
  parseRepositoryNames,
  parseWorkflowMap,
  rejectUnknownParameters,
  safeHttpsUrl,
} from "./validation";
import { encodeWorkflowMapComponent } from "./workflow-map";

test("accepts bounded GitHub identifiers", () => {
  assert.equal(parseGitHubHandle("octo-cat"), "octo-cat");
  assert.deepEqual(parseRepositoryNames("alpha, beta.repo, gamma_repo"), [
    "alpha",
    "beta.repo",
    "gamma_repo",
  ]);
});

test("rejects ambiguous and unbounded identifiers", () => {
  assert.throws(() => parseGitHubHandle("-owner"), InputError);
  assert.throws(() => parseRepositoryNames("alpha,ALPHA"), /duplicates/);
  assert.throws(() => parseRepositoryNames("a,b,c,d,e,f,g"), /one and six/);
  assert.throws(() => parseRepositoryNames("../secret"), /invalid/);
});

test("requires an explicit core lifecycle for every requested repository", () => {
  const states = parseLifecycleMap("alpha:active,beta:maintenance,gamma:planned", ["alpha", "beta", "gamma"]);
  assert.equal(states.get("alpha"), "active");
  assert.equal(states.get("beta"), "maintenance");
  assert.equal(states.get("gamma"), "planned");
  assert.throws(() => parseLifecycleMap("alpha:active", ["alpha", "beta"]), /exactly one/);
  assert.throws(() => parseLifecycleMap("alpha:healthy", ["alpha"]), /invalid/);
});

test("accepts the full six-project lifecycle contract while retaining a finite bound", () => {
  const repositories = Array.from({ length: 6 }, (_, index) => `${String.fromCharCode(97 + index)}${"x".repeat(99)}`);
  const value = repositories.map((repository) => `${repository}:maintenance`).join(",");
  assert.equal(value.length, MAX_LIFECYCLE_MAP_LENGTH);
  assert.equal(parseLifecycleMap(value, repositories).size, 6);
  assert.throws(() => parseLifecycleMap("x".repeat(MAX_LIFECYCLE_MAP_LENGTH + 1), repositories), /too long/);
});

test("aligns optional workflow identities to the requested repository subset", () => {
  const workflows = parseWorkflowMap("alpha:ci.yml,gamma:.github/workflows/release.yml", ["alpha", "beta", "gamma"]);
  assert.equal(workflows.get("alpha"), "ci.yml");
  assert.equal(workflows.get("beta"), undefined);
  assert.equal(workflows.get("gamma"), ".github/workflows/release.yml");
  assert.throws(() => parseWorkflowMap("other:ci.yml", ["alpha"]), /requested repositories/);
  assert.throws(() => parseWorkflowMap("alpha:", ["alpha"]), /invalid/);
  assert.throws(() => parseWorkflowMap("alpha:ci.yml,alpha:docs.yml", ["alpha"]), /duplicate/);
  for (const workflow of [".", "..", ".github/../ci.yml", ".github\\..\\ci.yml"]) {
    assert.throws(() => parseWorkflowMap(`alpha:${workflow}`, ["alpha"]), /invalid/);
  }
});

test("round-trips workflow map delimiters and literal escape-looking text", () => {
  const workflow = "ci,release:nightly.yml";
  assert.equal(
    parseWorkflowMap(`alpha:${encodeWorkflowMapComponent(workflow)}`, ["alpha"]).get("alpha"),
    workflow,
  );
  const literal = "encoded-%2C.yml";
  assert.equal(
    parseWorkflowMap(`alpha:${encodeWorkflowMapComponent(literal)}`, ["alpha"]).get("alpha"),
    literal,
  );
  assert.throws(() => parseWorkflowMap("x".repeat(MAX_WORKFLOW_MAP_LENGTH + 1), ["alpha"]), /too long/);
});

test("rejects unknown query parameters", () => {
  const query = new URLSearchParams("user=octocat&token=secret");
  assert.throws(() => rejectUnknownParameters(query, ["user"]), /token/);
  assert.throws(() => rejectUnknownParameters(new URLSearchParams("user=octocat&user=octocat"), ["user"]), /duplicate/);
});

test("permits only bounded HTTPS links", () => {
  assert.equal(safeHttpsUrl("https://example.com/docs"), "https://example.com/docs");
  assert.equal(safeHttpsUrl("http://example.com"), null);
  assert.equal(safeHttpsUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpsUrl("https://token@example.com/docs"), null);
});
