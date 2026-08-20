import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { calculateContributionMetrics } from "@commit-atlas/core";
import {
  generateStaticFromSnapshot,
  loadStaticConfig,
  parseStaticConfig,
  renderProjectCatalogArtifacts,
  renderStaticArtifacts,
  resolveContainedPath,
} from "../dist/index.js";

const generatedAt = "2026-08-20T12:00:00.000Z";

test("validates one contained config and rejects ambiguous projects or card selections", () => {
  const parsed = config();
  assert.equal(parsed.user, "octocat");
  assert.equal(parsed.cards.length, 8);
  assert.equal(parsed.responsiveAtlas, false);
  assert.equal(parsed.projects[0].repo, "octocat/atlas");
  assert.throws(() => parseStaticConfig({ ...rawConfig(), unknown: true }), /unrecognized_keys/i);
  assert.throws(() => parseStaticConfig({ ...rawConfig(), outputDir: "../outside" }), /contained relative path/);
  assert.throws(() => parseStaticConfig({ ...rawConfig(), cards: ["atlas", "atlas"] }), /duplicates/);
  assert.throws(() => parseStaticConfig({ ...rawConfig(), cards: ["profile"], responsiveAtlas: true }), /requires atlas/);
  assert.throws(() => parseStaticConfig({
    ...rawConfig(),
    projects: [{ ...rawConfig().projects[0], repo: "another/atlas" }],
  }), /owned by the configured user/);
});

test("renders wide and compact Atlas variants from one snapshot", () => {
  const rendered = renderStaticArtifacts(snapshot(), parseStaticConfig({
    ...rawConfig(),
    cards: ["atlas"],
    responsiveAtlas: true,
  }));
  assert.deepEqual(Object.keys(rendered).sort(), ["atlas-compact.svg", "atlas.svg"]);
  assert.match(rendered["atlas.svg"], /viewBox="0 0 860 380"/);
  assert.match(rendered["atlas-compact.svg"], /viewBox="0 0 480 570"/);
  const wideDescription = rendered["atlas.svg"].match(/<desc>(.*?)<\/desc>/s)?.[1];
  const compactDescription = rendered["atlas-compact.svg"].match(/<desc>(.*?)<\/desc>/s)?.[1];
  assert.equal(compactDescription, wideDescription);
});

test("loads only a tracked, non-symlinked repository config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-config-"));
  try {
    await promisify(execFile)("git", ["init"], { cwd: root, windowsHide: true });
    await writeFile(path.join(root, ".commitatlas.json"), `${JSON.stringify(rawConfig(), null, 2)}\n`);
    await assert.rejects(loadStaticConfig(root), /tracked/);
    await promisify(execFile)("git", ["add", ".commitatlas.json"], { cwd: root, windowsHide: true });
    const loaded = await loadStaticConfig(root);
    assert.equal(loaded.config.user, "octocat");
    await assert.rejects(resolveContainedPath(root, "..\\escape", { mustExist: false, label: "output" }), /inside/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("renders all rich widgets deterministically from one snapshot", () => {
  const first = renderStaticArtifacts(snapshot(), config());
  const second = renderStaticArtifacts(snapshot(), config());
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), [
    "activity.svg", "atlas.svg", "breakdown.svg", "languages.svg", "profile.svg", "projects.svg", "rhythm.svg", "streak.svg",
  ]);
  assert.match(first["atlas.svg"], /PUBLIC PROFILE VIEW/);
  assert.match(first["atlas.svg"], /PUBLIC PROFILE MIX · NOT WINDOW-SCOPED/);
  assert.match(first["atlas.svg"], /CONTRIBUTION DENSITY/);
  assert.match(first["atlas.svg"], /RHYTHM/);
  assert.match(first["breakdown.svg"], /PUBLIC PROFILE %/);
  assert.match(first["breakdown.svg"], /Annual profile-view percentages · exact window counts unavailable/);
  assert.match(first["breakdown.svg"], /not scoped to the requested contribution-calendar window/);
  assert.match(first["rhythm.svg"], /PERSONAL CONSISTENCY/);
  assert.match(first["rhythm.svg"], /not a GitHub rank/);
  for (const svg of Object.values(first)) {
    assert.match(svg, /^<svg/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|<image\b/i);
    assert.doesNotMatch(svg, /SYNTHETIC DEMO|Synthetic demo:|Synthetic demonstration data/);
  }
});

