import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("action is a credential-free Node 24 generator", async () => {
  const metadata = await readFile(new URL("../action.yml", import.meta.url), "utf8");
  assert.match(metadata, /using: node24/);
  assert.match(metadata, /main: action\/dist\/index\.js/);
  assert.doesNotMatch(metadata, /github-token|token:/i);
  assert.match(metadata, /dry-run:/);
  for (const output of ["manifest", "atlas", "atlas-compact", "atlas-wide", "profile", "streak", "activity", "languages", "projects"]) {
    assert.match(metadata, new RegExp(`  ${output}:`));
  }
});

test("checked bundle contains the static generator but no source map or token sentinel", async () => {
  const bundle = await readFile(new URL("./dist/index.js", import.meta.url), "utf8");
  assert.match(bundle, /CommitAtlas static portfolio/);
  assert.doesNotMatch(bundle, /must-not-leave-process|sourceMappingURL=/);
});
