import test from "node:test";
import assert from "node:assert/strict";
import { renderActivityCard } from "../dist/index.js";

function description(output) {
  return output.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/)?.[1] ?? "";
}

test("duplicate calendar days count once when the total is omitted", () => {
  const output = renderActivityCard({
    days: [
      { date: "2026-08-18", count: 4 },
      { date: "2026-08-18", count: 4 },
    ],
  });
  assert.match(output, />4 contributions<\/text>/);
  assert.doesNotMatch(output, />8 contributions<\/text>/);
  assert.equal((description(output).match(/2026-08-18 4/g) ?? []).length, 1);
  assert.doesNotMatch(output, /NaN|Infinity/);
});

test("a repeated zero day stays a measured zero", () => {
  const output = renderActivityCard({
    days: [
      { date: "2026-08-18", count: 0 },
      { date: "2026-08-18", count: 0 },
    ],
  });
  assert.match(output, />0 contributions<\/text>/);
  assert.doesNotMatch(output, /Total unavailable/);
});

test("a later different count for the same day is not added", () => {
  const output = renderActivityCard({
    days: [
      { date: "2026-08-18", count: 4 },
      { date: "2026-08-18", count: 9 },
    ],
  });
  assert.match(output, />4 contributions<\/text>/);
  assert.doesNotMatch(output, />13 contributions<\/text>/);
  assert.doesNotMatch(description(output), /2026-08-18 9/);
});

test("distinct days still sum when the total is omitted", () => {
  const output = renderActivityCard({
    days: [
      { date: "2026-08-18", count: 4 },
      { date: "2026-08-19", count: 2 },
    ],
  });
  assert.match(output, />6 contributions<\/text>/);
  assert.match(description(output), /2026-08-18 4; 2026-08-19 2/);
});

test("a supplied total stays the headline when days repeat", () => {
  const output = renderActivityCard({
    days: [
      { date: "2026-08-18", count: 4 },
      { date: "2026-08-18", count: 4 },
    ],
    total: 4,
  });
  assert.match(output, />4 contributions<\/text>/);
  assert.equal((description(output).match(/2026-08-18 4/g) ?? []).length, 1);
});