test("propagates synthetic source truth to every standalone static card", () => {
  const base = snapshot();
  const demoFreshness = { generatedAt, source: "synthetic-demo", mode: "demo" };
  const rendered = renderStaticArtifacts({
    ...base,
    profile: { ...base.profile, freshness: demoFreshness },
    contributions: { ...base.contributions, freshness: demoFreshness },
    projects: { ...base.projects, freshness: demoFreshness },
    freshness: demoFreshness,
  }, config());
  for (const name of ["profile.svg", "streak.svg", "activity.svg", "breakdown.svg", "rhythm.svg", "languages.svg", "projects.svg"]) {
    const svg = rendered[name];
    assert.match(svg, />SYNTHETIC DEMO<\/text>/, name);
    assert.match(svg, /<title>Synthetic demo:/, name);
    assert.match(svg, /<desc>Synthetic demonstration data, not live GitHub data\./, name);
  }
});

test("preserves the declared planned lifecycle in static project SVGs", () => {
  const base = snapshot();
  const rendered = renderStaticArtifacts({
    ...base,
    projects: {
      ...base.projects,
      projects: base.projects.projects.map((project) => ({ ...project, lifecycle: "planned" })),
    },
  }, config());
  assert.match(rendered["projects.svg"], /Planned · CI Passing/);
  assert.doesNotMatch(rendered["projects.svg"], /Experimental/);
});

test("renders a truthful deterministic catalog from observed and explicitly configured links", () => {
  const catalogConfig = parseStaticConfig({
    ...rawConfig(),
    projects: [{
      ...rawConfig().projects[0],
      links: {
        docs: "https://docs.github.com/en/repositories",
        install: "https://www.npmjs.com/package/atlas",
        download: "https://github.com/octocat/atlas/releases",
      },
    }],
  });
  const richSnapshot = {
    ...snapshot(),
    projects: {
      ...snapshot().projects,
      projects: [{
        ...snapshot().projects.projects[0],
        websiteUrl: "https://atlas.example.com",
        ci: { ...snapshot().projects.projects[0].ci, url: "https://github.com/octocat/atlas/actions/runs/42" },
        release: {
          tag: "v1.2.3",
          name: "Atlas 1.2.3",
          url: "https://github.com/octocat/atlas/releases/tag/v1.2.3",
          publishedAt: generatedAt,
          download: { name: "atlas.zip", url: "https://github.com/octocat/atlas/releases/download/v1.2.3/atlas.zip" },
        },
      }],
    },
  };
  const first = renderProjectCatalogArtifacts(richSnapshot, catalogConfig);
  const second = renderProjectCatalogArtifacts(richSnapshot, catalogConfig);
  assert.deepEqual(first, second);
  const parsed = JSON.parse(first["projects.json"]);
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.projects[0].actions.map((action) => [action.kind, action.origin]), [
    ["source", "snapshot"], ["website", "snapshot"], ["ci", "snapshot"], ["release", "snapshot"],
    ["release-download", "snapshot"], ["docs", "config"], ["install", "config"], ["download", "config"],
  ]);
  assert.match(first["projects.md"], /\[Docs\]\(https:\/\/docs.github.com\/en\/repositories\)/);
  assert.doesNotMatch(first["projects.md"], /#readme|\/docs\/|releases\/latest/);
});

