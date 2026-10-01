import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

// Keep the explicit, cross-platform npm test list from silently dropping suites.
test("the Studio gate includes every adjacent regression test", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const selected = new Set(pkg.scripts["test:studio"].split(/\s+/));
  const missing = readdirSync(new URL(".", import.meta.url))
    .filter((name) => name.endsWith(".test.ts"))
    .map((name) => `app/studio/${name}`)
    .filter((name) => !selected.has(name));
  assert.deepEqual(missing, [], "Studio regression files missing from test:studio");
});
