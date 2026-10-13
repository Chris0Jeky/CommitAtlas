import test from "node:test";
import assert from "node:assert/strict";
import { renderActivityCard, renderAtlasCard, renderLanguagesCard } from "../dist/index.js";

function metric(output, label) {
  const match = new RegExp(`>([^<]*)</text><text[^>]*>${label}</text>`).exec(output);
  assert.ok(match, `missing headline ${label}`);
  return match[1];
}

function atlasFixture(overrides = {}) {
  return {
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
    ...overrides,
  };
}

test("activity headline does not paint a non-finite total as zero contributions", () => {
  const days = [{ date: "2026-08-18", count: 4 }, { date: "2026-08-19", count: 2 }];
  for (const total of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const output = renderActivityCard({ days, total });
    assert.match(output, />Total unavailable<\/text>/);
    assert.doesNotMatch(output, /0 contributions|6 contributions/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }

  const missing = renderActivityCard({
    days: [{ date: "2026-08-18", count: 4 }, { date: "2026-08-19", count: Number.NaN }, { date: "2026-08-20", count: 2 }],
  });
  assert.match(missing, />6 contributions<\/text>/);
  assert.doesNotMatch(missing, /Total unavailable/);

  const zero = renderActivityCard({ days: [{ date: "2026-08-18", count: 3 }], total: 0 });
  assert.match(zero, />0 contributions<\/text>/);
  assert.doesNotMatch(zero, /Total unavailable/);

  const empty = renderActivityCard({ days: [] });
  assert.match(empty, />0 contributions<\/text>/);
  assert.doesNotMatch(empty, /Total unavailable/);

  const unknownDays = renderActivityCard({
    days: [{ date: "2026-08-18", count: Number.NaN }, { date: "2026-08-19", count: Number.POSITIVE_INFINITY }],
  });
  assert.match(unknownDays, />Total unavailable<\/text>/);
  assert.doesNotMatch(unknownDays, /0 contributions/);
});

test("a language item with no finite share is not an observed 0%", () => {
  for (const item of [
    { name: "Rust" },
    { name: "Rust", percentage: Number.NaN, bytes: Number.NaN },
    { name: "Rust", percentage: Number.POSITIVE_INFINITY },
    { name: "Rust", bytes: Number.NEGATIVE_INFINITY },
  ]) {
    const output = renderLanguagesCard({ languages: [item, { name: "Go" }] });
    assert.match(output, />Rust</);
    assert.match(output, />Go</);
    assert.match(output, />Languages unavailable<\/text>/);
    assert.doesNotMatch(output, />0%<\/text>/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }

  const zeroShare = renderLanguagesCard({
    languages: [{ name: "Rust", percentage: 0 }, { name: "Go", percentage: 100 }],
  });
  assert.match(zeroShare, />0%<\/text>/);
  assert.match(zeroShare, />100%<\/text>/);
  assert.doesNotMatch(zeroShare, /Languages unavailable/);

  const zeroBytes = renderLanguagesCard({
    languages: [{ name: "Rust", bytes: 0 }, { name: "Go", bytes: 10 }],
  });
  assert.match(zeroBytes, />0%<\/text>/);
  assert.match(zeroBytes, />100%<\/text>/);
  assert.doesNotMatch(zeroBytes, /Languages unavailable/);
});

test("atlas headline stats do not paint non-finite values as observed zeros", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const output = renderAtlasCard(atlasFixture({
      total: value,
      activeDays: value,
      density: value,
      averagePerDay: value,
      currentStreak: value,
      longestStreak: value,
      streakBoundary: { current: "open", longest: "open" },
    }), { motion: "none" });
    assert.equal(metric(output, "CONTRIBUTIONS"), "unavailable");
    assert.equal(metric(output, "ACTIVE DAYS"), "unavailable");
    assert.equal(metric(output, "DENSITY"), "unavailable");
    assert.equal(metric(output, "AVERAGE / DAY"), "unavailable");
    assert.equal(metric(output, "CURRENT STREAK"), "unavailable");
    assert.equal(metric(output, "LONGEST IN WINDOW"), "unavailable");
    assert.match(output, /Total unavailable across 56 days/);
    assert.match(output, /Active days unavailable/);
    assert.doesNotMatch(output, /0 contributions|0 active days|0% density|0\+d|0d</);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }

  const zero = renderAtlasCard(atlasFixture({
    total: 0,
    activeDays: 0,
    density: 0,
    averagePerDay: 0,
    currentStreak: 0,
    longestStreak: 0,
  }), { motion: "none" });
  assert.equal(metric(zero, "CONTRIBUTIONS"), "0");
  assert.equal(metric(zero, "ACTIVE DAYS"), "0");
  assert.equal(metric(zero, "DENSITY"), "0%");
  assert.equal(metric(zero, "AVERAGE / DAY"), "0.0");
  assert.equal(metric(zero, "CURRENT STREAK"), "0d");
  assert.equal(metric(zero, "LONGEST IN WINDOW"), "0d");
  assert.match(zero, /0 contributions across 56 days/);
  assert.doesNotMatch(zero, /Total unavailable|Active days unavailable|density unavailable|streak unavailable/);
});
