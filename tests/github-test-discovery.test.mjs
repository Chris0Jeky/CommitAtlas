import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

// Mirror the Studio discovery guard for the explicit cross-platform route test list.
test("the GitHub gate includes every root route regression suite", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const selected = new Set(pkg.scripts["test:github"].split(/\s+/));
  const missing = readdirSync(new URL(".", import.meta.url))
    .filter((name) => name.endsWith("-route.test.ts"))
    .map((name) => `tests/${name}`)
    .filter((name) => !selected.has(name));
  assert.deepEqual(missing, [], "Route regression files missing from test:github");
});
