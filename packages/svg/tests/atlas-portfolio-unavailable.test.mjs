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

function render(profile) {
  return renderAtlasCard({ ...base, profile: { ...base.profile, ...profile } });
}

test("a non-finite repository count is unavailable instead of 0 repos", () => {
  for (const repositories of nonFinite) {
    const output = render({ repositories });
    assert.match(output, />repos unavailable · 312 followers · 487 stars<\/text>/);
    assert.doesNotMatch(output, /0 repos/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a non-finite follower count is unavailable instead of 0 followers", () => {
  for (const followers of nonFinite) {
    const output = render({ followers });
    assert.match(output, />24 repos · followers unavailable · 487 stars<\/text>/);
    assert.doesNotMatch(output, /0 followers/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("measured zero repository and follower counts stay zero", () => {
  const output = render({ repositories: 0, followers: 0, stars: 0 });
  assert.match(output, />0 repos · 0 followers · 0 stars<\/text>/);
  assert.doesNotMatch(output, /repos unavailable|followers unavailable|stars unavailable/);
});
