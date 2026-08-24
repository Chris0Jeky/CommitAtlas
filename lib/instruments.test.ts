import assert from "node:assert/strict";
import test from "node:test";
import {
  compactCount,
  densityGrid,
  densityLevelOpacity,
  gaugeReading,
  isEmptyDensityCell,
  momentumTrace,
  quarterMeter,
  reticle,
  signedPercent,
} from "./instruments";

function pathPoints(path: string): { x: number; y: number }[] {
  return path.split(" ").map((command) => {
    const [x, y] = command.slice(1).split(",").map(Number);
    return { x: x!, y: y! };
  });
}

test("the momentum trace spans the plot area and scales to the window's own peak", () => {
  const counts = [4, 3, 2, 1, 0, 0, 7, 6, 5, 4];
  const trace = momentumTrace(counts);

  assert.equal(trace.peak, 7);
  assert.equal(trace.flat, false);
  assert.equal(trace.points.length, counts.length);

  const points = pathPoints(trace.path);
  assert.deepEqual(points, [...trace.points]);
  assert.equal(points[0]!.x, 4);
  assert.equal(points.at(-1)!.x, 330);
  // The peak sits at the top of the plot area and a zero day sits on the baseline. Anything else
  // would mean a day with no contributions renders above the floor, which reads as activity.
  assert.equal(Math.min(...points.map((point) => point.y)), 14);
  assert.equal(points[4]!.y, 82);
  assert.equal(points[5]!.y, 82);
});

test("an all-zero window draws a flat baseline rather than a full-height trace", () => {
  // Dividing by a zero peak would make every point NaN, and an NaN in a path attribute silently
  // drops the whole trace. A window with no contributions has to look like one.
  const trace = momentumTrace([0, 0, 0, 0]);
  assert.equal(trace.flat, true);
  assert.equal(trace.peak, 0);
  for (const point of trace.points) assert.equal(point.y, 82);
  assert.doesNotMatch(trace.path, /NaN|Infinity/);
});

test("the momentum trace survives an empty or non-finite series", () => {
  const empty = momentumTrace([]);
  assert.equal(empty.points.length, 0);
  assert.equal(empty.path, "M4,82 L330,82");

  const dirty = momentumTrace([Number.NaN, 3, Number.POSITIVE_INFINITY, -5, 6]);
  assert.deepEqual(dirty.points.map((point) => point.x), [4, 167, 330]);
  assert.equal(dirty.peak, 6);
  // The negative value is floored at zero rather than inverting the trace below the baseline.
  assert.equal(dirty.points[1]!.y, 82);
  assert.doesNotMatch(dirty.path, /NaN|Infinity|-\d+\.?\d*,/);
});

test("the rhythm gauge maps 0-100 onto a -90 to +90 needle", () => {
  assert.equal(gaugeReading(0).angle, -90);
  assert.equal(gaugeReading(50).angle, 0);
  assert.equal(gaugeReading(100).angle, 90);
  // 72 is the reading the synthetic octocat window produces, and 39.6 is the needle the design
  // canvas specifies for it. The two agree because the mapping is the same one.
  assert.equal(gaugeReading(72).angle, 39.6);
  assert.equal(gaugeReading(72).dash, "72 28");
  assert.equal(gaugeReading(72).ticks.length, 7);
});

test("the rhythm gauge refuses to render an out-of-range reading as an in-range one", () => {
  for (const [score, angle] of [[-20, -90], [140, 90], [Number.NaN, -90]] as const) {
    const gauge = gaugeReading(score);
    assert.equal(gauge.angle, angle);
    assert.doesNotMatch(gauge.dash, /NaN|-/);
  }
});

test("the density grid lays a calendar out by week column and weekday row", () => {
  // 2026-08-24 is a Monday, so the first cell belongs in row 1 and the first column is partial.
  const days = Array.from({ length: 14 }, (_, offset) => ({
    date: new Date(Date.UTC(2026, 7, 24 + offset)).toISOString().slice(0, 10),
    count: offset,
    level: offset % 5,
  }));
  const grid = densityGrid(days);

  assert.equal(grid.cells.length, 14);
  assert.equal(grid.cells[0]!.y, 5, "a Monday must not be placed on the Sunday row");
  assert.equal(grid.cells[0]!.column, 0);
  assert.equal(grid.cells[5]!.column, 0, "the first six days share the partial opening column");
  assert.equal(grid.cells[6]!.column, 1, "the following Sunday opens a new column");
  assert.equal(grid.cells[6]!.y, 0);
  assert.equal(grid.columns, 3);
  assert.equal(grid.viewBox, "0 0 14 34");
});

