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

function render(patch) {
  return renderAtlasCard({ ...base, ...patch }, { motion: "none" });
}

test("valid atlas dates stay visible", () => {
  const output = render({});
  assert.match(output, />OBSERVED HISTORY · 56D<\/text>/);
  assert.match(output, /Observed history 2026-01-01 to 2026-02-25/);
  assert.match(output, />2026-02-25<\/text>/);
  assert.match(output, />1 PEAK<\/text>/);
  assert.match(output, /Generated 2026-02-25T18:00:00\.000Z ·/);
  assert.doesNotMatch(output, /Generated unavailable/);
  assert.doesNotMatch(output, /date unavailable/);
});

test("an invalid atlas window end is unavailable instead of the raw text", () => {
  const output = render({ window: { ...base.window, from: "", to: "not-a-date" } });
  assert.match(output, />OBSERVED HISTORY · dates unavailable<\/text>/);
  assert.doesNotMatch(output, /not-a-date/);
  assert.doesNotMatch(output, />2026-01-01<\/text>/);
  assert.match(output, /Observed history unavailable to unavailable/);
});

test("the calendar peak uses displayed observations instead of an invalid history peak", () => {
  for (const date of ["2026-02-31", "2026-13-40", ""]) {
    const output = render({ peakDay: { date, count: 8 } });
    assert.match(output, />1 PEAK<\/text>/);
    assert.doesNotMatch(output, new RegExp(date ? date.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : />\s*PEAK ·\s*</));
    assert.doesNotMatch(output, />8 PEAK · 2026-02-31<\/text>/);
    assert.doesNotMatch(output, />8 PEAK · 2026-13-40<\/text>/);
  }
});

test("missing history peak fields cannot replace an observed calendar peak", () => {
  const output = render({ peakDay: { date: "2026-02-31", count: Number.NaN } });
  assert.match(output, />1 PEAK<\/text>/);
  assert.doesNotMatch(output, /2026-02-31/);
  assert.doesNotMatch(output, />0 PEAK/);
});

test("a non-timestamp generatedAt is unavailable", () => {
  for (const generatedAt of ["yesterday", "2026-02-31T00:00:00.000Z", ""]) {
    const output = render({ generatedAt });
    assert.match(output, /Generated unavailable ·/);
    assert.doesNotMatch(output, /yesterday/);
    assert.doesNotMatch(output, /2026-02-31/);
    assert.doesNotMatch(output, /Generated {2}·/);
  }
});

test("an omitted generatedAt is unavailable", () => {
  const data = { ...base };
  delete data.generatedAt;
  const output = renderAtlasCard(data, { motion: "none" });
  assert.match(output, /Generated unavailable ·/);
  assert.doesNotMatch(output, /Generated {2}·/);
});
