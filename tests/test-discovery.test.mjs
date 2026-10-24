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

// Tokenize quoted words before splitting the shell operators used in package scripts.
function scriptSegments(script) {
  const segments = [{ operator: null, tokens: [] }];
  for (const match of script.matchAll(/(?<operator>&&|\|\||;)|(?<word>(?:"[^"]*"|'[^']*'|[^\s"'&|;])+)/g)) {
    const { operator, word } = match.groups;
    if (operator) segments.push({ operator, tokens: [] });
    else segments.at(-1).tokens.push(word.replace(/"([^"]*)"|'([^']*)'/g, (_, double, single) => double ?? single));
  }
  return segments;
}

// Model explicit test runners and npm invocations, not arbitrary shell execution.
// Keys are repository-relative package directories; values are their scripts objects.
export function collectReachableTests(packages) {
  const referenced = new Set();
  const visited = new Set();
  const visit = (dir, script) => {
    const key = `${dir}:${script}`;
    if (visited.has(key)) return;
    const scripts = packages.get(dir);
    if (!scripts || !Object.hasOwn(scripts, script)) {
      throw new Error(`Missing npm script ${script} in ${dir}/package.json`);
    }
    visited.add(key);
    for (const { operator, tokens } of scriptSegments(scripts[script])) {
      // A fallback alone cannot prove that a suite runs on the successful path.
      if (operator === "||") continue;
      while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0] ?? "") || tokens[0] === "cross-env") {
        tokens.shift();
      }
      const isRunner = (["node", "tsx"].includes(tokens[0]) && tokens[1] === "--test")
        || tokens[0] === "vitest";
      if (isRunner) {
        for (const file of tokens.slice(1).filter((token) => /\.test\.[cm]?[jt]sx?$/.test(token))) {
          referenced.add(posix.join(dir, file));
        }
      }
      // npm's forwarded arguments are not proof that the target script uses them.
      if (tokens[0] !== "npm") continue;
      let targetDir = dir;
      let index = 1;
      const prefixed = tokens[index] === "--prefix";
      if (prefixed) {
        targetDir = posix.join(dir, tokens[index + 1]);
        index += 2;
      }
      if (tokens[index] === "run") visit(targetDir, tokens[index + 1]);
      else if (prefixed || tokens[index] === "test") visit(targetDir, tokens[index]);
    }
  };
  visit(".", "check");
  return referenced;
}

test("discovery follows transitive npm run, npm test and && chains", () => {
  const packages = new Map([[".", {
    check: "npm run first && npm test && node --test tests/direct.test.mjs",
    first: "npm run nested",
    nested: "tsx --test tests/nested.test.ts",
    test: "node --test tests/alias.test.mjs",
  }]]);
  assert.deepEqual(collectReachableTests(packages), new Set([
    "tests/nested.test.ts", "tests/alias.test.mjs", "tests/direct.test.mjs",
  ]));
});

for (const [label, check, expected] of [
  ["forwarded npm arguments", "npm run noop -- tests/orphan.test.mjs", []],
  ["non-runner arguments", "node noop.mjs tests/orphan.test.mjs", []],
  ["fallback runner", "node success.mjs || node --test tests/orphan.test.mjs", []],
  ["fallback npm script", "node success.mjs || npm run suite", []],
  ["cross-env npm run", "cross-env MODE=test npm run suite", ["tests/suite.test.mjs"]],
  ["semicolon chain", "node success.mjs; npm run suite", ["tests/suite.test.mjs"]],
  ["quoted operator", 'node --test "tests/a&&b.test.mjs"', ["tests/a&&b.test.mjs"]],
  ["quoted npm argument", 'npm run suite -- "a&&npm run missing"', ["tests/suite.test.mjs"]],
]) {
  test(`discovery handles ${label}`, () => {
    const packages = new Map([[".", {
      check, noop: "node noop.mjs", suite: "node --test tests/suite.test.mjs",
    }]]);
    assert.deepEqual(collectReachableTests(packages), new Set(expected));
  });
}

