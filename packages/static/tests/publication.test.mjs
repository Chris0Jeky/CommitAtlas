import assert from "node:assert/strict";
import { symlinkSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

    // A non-recursive rm over this directory throws while collecting a stale managed artifact.
    await rm(path.join(output, "projects.md"), { force: true });
    await mkdir(path.join(output, "projects.md"));
    await writeFile(path.join(output, "projects.md", "blocker.txt"), "makes rm throw\n");
    await assert.rejects(
      generateStaticFromSnapshot({ root, config: withoutCatalog, snapshot: portfolio("A changed Octocat") }),
    );
    assert.equal(await readFile(path.join(output, "atlas.svg"), "utf8"), ownedAtlas);
    assert.equal(await readFile(path.join(output, "manifest.json"), "utf8"), ownedManifest);
    await assertNoStagedFiles(output);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
