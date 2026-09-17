import assert from "node:assert/strict";
import test from "node:test";
import { densityScanMotion } from "./instruments";

test("two density columns pulse in the sole legal gutter", () => {
  assert.deepEqual(densityScanMotion(2), {
    travelPx: 0,
    steps: 1,
  });
});

test("wider density grids retain one stepped stop per gutter", () => {
  assert.deepEqual(densityScanMotion(3), {
    travelPx: 10,
    steps: 2,
  });
  assert.deepEqual(densityScanMotion(5), {
    travelPx: 20,
    steps: 4,
  });
});

test("a scan is omitted when the grid has fewer than two usable columns", () => {
  for (const columns of [0, 1, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(densityScanMotion(columns), null);
  }
});
