import assert from "node:assert/strict";
import { symlinkSync } from "node:fs";
import { link, lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { demoContributions, demoProfile, demoProjects } from "@commit-atlas/github";
import {
  assembleStaticPortfolio,
  generateStaticFromSnapshot,
  parseStaticConfig,
} from "../dist/index.js";

const NOW = new Date("2026-08-20T12:00:00.000Z");

/** A blocked secondary output must fail before an existing primary snapshot changes. */
test("prepares every theme output before changing an existing primary snapshot", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-theme-storage-preflight-"));
  try {
    const primaryOnly = staticConfig({ cards: ["atlas"] });
    const primaryOutput = path.join(root, "assets", "commitatlas");
    await generateStaticFromSnapshot({ root, config: primaryOnly, snapshot: portfolio() });
    const originalAtlas = await readFile(path.join(primaryOutput, "atlas.svg"), "utf8");
    const originalManifest = await readFile(path.join(primaryOutput, "manifest.json"), "utf8");

    // A regular file at the secondary output path makes directory preparation fail. The primary
    // directory must remain one coherent previous snapshot rather than publishing before its pair.
    await writeFile(path.join(primaryOutput, "light"), "blocks the theme output directory\n");
    const paired = staticConfig({
      cards: ["atlas"],
      themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
    });
    await assert.rejects(
      generateStaticFromSnapshot({ root, config: paired, snapshot: portfolio("A changed Octocat") }),
      /EEXIST|directory/i,
    );
    assert.equal(await readFile(path.join(primaryOutput, "atlas.svg"), "utf8"), originalAtlas);
    assert.equal(await readFile(path.join(primaryOutput, "manifest.json"), "utf8"), originalManifest);
    await assertNoStagedFiles(primaryOutput);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** Every visible destination must be rename-compatible before any target begins committing. */
test("preflights current secondary destinations before changing the primary snapshot", async () => {
  for (const blockedName of ["atlas.svg", "manifest.json"]) {
    const root = await mkdtemp(path.join(os.tmpdir(), `commitatlas-destination-preflight-${blockedName}-`));
    try {
      const paired = staticConfig({
        cards: ["atlas"],
        themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
      });
      const primaryOutput = path.join(root, "assets", "commitatlas");
      const secondaryOutput = path.join(primaryOutput, "light");
      await generateStaticFromSnapshot({ root, config: paired, snapshot: portfolio() });
      const originalAtlas = await readFile(path.join(primaryOutput, "atlas.svg"), "utf8");
      const originalManifest = await readFile(path.join(primaryOutput, "manifest.json"), "utf8");

      await rm(path.join(secondaryOutput, blockedName), { force: true });
      await mkdir(path.join(secondaryOutput, blockedName));
      await writeFile(path.join(secondaryOutput, blockedName, "blocker.txt"), "blocks the destination rename\n");

      await assert.rejects(
        generateStaticFromSnapshot({ root, config: paired, snapshot: portfolio("A changed Octocat") }),
        /regular artifact file|directory|EISDIR|ENOTEMPTY/i,
      );
      assert.equal(
        await readFile(path.join(primaryOutput, "atlas.svg"), "utf8"),
        originalAtlas,
        `${blockedName} let the primary payload advance`,
      );
      assert.equal(
        await readFile(path.join(primaryOutput, "manifest.json"), "utf8"),
        originalManifest,
        `${blockedName} let the primary manifest advance`,
      );
      await assertNoStagedFiles(primaryOutput);
      await assertNoStagedFiles(secondaryOutput);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

/** A path swapped to a symlink after initial resolution must be caught before staging. */
test("rechecks output containment after render-time path replacement", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-output-race-root-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "commitatlas-output-race-outside-"));
  try {
    await mkdir(path.join(root, "assets"), { recursive: true });
    const base = portfolio();
    let replaced = false;
    const raced = { ...base };
    Object.defineProperty(raced, "profile", {
      enumerable: true,
      get() {
        if (!replaced) {
          replaced = true;
          symlinkSync(
            outside,
            path.join(root, "assets", "commitatlas"),
            process.platform === "win32" ? "junction" : "dir",
          );
        }
        return base.profile;
      },
    });

    await assert.rejects(
      generateStaticFromSnapshot({ root, config: staticConfig({ cards: ["atlas"] }), snapshot: raced }),
      /symbolic links|inside the repository/i,
    );
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

/** A missing output directory under a swapped parent must not be created outside the root. */
test("does not create output directories through a render-time parent symlink", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-output-mkdir-race-root-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "commitatlas-output-mkdir-race-outside-"));
  try {
    const base = portfolio();
    let replaced = false;
    const raced = { ...base };
    Object.defineProperty(raced, "profile", {
      enumerable: true,
      get() {
        if (!replaced) {
          replaced = true;
          symlinkSync(outside, path.join(root, "assets"), process.platform === "win32" ? "junction" : "dir");
        }
        return base.profile;
      },
    });

    await assert.rejects(
      generateStaticFromSnapshot({ root, config: staticConfig({ cards: ["atlas"] }), snapshot: raced }),
      /symbolic links|inside the repository/i,
    );
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

/** Failed stale cleanup must not expose new bytes under the previous ownership manifest. */
test("keeps previous payload bytes with the ownership record when cleanup is interrupted", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-cleanup-preflight-"));
  try {
    const output = path.join(root, "assets", "commitatlas");
    await mkdir(output, { recursive: true });
    const withCatalog = staticConfig({ cards: ["atlas", "projects"] });
    const withoutCatalog = staticConfig({ cards: ["atlas"] });
    await generateStaticFromSnapshot({ root, config: withCatalog, snapshot: portfolio() });
    const ownedAtlas = await readFile(path.join(output, "atlas.svg"), "utf8");
    const ownedManifest = await readFile(path.join(output, "manifest.json"), "utf8");

    // A directory in place of a stale managed artifact is rejected before any cleanup runs.
    await rm(path.join(output, "projects.md"), { force: true });
    await mkdir(path.join(output, "projects.md"));
    await writeFile(path.join(output, "projects.md", "blocker.txt"), "blocks stale cleanup\n");
    await assert.rejects(
      generateStaticFromSnapshot({ root, config: withoutCatalog, snapshot: portfolio("A changed Octocat") }),
      /projects\.md is a directory/,
    );
    assert.equal(await readFile(path.join(output, "atlas.svg"), "utf8"), ownedAtlas);
    assert.equal(await readFile(path.join(output, "manifest.json"), "utf8"), ownedManifest);
    await assertNoStagedFiles(output);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("modified stale fixed cards and scenes block publication before either theme changes", async t => {
  for (const name of ["projects.svg", "scene-evidence-coverage.svg"]) {
    for (const change of ["same-size", "appended"]) await t.test(`${name}: ${change}`, async t => {
      const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-stale-content-"));
      t.after(() => rm(root, { recursive: true, force: true }));
      const themes = [{ theme: "paper", outputDir: "assets/commitatlas/light" }];
      const first = await generateStaticFromSnapshot({ root, snapshot: portfolio(), config: staticConfig({
        cards: ["atlas", "projects"], scenes: ["evidence-coverage"], themes,
      }) });
      const outputs = [first.outputDir, first.variants[0].outputDir];
      const before = new Map();
      for (const output of outputs) {
        for (const entry of await readdir(output)) {
          const file = path.join(output, entry);
          if ((await lstat(file)).isFile()) before.set(file, await readFile(file));
        }
      }
      const changedFile = path.join(outputs[1], name);
      const original = before.get(changedFile);
      const changed = change === "appended" ? Buffer.concat([original, Buffer.from("caller changes")]) : Buffer.from(original);
      if (change === "same-size") changed[0] ^= 1;
      await writeFile(changedFile, changed);
      before.set(changedFile, changed);

      await assert.rejects(generateStaticFromSnapshot({ root, snapshot: portfolio("A changed Octocat"),
        config: staticConfig({ cards: ["atlas"], themes }),
      }), /stale artifact.*changed|no longer matches/i);
      for (const [file, body] of before) assert.deepEqual(await readFile(file), body, file);
      for (const output of outputs) await assertNoStagedFiles(output);
    });
  }
});

test("stale cleanup preserves caller replacements that are links instead of owned files", async t => {
  for (const kind of ["symlink", "hardlink"]) await t.test(kind, async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-stale-link-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const first = await generateStaticFromSnapshot({ root, snapshot: portfolio(),
      config: staticConfig({ cards: ["atlas", "projects"] }),
    });
    const stale = path.join(first.outputDir, "projects.svg");
    const body = await readFile(stale);
    const manifest = await readFile(path.join(first.outputDir, "manifest.json"));
    const atlas = await readFile(path.join(first.outputDir, "atlas.svg"));
    const caller = path.join(root, "caller-owned.svg");
    await writeFile(caller, body); // Matching content must not authorize deleting a substituted link.
    await rm(stale);
    if (kind === "hardlink") await link(caller, stale);
    else {
      try { await symlink(caller, stale, "file"); }
      catch (error) {
        if (process.platform === "win32" && error.code === "EPERM") {
          t.skip("Creating file symlinks requires Windows developer mode or elevation");
          return;
        }
        throw error;
      }
    }
    await assert.rejects(generateStaticFromSnapshot({ root, snapshot: portfolio("A changed Octocat"),
      config: staticConfig({ cards: ["atlas"] }),
    }), /regular|link|stale artifact/i);
    assert.deepEqual(await readFile(caller), body);
    assert.deepEqual(await readFile(stale), body);
    assert.equal((await lstat(stale)).isSymbolicLink(), kind === "symlink");
    assert.deepEqual(await readFile(path.join(first.outputDir, "manifest.json")), manifest);
    assert.deepEqual(await readFile(path.join(first.outputDir, "atlas.svg")), atlas);
    await assertNoStagedFiles(first.outputDir);
  });
});

test("legacy or malformed fixed-artifact integrity never authorizes stale deletion", async t => {
  for (const proof of [{}, { bytes: 5 }, { sha256: "a".repeat(64) },
    { bytes: -1, sha256: "a".repeat(64) }, { bytes: 5, sha256: "invalid" },
    { bytes: 1024 * 1024, sha256: "a".repeat(64) }]) await t.test(JSON.stringify(proof), async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-stale-legacy-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const first = await generateStaticFromSnapshot({ root, snapshot: portfolio(), config: staticConfig({ cards: ["atlas"] }) });
    const stale = path.join(first.outputDir, "projects.svg");
    await writeFile(stale, "caller-owned legacy contents");
    await writeFile(path.join(first.outputDir, "manifest.json"), JSON.stringify({
      ...first.manifest, artifacts: [...first.manifest.artifacts, { path: "projects.svg", ...proof }],
    }));
    const next = await generateStaticFromSnapshot({ root, snapshot: portfolio("A changed Octocat"),
      config: staticConfig({ cards: ["atlas"] }),
    });
    assert.equal(await readFile(stale, "utf8"), "caller-owned legacy contents");
    assert.ok(!next.manifest.artifacts.some(artifact => artifact.path === "projects.svg"));
    assert.match(await readFile(path.join(first.outputDir, "atlas.svg"), "utf8"), /A changed Octocat/);
    await assertNoStagedFiles(first.outputDir);
  });
});

test("duplicate ownership claims disable cleanup instead of selecting a convenient proof", async t => {
  for (const kind of ["conflicting", "name-only"]) await t.test(kind, async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-stale-duplicate-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const first = await generateStaticFromSnapshot({ root, snapshot: portfolio(),
      config: staticConfig({ cards: ["atlas", "projects"] }),
    });
    const proof = first.manifest.artifacts.find(artifact => artifact.path === "projects.svg");
    const duplicate = kind === "conflicting" ? { ...proof, sha256: "a".repeat(64) } : { path: proof.path };
    await writeFile(path.join(first.outputDir, "manifest.json"), JSON.stringify({
      ...first.manifest, artifacts: [duplicate, ...first.manifest.artifacts],
    }));
    const before = new Map();
    for (const name of ["projects.svg", "projects.json", "projects.md"]) {
      before.set(name, await readFile(path.join(first.outputDir, name)));
    }
    await generateStaticFromSnapshot({ root, snapshot: portfolio("A changed Octocat"),
      config: staticConfig({ cards: ["atlas"] }),
    });
    for (const [name, body] of before) assert.deepEqual(await readFile(path.join(first.outputDir, name)), body);
    await assertNoStagedFiles(first.outputDir);
  });
});

test("missing stale files do not prevent cleanup of unchanged managed artifacts", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-stale-missing-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = await generateStaticFromSnapshot({ root, snapshot: portfolio(), config: staticConfig({
    cards: ["atlas", "projects"], scenes: ["evidence-coverage"],
  }) });
  await rm(path.join(first.outputDir, "projects.svg"));
  await generateStaticFromSnapshot({ root, snapshot: portfolio("A changed Octocat"), config: staticConfig({ cards: ["atlas"] }) });
  assert.deepEqual((await readdir(first.outputDir)).sort(), ["atlas.svg", "manifest.json"]);
});

async function assertNoStagedFiles(outputDir) {
  const entries = await readdir(outputDir);
  assert.deepEqual(entries.filter((name) => /^\..+\.tmp$/.test(name)), []);
}

function staticConfig(overrides = {}) {
  return parseStaticConfig({
    version: 1,
    user: "octocat",
    theme: "ember",
    days: 365,
    motion: "subtle",
    layout: "wide",
    outputDir: "assets/commitatlas",
    projects: [{
      repo: "octocat/atlas",
      label: "Atlas",
      lifecycle: "active",
      workflow: "ci.yml",
    }],
    ...overrides,
  });
}

function portfolio(name = "Synthetic preview") {
  const profile = { ...demoProfile("octocat", NOW), name };
  const contributions = demoContributions("octocat", 365, NOW);
  const projects = demoProjects(
    "octocat",
    ["atlas"],
    new Map([["atlas", "active"]]),
    new Map([["atlas", "ci.yml"]]),
    NOW,
  );
  return assembleStaticPortfolio(profile, contributions, projects);
}
