import test from "node:test";
import assert from "node:assert/strict";
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

const nonFinite = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

function render(data) {
  return renderRhythmCard(data, { motion: "none" });
}

function description(output) {
  return output.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/)?.[1] ?? "";
}

test("an unknown rhythm score shows UNAVAILABLE on the card instead of the band word", () => {
  for (const score of [undefined, null, ...nonFinite]) {
    const output = render({ ...base, rhythm: { ...base.rhythm, score } });
    assert.match(output, />UNAVAILABLE<\/text>/);
    assert.doesNotMatch(output, />STEADY<\/text>/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("an unknown rhythm score's accessible description says unavailable and omits the band word", () => {
  for (const score of [undefined, null, ...nonFinite]) {
    const output = render({ ...base, rhythm: { ...base.rhythm, score } });
    assert.match(description(output), /score is unavailable/);
    assert.doesNotMatch(description(output), /steady/i);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a known rhythm score keeps its band word on the card and in the description", () => {
  const output = render({ ...base, rhythm: { ...base.rhythm, score: 60 } });
  assert.match(output, />STEADY<\/text>/);
  assert.doesNotMatch(output, />UNAVAILABLE<\/text>/);
  assert.match(description(output), /Personal consistency score 60 out of 100, steady;/);
});