test("discovery follows wrapped aliases and workspaces after shell operators", () => {
  const packages = new Map([
    [".", { check: 'MODE=test cross-env LABEL="a&&b; c||d" npm test; cross-env MODE=test npm --prefix packages/a run suite', test: "tsx --test tests/root.test.ts" }],
    ["packages/a", { suite: "MODE=test cross-env EXTRA=yes node --test tests/local.test.mjs" }],
  ]);
  assert.deepEqual(collectReachableTests(packages), new Set([
    "tests/root.test.ts", "packages/a/tests/local.test.mjs",
  ]));
});

for (const runner of ["node --test", "tsx --test", "vitest", "vitest run"]) {
  test(`discovery recognizes ${runner} with environment prefixes`, () => {
    const packages = new Map([[".", {
      check: `MODE=test cross-env LABEL='a&&b; c||d' ${runner} tests/suite.test.ts`,
    }]]);
    assert.deepEqual(collectReachableTests(packages), new Set(["tests/suite.test.ts"]));
  });
}

test("discovery resolves prefixed scripts and test paths relative to each package", () => {
  const packages = new Map([
    [".", { check: 'npm --prefix "packages/a" test && npm --prefix packages/b run suite && npm --prefix packages/b suite' }],
    ["packages/a", { test: "npm run suite && npm --prefix ../b run suite", suite: "node --test tests/local.test.mjs" }],
    ["packages/b", { suite: "node --test ./tests/local.test.mjs ../../tests/shared.test.mjs" }],
  ]);
  assert.deepEqual(collectReachableTests(packages), new Set([
    "packages/a/tests/local.test.mjs", "packages/b/tests/local.test.mjs", "tests/shared.test.mjs",
  ]));
});

test("unreachable root and workspace scripts cannot cover test files", () => {
  const packages = new Map([
    [".", { check: "node --test tests/reachable.test.mjs && npm --prefix packages/a run build", unused: "node --test tests/orphan.test.mjs && npm run missing" }],
    ["packages/a", { build: "node build.mjs", test: "node --test tests/orphan.test.mjs" }],
  ]);
  assert.deepEqual(collectReachableTests(packages), new Set(["tests/reachable.test.mjs"]));
});

test("discovery terminates cycles across scripts and packages", () => {
  const packages = new Map([
    [".", { check: "npm run loop && npm --prefix packages/a test", loop: "npm run check && node --test tests/root.test.mjs" }],
    ["packages/a", { test: "npm --prefix ../.. run check && node --test tests/local.test.mjs" }],
  ]);
  assert.deepEqual(collectReachableTests(packages), new Set([
    "tests/root.test.mjs", "packages/a/tests/local.test.mjs",
  ]));
});

for (const [label, packages, message] of [
  ["root check", new Map([[".", {}]]), "Missing npm script check in ./package.json"],
  ["transitive script", new Map([[".", { check: "npm run suite", suite: "npm run missing" }]]), "Missing npm script missing in ./package.json"],
  ["test alias", new Map([[".", { check: "npm test" }]]), "Missing npm script test in ./package.json"],
  ["workspace script", new Map([[".", { check: "npm --prefix packages/a run missing" }], ["packages/a", {}]]), "Missing npm script missing in packages/a/package.json"],
  ["workspace manifest", new Map([[".", { check: "npm --prefix packages/absent test" }]]), "Missing npm script test in packages/absent/package.json"],
]) {
  test(`discovery fails for a missing ${label}`, () => {
    assert.throws(() => collectReachableTests(packages), { message });
  });
}

// CI runs check; deploy also runs build (already reachable via npm test).
// Neither workflow runs an additional test script outside this graph.
// Keep the explicit, cross-platform npm test lists from silently dropping a suite.
test("every tracked test file is reachable from npm run check", () => {
  const packages = new Map();
  for (const manifest of tracked("*package.json").filter((path) => !path.includes("node_modules/"))) {
    const { scripts = {} } = JSON.parse(readFileSync(new URL(manifest, root), "utf8"));
    packages.set(posix.dirname(manifest), scripts);
  }
  const referenced = collectReachableTests(packages);
  const tests = tracked("*.test.*").filter((path) => /\.test\.[cm]?[jt]sx?$/.test(path));
  assert.ok(tests.length > 50, `expected the repository's test files, found ${tests.length}`);
  const missing = tests.filter((path) => !referenced.has(path) && !RUN_ELSEWHERE.has(path));
  assert.deepEqual(missing, [], "test files not reachable from npm run check");
});
