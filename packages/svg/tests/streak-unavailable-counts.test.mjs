import test from "node:test";
import assert from "node:assert/strict";
import { renderStreakCard } from "../dist/index.js";

const nonFinite = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

test("a non-finite current streak is unavailable instead of no current streak", () => {
  for (const current of nonFinite) {
    const output = renderStreakCard({
      current,
      longest: 4,
      total: 9,
      activeDays: 3,
      boundary: { current: "closed", longest: "closed" },
    });
    assert.doesNotMatch(output, /no current streak/);
    assert.match(output, /unavailable/);
    assert.match(output, />unavailable<\/text>/);
    assert.match(output, />current streak unavailable<\/text>/);
    assert.match(output, /<desc>[^<]*current streak unavailable/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a non-finite longest streak is unavailable instead of zero days", () => {
  for (const longest of nonFinite) {
    const output = renderStreakCard({
      current: 3,
      longest,
      total: 9,
      activeDays: 3,
      boundary: { current: "closed", longest: "closed" },
    });
    assert.doesNotMatch(output, />0 days</);
    assert.match(output, /Longest unavailable/);
    assert.match(output, />Longest unavailable<\/text>/);
    assert.match(output, /<desc>[^<]*Longest unavailable/);
    assert.doesNotMatch(output, /<desc>[^<]*0 days/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
});

test("a measured zero streak still says there is no current streak and zero days", () => {
  const output = renderStreakCard({ current: 0, longest: 0 });
  assert.match(output, /no current streak/);
  assert.match(output, />0 days</);
  assert.doesNotMatch(output, /current streak unavailable|Longest unavailable/);
});
