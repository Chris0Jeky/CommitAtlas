import test from "node:test";
import assert from "node:assert/strict";
import { renderContributionBreakdownCard } from "../dist/index.js";

const window = { from: "2026-01-01", to: "2026-03-24", days: 84 };
const counts = { commits: 20, issues: 2, pullRequests: 3, reviews: 1 };
const nonFinite = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

function description(output) {
  return output.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/)?.[1] ?? "";
}

test("a non-finite exact count is unavailable instead of 0", () => {
  for (const commits of nonFinite) {
    const output = renderContributionBreakdownCard({
      window,
      basis: "exact-counts",
      breakdown: { ...counts, commits },
    });
    assert.match(output, />unavailable<\/text>/);
    assert.match(description(output), /Commits: unavailable/);
    assert.match(output, />2<\/text>/);
    assert.doesNotMatch(output, />0<\/text>/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a measured zero exact count stays zero", () => {
  const output = renderContributionBreakdownCard({
    window,
    basis: "exact-counts",
    breakdown: { ...counts, commits: 0 },
  });
  assert.match(output, />0<\/text>/);
  assert.match(description(output), /Commits: 0/);
  assert.doesNotMatch(output, /unavailable/);
});

test("a non-finite public percentage is unavailable and a real zero percent remains", () => {
  for (const commits of nonFinite) {
    const output = renderContributionBreakdownCard({
      window,
      basis: "public-profile-percentages",
      breakdown: { commits, issues: 10, pullRequests: 0, reviews: 5 },
    });
    assert.match(description(output), /Commits: unavailable/);
    assert.match(output, />0%<\/text>/);
    assert.match(description(output), /Pull requests: 0%/);
    assert.doesNotMatch(description(output), /Commits: 0%/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a measured zero percent stays zero percent", () => {
  const output = renderContributionBreakdownCard({
    window,
    basis: "public-profile-percentages",
    breakdown: { commits: 0, issues: 10, pullRequests: 0, reviews: 5 },
  });
  assert.match(description(output), /Commits: 0%/);
  assert.doesNotMatch(description(output), /Commits: unavailable/);
});

test("a non-finite breakdown window is unavailable instead of 0 days", () => {
  for (const days of nonFinite) {
    const output = renderContributionBreakdownCard({
      window: { ...window, days },
      basis: "exact-counts",
      breakdown: counts,
    });
    assert.match(output, />2026-01-01 → 2026-03-24 · window unavailable<\/text>/);
    assert.match(description(output), /window unavailable/);
    assert.match(output, />20<\/text>/);
    assert.doesNotMatch(output, /0 days/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});