test("fails closed for unsafe observed URLs and control-bearing labels while escaping Markdown text", () => {
  const base = snapshot();
  assert.throws(() => renderProjectCatalogArtifacts({
    ...base,
    projects: { ...base.projects, projects: [{ ...base.projects.projects[0], sourceUrl: "https://user:pass@github.com/octocat/atlas" }] },
  }, config()), /safe HTTPS URL/);
  const escapedConfig = parseStaticConfig({
    ...rawConfig(),
    projects: [{ ...rawConfig().projects[0], label: "Atlas [stable]" }],
  });
  assert.match(renderProjectCatalogArtifacts(base, escapedConfig)["projects.md"], /## Atlas \\\[stable\\\]/);
  const controlConfig = parseStaticConfig({
    ...rawConfig(),
    projects: [{ ...rawConfig().projects[0], label: "Atlas\nstable" }],
  });
  assert.throws(() => renderProjectCatalogArtifacts(base, controlConfig), /invalid or overlong text/);
});

test("writes selected SVGs and a hash manifest while preserving unrelated siblings", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-output-"));
  try {
    const selected = parseStaticConfig({
      ...rawConfig(),
      cards: ["atlas", "projects"],
      responsiveAtlas: true,
    });
    const output = path.join(root, "assets", "commitatlas");
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "keep.txt"), "belongs to caller\n");
    const first = await generateStaticFromSnapshot({ root, config: selected, snapshot: snapshot() });
    const second = await generateStaticFromSnapshot({ root, config: selected, snapshot: snapshot() });
    assert.equal(first.written, true);
    assert.deepEqual(first.manifest, second.manifest);
    assert.deepEqual((await readdir(output)).sort(), [
      "atlas-compact.svg", "atlas.svg", "keep.txt", "manifest.json", "projects.json", "projects.md", "projects.svg",
    ]);
    assert.equal(await readFile(path.join(output, "keep.txt"), "utf8"), "belongs to caller\n");
    const manifest = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
    assert.equal(manifest.artifacts.length, 5);
    assert.ok(manifest.artifacts.every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256)));
    for (const artifact of manifest.artifacts) {
      const body = await readFile(path.join(output, artifact.path));
      assert.equal(body.byteLength, artifact.bytes);
      assert.equal(createHash("sha256").update(body).digest("hex"), artifact.sha256);
    }

    const switched = parseStaticConfig({
      ...rawConfig(),
      cards: ["atlas"],
      layout: "compact",
      responsiveAtlas: true,
    });
    await generateStaticFromSnapshot({ root, config: switched, snapshot: snapshot() });
    assert.deepEqual((await readdir(output)).sort(), ["atlas-wide.svg", "atlas.svg", "keep.txt", "manifest.json"]);

    const narrowed = parseStaticConfig({ ...rawConfig(), cards: ["atlas"], layout: "compact" });
    await generateStaticFromSnapshot({ root, config: narrowed, snapshot: snapshot() });
    assert.deepEqual((await readdir(output)).sort(), ["atlas.svg", "keep.txt", "manifest.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function rawConfig() {
  return {
    version: 1,
    user: "OctoCat",
    theme: "ember",
    days: 365,
    motion: "subtle",
    layout: "wide",
    outputDir: "assets/commitatlas",
    projects: [{
      repo: "OctoCat/atlas",
      label: "Atlas",
      lifecycle: "active",
      workflow: "ci.yml",
      links: { docs: "https://github.com/octocat/atlas#readme" },
    }],
  };
}

function config() {
  return parseStaticConfig(rawConfig());
}

function snapshot() {
  const days = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 7, 21 + index)).toISOString().slice(0, 10);
    const count = index % 5;
    return { date, count, level: count };
  });
  const contributions = {
    version: 1,
    login: "octocat",
    totalContributions: days.reduce((sum, day) => sum + day.count, 0),
    commits: 78,
    issues: 7,
    pullRequests: 12,
    reviews: 3,
    breakdownBasis: "public-profile-percentages",
    days,
    freshness: { generatedAt, source: "github-profile-html", mode: "live" },
  };
  const metrics = calculateContributionMetrics({ version: 1, days }, {
    asOf: days.at(-1).date,
    days: days.length,
    commits: contributions.commits,
    issues: contributions.issues,
    pullRequests: contributions.pullRequests,
    reviews: contributions.reviews,
    breakdownBasis: contributions.breakdownBasis,
  });
  return {
    version: 1,
    profile: {
      version: 1,
      login: "octocat",
      name: "The Octocat",
      profileUrl: "https://github.com/octocat",
      publicRepositories: 24,
      followers: 312,
      following: 48,
      stars: 487,
      forks: 96,
      primaryLanguages: [
        { name: "TypeScript", repositories: 9, share: 60 },
        { name: "Python", repositories: 6, share: 40 },
      ],
      latestPushAt: generatedAt,
      repositoriesTruncated: false,
      freshness: { generatedAt, source: "github-rest", mode: "live" },
    },
    contributions,
    metrics,
    projects: {
      version: 1,
      owner: "octocat",
      projects: [{
        repo: "octocat/atlas",
        name: "atlas",
        description: "Maps public GitHub signals.",
        sourceUrl: "https://github.com/octocat/atlas",
        websiteUrl: null,
        lifecycle: "active",
        primaryLanguage: "TypeScript",
        stars: 42,
        forks: 8,
        openIssues: 2,
        pushedAt: generatedAt,
        license: "GPL-3.0-only",
        ci: { state: "passing", label: "Passing", workflow: "ci.yml", url: null, checkedAt: generatedAt, headSha: null },
        release: null,
      }],
      freshness: { generatedAt, source: "github-rest", mode: "live" },
    },
    freshness: { generatedAt, source: "github-profile-html", mode: "live" },
  };
}
