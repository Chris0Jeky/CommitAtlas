import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliUrl = new URL("../dist/cli.js", import.meta.url);
const cliPath = fileURLToPath(cliUrl);

function run(args, cwd) {
  const result = spawnSync(process.execPath, args, {
    cwd, encoding: "utf8", timeout: 15_000, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  return result;
}

test("importing the CLI does not execute it or modify the caller's exit status", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-import-"));
  try {
    const result = run(["--input-type=module", "--eval", `
      const { main } = await import(${JSON.stringify(cliUrl.href)});
      if (typeof main !== "function") throw new Error("CLI main is not exported");
      await new Promise(resolve => setImmediate(resolve));
      console.log("imported");
    `], root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "imported\n");
    assert.equal(result.stderr, "");
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the imported main API rejects invalid arguments without installing a global error handler", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-api-"));
  try {
    const result = run(["--input-type=module", "--eval", `
      import assert from "node:assert/strict";
      const { main } = await import(${JSON.stringify(cliUrl.href)});
      await assert.rejects(main([]), /Usage: commitatlas generate/);
      console.log("handled");
    `], root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "handled\n");
    assert.equal(result.stderr, "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("direct CLI execution retains its bounded error and nonzero exit", () => {
  const result = run([cliPath]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^CommitAtlas: Usage: commitatlas generate \[/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test("a symlinked npm-style CLI entry still executes, including escaped path characters", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas bin #%-"));
  try {
    const entry = path.join(root, "commitatlas.js");
    try {
      await symlink(cliPath, entry, "file");
    } catch (error) {
      if (process.platform === "win32" && error.code === "EPERM") {
        t.skip("Creating file symlinks requires Windows developer mode or elevation");
        return;
      }
      throw error;
    }
    // Preserving the main symlink also changes the relative import base. Keep its
    // generator dependency resolvable so this test isolates entry-point detection.
    await symlink(fileURLToPath(new URL("../dist/generate.js", import.meta.url)), path.join(root, "generate.js"), "file");
    await writeFile(path.join(root, "package.json"), '{"type":"module"}');
    for (const flags of [[], ["--preserve-symlinks-main"]]) {
      const result = run([...flags, entry], root);
      assert.equal(result.status, 1, `flags=${flags.join(" ")}: ${result.stderr}`);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /^CommitAtlas: Usage: commitatlas generate \[/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
