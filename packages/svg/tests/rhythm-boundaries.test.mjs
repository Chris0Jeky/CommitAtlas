import assert from "node:assert/strict";
import test from "node:test";
import { renderRhythmCard } from "../dist/index.js";

const base = {
  window: { from: "2026-01-01", to: "2026-03-24", days: 84 },
  activeDays: 42,
  density: 50,
  currentStreak: 5,
  currentStreakBoundary: "closed",
  currentStreakThrough: "2026-03-24",
  trend: {
    buckets: [1, 2, 3, 4],
    recent28Days: 7,
    previous28Days: 14,
    changePercent: -50,
    direction: "down",
  },
  rhythm: {
    score: 60,
    level: "steady",
    basis: "70% active-day density (capped at 80%) + 30% current streak (capped at 30 days)",
  },
};

test("rhythm cards state new, flat, and downward trends visibly and accessibly", () => {
  const cases = [
    {
      trend: { ...base.trend, previous28Days: 0, changePercent: null, direction: "new" },
      expected: "7 recent contributions · new activity",
    },
    {
      trend: { ...base.trend, previous28Days: 7, changePercent: 0, direction: "flat" },
      expected: "7 recent contributions · flat vs prior 28 days",
    },
    {
      trend: { ...base.trend, previous28Days: 14, changePercent: -50, direction: "down" },
      expected: "7 recent contributions · -50% vs prior 28 days",
    },
  ];

  for (const { trend, expected } of cases) {
    const output = renderRhythmCard({ ...base, trend }, { motion: "none" });
    const description = output.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/)?.[1] ?? "";
    const visibleText = [...output.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
      .map((match) => match[1])
      .join(" ");
    assert.match(description, new RegExp(escapeRegex(expected)));
    assert.match(visibleText, new RegExp(escapeRegex(expected)));
  }
});

test("rhythm cards render only the latest twelve weekly buckets", () => {
  const latestTwelve = Array.from({ length: 12 }, (_, index) => index + 1);
  const earlierA = [91, 92, 93, 94];
  const earlierB = [1, 1, 1, 1];

  const fromA = renderRhythmCard({
    ...base,
    trend: { ...base.trend, buckets: [...earlierA, ...latestTwelve] },
  }, { motion: "none" });
  const fromB = renderRhythmCard({
    ...base,
    trend: { ...base.trend, buckets: [...earlierB, ...latestTwelve] },
  }, { motion: "none" });
  const exactlyTwelve = renderRhythmCard({
    ...base,
    trend: { ...base.trend, buckets: latestTwelve },
  }, { motion: "none" });

  assert.equal(fromA, exactlyTwelve);
  assert.equal(fromB, exactlyTwelve);

  const changedOldestRetainedBucket = renderRhythmCard({
    ...base,
    trend: { ...base.trend, buckets: [99, ...latestTwelve.slice(1)] },
  }, { motion: "none" });
  const changedNewestRetainedBucket = renderRhythmCard({
    ...base,
    trend: { ...base.trend, buckets: [...latestTwelve.slice(0, 11), 99] },
  }, { motion: "none" });
  assert.notEqual(changedOldestRetainedBucket, exactlyTwelve);
  assert.notEqual(changedNewestRetainedBucket, exactlyTwelve);
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
