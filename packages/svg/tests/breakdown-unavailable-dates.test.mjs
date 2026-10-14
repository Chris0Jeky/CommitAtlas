import test from "node:test";
import assert from "node:assert/strict";
import { renderContributionBreakdownCard } from "../dist/index.js";

const counts = { commits: 20, issues: 2, pullRequests: 3, reviews: 1 };
const validWindow = { from: "2026-01-01", to: "2026-03-24", days: 84 };

function description(output) {
  return output.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/)?.[1] ?? "";
}

test("valid breakdown dates stay on the scope line", () => {
  const output = renderContributionBreakdownCard({
    window: validWindow,
    basis: "exact-counts",
    breakdown: counts,
  });
  assert.match(output, />2026-01-01 → 2026-03-24 · 84 days<\/text>/);
  assert.match(description(output), /exact categorized counts for 2026-01-01 to 2026-03-24, 84 days/);
  assert.doesNotMatch(output, />unavailable · 84 days<\/text>/);
});

test("an invalid breakdown window edge is unavailable instead of the raw string", () => {
  for (const to of ["not-a-date", "2026-02-31", "2026-13-40", ""]) {
    const output = renderContributionBreakdownCard({
      window: { from: "2026-01-01", to, days: 84 },
      basis: "exact-counts",
      breakdown: counts,
    });
    assert.match(output, />2026-01-01 → unavailable · 84 days<\/text>/);
    assert.match(description(output), /exact categorized counts for 2026-01-01 to unavailable, 84 days/);
    assert.doesNotMatch(output, /not-a-date|2026-02-31|2026-13-40/);
    assert.match(output, />20<\/text>/);
  }
});

test("both invalid breakdown dates collapse, and a known day count remains", () => {
  const output = renderContributionBreakdownCard({
    window: { from: "", to: "not-a-date", days: 84 },
    basis: "exact-counts",
    breakdown: counts,
  });
  assert.match(output, />unavailable · 84 days<\/text>/);
  assert.doesNotMatch(output, /unavailable → unavailable/);
  assert.match(description(output), /exact categorized counts for unavailable to unavailable, 84 days/);
  assert.doesNotMatch(output, /not-a-date/);
});

test("a markup-like invalid date is not painted", () => {
  const output = renderContributionBreakdownCard({
    window: { from: "<bad", to: "2026-03-24", days: 84 },
    basis: "exact-counts",
    breakdown: counts,
  });
  assert.match(output, />unavailable → 2026-03-24 · 84 days<\/text>/);
  assert.doesNotMatch(output, /<bad|&lt;bad/);
});
