import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("action keeps delivery credentials optional and exposes generated evidence outputs", async () => {
  const metadata = await readFile(new URL("../action.yml", import.meta.url), "utf8");
  assert.match(metadata, /using: node24/);
  assert.match(metadata, /main: action\/dist\/index\.js/);
  assert.match(metadata, /github-token:\r?\n[\s\S]*?required: false/);
  assert.match(metadata, /dry-run:/);
  for (const output of [
    "manifest", "atlas", "atlas-compact", "atlas-wide", "profile", "streak", "activity", "breakdown",
    "rhythm", "languages", "projects", "cadence", "releases", "delivery", "delivery-json",
    "projects-json", "projects-markdown",
  ]) {
    assert.match(metadata, new RegExp(`  ${output}:`));
  }
});

test("checked bundle contains delivery generation but no source map or token sentinel", async () => {
  const bundle = await readFile(new URL("./dist/index.js", import.meta.url), "utf8");
  assert.match(bundle, /CommitAtlas static portfolio/);
  assert.match(bundle, /Variant/);
  assert.match(bundle, /delivery\.json/);
  assert.match(bundle, /github-token/);
  assert.doesNotMatch(bundle, /must-not-leave-process|sourceMappingURL=/);
});
