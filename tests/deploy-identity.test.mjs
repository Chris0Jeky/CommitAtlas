import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { formatDeploymentIdentity, readCheckoutSha } from "../scripts/deploy-identity.mjs";

const SHA = "a".repeat(40);
const VERSION = "168ef4e0-0862-4eed-b9ba-d144fe281832";

test("build identity reads the exact checkout and ignores workflow SHA claims", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "commitatlas-build-identity-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const runGit = (...args) => {
    const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  runGit("init", "--quiet");
  runGit("-c", "user.name=CommitAtlas fixture", "-c", "user.email=fixture@example.test",
    "commit", "--allow-empty", "--quiet", "-m", "synthetic build identity fixture");
  const expected = runGit("rev-parse", "HEAD");
  const previous = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = "f".repeat(40);
  t.after(() => {
    if (previous === undefined) delete process.env.GITHUB_SHA;
    else process.env.GITHUB_SHA = previous;
  });
  assert.equal(readCheckoutSha(directory), expected);

  const nested = path.join(directory, "archive-without-git");
  mkdirSync(nested);
  assert.equal(readCheckoutSha(nested), null, "an enclosing repository must not name an extracted build");

  const worktree = path.join(directory, "linked-worktree");
  runGit("worktree", "add", "--detach", "--quiet", worktree, "HEAD");
  assert.equal(readCheckoutSha(worktree), expected, "a linked worktree has its own checkout root");
});

test("build identity stays unavailable for an archive or unborn checkout", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "commitatlas-build-identity-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  assert.equal(readCheckoutSha(directory), null);
  assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: directory }).status, 0);
  assert.equal(readCheckoutSha(directory), null);
});

for (const target of ["checkout", "archive"]) {
  test(`build identity ignores Git repository overrides for the ${target}`, (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), "commitatlas-build-override-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const source = path.join(directory, "source");
    const other = path.join(directory, "other");
    mkdirSync(source);
    mkdirSync(other);
    const cleanEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
    const git = (cwd, ...args) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8", env: cleanEnvironment });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    const initialize = (cwd, message) => {
      git(cwd, "init", "--quiet");
      git(cwd, "-c", "user.name=CommitAtlas fixture", "-c", "user.email=fixture@example.test",
        "commit", "--allow-empty", "--quiet", "-m", message);
      return git(cwd, "rev-parse", "HEAD");
    };
    const unrelated = initialize(other, "unrelated repository");
    const expected = target === "checkout" ? initialize(source, "intended source checkout") : null;
    assert.notEqual(expected, unrelated);
    const overrides = { GIT_DIR: path.join(other, ".git"), GIT_WORK_TREE: source };
    const previous = Object.fromEntries(Object.keys(overrides).map(name => [name, process.env[name]]));
    Object.assign(process.env, overrides);
    t.after(() => {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    });
    assert.equal(readCheckoutSha(source), expected);
    for (const [name, value] of Object.entries(overrides)) assert.equal(process.env[name], value);
  });
}

test("deploy refuses unavailable checkout identity before invoking deployment tools", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "commitatlas-deploy-identity-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const scripts = path.join(directory, "scripts");
  mkdirSync(scripts);
  for (const file of ["deploy.mjs", "deploy-identity.mjs", "deployed-origin.mjs"]) {
    copyFileSync(new URL(`../scripts/${file}`, import.meta.url), path.join(scripts, file));
  }
  // No Git or deployment tools are available in this fixture; GITHUB_SHA is not proof.
  const result = spawnSync(process.execPath, [path.join(scripts, "deploy.mjs"), "--skip-build"], {
    cwd: directory, encoding: "utf8", env: { ...process.env, PATH: directory, GITHUB_SHA: SHA },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires a valid commit SHA from this Git checkout/);
  assert.doesNotMatch(result.stdout, /deploying to Cloudflare/);
});

test("formats the commit and Wrangler version for the log and step summary", () => {
  assert.equal(
    formatDeploymentIdentity(` ${SHA}\n`, `Uploaded commit-atlas\r\n\u001b[32mCurrent Version ID: ${VERSION}\u001b[0m\r\n`),
    `Commit SHA: ${SHA}\nWorker version ID: ${VERSION}\n`,
  );
});

test("reports missing identity as unknown rather than guessing from unrelated output", () => {
  assert.equal(
    formatDeploymentIdentity(undefined, `notice: ${VERSION}\nCurrent Version ID: invalid`),
    "Commit SHA: unknown\nWorker version ID: unknown\n",
  );
  assert.equal(
    formatDeploymentIdentity("bad\nInjected summary", ""),
    "Commit SHA: unknown\nWorker version ID: unknown\n",
  );
});
