import assert from "node:assert/strict";
import test from "node:test";
import { parseRepositoryNames } from "../dist/index.js";

test("rejects an empty repository segment instead of shortening the list", () => {
  assert.throws(() => parseRepositoryNames("alpha,,beta"), /empty repository name/);
  assert.throws(() => parseRepositoryNames("alpha, ,beta"), /empty repository name/);
  assert.throws(() => parseRepositoryNames("alpha,"), /empty repository name/);
  assert.deepEqual(parseRepositoryNames("alpha, beta.repo"), ["alpha", "beta.repo"]);
  assert.throws(() => parseRepositoryNames(""), /one and six/);
});
