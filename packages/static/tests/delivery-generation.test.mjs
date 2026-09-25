import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderDeliveryCard } from "@commit-atlas/svg";
import { calculateContributionMetrics } from "@commit-atlas/core";
import { buildDeliveryQueryPlan, deriveDeliverySnapshot } from "@commit-atlas/github";
import { generateStaticFromSnapshot, parseStaticConfig } from "../dist/index.js";

const generatedAt = "2026-09-21T18:22:00.000Z";

function config() {
  return parseStaticConfig({
    version: 1,
    user: "octocat",
    theme: "ember",
    themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
    days: 7,
    motion: "none",
    layout: "wide",
    outputDir: "assets/commitatlas/dark",
    cards: ["delivery"],
    projects: [{
      repo: "octocat/atlas",
      label: "Atlas",
      lifecycle: "active",
      workflow: "ci.yml",
      links: { docs: "https://github.com/octocat/atlas#readme" },
    }],
  });
}

function portfolio() {
  const days = Array.from({ length: 7 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 8, 15 + index)).toISOString().slice(0, 10),
    count: index,
    level: Math.min(index, 4),
  }));
  const contributions = {
    version: 1,
    login: "octocat",
    totalContributions: days.reduce((total, day) => total + day.count, 0),
    commits: 78,
    issues: 7,
    pullRequests: 12,
    reviews: 3,
    breakdownBasis: "public-profile-percentages",
    days,
    freshness: { generatedAt, source: "github-profile-html", mode: "live" },
  };
  return {
    version: 1,
    profile: {
      version: 1,
      login: "octocat",
      name: "The Octocat",
      profileUrl: "https://github.com/octocat",
      publicRepositories: 1,
      followers: 1,
      following: 1,
      stars: 1,
      forks: 1,
      primaryLanguages: [{ name: "TypeScript", repositories: 1, share: 100 }],
      latestPushAt: generatedAt,
      repositoriesTruncated: false,
      freshness: { generatedAt, source: "github-rest", mode: "live" },
    },
    contributions,
    metrics: calculateContributionMetrics({ version: 1, days }, {
      asOf: "2026-09-21",
      days: 7,
      commits: contributions.commits,
      issues: contributions.issues,
      pullRequests: contributions.pullRequests,
      reviews: contributions.reviews,
      breakdownBasis: contributions.breakdownBasis,
    }),
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
        stars: 1,
        forks: 1,
        openIssuesAndPullRequests: 1,
        pushedAt: generatedAt,
        license: "GPL-3.0-only",
        ci: { state: "passing", label: "Passing", workflow: "ci.yml", url: null, checkedAt: generatedAt, headSha: null },
        releaseState: "none",
        release: null,
      }],
      freshness: { generatedAt, source: "github-rest", mode: "live" },
    },
    freshness: { generatedAt, source: "github-profile-html", mode: "live" },
  };
}

function delivery(repository = "octocat/atlas") {
  const plan = buildDeliveryQueryPlan({
    login: "octocat",
    repositories: [repository],
    asOf: new Date(generatedAt),
  });
  const counts = Object.fromEntries(plan.queries.map(({ alias }) => [alias, 0]));
  Object.assign(counts, {
    lifetimeAuthored: 24,
    lifetimeMerged: 20,
    lifetimeClosed: 22,
    lifetimeOpen: 2,
    lifetimeDrafts: 1,
    opened7: 7,
    merged7: 6,
    opened30: 12,
    merged30: 11,
    opened90: 18,
    merged90: 16,
    opened365: 24,
    merged365: 20,
  });
  for (const query of plan.queries) {
    if (query.repository) counts[query.alias] = 12;
  }
  return deriveDeliverySnapshot({ plan, counts });
}

test("generates paired delivery SVG and identical evidence JSON atomically", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-delivery-"));
  try {
    const result = await generateStaticFromSnapshot({
      root,
      config: config(),
      snapshot: portfolio(),
      delivery: delivery(),
    });
    assert.equal(result.variants.length, 1);
    const dark = path.join(root, "assets", "commitatlas", "dark");
    const light = path.join(root, "assets", "commitatlas", "light");
    assert.deepEqual((await readdir(dark)).sort(), ["delivery.json", "delivery.svg", "manifest.json"]);
    assert.deepEqual((await readdir(light)).sort(), ["delivery.json", "delivery.svg", "manifest.json"]);
    assert.equal(await readFile(path.join(dark, "delivery.json"), "utf8"), await readFile(path.join(light, "delivery.json"), "utf8"));
    assert.notEqual(await readFile(path.join(dark, "delivery.svg"), "utf8"), await readFile(path.join(light, "delivery.svg"), "utf8"));
    for (const [directory, theme] of [[dark, "ember"], [light, "paper"]]) {
      assert.equal(await readFile(path.join(directory, "delivery.svg"), "utf8"),
        renderDeliveryCard(delivery(), { theme, width: 860, motion: "none" }));
    }
    for (const directory of [dark, light]) {
      const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
      assert.deepEqual(manifest.artifacts.map(({ path: artifact }) => artifact), ["delivery.json", "delivery.svg"]);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails before writing when delivery evidence is absent or outside configured scope", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-delivery-invalid-"));
  try {
    await assert.rejects(generateStaticFromSnapshot({
      root,
      config: config(),
      snapshot: portfolio(),
    }), /requires a delivery snapshot/i);
    await assert.rejects(generateStaticFromSnapshot({
      root,
      config: config(),
      snapshot: portfolio(),
      delivery: delivery("octocat/another"),
    }), /scope does not match/i);
    await assert.rejects(readdir(path.join(root, "assets")), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
