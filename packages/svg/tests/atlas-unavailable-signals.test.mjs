import test from "node:test";
import assert from "node:assert/strict";
import { renderAtlasCard } from "../dist/index.js";

const base = {
  profile: { name: "Ada Lovelace", login: "octocat", repositories: 24, followers: 312, stars: 487 },
  window: { from: "2026-01-01", to: "2026-02-25", days: 56 },
  total: 912,
  activeDays: 40,
  density: 71.4,
  averagePerDay: 2.5,
  currentStreak: 6,
  longestStreak: 11,
  streakBasis: "returned-window",
  streakBoundary: { current: "closed", longest: "closed" },
  peakDay: { date: "2026-02-25", count: 8 },
  breakdown: { commits: 20, issues: 2, pullRequests: 3, reviews: 1 },
  trend: { buckets: [1, 2], recent28Days: 12, previous28Days: 9, changePercent: 33.3, direction: "up" },
  rhythm: { score: 44, level: "steady" },
  activity: [{ date: "2026-02-25", count: 1, level: 1 }],
  languages: [{ name: "TypeScript", percentage: 55 }],
  projects: { total: 6, passing: 4, attention: 1, unavailable: 1 },
  generatedAt: "2026-02-25T18:00:00.000Z",
  source: "public-github",
};

const nonFinite = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

function render(patch) {
  return renderAtlasCard({ ...base, ...patch }, { motion: "none" });
}

function description(output) {
  return output.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/)?.[1] ?? "";
}

test("a non-finite atlas rhythm score is unavailable instead of 0/100", () => {
  for (const score of [undefined, null, ...nonFinite]) {
    const output = render({ rhythm: { ...base.rhythm, score } });
    assert.match(output, />unavailable<\/text>/);
    assert.doesNotMatch(output, />0\/100<\/text>/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a real zero atlas rhythm score stays 0/100", () => {
  const output = render({ rhythm: { ...base.rhythm, score: 0 } });
  assert.match(output, />0\/100<\/text>/);
  assert.doesNotMatch(output, />unavailable<\/text>/);
});

test("a negative atlas rhythm score stays clamped at 0/100", () => {
  const output = render({ rhythm: { ...base.rhythm, score: -3 } });
  assert.match(output, />0\/100<\/text>/);
  assert.doesNotMatch(output, />unavailable<\/text>/);
});

test("a non-finite atlas language percentage is unavailable instead of 0%", () => {
  for (const percentage of [undefined, null, ...nonFinite]) {
    const output = render({ languages: [{ name: "TypeScript", percentage }] });
    assert.match(output, />TypeScript unavailable<\/text>/);
    assert.doesNotMatch(output, />TypeScript 0%<\/text>/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a real zero atlas language percentage stays 0%", () => {
  const output = render({ languages: [{ name: "TypeScript", percentage: 0 }] });
  assert.match(output, />TypeScript 0%<\/text>/);
  assert.doesNotMatch(output, />TypeScript unavailable<\/text>/);
});

test("a non-finite peak count is unavailable instead of 0 PEAK", () => {
  for (const count of [undefined, null, ...nonFinite]) {
    const output = render({ peakDay: { ...base.peakDay, count } });
    assert.match(output, />peak unavailable · 2026-02-25<\/text>/);
    assert.doesNotMatch(output, />0 PEAK/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a real zero peak count stays 0 PEAK", () => {
  const output = render({ peakDay: { ...base.peakDay, count: 0 } });
  assert.match(output, />0 PEAK · 2026-02-25<\/text>/);
  assert.doesNotMatch(output, /peak unavailable/);
});

test("a non-finite atlas window length is unavailable instead of 0 days", () => {
  for (const days of [undefined, null, ...nonFinite]) {
    const output = render({ window: { ...base.window, days } });
    assert.match(output, />unavailable · 2026-02-25<\/text>/);
    assert.match(description(output), /across an unavailable window/);
    assert.doesNotMatch(output, />0D ·/);
    assert.doesNotMatch(description(output), /across 0 days/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a real zero atlas window length stays 0 days", () => {
  const output = render({ window: { ...base.window, days: 0 } });
  assert.match(output, />0D · 2026-02-25<\/text>/);
  assert.match(description(output), /across 0 days/);
  assert.doesNotMatch(description(output), /unavailable window/);
});

test("a non-finite recent trend count is unavailable instead of 0", () => {
  for (const recent28Days of [undefined, null, ...nonFinite]) {
    const output = render({ trend: { ...base.trend, recent28Days } });
    assert.match(output, />recent unavailable · \+33\.3% vs prior 28d<\/text>/);
    assert.doesNotMatch(output, />0 · \+33\.3% vs prior 28d<\/text>/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a real zero recent trend count stays 0", () => {
  const output = render({ trend: { ...base.trend, recent28Days: 0 } });
  assert.match(output, />0 · \+33\.3% vs prior 28d<\/text>/);
  assert.doesNotMatch(output, /recent unavailable/);
});

test("a non-finite atlas breakdown count is unavailable instead of 0", () => {
  for (const commits of [undefined, null, ...nonFinite]) {
    const output = render({ breakdown: { ...base.breakdown, commits } });
    assert.match(description(output), /unavailable commits/);
    assert.doesNotMatch(description(output), /\b0 commits/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a non-finite atlas profile-mix percentage is unavailable instead of 0%", () => {
  const output = render({
    breakdownBasis: "public-profile-percentages",
    breakdown: { ...base.breakdown, commits: Number.NaN },
  });
  assert.match(description(output), /unavailable commits/);
  assert.doesNotMatch(output, />0%<\/text>/);
  assert.doesNotMatch(description(output), /0% commits/);
  assert.doesNotMatch(output, /NaN|Infinity/);
});

test("real zero atlas counts stay zero together", () => {
  const output = render({
    rhythm: { ...base.rhythm, score: 0 },
    languages: [{ name: "TypeScript", percentage: 0 }],
    peakDay: { ...base.peakDay, count: 0 },
    window: { ...base.window, days: 0 },
    trend: { ...base.trend, recent28Days: 0 },
    breakdown: { ...base.breakdown, commits: 0 },
  });
  assert.match(output, />0\/100<\/text>/);
  assert.match(output, />TypeScript 0%<\/text>/);
  assert.match(output, />0 PEAK · 2026-02-25<\/text>/);
  assert.match(output, />0D · 2026-02-25<\/text>/);
  assert.match(description(output), /across 0 days/);
  assert.match(output, />0 · \+33\.3% vs prior 28d<\/text>/);
  assert.match(description(output), /\b0 commits/);
  assert.doesNotMatch(output, /score unavailable|TypeScript unavailable|peak unavailable|recent unavailable|unavailable commits|unavailable window/);
});
