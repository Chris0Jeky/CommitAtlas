/** Absolute daily contribution bands. Hue, shape, and the numeric key agree across themes. */
export const CONTRIBUTION_DENSITY_BANDS = Object.freeze([
  Object.freeze({ name: "copper", min: 1, max: 200, label: "1–200" }),
  Object.freeze({ name: "gold", min: 201, max: 700, label: "201–700" }),
  Object.freeze({ name: "violet", min: 701, max: 1500, label: "701–1500" }),
] as const);

/** Original, small silhouettes: no font glyph, remote artwork, or random selection. */
export const CONTRIBUTION_GLYPHS = Object.freeze(["spark", "diamond", "crest", "comet", "crown", "bolt"] as const);
export type ContributionGlyph = typeof CONTRIBUTION_GLYPHS[number];
export type ContributionDensityBand = "unavailable" | "zero" | "copper" | "gold" | "violet" | "special";

export const CONTRIBUTION_DENSITY_PALETTES = Object.freeze({
  dark: Object.freeze({
    copper: Object.freeze(["#a06246", "#bf7a51", "#df9a6c", "#ffbb8b"]),
    gold: Object.freeze(["#9d812b", "#bda040", "#dcc15f", "#fbe18b"]),
    violet: Object.freeze(["#8d6cb8", "#a186d5", "#bba6ec", "#d9caff"]),
    special: "#f4f1da",
  }),
  light: Object.freeze({
    copper: Object.freeze(["#b0643c", "#96502d", "#78391d", "#582713"]),
    gold: Object.freeze(["#8d762d", "#735e20", "#594816", "#3f320c"]),
    violet: Object.freeze(["#8866ac", "#71518f", "#583c73", "#402852"]),
    special: "#28341e",
  }),
});

export const CONTRIBUTION_DENSITY_DESCRIPTION = "Daily count key: 0 is a neutral square; 1–200 copper squares; 201–700 gold squares with one cut corner; 701–1500 violet squares with two cut corners; above 1500 a date-selected spark, diamond, crest, comet, crown, or bolt. Each coloured band has four ordered shades. Glyph variety is decorative and adds no rank. Counts record contributions, not productivity or quality.";

export interface ContributionDensityReading {
  readonly band: ContributionDensityBand;
  readonly step: number;
  readonly glyph?: ContributionGlyph;
}

export function contributionGlyph(date: string): ContributionGlyph {
  // FNV-1a over the ISO date. The same day keeps its silhouette if a count or theme changes.
  let hash = 2166136261;
  for (const character of date) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return CONTRIBUTION_GLYPHS[hash % CONTRIBUTION_GLYPHS.length]!;
}

export function contributionDensity(count: number, date: string): ContributionDensityReading {
  if (!Number.isSafeInteger(count) || count < 0) return { band: "unavailable", step: 0 };
  if (count === 0) return { band: "zero", step: 0 };
  const band = CONTRIBUTION_DENSITY_BANDS.find(candidate => count <= candidate.max);
  if (!band) return { band: "special", step: 0, glyph: contributionGlyph(date) };
  const step = Math.min(3, Math.floor((count - band.min) * 4 / (band.max - band.min + 1)));
  return { band: band.name, step };
}

interface DensityTheme {
  readonly scheme: "dark" | "light";
  readonly socket: string;
  readonly muted: string;
}

export function contributionFill(reading: ContributionDensityReading, theme: DensityTheme): string {
  if (reading.band === "zero" || reading.band === "unavailable") return theme.socket;
  const palette = CONTRIBUTION_DENSITY_PALETTES[theme.scheme];
  return reading.band === "special" ? palette.special : palette[reading.band][reading.step]!;
}

function n(value: number): string { return String(Number(value.toFixed(2))); }

/** Relative path beginning and ending at the top-left cell origin, for compact batched output. */
export function contributionShape(reading: ContributionDensityReading, size: number): string {
  const s = n(size);
  const half = n(Math.floor(size / 2));
  const other = n(size - Number(half));
  const notch = n(Math.max(1, Math.round(size / 4)));
  const rest = n(size - Number(notch));
  if (reading.band === "gold") return `h${rest}l${notch} ${notch}v${rest}h-${s}z`;
  if (reading.band === "violet") return `m${notch} 0h${rest}v${rest}l-${notch} ${notch}h-${rest}v-${rest}z`;
  if (reading.band === "special") {
    const q = n(Math.max(1, Math.floor(size / 4)));
    const three = n(size - Number(q));
    switch (reading.glyph) {
      case "spark": return `m${half} 0l${q} ${n(Number(half) - Number(q))} ${n(Number(other) - Number(q))} ${q}-${n(Number(other) - Number(q))} ${q}-${q} ${n(Number(other) - Number(q))}-${q}-${n(Number(other) - Number(q))}-${n(Number(half) - Number(q))}-${q} ${n(Number(half) - Number(q))}-${q}z`;
      case "diamond": return `m${half} 0l${other} ${half}-${other} ${other}-${half}-${other}z`;
      case "crest": return `h${s}v${half}l-${other} ${other}-${half}-${other}z`;
      case "comet": return `l${s} ${half}-${other} ${other}z`;
      case "crown": return `v${s}h${s}v-${s}l-${q} ${half}-${n(Number(other) - Number(q))}-${half}-${q} ${half}z`;
      case "bolt": return `m${half} 0h${other}l-${half} ${half}h${half}l-${three} ${other} ${q}-${other}h-${n(2 * Number(q))}z`;
    }
  }
  return `h${s}v${s}h-${s}z`;
}

export interface DensityCell {
  readonly date: string;
  readonly count: number;
  readonly x: number;
  readonly y: number;
}

/** Batch repeated silhouettes instead of duplicating a symbol/reference or title for every day. */
export function renderContributionCells(cells: readonly DensityCell[], size: number, theme: DensityTheme, className: string): string {
  const groups = new Map<string, { reading: ContributionDensityReading; paths: string[]; count: number; lastX: number; lastY: number }>();
  for (const cell of cells) {
    const reading = contributionDensity(cell.count, cell.date);
    const key = `${reading.band}-${reading.step}-${reading.glyph ?? ""}`;
    const group = groups.get(key) ?? { reading, paths: [], count: 0, lastX: 0, lastY: 0 };
    const shape = contributionShape(reading, size);
    const offset = /^m([\d.]+) 0/u.exec(shape);
    const x = cell.x + (offset ? Number(offset[1]) : 0);
    const y = cell.y;
    const move = group.count === 0 ? `M${n(x)} ${n(y)}` : `m${n(x - group.lastX)} ${n(y - group.lastY)}`;
    group.paths.push(move + (offset ? shape.slice(offset[0].length) : shape));
    group.count += 1;
    group.lastX = x; group.lastY = y;
    groups.set(key, group);
  }
  return [...groups.values()].map(({ reading, paths, count }) => {
    const unknown = reading.band === "unavailable";
    return `<path class="${className}" data-cell-count="${count}" data-density-band="${reading.band}"${reading.glyph ? ` data-glyph="${reading.glyph}"` : ""} fill="${contributionFill(reading, theme)}"${unknown ? ` stroke="${theme.muted}" stroke-width="0.6" stroke-dasharray="1 1"` : ""} d="${paths.join("")}"/>`;
  }).join("");
}
