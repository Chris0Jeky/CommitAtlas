import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  } finally {
    await rm(root, { recursive: true, force: true });
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
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

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
