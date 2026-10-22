import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import test from "node:test";

// Suites run by a config file rather than an npm script argument.
const RUN_ELSEWHERE = new Map([
  ["packages/core/core.test.ts", "packages/core/vitest.config.ts include"],
]);

const root = new URL("..", import.meta.url);
const tracked = (pattern) =>
  execFileSync("git", ["ls-files", "-z", "--", pattern], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);

// Keep the explicit, cross-platform npm test lists from silently dropping a suite.
test("every tracked test file is run by an npm script", () => {
  const referenced = new Set();
  for (const manifest of tracked("*package.json").filter((path) => !path.includes("node_modules/"))) {
    const dir = posix.dirname(manifest);
    const { scripts = {} } = JSON.parse(readFileSync(new URL(manifest, root), "utf8"));
    for (const command of Object.values(scripts)) {
      for (const [file] of command.matchAll(/[\w./-]+\.test\.[cm]?[jt]sx?/g)) referenced.add(posix.join(dir, file));
    }
  }
  const tests = tracked("*.test.*").filter((path) => /\.test\.[cm]?[jt]sx?$/.test(path));
  assert.ok(tests.length > 50, `expected the repository's test files, found ${tests.length}`);
  const missing = tests.filter((path) => !referenced.has(path) && !RUN_ELSEWHERE.has(path));
  assert.deepEqual(missing, [], "test files referenced by no npm script");
});
