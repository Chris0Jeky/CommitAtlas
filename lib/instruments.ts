/**
 * Geometry for the instrument fascia.
 *
 * Every function here turns an *observed* value into a drawable shape and nothing else. There is no
 * smoothing, no interpolation onto a nicer curve, and no clamping that would let an out-of-range
 * reading render as an in-range one — a value the instrument cannot draw is reported as such by the
 * caller rather than quietly pinned to the end of the scale.
 *
 * The instruments are decoration only in the sense that the *numbers are always printed as text
 * beside them*. Nothing here is load-bearing: if the SVG fails to render, the bay still reads.
 */

export interface Point {
  x: number;
  y: number;
}

export interface MomentumTrace {
  /** `viewBox` this path is drawn in. */
  viewBox: string;
  width: number;
  height: number;
  /** Polyline through the observed counts, oldest first. */
  path: string;
  points: readonly Point[];
  /** The largest observed count in the window; the top of the plotted range. */
  peak: number;
  /** True when every observed count is zero, so the trace is a flat rule at the baseline. */
  flat: boolean;
}

const MOMENTUM_GEOMETRY = { width: 336, height: 96, left: 4, right: 330, top: 14, bottom: 82 } as const;

/**
 * Plot a daily contribution series as a plotter trace.
 *
 * The vertical scale is the window's own peak, not a global constant: this is a *momentum* trace,
 * and the shape people read from it is the rhythm of the window, not its magnitude against some
 * other window. The magnitude is the number printed next to it.
 */
export function momentumTrace(counts: readonly number[]): MomentumTrace {
  const { width, height, left, right, top, bottom } = MOMENTUM_GEOMETRY;
  const viewBox = `0 0 ${width} ${height}`;
  const series = counts.filter((count) => Number.isFinite(count)).map((count) => Math.max(0, count));

  if (series.length === 0) {
    return { viewBox, width, height, path: `M${left},${bottom} L${right},${bottom}`, points: [], peak: 0, flat: true };
  }

  const peak = series.reduce((highest, count) => (count > highest ? count : highest), 0);
  const span = right - left;
  const points = series.map((count, index) => ({
    x: series.length === 1 ? left : Number((left + (span * index) / (series.length - 1)).toFixed(2)),
    y: peak === 0 ? bottom : Number((bottom - ((bottom - top) * count) / peak).toFixed(2)),
  }));

  // A single observation is a level, not a trend. Drawn as a full-width rule at its own height it
  // reads as one steady value; drawn as a bare moveto — which is what a one-point polyline is — it
  // reads as nothing at all, while the pen dot still rides a zero-length path.
  const path = points.length === 1
    ? `M${left},${points[0]!.y} L${right},${points[0]!.y}`
    : points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  return {
    viewBox,
    width,
    height,
    path,
    points,
    peak,
    flat: peak === 0,
  };
}

export interface GaugeReading {
  viewBox: string;
  /** Semicircular track, swept left to right. */
  arc: string;
  /** Needle rotation in degrees: `-90` at zero, `+90` at full scale. */
  angle: number;
  /** `stroke-dasharray` for the filled portion, against `pathLength="100"`. */
  dash: string;
  centre: Point;
  /** Tick marks at 0, 50, and 100 plus the four intermediates. */
  ticks: readonly { x1: number; y1: number; x2: number; y2: number }[];
}

const GAUGE = { width: 220, height: 122, cx: 110, cy: 110, radius: 86 } as const;

/**
 * Map a 0–100 consistency score onto a −90°…+90° needle.
 *
 * The score is a CommitAtlas *evenness* reading, not a rank and not a percentile, which is why the
 * gauge prints `EVENNESS · NOT A RANK` rather than a grade. A value outside 0–100 is a programming
 * error upstream, so it is clamped here *and* the clamp is visible in the returned `dash` — the
 * caller prints the raw number regardless, so a clamped needle never hides a bad reading.
 */
export function gaugeReading(score: number): GaugeReading {
  const bounded = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
  const { cx, cy, radius, width, height } = GAUGE;
  const ticks = Array.from({ length: 7 }, (_, index) => {
    const radians = Math.PI - (Math.PI * index) / 6;
    const outer = { x: cx + radius * Math.cos(radians), y: cy - radius * Math.sin(radians) };
    const inner = { x: cx + (radius - 8) * Math.cos(radians), y: cy - (radius - 8) * Math.sin(radians) };
    return {
      x1: Number(outer.x.toFixed(1)),
      y1: Number(outer.y.toFixed(1)),
      x2: Number(inner.x.toFixed(1)),
      y2: Number(inner.y.toFixed(1)),
    };
  });

  return {
    viewBox: `0 0 ${width} ${height}`,
    arc: `M${cx - radius},${cy} A${radius},${radius} 0 0 1 ${cx + radius},${cy}`,
    angle: Number((bounded * 1.8 - 90).toFixed(2)),
    dash: `${Number(bounded.toFixed(2))} ${Number((100 - bounded).toFixed(2))}`,
    centre: { x: cx, y: cy },
    ticks,
  };
}

export interface DensityCell {
  date: string;
  count: number;
  level: number;
  x: number;
  y: number;
  /** Zero-based week column, used to stagger the fill left to right in date order. */
  column: number;
}

export interface DensityGrid {
  viewBox: string;
  columns: number;
  cell: number;
  gap: number;
  cells: readonly DensityCell[];
}

const DENSITY = { cell: 4, gap: 1, rows: 7 } as const;

