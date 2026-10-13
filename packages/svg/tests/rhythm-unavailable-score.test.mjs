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

test("a non-finite rhythm score is unavailable instead of 0/100", () => {
  for (const score of nonFinite) {
    const output = render({ ...base, rhythm: { ...base.rhythm, score } });
    assert.match(output, />unavailable<\/text>/);
    assert.match(description(output), /score is unavailable/);
    assert.match(output, /stroke-dasharray="0\.00 /);
    assert.doesNotMatch(output, />0<\/text>/);
    assert.doesNotMatch(output, /0 out of 100/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a non-finite density is unavailable instead of 0% density", () => {
  for (const density of nonFinite) {
    const output = render({ ...base, density });
    assert.match(output, />density unavailable · 42 active days<\/text>/);
    assert.doesNotMatch(output, /(?<!\d)0% density/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a non-finite active-day count is unavailable instead of 0 active days", () => {
  for (const activeDays of nonFinite) {
    const output = render({ ...base, activeDays });
    assert.match(output, /active days unavailable/);
    assert.doesNotMatch(output, /(?<!\d)0 active days/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a non-finite window is unavailable instead of a 0-day window", () => {
  for (const days of nonFinite) {
    const output = render({ ...base, window: { ...base.window, days } });
    assert.match(output, />window unavailable · current 5 days · CLOSED<\/text>/);
    assert.doesNotMatch(output, /(?<!\d)0-day window/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a non-finite current streak is unavailable instead of 0 days", () => {
  for (const currentStreak of nonFinite) {
    const output = render({ ...base, currentStreak });
    assert.match(output, />84-day window · current streak unavailable<\/text>/);
    assert.match(description(output), /current streak unavailable/);
    assert.doesNotMatch(output, /(?<!\d)0 days/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a non-finite recent contribution count keeps the change wording without a zero count", () => {
  for (const recent28Days of nonFinite) {
    const output = render({ ...base, trend: { ...base.trend, recent28Days } });
    assert.match(description(output), /recent contributions unavailable · -50% vs prior 28 days/);
    assert.doesNotMatch(output, /0 recent contributions/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a measured zero rhythm stays a measured zero", () => {
  const output = render({
    ...base,
    window: { ...base.window, days: 0 },
    activeDays: 0,
    density: 0,
    currentStreak: 0,
    trend: { ...base.trend, recent28Days: 0 },
    rhythm: { ...base.rhythm, score: 0 },
  });
  assert.match(output, />0<\/text>/);
  assert.match(output, />\/ 100<\/text>/);
  assert.match(output, />0% density · 0 active days<\/text>/);
  assert.match(output, />0-day window · current 0 days · CLOSED<\/text>/);
  assert.match(output, /0 recent contributions/);
  assert.doesNotMatch(output, /score is unavailable|density unavailable|active days unavailable|window unavailable|current streak unavailable|recent contributions unavailable/);
  assert.doesNotMatch(output, /NaN|Infinity/);
});
