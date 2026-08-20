import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { removePackageDist, resolvePackageContext } from "../scripts/package-build-utils.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageDirectories = ["core", "github", "svg", "static"];

function declaredPackageTargets(packageJson) {
  const targets = [];
  const visit = (value) => {
    if (typeof value === "string" && value.startsWith("./")) {
      targets.push(value.slice(2));
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(packageJson.exports);
  visit(packageJson.bin);
  return [...new Set(targets)];
}

function declaredRuntimeExports(packageJson) {
  const targets = [];
  const visit = (value) => {
    if (typeof value === "string") {
      if (value.startsWith("./") && value.endsWith(".js")) targets.push(value.slice(2));
      return;
    }
    if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(packageJson.exports);
  return [...new Set(targets)];
}

function runPack(packageRoot) {
  const npmExecPath = process.env.npm_execpath;
  assert.ok(npmExecPath, "npm_execpath must be available for portable npm invocation");
  const result = spawnSync(process.execPath, [npmExecPath, "pack", "--dry-run", "--json", "--silent"], {
    cwd: packageRoot,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = result.stdout.trim();
  const jsonStart = output.indexOf("[");
  assert.notEqual(jsonStart, -1, `npm pack did not return JSON: ${output}`);
  return JSON.parse(output.slice(jsonStart));
}

function runNode(arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      windowsHide: true,
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

test("package build locks serialize concurrent holders", { concurrency: false }, async () => {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "commitatlas-build-lock-"));
  const logPath = path.join(fixtureRoot, "events.log");
  const utilityUrl = pathToFileURL(path.join(repositoryRoot, "scripts", "package-build-utils.mjs")).href;
  const childSource = `
    import { appendFileSync } from "node:fs";
    import { withPackageBuildLock } from ${JSON.stringify(utilityUrl)};
    const [root, log, id] = process.argv.slice(1);
    withPackageBuildLock(root, () => {
      appendFileSync(log, id + ":start\\n");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 180);
      appendFileSync(log, id + ":end\\n");
    });
  `;
  try {
    const results = await Promise.all([
      runNode(["--input-type=module", "-e", childSource, fixtureRoot, logPath, "a"]),
      runNode(["--input-type=module", "-e", childSource, fixtureRoot, logPath, "b"]),
    ]);
    for (const result of results) {
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(result.signal, null);
    }
    const events = readFileSync(logPath, "utf8").trim().split(/\r?\n/);
    assert.ok(
      JSON.stringify(events) === JSON.stringify(["a:start", "a:end", "b:start", "b:end"])
        || JSON.stringify(events) === JSON.stringify(["b:start", "b:end", "a:start", "a:end"]),
      `lock holders overlapped: ${events.join(", ")}`,
    );
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

test("package cleanup rejects linked roots and dist directories", { concurrency: false }, () => {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "commitatlas-clean-boundary-"));
  const repository = path.join(fixtureRoot, "repo");
  const packages = path.join(repository, "packages");
  const externalRoot = path.join(fixtureRoot, "external-package");
  const externalDist = path.join(externalRoot, "dist");
  const marker = path.join(externalDist, "must-survive.txt");
  mkdirSync(packages, { recursive: true });
  mkdirSync(externalDist, { recursive: true });
  writeFileSync(path.join(externalRoot, "package.json"), "{}\n");
  writeFileSync(marker, "outside the repository\n");

  try {
    const linkedPackage = path.join(packages, "linked");
    symlinkSync(externalRoot, linkedPackage, process.platform === "win32" ? "junction" : "dir");
    assert.throws(
      () => resolvePackageContext(path.join(linkedPackage, "package.json")),
      /linked package root/,
    );
    assert.equal(existsSync(marker), true);

    const localPackage = path.join(packages, "local");
    mkdirSync(localPackage);
    writeFileSync(path.join(localPackage, "package.json"), "{}\n");
    symlinkSync(externalDist, path.join(localPackage, "dist"), process.platform === "win32" ? "junction" : "dir");
    const context = resolvePackageContext(path.join(localPackage, "package.json"));
    assert.throws(() => removePackageDist(context), /linked dist directory/);
    assert.equal(existsSync(marker), true);
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

test("all published packages remove stale dist output before packing", { concurrency: false }, async () => {
  for (const directory of packageDirectories) {
    const packageRoot = path.join(repositoryRoot, "packages", directory);
    const packageJson = JSON.parse(readPackageJson(packageRoot));
    assert.equal(packageJson.scripts.build, "node ../../scripts/build-package.mjs");
    const marker = path.join(packageRoot, "dist", "zz-seeded-stale-output.js");
    mkdirSync(path.dirname(marker), { recursive: true });
    writeFileSync(marker, "stale output should never ship\n");

    try {
      const packResults = runPack(packageRoot);
      assert.equal(existsSync(marker), false, `${directory} retained stale dist output on disk`);
      assert.equal(packResults.length, 1);
      const manifest = new Set(packResults[0].files.map((file) => file.path));
      for (const required of ["LICENSE", "README.md", "package.json", "dist/index.js", "dist/index.d.ts"]) {
        assert.ok(manifest.has(required), `${directory} package is missing ${required}`);
      }
      for (const target of declaredPackageTargets(packageJson)) {
        assert.ok(manifest.has(target), `${directory} package is missing declared target ${target}`);
      }
      assert.doesNotMatch(packResults[0].files.map((file) => file.path).join("\n"), /zz-seeded-stale-output/);
      for (const target of declaredRuntimeExports(packageJson)) {
        await import(`${pathToFileURL(path.join(packageRoot, target)).href}?pack-test=${directory}-${encodeURIComponent(target)}`);
      }
      for (const target of Object.values(packageJson.bin ?? {})) {
        const executable = path.join(packageRoot, target);
        assert.match(readFileSync(executable, "utf8"), /^#!\/usr\/bin\/env node/);
        const result = spawnSync(process.execPath, [executable], { cwd: packageRoot, encoding: "utf8", windowsHide: true });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Usage: commitatlas generate/);
      }
    } finally {
      rmSync(marker, { force: true });
    }
  }
});

function readPackageJson(packageRoot) {
  return readFileSync(path.join(packageRoot, "package.json"), "utf8");
}