/**
 * Lay a contribution calendar out the way GitHub does: one column per week, one row per weekday.
 *
 * The first column is partial whenever the window does not begin on a Sunday, which is almost
 * always. That gap is left in rather than back-filled with zeroes — a rendered zero and an
 * unobserved day are different claims, and only one of them is true here.
 */
export function densityGrid(
  days: readonly { date: string; count: number; level?: number }[],
): DensityGrid {
  const { cell, gap, rows } = DENSITY;
  const pitch = cell + gap;
  // `UtcDateSchema` already rejects anything else upstream, so this is defence in depth — but the
  // failure it prevents is total. An unparseable day makes `getUTCDay()` NaN, which propagates into
  // every coordinate and into the `viewBox`, and the entire survey renders as nothing.
  const first = days[0];
  const firstWeekday = first ? utcWeekday(first.date) : 0;

  const cells = days.map((day, index) => {
    const slot = firstWeekday + index;
    const column = Math.floor(slot / rows);
    return {
      date: day.date,
      count: day.count,
      level: day.level ?? 0,
      column,
      x: column * pitch,
      y: (slot % rows) * pitch,
    };
  });

  const columns = cells.length === 0 ? 0 : (cells[cells.length - 1]!.column + 1);
  return {
    viewBox: `0 0 ${Math.max(pitch * columns - gap, 1)} ${pitch * rows - gap}`,
    columns,
    cell,
    gap,
    cells,
  };
}

/** Weekday index for a UTC day, or `0` when the value is not one CommitAtlas can place. */
function utcWeekday(date: string): number {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`).getUTCDay() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Opacity for an *active* contribution level, 1 through 4, applied over the warm fill.
 *
 * Level 0 is deliberately not on this ramp. A day with no contributions drawn as a 8%-opacity tint
 * of the activity colour reads as a little activity — and on a light ground it disappears entirely.
 * It is drawn as a neutral socket instead; see `isEmptyDensityCell`.
 */
export function densityLevelOpacity(level: number): number {
  const ramp = [0.34, 0.55, 0.78, 1] as const;
  // Without the finite guard, a NaN level indexes the ramp with NaN, yields `undefined`, and React
  // omits the attribute — so the cell paints at opacity 1, the *strongest* reading on the scale.
  // An unreadable signal rendered as the maximum is the exact inversion this product forbids, so it
  // falls to the faintest active step instead.
  if (!Number.isFinite(level)) return ramp[0];
  return ramp[Math.min(3, Math.max(0, Math.trunc(level) - 1))];
}

/** True when a day carried nothing observable and must render as a socket rather than a fill. */
export function isEmptyDensityCell(level: number, count: number): boolean {
  return !(count > 0) || Math.trunc(level) <= 0;
}

export interface ReticleLamp {
  index: number;
  x: number;
  y: number;
}

export interface Reticle {
  viewBox: string;
  centre: Point;
  radius: number;
  /** Graticule rings, outermost first. */
  rings: readonly number[];
  /** One lamp position per declared project, distributed clockwise from the top. */
  lamps: readonly ReticleLamp[];
}

const RETICLE = { width: 220, height: 96, cx: 110, cy: 48, radius: 38 } as const;

/**
 * Place one lamp per declared project around a reticle ring.
 *
 * The ring is drawn whether or not anything reports. An instrument that disappears when it has
 * nothing to show teaches the reader that no news is no instrument; an instrument that stays lit up
 * with empty sockets teaches them that nothing was declared. The second is true.
 */
export function reticle(projectCount: number): Reticle {
  const { width, height, cx, cy, radius } = RETICLE;
  const count = Math.max(0, Math.trunc(projectCount));
  const lamps = Array.from({ length: count }, (_, index) => {
    const radians = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, count);
    return {
      index,
      x: Number((cx + radius * Math.cos(radians)).toFixed(2)),
      y: Number((cy + radius * Math.sin(radians)).toFixed(2)),
    };
  });
  return {
    viewBox: `0 0 ${width} ${height}`,
    centre: { x: cx, y: cy },
    radius,
    rings: [radius, radius * 0.62, radius * 0.26],
    lamps,
  };
}

/**
 * Bin a 0–100 reading into the chassis's four-square meter: `■ ■ ■ □`.
 *
 * This is a second, *shape-based* encoding of a value the page already prints as a number and draws
 * as a needle. It exists for the same reason every CI state has a lamp shape: a reader who cannot
 * separate the lime arc from its track still gets the reading, and the count is legible at a glance
 * in a way a two-digit number beside a gauge is not.
 *
 * Quarters, rounded up, so any non-zero reading fills at least one square — a score of 1 is not
 * nothing, and an empty meter is reserved for a score of nothing.
 */
export function quarterMeter(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(4, Math.ceil(Math.min(100, score) / 25));
}

/**
 * Compact a count the way the chassis prints it: `1.1k`, never `1.1K` and never `1,142` in a stat
 * slot. Exact values remain available in the evidence drawer, so this abbreviation is a display
 * choice rather than a loss of the number.
 */
export function compactCount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const magnitude = Math.abs(value);
  if (magnitude < 1_000) return String(Math.trunc(value));
  if (magnitude < 1_000_000) return `${trimZero(value / 1_000)}k`;
  return `${trimZero(value / 1_000_000)}m`;
}

function trimZero(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

/** `+4.2%` / `−1.1%` / `—` when there is no prior window to compare against. */
export function signedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(1));
  if (rounded === 0) return "0%";
  // U+2212 MINUS SIGN, not a hyphen: at mono label sizes a hyphen reads as a dash in a range.
  return rounded > 0 ? `+${rounded}%` : `−${Math.abs(rounded)}%`;
}
