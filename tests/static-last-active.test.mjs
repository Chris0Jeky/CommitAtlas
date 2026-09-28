import assert from "node:assert/strict";
import test from "node:test";
import { parseStaticConfig, renderStaticArtifacts } from "../packages/static/dist/index.js";

const generatedAt = "2026-09-28T00:00:00.000Z";

function config() {
  return parseStaticConfig({
    version: 1,
    user: "octocat",
    theme: "aurora",
    motion: "none",
    layout: "wide",
    outputDir: "assets/commitatlas",
    cards: ["streak"],
    projects: [{ repo: "octocat/atlas", label: "Atlas", lifecycle: "active" }],
  });
}

function snapshotFor(days) {
  const sorted = [...days].sort((left, right) => left.date.localeCompare(right.date));
  const from = sorted[0]?.date ?? "2026-01-01";
  const to = sorted.at(-1)?.date ?? "2026-01-01";
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = days.filter((day) => day.count > 0).length;
  const lastActiveDay = [...sorted].reverse().find((day) => day.count > 0)?.date ?? null;
  const freshness = { generatedAt, source: "github-rest", mode: "live" };
  return {
    version: 1,
    profile: {
      version: 1,
      login: "octocat",
      name: "The Octocat",
      profileUrl: "https://github.com/octocat",
      publicRepositories: 1,
      followers: 0,
      following: 0,
      stars: 0,
      forks: 0,
      primaryLanguages: [],
      latestPushAt: generatedAt,
      repositoriesTruncated: false,
      freshness,
    },
    contributions: {
      version: 1,
      login: "octocat",
      totalContributions: total,
      commits: total,
      issues: 0,
      pullRequests: 0,
      reviews: 0,
      breakdownBasis: "exact-counts",
      days,
      freshness,
    },
    metrics: {
      version: 1,
      window: { from, to, days: days.length, observedDays: days.length, complete: true },
      total,
      activeDays,
      density: 100,
      averagePerDay: total / Math.max(1, days.length),
      averagePerActiveDay: activeDays === 0 ? 0 : total / activeDays,
      peakDay: { date: from, count: 0 },
      streak: {
        version: 1,
        asOf: to,
        current: lastActiveDay ? 1 : 0,
        currentThrough: lastActiveDay,
        longest: lastActiveDay ? 1 : 0,
        boundary: { current: "closed", longest: "closed" },
        basis: "returned-window",
      },
      breakdown: { commits: total, issues: 0, pullRequests: 0, reviews: 0 },
      breakdownBasis: "exact-counts",
      trend: {
        buckets: [],
        recent28Days: total,
        previous28Days: null,
        changePercent: null,
        direction: "unavailable",
      },
      rhythm: {
        score: 0,
        level: "starting",
        basis: "70% active-day density (capped at 80%) + 30% current streak (capped at 30 days)",
      },
    },
    projects: {
      version: 1,
      owner: "octocat",
      projects: [],
      freshness,
    },
    freshness,
  };
}

function streakSvg(days) {
  const rendered = renderStaticArtifacts(snapshotFor(days), config());
  assert.ok(rendered["streak.svg"], "expected a streak card artifact");
  return rendered["streak.svg"];
}

test("resolves streak lastActive from sorted calendar days when input is out of order", () => {
  const svg = streakSvg([
    { date: "2026-09-27", count: 1, level: 1 },
    { date: "2026-01-01", count: 9, level: 4 },
  ]);
  assert.match(svg, /Last active 2026-09-27/);
  assert.doesNotMatch(svg, /Last active 2026-01-01/);
});

test("keeps streak lastActive for in-order contribution days", () => {
  const svg = streakSvg([
    { date: "2026-01-01", count: 9, level: 4 },
    { date: "2026-09-27", count: 1, level: 1 },
  ]);
  assert.match(svg, /Last active 2026-09-27/);
});

test("omits streak lastActive when no active day exists", () => {
  const svg = streakSvg([
    { date: "2026-09-27", count: 0, level: 0 },
    { date: "2026-01-01", count: 0, level: 0 },
  ]);
  assert.doesNotMatch(svg, /Last active/);
});
