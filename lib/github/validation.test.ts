import assert from "node:assert/strict";
import test from "node:test";
import {
  InputError,
  parseGitHubHandle,
  parseLifecycleMap,
  parseRepositoryNames,
  rejectUnknownParameters,
  safeHttpsUrl,
} from "./validation";

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

test("rejects unknown query parameters", () => {
  const query = new URLSearchParams("user=octocat&token=secret");
  assert.throws(() => rejectUnknownParameters(query, ["user"]), /token/);
});

test("permits only bounded HTTPS links", () => {
  assert.equal(safeHttpsUrl("https://example.com/docs"), "https://example.com/docs");
  assert.equal(safeHttpsUrl("http://example.com"), null);
  assert.equal(safeHttpsUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpsUrl("https://token@example.com/docs"), null);
});
