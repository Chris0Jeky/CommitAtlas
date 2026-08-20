import assert from "node:assert/strict";
import test from "node:test";
import { demoContributionBreakdown, demoContributions } from "./demo";

const NOW = new Date("2026-08-19T00:00:00.000Z");
const KEYS = ["commits", "issues", "pullRequests", "reviews"] as const;

test("allocates the canonical synthetic breakdown with largest remainders", () => {
  assert.deepEqual(demoContributionBreakdown(0), { commits: 0, issues: 0, pullRequests: 0, reviews: 0 });
  assert.deepEqual(demoContributionBreakdown(7), { commits: 5, issues: 0, pullRequests: 1, reviews: 1 });
  assert.deepEqual(demoContributionBreakdown(30), { commits: 19, issues: 2, pullRequests: 4, reviews: 5 });
  assert.deepEqual(demoContributionBreakdown(50), { commits: 32, issues: 3, pullRequests: 7, reviews: 8 });
  assert.deepEqual(demoContributionBreakdown(365), { commits: 234, issues: 18, pullRequests: 51, reviews: 62 });
});

test("rejects invalid totals and preserves safe integer arithmetic", () => {
  for (const total of [-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => demoContributionBreakdown(total), RangeError);
  }
  const maximum = demoContributionBreakdown(Number.MAX_SAFE_INTEGER);
  assert.equal(sumBreakdown(maximum), Number.MAX_SAFE_INTEGER);
  assert.ok(KEYS.every((key) => Number.isSafeInteger(maximum[key]) && maximum[key] >= 0));
});

test("is deterministic, keeps the canonical basis, and sums each demo window exactly", () => {
  assert.deepEqual(demoContributionBreakdown(123456), demoContributionBreakdown(123456));
  const windows = [
    [7, 27, { commits: 17, issues: 1, pullRequests: 4, reviews: 5 }],
    [30, 97, { commits: 62, issues: 5, pullRequests: 14, reviews: 16 }],
    [365, 1142, { commits: 731, issues: 57, pullRequests: 160, reviews: 194 }],
  ] as const;
  for (const [requestedDays, expectedTotal, expectedBreakdown] of windows) {
    const contributions = demoContributions("octocat", requestedDays, NOW);
    assert.equal(contributions.breakdownBasis, "exact-counts");
    assert.equal(contributions.totalContributions, expectedTotal);
    assert.deepEqual(
      Object.fromEntries(KEYS.map((key) => [key, contributions[key]])),
      expectedBreakdown,
    );
    assert.equal(sumBreakdown(contributions), contributions.totalContributions);
    assert.equal(contributions.totalContributions, contributions.days.reduce((sum, day) => sum + day.count, 0));
    assert.ok(KEYS.every((key) => Number.isSafeInteger(contributions[key]) && contributions[key] >= 0));
    assert.deepEqual(contributions, demoContributions("octocat", requestedDays, NOW));
  }
});

function sumBreakdown(breakdown: Record<(typeof KEYS)[number], number>): number {
  return KEYS.reduce((sum, key) => sum + breakdown[key], 0);
}
