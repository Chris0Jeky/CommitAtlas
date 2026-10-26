import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

for (const verifierStatus of [0, 1]) {
  test(`deploy drains its receipt before verification exits ${verifierStatus}`, { timeout: 10_000 }, async (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), "commitatlas-deploy-output-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const scripts = path.join(directory, "scripts");
    const bin = path.join(directory, "bin");
    mkdirSync(scripts);
    mkdirSync(bin);
    for (const file of ["deploy.mjs", "deploy-identity.mjs", "deployed-origin.mjs"]) {
      copyFileSync(new URL(`../scripts/${file}`, import.meta.url), path.join(scripts, file));
    }
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
    const pathKey = Object.keys(env).find((name) => name.toLowerCase() === "path") ?? "PATH";
    const git = (...args) => {
      const result = spawnSync("git", args, { cwd: directory, env, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    git("init", "--quiet");
    git("-c", "user.name=CommitAtlas fixture", "-c", "user.email=fixture@example.test",
      "commit", "--allow-empty", "--quiet", "-m", "deployment output fixture");
    const sha = git("rev-parse", "HEAD");
    const reportedOrigin = "https://new-worker.fixture.workers.dev";
    const overrideOrigin = "https://custom.fixture.test";
    const stdoutReport = "WRANGLER-STDOUT-START\n" + "table row\n".repeat(40_000) +
      `Deployed fixture triggers (1.0 sec)\n  ${reportedOrigin}\nCurrent Version ID: ${VERSION}\nWRANGLER-STDOUT-END\n`;
    const stderrReport = "WRANGLER-STDERR-START\n" + "diagnostic row\n".repeat(20_000) + "WRANGLER-STDERR-END\n";
    const wrangler = path.join(directory, "wrangler-fixture.mjs");
    writeFileSync(wrangler, `import { writeFileSync } from "node:fs";
      writeFileSync(1, ${JSON.stringify(stdoutReport)});
      writeFileSync(2, ${JSON.stringify(stderrReport)});\n`);
    if (process.platform === "win32") {
      writeFileSync(path.join(bin, "npx.cmd"), `@echo off\r\n"${process.execPath}" "${wrangler}" %*\r\n`);
    } else {
      const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
      writeFileSync(path.join(bin, "npx"), `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(wrangler)} "$@"\n`, { mode: 0o755 });
    }
    writeFileSync(path.join(scripts, "verify-deployment.mjs"), `import { writeFileSync } from "node:fs";
      writeFileSync("verifier-argv.json", JSON.stringify(process.argv.slice(2)));
      console.log("VERIFIER-START");
      process.exit(${verifierStatus});\n`);
    const summary = path.join(directory, "summary.txt");
    const child = spawn(process.execPath, [path.join(scripts, "deploy.mjs"), "--skip-build"], {
      cwd: directory,
      env: { ...env, [pathKey]: `${bin}${path.delimiter}${env[pathKey] ?? ""}`, DEPLOY_BASE_URL: overrideOrigin,
        GITHUB_STEP_SUMMARY: summary },
      stdio: ["ignore", "pipe", "pipe"],
    });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    const stdout = [];
    const stderr = [];
    for (const [stream, chunks] of [[child.stdout, stdout], [child.stderr, stderr]]) {
      stream.on("data", (chunk) => {
        chunks.push(chunk);
        // A slow pipe models CI log collection and forces writes to queue.
        stream.pause();
        setTimeout(() => stream.resume(), 5);
      });
    }
    const [code, signal] = await once(child, "close");
    assert.equal(signal, null);
    assert.equal(code, verifierStatus);
    const output = Buffer.concat(stdout).toString("utf8");
    const errors = Buffer.concat(stderr).toString("utf8");
    assert.ok(output.includes(stdoutReport), "the complete Wrangler report must reach stdout");
    assert.ok(errors.includes(stderrReport), "the complete Wrangler diagnostics must reach stderr");
    const receipt = `Commit SHA: ${sha}\nWorker version ID: ${VERSION}\n`;
    assert.ok(output.includes(receipt), "the deployment receipt must reach stdout");
    assert.ok(output.includes(`note: verifying DEPLOY_BASE_URL (${overrideOrigin}) rather than the reported ${reportedOrigin}.`));
    assert.ok(output.indexOf(receipt) < output.indexOf("VERIFIER-START"), "the receipt must precede verifier output");
    assert.deepEqual(JSON.parse(readFileSync(path.join(directory, "verifier-argv.json"), "utf8")),
      [overrideOrigin, "--expected-sha", sha]);
    assert.equal(readFileSync(summary, "utf8"), `\n${receipt}\n`);
    if (verifierStatus !== 0) assert.match(errors, /deployment verification failed with exit code 1/);
  });
}
