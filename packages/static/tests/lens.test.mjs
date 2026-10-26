import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fsPromises, { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as api from "../dist/index.js";
import * as core from "../../core/dist/lens-projection.js";
import * as svg from "../../svg/dist/index.js";
import { sceneInputs } from "../../svg/tests/scene.fixture.mjs";
const fixtureBytes = await readFile(new URL("../../../research-contracts/lens-projection/v1/showcase.fixture.json", import.meta.url), "utf8");
const fixture = JSON.parse(fixtureBytes);
const snapshot = structuredClone(sceneInputs().snapshot);
snapshot.freshness.generatedAt = fixture.generatedAt;
const raw = { version: 1, user: "scene-demo", outputDir: "output", cards: ["profile"], projects: [{ repo: "scene-demo/atlas", label: "Atlas", lifecycle: "active" }] };
async function temporary(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-lens-"));
  try {
    execFileSync("git", ["init", "-q", root]);
    await writeFile(path.join(root, "lens.json"), fixtureBytes);
    execFileSync("git", ["-C", root, "add", "lens.json"]);
    return await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
function config(extra = {}) { return api.parseStaticConfig({ ...raw, ...extra }); }
function options(root, extra = {}) { return { root, config: config({ lens: { path: "lens.json" }, ...extra }), snapshot }; }

test("legacy config has no lens and additive lens config defaults to 45 days", () => {
  assert.equal(config().lens, undefined);
  assert.deepEqual(config({ lens: { path: "lens.json" } }).lens, { path: "lens.json", maxAgeDays: 45 });
  for (const lens of [{ path: "../outside" }, { path: "https://example.invalid/lens" }, { path: "/outside" }, { path: "lens.json", maxAgeDays: 0 }, { path: "lens.json", extra: true }]) assert.throws(() => config({ lens }));
});
test("loads only tracked C0 projection files with snapshot-relative freshness", async () => {
  assert.equal(typeof api.loadStaticLensProjection, "function");
  await temporary(async root => {
    const lens = await api.loadStaticLensProjection(root, { path: "lens.json", maxAgeDays: 45 }, snapshot);
    assert.equal(lens.schemaVersion, "PublicLensProjection.v1");
    assert.equal(lens.summary.commits, fixture.summary.commits);
    assert.deepEqual(lens.freshness, { status: "fresh", ageDays: 0, maxAgeDays: 45 });
    assert.equal(lens.coverage.scorePercent, 100);
    assert.ok(Object.isFrozen(lens));
  });
});
test("rejects untracked, escaping, symlink, oversized, invalid UTF8/JSON and non-regular files using codes", async () => {
  await temporary(async root => {
    await writeFile(path.join(root, "untracked.json"), fixtureBytes);
    await assert.rejects(api.loadStaticLensProjection(root, { path: "untracked.json", maxAgeDays: 45 }, snapshot), /^LensProjectionError: LENS_UNTRACKED_FILE$/);
    await assert.rejects(api.loadStaticLensProjection(root, { path: "../outside.json", maxAgeDays: 45 }, snapshot), /^LensProjectionError: LENS_INVALID_FILE$/);
    await symlink(path.join(root, "lens.json"), path.join(root, "link.json"));
    execFileSync("git", ["-C", root, "add", "link.json"]);
    await assert.rejects(api.loadStaticLensProjection(root, { path: "link.json", maxAgeDays: 45 }, snapshot), /^LensProjectionError: LENS_INVALID_FILE$/);
    await assert.rejects(api.loadStaticLensProjection(root, { path: ".git", maxAgeDays: 45 }, snapshot), /LENS_(UNTRACKED|INVALID)_FILE/);
    await writeFile(path.join(root, "lens.json"), " ".repeat(300 * 1024));
    await assert.rejects(api.loadStaticLensProjection(root, { path: "lens.json", maxAgeDays: 45 }, snapshot), /^LensProjectionError: LENS_FILE_TOO_LARGE$/);
    for (const invalid of ["invented private body {", Buffer.from([0xff, 0xfe])]) {
      await writeFile(path.join(root, "lens.json"), invalid);
      await assert.rejects(api.loadStaticLensProjection(root, { path: "lens.json", maxAgeDays: 45 }, snapshot), /^LensProjectionError: LENS_INVALID_FILE$/);
    }
  });
});
test("generation rejects an invalid configured projection before output writes", async () => {
  await temporary(async root => {
    await writeFile(path.join(root, "lens.json"), "invented rejected body");
    await assert.rejects(api.generateStaticFromSnapshot(options(root)), /^LensProjectionError: LENS_INVALID_FILE$/);
    await assert.rejects(readFile(path.join(root, "output", "manifest.json")), /ENOENT/);
  });
});
test("static publication keeps C1 disabled pending owner decision", async () => {
  await temporary(async root => {
    const c1 = structuredClone(fixture);
    Object.assign(c1, { dataClass: "C1", scope: "redacted-local", repositoryRedaction: "all-aliases" });
    delete c1.provenance.showcaseUrl;
    c1.repositories.forEach((r, i) => { r.label = `Project Amber ${i + 1}`; r.disclosure = "masked-alias"; });
    c1.provenance.projectionHash = core.computeLensProjectionHash(c1);
    await writeFile(path.join(root, "lens.json"), JSON.stringify(c1));
    await assert.rejects(api.loadStaticLensProjection(root, { path: "lens.json", maxAgeDays: 45 }, snapshot), /^LensProjectionError: LENS_C1_PUBLICATION_DISABLED$/);
  });
});
test("static generator supplies the full fresh C0 projection to scene models", async () => {
  const id = "lens-reader-fixture";
  let observed;
  svg.registerScene({
    id, family: "scene", budget: "scene", supportedPacks: ["survey"], supportedMotion: ["none"],
    buildModel(inputs) { observed = inputs.lens; return { value: inputs.lens?.summary.commits ?? 0 }; },
    accessibility(m) { return { title: "Lens fixture", description: `Observed synthetic commits ${m.value}.` }; },
    render(m) { const a = this.accessibility(m); return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${a.title}" viewBox="0 0 720 120"><title>${a.title}</title><desc>${a.description}</desc><text x="20" y="40">${m.value}</text></svg>`; },
  });
  await temporary(async root => {
    await api.generateStaticFromSnapshot(options(root, { scenes: [id] }));
    assert.equal(observed?.schemaVersion, "PublicLensProjection.v1");
    assert.equal(observed?.summary.commits, fixture.summary.commits);
    assert.equal(observed?.freshness.status, "fresh");
    const image = await readFile(path.join(root, "output", `scene-${id}.svg`), "utf8");
    assert.ok(image.includes(String(fixture.summary.commits)));
    assert.equal(`sha256:${createHash("sha256").update(fixtureBytes).digest("hex")}`, core.LENS_PROJECTION_FIXTURE_SHA256);
  });
});

test("a tracked path replaced by a FIFO is rejected without blocking", { skip: process.platform === "win32" }, async () => {
  await temporary(async root => {
    await rm(path.join(root, "lens.json"));
    execFileSync("mkfifo", [path.join(root, "lens.json")]);
    const modulePath = new URL("../dist/index.js", import.meta.url).href;
    const script = `import { loadStaticLensProjection } from ${JSON.stringify(modulePath)}; try { await loadStaticLensProjection(${JSON.stringify(root)}, { path: "lens.json", maxAgeDays: 45 }, ${JSON.stringify(snapshot)}); process.stdout.write("unexpected-success"); } catch (error) { process.stdout.write(error.message); }`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 2000 });
    assert.equal(result.error, undefined, "regular-file rejection must finish without waiting for a FIFO writer");
    assert.equal(result.stdout, "LENS_INVALID_FILE");
  });
});

test("tracked proof ignores inherited Git index and repository overrides", async () => {
  await temporary(async foreign => temporary(async root => {
    execFileSync("git", ["-C", root, "rm", "--cached", "--quiet", "lens.json"]);
    const overrides = [
      { GIT_INDEX_FILE: path.join(foreign, ".git", "index") },
      { GIT_DIR: path.join(foreign, ".git"), GIT_WORK_TREE: root },
      { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.worktree", GIT_CONFIG_VALUE_0: foreign, GIT_INDEX_FILE: path.join(foreign, ".git", "index") },
    ];
    for (const override of overrides) {
      const previous = Object.fromEntries(Object.keys(override).map(key => [key, process.env[key]]));
      try {
        Object.assign(process.env, override);
        await assert.rejects(api.loadStaticLensProjection(root, { path: "lens.json", maxAgeDays: 45 }, snapshot), /^LensProjectionError: LENS_UNTRACKED_FILE$/);
      } finally {
        for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      }
    }
  }));
});
test("tracked proof treats wildcard filenames literally", { skip: process.platform === "win32" }, async () => {
  await temporary(async root => {
    await writeFile(path.join(root, "invented-real.json"), fixtureBytes);
    execFileSync("git", ["-C", root, "add", "invented-real.json"]);
    await writeFile(path.join(root, "invented*.json"), fixtureBytes);
    await assert.rejects(api.loadStaticLensProjection(root, { path: "invented*.json", maxAgeDays: 45 }, snapshot), /^LensProjectionError: LENS_UNTRACKED_FILE$/);
  });
});
for (const phase of ["preopen", "postopen", "read"]) {
  test(`rejects an ancestor swap at ${phase} before returning projection data`, { skip: process.platform === "win32" }, async () => {
    await temporary(async outside => temporary(async root => {
      const nested = path.join(root, "nested");
      await mkdir(nested);
      const target = path.join(nested, "lens.json");
      await writeFile(target, fixtureBytes);
      execFileSync("git", ["-C", root, "add", "nested/lens.json"]);
      const changed = structuredClone(fixture);
      changed.summary.commits += 101;
      changed.provenance.projectionHash = core.computeLensProjectionHash(changed);
      await writeFile(path.join(outside, "lens.json"), JSON.stringify(changed));
      const originalLstat = fsPromises.lstat, originalOpen = fsPromises.open;
      let checks = 0, swapped = false;
      async function swap() {
        if (swapped) return;
        await rename(nested, path.join(root, "nested-saved"));
        await symlink(outside, nested, "dir");
        swapped = true;
      }
      fsPromises.lstat = async function(file, ...args) {
        const result = await originalLstat(file, ...args);
        if (phase === "preopen" && file === target && ++checks === 2) await swap();
        return result;
      };
      fsPromises.open = async function(file, ...args) {
        const handle = await originalOpen(file, ...args);
        if (file === target && phase === "postopen") await swap();
        if (file === target && phase === "read") {
          const originalRead = handle.read;
          handle.read = async function(...readArgs) { const result = await originalRead.apply(this, readArgs); await swap(); return result; };
        }
        return handle;
      };
      syncBuiltinESMExports();
      try {
        await assert.rejects(api.loadStaticLensProjection(root, { path: "nested/lens.json", maxAgeDays: 45 }, snapshot), /^LensProjectionError: LENS_INVALID_FILE$/);
        assert.equal(swapped, true);
      } finally { fsPromises.lstat = originalLstat; fsPromises.open = originalOpen; syncBuiltinESMExports(); }
    }));
  });
}