test("a day with no contributions is a socket, never a faint tint of the activity colour", () => {
  // A pale orange square reads as a little activity. A day with none had none, so it is drawn in
  // neutral ink instead — which is also the only version of this that survives a light theme.
  assert.equal(isEmptyDensityCell(0, 0), true);
  assert.equal(isEmptyDensityCell(0, 3), true, "level 0 wins even if a count leaked through");
  assert.equal(isEmptyDensityCell(2, 0), true, "a zero count wins even if a level leaked through");
  assert.equal(isEmptyDensityCell(Number.NaN, Number.NaN), true, "an unreadable cell is never filled");
  assert.equal(isEmptyDensityCell(1, 1), false);
});

test("the active-level ramp rises monotonically and is bounded at both ends", () => {
  const opacities = [1, 2, 3, 4].map(densityLevelOpacity);
  assert.deepEqual([...opacities].sort((a, b) => a - b), opacities);
  assert.equal(opacities[0]! > 0.2, true, "the faintest active day must still be visible");
  assert.equal(opacities.at(-1), 1);
  assert.equal(densityLevelOpacity(9), densityLevelOpacity(4));
  assert.equal(densityLevelOpacity(-3), densityLevelOpacity(1));
});

test("an empty calendar produces a drawable, non-degenerate grid", () => {
  const grid = densityGrid([]);
  assert.equal(grid.cells.length, 0);
  assert.equal(grid.columns, 0);
  assert.doesNotMatch(grid.viewBox, /-|NaN/);
});

test("the portfolio reticle keeps its ring when nothing reports", () => {
  const empty = reticle(0);
  assert.equal(empty.lamps.length, 0);
  assert.equal(empty.rings.length, 3);
  assert.ok(empty.radius > 0, "the ring disappears when no project is declared");

  const two = reticle(2);
  assert.equal(two.lamps.length, 2);
  assert.deepEqual(two.lamps[0], { index: 0, x: 110, y: 10 });
  assert.deepEqual(two.lamps[1], { index: 1, x: 110, y: 86 });
});

test("counts compact the way the chassis prints them", () => {
  assert.equal(compactCount(0), "0");
  assert.equal(compactCount(999), "999");
  assert.equal(compactCount(1_000), "1k");
  assert.equal(compactCount(1_142), "1.1k");
  assert.equal(compactCount(1_250_000), "1.3m");
  assert.equal(compactCount(Number.NaN), "—");
});

test("a percentage change prints its sign, and an absent comparison prints nothing", () => {
  assert.equal(signedPercent(null), "—");
  assert.equal(signedPercent(Number.NaN), "—");
  assert.equal(signedPercent(0), "0%");
  assert.equal(signedPercent(4.25), "+4.3%");
  // U+2212, not a hyphen: at 10px mono a hyphen reads as a range dash.
  assert.equal(signedPercent(-1.1), "−1.1%");
});

test("the four-square meter bins a reading without rounding nothing up to something", () => {
  // 72 is the synthetic window's rhythm score, and three filled squares is what the design canvas
  // shows against it. The two agree because this is the binning that produced it.
  assert.equal(quarterMeter(72), 3);
  assert.equal(quarterMeter(0), 0, "an empty meter is reserved for a score of nothing");
  assert.equal(quarterMeter(1), 1, "a score of 1 is not nothing");
  assert.equal(quarterMeter(25), 1);
  assert.equal(quarterMeter(26), 2);
  assert.equal(quarterMeter(100), 4);
  // Out of range in either direction still produces a drawable meter.
  assert.equal(quarterMeter(140), 4);
  assert.equal(quarterMeter(-5), 0);
  assert.equal(quarterMeter(Number.NaN), 0);
});
