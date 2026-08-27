/**
 * CommitAtlas presentation primitives.
 *
 * This module is deliberately a pure function library: it has no network, clock, random,
 * DOM, or framework dependency. The caller owns data fetching and lifecycle semantics.
 */

export type ThemeName = "aurora" | "midnight" | "paper" | "ember";

export interface SvgTheme {
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly muted: string;
  readonly accent: string;
  readonly positive: string;
  readonly warning: string;
  readonly negative: string;
  readonly border: string;
  /** Chassis chrome: mono labels, section numerals, rules. */
  readonly chrome: string;
  /**
   * The density ramp: ONE hue at four ascending steps, level 1 through level 4.
   *
   * Never four different hues. Hue carries no order — nothing about orange, green and yellow
   * says "more" — and the previous ramp additionally borrowed `accent`, `positive` and `warning`,
   * which are the same three colours the contribution mix prints beside it, so a square's colour
   * named a category it did not mean. `svg.test.mjs` asserts monotonic luminance and a ≥1.25×
   * separation at every step, in both directions, so the scale survives greyscale.
   */
  readonly density: readonly [string, string, string, string];
  /**
   * A day with nothing observed. Neutral, and deliberately not a faint tint of the ramp: a pale
   * ember square reads as a little activity, and a day with none had none.
   */
  readonly socket: string;
  /**
   * The single ink every contribution-mix bar is drawn in.
   *
   * The bar's LENGTH is the variable, so its colour is free to stay constant — which is what
   * stops the mix competing with the density grid for the reader's colour vocabulary.
   */
  readonly mixInk: string;
  /** Unfilled bar track. */
  readonly track: string;
  readonly languagePalette: readonly string[];
  /** Which colour scheme this theme is for, and its partner in the other one. */
  readonly scheme: "dark" | "light";
  readonly pair: ThemeName;
}

/**
 * The four card themes, drawn in the Fieldline chassis vocabulary.
 *
 * Every theme is a dark/light PAIR with another: `paper` is the light partner for all three dark
 * themes, and `ember` is the dark partner for `paper`. `buildStudioMarkdown` uses that pairing to
 * emit a `<picture>` block, so a README serves whichever card matches the reader's colour scheme
 * instead of pinning one and being wrong for half the audience.
 */
export const themes: Readonly<Record<ThemeName, SvgTheme>> = {
  aurora: {
    background: "#09131f", surface: "#0e1b2b", text: "#f6fbff", muted: "#a9c1d5",
    accent: "#58e6be", positive: "#79f2c0", warning: "#ffd166", negative: "#ff7b9c",
    border: "#1d3348", chrome: "#8fd8d2",
    density: ["#123f3a", "#1a6b60", "#2f9e8c", "#58e6be"], socket: "#101e2c",
    mixInk: "#6cc6ff", track: "#16283a",
    languagePalette: ["#58e6be", "#6cc6ff", "#c4a7ff", "#ffd166", "#ff9f68"],
    scheme: "dark", pair: "paper",
  },
  midnight: {
    background: "#05070d", surface: "#0d1017", text: "#f8fafc", muted: "#b5c1d5",
    accent: "#b89bff", positive: "#6ee7b7", warning: "#fbbf24", negative: "#fb7185",
    border: "#1e2434", chrome: "#d9caff",
    density: ["#2b1f52", "#4a3585", "#7a5cc4", "#b89bff"], socket: "#101420",
    mixInk: "#8da4ff", track: "#161b28",
    languagePalette: ["#b89bff", "#8da4ff", "#6ee7b7", "#fbbf24", "#fb7185"],
    scheme: "dark", pair: "paper",
  },
  paper: {
    // Limestone, not white. A card on a pale ground still needs to read as a card, and the
    // chassis has one light ground rather than a bleached version of a dark one.
    background: "#dfe4c9", surface: "#e8ecd6", text: "#23261c", muted: "#5b6150",
    accent: "#9c3d0d", positive: "#186b3c", warning: "#6b4f08", negative: "#8f1c1c",
    border: "#c2c9a8", chrome: "#55651a",
    // The ramp inverts with the ground: on a pale card more activity is DARKER, not brighter.
    density: ["#f0a878", "#dd7440", "#b84f1e", "#82300a"], socket: "#c9cfb2",
    mixInk: "#0f5f50", track: "#cdd3b6",
    languagePalette: ["#9c3d0d", "#0f5f50", "#4d3494", "#6b4f08", "#8f1c1c"],
    scheme: "light", pair: "ember",
  },
  ember: {
    background: "#121310", surface: "#191a15", text: "#edf0e2", muted: "#9aa08c",
    accent: "#ff7a45", positive: "#75d69b", warning: "#ffd166", negative: "#ff7b7b",
    border: "#2a2c24", chrome: "#d9ff4a",
    density: ["#5c2a17", "#97431f", "#d05e2f", "#ff7a45"], socket: "#1c1f19",
    mixInk: "#58e6be", track: "#23261e",
    languagePalette: ["#ff7a45", "#ffd166", "#75d69b", "#58e6be", "#b89bff"],
    scheme: "dark", pair: "paper",
  },
};

export interface RenderOptions {
  readonly theme?: ThemeName;
  readonly width?: number;
  readonly height?: number;
  readonly title?: string;
  readonly description?: string;
  readonly motion?: "none" | "subtle";
}

export type CardSource = "public-github" | "public-profile" | "synthetic-demo";

export interface SourceLabelledCardData {
  readonly source?: CardSource;
}

export interface ProfileCardData extends SourceLabelledCardData {
  readonly name: string;
  readonly login: string;
  readonly bio?: string;
  readonly location?: string;
  readonly website?: string;
  readonly repositories: number;
  readonly followers: number;
  readonly following: number;
  readonly contributions?: number;
  /** Source-backed aggregate repository stars, when the adapter provides it. */
  readonly stars?: number;
}

export interface StreakCardData extends SourceLabelledCardData {
  readonly current: number;
  readonly currentThrough?: string;
  readonly asOf?: string;
  readonly longest: number;
  readonly total?: number;
  readonly activeDays?: number;
  readonly lastActive?: string;
  readonly windowDays?: number;
  readonly boundary?: {
    readonly current: "closed" | "open";
    readonly longest: "closed" | "open";
  };
}

export interface ActivityDay {
  readonly date: string;
  readonly count: number;
  /** Upstream GitHub intensity, when available. Falls back to a local scale for direct callers. */
  readonly level?: number;
}

export interface ActivityCardData extends SourceLabelledCardData {
  readonly days: readonly ActivityDay[];
  readonly total?: number;
  readonly periodLabel?: string;
}

export interface ContributionBreakdownCardData extends SourceLabelledCardData {
  readonly window: { readonly from: string; readonly to: string; readonly days: number };
  readonly breakdown: {
    readonly commits: number;
    readonly issues: number;
    readonly pullRequests: number;
    readonly reviews: number;
  };
  readonly basis: "exact-counts" | "public-profile-percentages";
}

export interface RhythmCardData extends SourceLabelledCardData {
  readonly window: { readonly from: string; readonly to: string; readonly days: number };
  readonly activeDays: number;
  readonly density: number;
  readonly currentStreak: number;
  readonly currentStreakThrough?: string;
  readonly currentStreakBoundary: "closed" | "open";
  readonly trend: {
    readonly buckets: readonly number[];
    readonly recent28Days: number;
    readonly previous28Days: number | null;
    readonly changePercent: number | null;
    readonly direction: "up" | "down" | "flat" | "new" | "unavailable";
  };
  readonly rhythm: {
    readonly score: number;
    readonly level: "starting" | "building" | "steady" | "strong" | "relentless";
    readonly basis: "70% active-day density (capped at 80%) + 30% current streak (capped at 30 days)";
  };
}

export interface LanguageStat {
  /** Human-readable label used by standalone SVG callers. */
  readonly name?: string;
  /** Canonical @commit-atlas/core aggregate field. */
  readonly language?: string;
  readonly bytes?: number;
  readonly percentage?: number;
  readonly color?: string;
}

export interface LanguagesCardData extends SourceLabelledCardData {
  readonly languages: readonly LanguageStat[];
  readonly totalBytes?: number;
}

export type Lifecycle = "planned" | "active" | "maintained" | "paused" | "archived" | "experimental";
export type CiState = "passing" | "failing" | "pending" | "stale" | "unavailable" | "unconfigured";

export interface ProjectLinks {
  readonly repository?: string;
  readonly docs?: string;
  readonly install?: string;
  readonly download?: string;
}

export interface ProjectSignal {
  readonly name: string;
  readonly lifecycle: Lifecycle;
  readonly ci: CiState;
  readonly description?: string;
  readonly version?: string;
  readonly stars?: number;
  readonly updatedAt?: string;
  readonly links?: ProjectLinks;
}

export interface ProjectBoardData extends SourceLabelledCardData {
  readonly projects: readonly ProjectSignal[];
}

export interface CadenceCardData extends SourceLabelledCardData {
  /** Contribution days for the window; entries with invalid dates or non-finite counts are dropped. */
  readonly days: readonly ActivityDay[];
}

export interface ReleaseSignal {
  /** Display name of the project the release belongs to. */
  readonly project: string;
  readonly tag: string;
  /** ISO 8601 timestamp; entries without a parseable date are dropped. */
  readonly publishedAt: string;
}

export interface ReleasesCardData extends SourceLabelledCardData {
  readonly releases: readonly ReleaseSignal[];
  /** How many curated projects were observed, so absence can be stated rather than implied. */
  readonly projectsObserved?: number;
  /** How many curated-project release lookups were unavailable and therefore cannot imply absence. */
  readonly projectsUnavailable?: number;
}

export interface AtlasCardData {
  readonly profile: {
    readonly name: string;
    readonly login: string;
    readonly repositories: number;
    readonly followers: number;
    readonly stars?: number;
  };
  readonly window: { readonly from: string; readonly to: string; readonly days: number };
  readonly total: number;
  readonly activeDays: number;
  readonly density: number;
  readonly averagePerDay: number;
  readonly currentStreak: number;
  readonly currentStreakThrough?: string;
  readonly longestStreak: number;
  readonly streakBasis: "returned-window";
  readonly streakBoundary?: {
    readonly current: "closed" | "open";
    readonly longest: "closed" | "open";
  };
  readonly peakDay: { readonly date: string; readonly count: number };
  readonly breakdown: {
    readonly commits: number;
    readonly issues: number;
    readonly pullRequests: number;
    readonly reviews: number;
  };
  readonly breakdownBasis?: "exact-counts" | "public-profile-percentages";
  readonly trend: {
    readonly buckets: readonly number[];
    readonly recent28Days: number;
    readonly previous28Days: number | null;
    readonly changePercent: number | null;
    readonly direction: "up" | "down" | "flat" | "new" | "unavailable";
  };
  readonly rhythm: {
    readonly score: number;
    readonly level: "starting" | "building" | "steady" | "strong" | "relentless";
  };
  readonly activity: readonly (ActivityDay & { readonly level?: number })[];
  readonly languages?: readonly LanguageStat[];
  readonly projects?: {
    readonly total: number;
    readonly passing: number;
    readonly attention: number;
    readonly unavailable: number;
  };
  readonly generatedAt: string;
  readonly source: CardSource;
}

const DEFAULT_OPTIONS: Required<Pick<RenderOptions, "theme" | "width" | "height">> = {
  theme: "aurora", width: 720, height: 180,
};

const MIN_WIDTH = 420;
const MAX_WIDTH = 1_200;
const MAX_TITLE_LENGTH = 96;
const MAX_DESCRIPTION_LENGTH = 180;
const MAX_ACTIVITY_PERIOD_LENGTH = 32;
const MAX_ACTIVITY_DAYS = 366;
/**
 * Window boundary labels are ISO calendar dates (`YYYY-MM-DD`, 10 characters). The cap leaves
 * headroom for other bounded date spellings while stopping a direct caller from pushing an
 * unbounded string into the breakdown scope line, the atlas header, or an accessible
 * description. `truncateText` bounds code points, not escaped bytes, so the escaped worst case
 * is 24 apostrophes at `&apos;` each: 144 bytes per label.
 */
const MAX_WINDOW_LABEL_LENGTH = 24;
/** Rhythm levels are a five-value enum whose longest member (`relentless`) is 10 characters. */
const MAX_RHYTHM_LEVEL_LENGTH = 24;
/** The canonical rhythm basis sentence is 79 characters; the cap leaves room without unbounded growth. */
const MAX_RHYTHM_BASIS_LENGTH = 120;
/**
 * `@commit-atlas/core` emits `ceil(min(days, trendWeeks * 7) / 7)` weekly buckets and caps
 * `trendWeeks` at 16, so a real momentum strip never exceeds 16 bars. The cap keeps headroom for
 * direct callers while staying inside the layout box — past roughly 48 bars the minimum bar width
 * makes the strip overflow its region — and keeps the card far below the 30KB output budget.
 */
const MAX_ATLAS_TREND_BUCKETS = 26;
/** Compact cadence summaries stay inside the right-aligned header at the minimum card width. */
const MAX_COMPACT_CADENCE_LABEL_LENGTH = 42;

/** Escape text and attribute values before they enter an SVG document. */
export function escapeXml(value: unknown): string {
  const xmlSafe = [...String(value ?? "")].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const allowed = codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    return allowed ? character : "�";
  }).join("");
  return xmlSafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Keep labels compact without splitting a surrogate pair. */
export function truncateText(value: unknown, maxLength: number): string {
  const text = String(value ?? "").trim();
  const limit = Math.max(1, Math.floor(maxLength));
  if ([...text].length <= limit) return text;
  if (limit <= 1) return "…";
  return `${[...text].slice(0, limit - 1).join("")}…`;
}

/** Format counts consistently across renderers; no locale-dependent decimals are emitted. */
export function formatNumber(value: number | undefined, compact = true): string {
  const number = Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : 0;
  if (!compact || number < 1_000) return number.toLocaleString("en-US");
  if (number < 1_000_000) {
    const compactThousands = (number / 1_000).toFixed(number >= 10_000 ? 0 : 1).replace(/\.0$/, "");
    return Number(compactThousands) >= 1_000 ? "1M" : `${compactThousands}k`;
  }
  if (number < 1_000_000_000) {
    const compactMillions = (number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1).replace(/\.0$/, "");
    return Number(compactMillions) >= 1_000 ? "1B" : `${compactMillions}M`;
  }
  return `${(number / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
}

function finite(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, value as number) : fallback;
}

function themeFor(options?: RenderOptions): SvgTheme {
  return themes[options?.theme ?? DEFAULT_OPTIONS.theme] ?? themes.aurora;
}

function dimension(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  const candidate = Number.isFinite(value) && (value as number) > 0 ? Math.round(value as number) : fallback;
  return Math.min(maximum, Math.max(minimum, candidate));
}

function safeHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const safeProtocol = url.protocol === "https:" || url.protocol === "http:";
    return safeProtocol && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function safeColor(value: string | undefined, fallback: string): string {
  return value && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : fallback;
}

function boundedLabel(value: unknown, fallback: string, maxLength: number): string {
  const text = String(value ?? "").trim();
  return truncateText(text || fallback, maxLength);
}

function optionsFor(
  options: RenderOptions | undefined,
  defaultHeight: number,
  defaultTitle: string,
  defaultDescription: string,
  minimumHeight: number,
  maximumHeight: number,
): { theme: SvgTheme; width: number; height: number; title: string; description: string } {
  return {
    theme: themeFor(options), width: dimension(options?.width, DEFAULT_OPTIONS.width, MIN_WIDTH, MAX_WIDTH),
    height: dimension(options?.height, defaultHeight, minimumHeight, maximumHeight),
    title: boundedLabel(options?.title, defaultTitle, MAX_TITLE_LENGTH),
    description: boundedLabel(options?.description, defaultDescription, MAX_DESCRIPTION_LENGTH),
  };
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

interface CalendarGridCell {
  readonly day: ActivityDay;
  readonly column: number;
  readonly row: number;
}

/**
 * Place contribution days on GitHub-compatible Sunday-to-Saturday week rows.
 *
 * Chunking an arbitrary 365-day window into groups of seven makes row zero inherit the weekday
 * of the window's first date. The data stays current, but the visual pattern cannot be compared
 * with GitHub's calendar and therefore looks stale. Anchoring the first column to its preceding
 * Sunday gives the same weekday geometry while retaining the exact requested date window.
 */
function calendarGrid(days: readonly ActivityDay[]): { readonly cells: readonly CalendarGridCell[]; readonly columns: number } {
  const first = days[0];
  if (!first) return { cells: [], columns: 1 };
  const millisecondsPerDay = 86_400_000;
  const firstTimestamp = Date.parse(`${first.date}T00:00:00Z`);
  const gridStart = firstTimestamp - new Date(firstTimestamp).getUTCDay() * millisecondsPerDay;
  const cells = days.map((day) => {
    const timestamp = Date.parse(`${day.date}T00:00:00Z`);
    const offset = Math.round((timestamp - gridStart) / millisecondsPerDay);
    return { day, column: Math.floor(offset / 7), row: new Date(timestamp).getUTCDay() };
  });
  return { cells, columns: Math.max(1, (cells.at(-1)?.column ?? 0) + 1) };
}

function svgStart(
  width: number,
  height: number,
  theme: SvgTheme,
  title: string,
  description: string,
  accessibleDescription = description,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(title)}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">` +
    `<title>${escapeXml(title)}</title><desc>${escapeXml(accessibleDescription)}</desc>` +
    plate(width, height, theme);
}

function svgEnd(): string { return "</svg>"; }

/**
 * Type stacks.
 *
 * System faces only, and not by preference. These cards render as SVG inside an `<img>` on
 * GitHub, where no webfont can load and an embedded `@font-face` would spend the entire 30 KiB
 * budget before any data was drawn. Geist is the chassis face on the web surface; here the design
 * has to survive substitution on whatever machine renders it, so it is drawn at the stack that
 * actually paints. `Inter` is deliberately absent — it is almost never installed, so naming it
 * only added a failed lookup before the same fallback.
 */
// Single quotes inside the family list, never double. These land in a double-quoted XML
// attribute, so a double quote here closes `font-family="` early and the whole tag becomes
// malformed — which is exactly what `assertWellFormedXml` caught on the first attempt.
// Multi-word families are the only ones that need quoting at all, so the two here are the
// only two that matter.
const SANS = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace";

function text(x: number, y: number, value: unknown, size: number, fill: string, weight = 400, anchor = "start"): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${SANS}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

/**
 * A chassis label: mono, tracked out, upper case.
 *
 * `letter-spacing` is what makes these read as instrument chrome rather than as small body copy,
 * and it is the one type property the chassis uses consistently across both surfaces.
 */
function mono(x: number, y: number, value: unknown, size: number, fill: string, weight = 500, anchor = "start", tracking = 0.13): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" letter-spacing="${(size * tracking).toFixed(2)}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

/** A section numeral — `01 //` — the chassis's way of ordering panels without a heading. */
function numeral(x: number, y: number, index: number, label: string, theme: SvgTheme): string {
  return mono(x, y, `${String(index).padStart(2, "0")} // ${label}`, 9, theme.chrome);
}

function panel(x: number, y: number, width: number, height: number, theme: SvgTheme): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${theme.surface}" stroke="${theme.border}"/>`;
}

/**
 * The corner-cut card plate and its hazard strip — the two marks that say "instrument".
 *
 * A `path` rather than a `rect` because the top-right corner is cut at 45°, which is the chassis
 * panel shape. The strip is drawn as a clipped group of diagonals rather than a pattern fill:
 * `<pattern>` would work, but every card would then carry a `defs` block and an id, and ids are
 * what collide when two cards are inlined into one document.
 */
function plate(width: number, height: number, theme: SvgTheme, cut = 22): string {
  const d = `M0 0H${width - cut}L${width} ${cut}V${height}H0Z`;
  let out = `<path d="${d}" fill="${theme.background}"/>`;
  // Deliberately faint. On the web fascia this strip is one element among many across 1440px;
  // on a 720px card repeated eight times down a README it was the loudest thing on screen while
  // carrying no information at all. It earns its place as edge texture, not as a feature.
  const bars: string[] = [];
  for (let y = -8; y < height; y += 11) {
    bars.push(`M0 ${y}l4 0l-4 11l0 -11Z`);
  }
  out += `<g aria-hidden="true" opacity="0.18">${bars.map((b) => `<path d="${b}" fill="${theme.chrome}"/>`).join("")}</g>`;
  return out;
}

/**
 * Map a contribution level to a fill. The ONLY place in this module that decision is made.
 *
 * Level 0 is the neutral socket, never the faintest step of the ramp. A non-finite or negative
 * level also resolves to the socket rather than indexing past the end — an unreadable signal must
 * never render as the strongest reading, which is the inversion this product exists to refuse.
 */
function densityFill(level: number, theme: SvgTheme): string {
  if (!Number.isFinite(level)) return theme.socket;
  const step = Math.trunc(level);
  if (step <= 0) return theme.socket;
  return theme.density[Math.min(3, step - 1)]!;
}

/** The Less…More key every density surface prints, so the ramp is self-describing. */
function densityKey(x: number, y: number, theme: SvgTheme, size = 8): string {
  let out = mono(x, y + size, "LESS", 8, theme.muted, 500, "end");
  const swatches = [theme.socket, ...theme.density];
  swatches.forEach((fill, index) => {
    out += `<rect x="${x + 6 + index * (size + 3)}" y="${y}" width="${size}" height="${size}" fill="${fill}"/>`;
  });
  out += mono(x + 12 + swatches.length * (size + 3), y + size, "MORE", 8, theme.muted);
  return out;
}

function statusColor(state: CiState, theme: SvgTheme): string {
  if (state === "passing") return theme.positive;
  if (state === "failing") return theme.negative;
  if (state === "pending" || state === "stale") return theme.warning;
  return theme.muted;
}

function statusLabel(state: CiState): string {
  return { passing: "Passing", failing: "Failing", pending: "Pending", stale: "Stale", unavailable: "Unavailable", unconfigured: "Unconfigured" }[state];
}

function lifecycleLabel(state: Lifecycle): string {
  return state[0].toUpperCase() + state.slice(1);
}

function link(textValue: string, href: string | undefined, x: number, y: number, theme: SvgTheme): string {
  const safe = safeHref(href);
  const label = escapeXml(textValue);
  const body = text(x, y, textValue, 11, theme.accent, 600);
  return safe ? `<a href="${escapeXml(safe)}" target="_blank" rel="noopener" aria-label="${label}">${body}</a>` : body;
}

function sourceMetadata(
  source: CardSource | undefined,
  title: string,
  description: string,
): { title: string; description: string } {
  if (source !== "synthetic-demo") return { title, description };
  return {
    title: boundedLabel(`Synthetic demo: ${title}`, "Synthetic demo card", MAX_TITLE_LENGTH),
    description: boundedLabel(
      `Synthetic demonstration data, not live GitHub data. ${description}`,
      "Synthetic demonstration data, not live GitHub data.",
      MAX_DESCRIPTION_LENGTH,
    ),
  };
}

function sourceMarker(
  source: CardSource | undefined,
  x: number,
  y: number,
  theme: SvgTheme,
  anchor: "start" | "end" = "end",
): string {
  return source === "synthetic-demo"
    ? `<g aria-hidden="true">${text(x, y, "SYNTHETIC DEMO", 9, theme.warning, 750, anchor)}</g>`
    : "";
}

function cardMotionStyle(motion: RenderOptions["motion"]): string {
  if (motion !== "subtle") return "";
  // Fill-mode none with a delay, for the same reason as atlasMotionStyle: a renderer that never
  // runs CSS animations (SVG through <img>) must show the finished card, not a frozen keyframe.
  return `<style>
@keyframes card-enter{from{transform:translateY(4px)}to{transform:translateY(0)}}
.card-enter{transform-box:fill-box;transform-origin:center;animation:card-enter .38s ease-out .06s}
@media (prefers-reduced-motion:reduce){.card-enter{animation:none!important}}
</style>`;
}

export function renderProfileCard(data: ProfileCardData, options?: RenderOptions): string {
  const rawLogin = String(data.login ?? "").replace(/^@/, "").trim();
  const name = truncateText(String(data.name ?? "").trim() || rawLogin || "GitHub user", 30);
  const hasDetails = Boolean(String(data.bio ?? "").trim() || String(data.location ?? "").trim() || data.website);
  const o = optionsFor(
    options, hasDetails ? 220 : 190, `${name} profile`, `GitHub profile for ${name}.`, 180, 320,
  ); const t = o.theme; const width = o.width;
  const login = truncateText(rawLogin, 32);
  const bio = truncateText(data.bio ?? "", 78);
  const compact = o.height < 200;
  const bioY = compact && data.location ? 94 : 103;
  const locationY = compact ? 110 : 127;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  let out = svgStart(width, o.height, t, metadata.title, metadata.description);
  out += cardMotionStyle(options?.motion) + `<g class="card-enter">`;
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += sourceMarker(data.source, 34, 31, t, "start");
  out += `<circle cx="64" cy="73" r="31" fill="${t.accent}"/><text x="64" y="82" fill="${t.background}" font-family="Inter,ui-sans-serif,system-ui,sans-serif" font-size="24" font-weight="800" text-anchor="middle">${escapeXml(([...name][0] ?? "?").toUpperCase())}</text>`;
  out += text(112, 54, name, 24, t.text, 750) + text(112, 77, `@${login}`, 13, t.muted);
  if (bio) out += text(112, bioY, bio, 13, t.text);
  if (data.location) out += text(112, locationY, `⌖ ${truncateText(data.location, 35)}`, 12, t.muted);
  const possibleStats: readonly (readonly [string, number | undefined])[] = [
    ["Repositories", data.repositories], ["Followers", data.followers], ["Following", data.following],
    ["Contributions", data.contributions], ["Stars", data.stars],
  ];
  const stats = possibleStats.filter((stat): stat is readonly [string, number] => {
    const value = stat[1];
    return value !== undefined && Number.isFinite(value) && value >= 0;
  });
  const statY = o.height - 31; const statWidth = (width - 64) / Math.max(1, stats.length);
  stats.forEach(([label, value], index) => {
    const x = 32 + statWidth * index;
    out += text(x, statY - 13, formatNumber(finite(value)), 18, t.text, 750) + text(x, statY + 5, label, 10, t.muted);
  });
  if (data.website) out += link("Website ↗", data.website, width - 93, 34, t);
  return out + `</g>` + svgEnd();
}

export function renderStreakCard(data: StreakCardData, options?: RenderOptions): string {
  const o = optionsFor(options, 180, "Contribution streak", "Current and longest GitHub contribution streaks in the returned window.", 150, 260); const t = o.theme; const width = o.width;
  const compact = o.height < 180;
  const personalBestY = compact ? 57 : 65;
  const longestY = compact ? 88 : 104;
  const statusY = compact ? 110 : 133;
  const lastActiveY = compact ? 128 : 153;
  const windowDays = Number.isFinite(data.windowDays)
    ? Math.max(1, Math.min(MAX_ACTIVITY_DAYS, Math.round(data.windowDays as number)))
    : null;
  const windowLabel = windowDays ? `${windowDays}-day window` : "returned window";
  const currentThrough = isValidIsoDate(data.currentThrough) ? data.currentThrough : null;
  const asOf = isValidIsoDate(data.asOf) ? data.asOf : null;
  const throughPriorDay = currentThrough && asOf && currentThrough !== asOf;
  const currentOpen = data.boundary?.current === "open";
  const currentCount = finite(data.current);
  const currentValue = `${formatNumber(currentCount, false)}${currentOpen ? "+" : ""}`;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  const accessibleDescription = data.boundary
    ? `${metadata.description} Current streak: ${currentOpen ? "at least " : ""}${formatNumber(currentCount, false)} days${currentThrough ? ` through ${currentThrough}` : ""}. Longest observed in the ${windowLabel}: ${formatNumber(finite(data.longest), false)} days. History before this window is not observed.${data.lastActive ? ` Last active ${truncateText(data.lastActive, 22)}.` : ""}`
    : metadata.description;
  let out = svgStart(width, o.height, t, metadata.title, metadata.description, accessibleDescription);
  out += cardMotionStyle(options?.motion) + `<g class="card-enter">`;
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += sourceMarker(data.source, width - 34, 31, t);
  out += numeral(34, 48, 1, "CONTRIBUTION STREAK", t);
  const currentLabel = currentCount <= 0
    ? "no current streak"
    : throughPriorDay ? `days · through ${currentThrough}`
      : currentOpen ? "days current · at least" : data.boundary ? "days current" : "days in returned window";
  out += text(34, 94, currentValue, 46, t.accent, 800) + text(34, 116, currentLabel, throughPriorDay ? 10 : 12, t.text, 600);
  out += `<line x1="${width / 2}" y1="38" x2="${width / 2}" y2="${o.height - 38}" stroke="${t.border}"/>`;
  out += text(width / 2 + 28, personalBestY, `Longest in ${windowLabel}`, 12, t.muted) + text(width / 2 + 28, longestY, `${formatNumber(finite(data.longest), false)} days`, 24, t.text, 750);
  const totalLabel = Number.isFinite(data.total) ? `Total ${formatNumber(finite(data.total))}` : "Total unavailable";
  const activeDaysLabel = Number.isFinite(data.activeDays) ? `${formatNumber(finite(data.activeDays))} active days` : "Active days unavailable";
  out += text(width / 2 + 28, statusY, `${totalLabel} · ${activeDaysLabel}`, 11, t.muted);
  const historyLabel = width < 560
    ? "Earlier history not observed"
    : `${data.lastActive ? `Last active ${truncateText(data.lastActive, 10)} · ` : ""}earlier history not observed`;
  out += text(width / 2 + 28, lastActiveY, historyLabel, width < 560 ? 9 : 10, t.muted);
  return out + `</g>` + svgEnd();
}

export function renderActivityCard(data: ActivityCardData, options?: RenderOptions): string {
  const days = data.days.filter((day) => isValidIsoDate(day.date)).sort((left, right) => left.date.localeCompare(right.date)).slice(-MAX_ACTIVITY_DAYS);
  const max = Math.max(1, ...days.map((day) => finite(day.count)));
  const periodLabel = boundedLabel(data.periodLabel, "ACTIVITY", MAX_ACTIVITY_PERIOD_LENGTH);
  const o = optionsFor(options, 220, "Contribution activity", "A compact contribution activity map with text labels for accessible status.", 180, 280); const t = o.theme; const width = o.width;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  const accessibilitySummary = days.map((day) => `${day.date} ${formatNumber(day.count, false)}`).join("; ");
  const accessibleDescription = accessibilitySummary
    ? `${metadata.description} Contributions by date, chronologically: ${accessibilitySummary}`
    : metadata.description;
  let out = svgStart(width, o.height, t, metadata.title, metadata.description, accessibleDescription);
  out += cardMotionStyle(options?.motion) + `<g class="card-enter">`;
  out += panel(16, 16, width - 32, o.height - 32, t) + numeral(34, 48, 1, periodLabel, t);
  out += sourceMarker(data.source, width - 34, 29, t);
  out += text(width - 34, 50, `${formatNumber(finite(data.total ?? days.reduce((sum, day) => sum + day.count, 0)))} contributions`, 12, t.text, 600, "end");
  const grid = calendarGrid(days);
  const columns = grid.columns; const cell = Math.max(4, Math.min(11, Math.floor((width - 86 - 2 * (columns - 1)) / columns)));
  const start = 40; const top = 66;
  // Quartiles of the observed peak, so the four steps describe THIS window rather than an
  // absolute scale no reader can see. A zero day is level 0 and takes the neutral socket.
  const cells: string[] = [];
  grid.cells.forEach(({ day, column, row }) => {
    const count = finite(day.count);
    const level = Number.isFinite(day.level)
      ? Math.max(0, Math.min(4, Math.round(day.level as number)))
      : count <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((count / max) * 4)));
    const x = start + column * (cell + 2); const y = top + row * (cell + 2);
    cells.push(`<path fill="${densityFill(level, t)}" d="M${x} ${y}h${cell}v${cell}H${x}"/>`);
  });
  out += `<g aria-hidden="true">${cells.join("")}</g>`;
  out += `<g aria-hidden="true">${densityKey(width - 118, top + 7 * (cell + 2) + 10, t)}</g>`;
  return out + `</g>` + svgEnd();
}

const breakdownLabels = [
  ["Commits", "commits"],
  ["Issues", "issues"],
  ["Pull requests", "pullRequests"],
  ["Reviews", "reviews"],
] as const;

function breakdownValue(value: number, basis: ContributionBreakdownCardData["basis"]): string {
  return basis === "public-profile-percentages"
    ? `${finite(value).toFixed(1).replace(/\.0$/, "")}%`
    : formatNumber(value, false);
}

/** Render a source-labelled activity-type mix without turning percentages into counts. */
export function renderContributionBreakdownCard(
  data: ContributionBreakdownCardData,
  options?: RenderOptions,
): string {
  const publicProfileMix = data.basis === "public-profile-percentages";
  const o = optionsFor(
    options,
    220,
    "Contribution breakdown",
    publicProfileMix
      ? "GitHub public-profile activity percentages; not exact counts and not scoped to the requested contribution-calendar window."
      : "Exact categorized contribution activity for the selected window.",
    220,
    280,
  );
  const t = o.theme;
  const width = o.width;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  const values = breakdownLabels.map(([, key]) => finite(data.breakdown[key]));
  const total = values.reduce((sum, value) => sum + value, 0);
  const basisLabel = publicProfileMix ? "PUBLIC PROFILE %" : "EXACT COUNTS";
  // Window boundaries come from the caller, so bound them here rather than trusting the adapter.
  const windowFrom = truncateText(data.window.from, MAX_WINDOW_LABEL_LENGTH);
  const windowTo = truncateText(data.window.to, MAX_WINDOW_LABEL_LENGTH);
  const basisDescription = publicProfileMix
    ? `GitHub public-profile percentages from calendar-year profile views; these are not exact counts and are not scoped to the requested ${formatNumber(data.window.days, false)}-day contribution-calendar window`
    : `exact categorized counts for ${windowFrom} to ${windowTo}, ${formatNumber(data.window.days, false)} days`;
  const accessibleDescription = `${metadata.description} Basis: ${basisDescription}. ${breakdownLabels.map(([label], index) => `${label}: ${breakdownValue(values[index], data.basis)}`).join(", ")}.`;
  let out = svgStart(width, o.height, t, metadata.title, metadata.description, accessibleDescription);
  out += cardMotionStyle(options?.motion) + `<g class="card-enter">`;
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += numeral(34, 48, 1, "CONTRIBUTION BREAKDOWN", t);
  out += `<rect x="${width - 150}" y="31" width="116" height="22" fill="${t.background}" stroke="${t.border}"/>`;
  out += mono(width - 92, 46, basisLabel, 8.5, data.basis === "public-profile-percentages" ? t.warning : t.positive, 600, "middle", 0.1);
  out += sourceMarker(data.source, width - 34, 70, t);
  const scopeLabel = publicProfileMix
    ? width < 480 ? "Profile activity mix · not window-scoped" : "GitHub profile activity mix · not window-scoped"
    : `${windowFrom} → ${windowTo} · ${formatNumber(data.window.days, false)} days`;
  out += mono(34, 70, scopeLabel, 9, t.muted, 500, "start", 0.06);
  const barX = Math.min(174, Math.max(136, width * 0.24));
  const barWidth = Math.max(40, width - barX - 106);
  breakdownLabels.forEach(([label], index) => {
    const y = 82 + index * 26;
    const value = values[index];
    const normalized = publicProfileMix
      ? Math.min(100, value) / 100
      : total > 0 ? value / total : 0;
    const fillWidth = barWidth * normalized;
    // One ink, four rows: the bar length is the variable, so the colour does not have to be.
    out += mono(34, y + 9, label, 9, t.muted, 500, "start", 0.08);
    out += `<rect x="${barX}" y="${y + 1}" width="${barWidth}" height="8" fill="${t.track}"/>`;
    if (fillWidth > 0) out += `<rect x="${barX}" y="${y + 1}" width="${fillWidth.toFixed(2)}" height="8" fill="${t.mixInk}"/>`;
    out += mono(width - 34, y + 9, breakdownValue(value, data.basis), 9.5, t.text, 600, "end", 0.04);
  });
  out += `<line x1="34" y1="190" x2="${width - 34}" y2="190" stroke="${t.border}"/>`;
  const footer = publicProfileMix
    ? width < 600 ? "Annual profile % · not window-scoped" : "Annual profile-view percentages · exact window counts unavailable"
    : width < 520 ? "Exact categorized counts · normalized bars" : "Categorized exact counts · bars normalized to categorized total";
  out += mono(34, 208, footer, 8.5, t.muted, 500, "start", 0.06);
  return out + `</g>` + svgEnd();
}

function rhythmTrendLabel(trend: RhythmCardData["trend"]): string {
  if (trend.direction === "unavailable") return "Trend unavailable";
  if (trend.direction === "new") return `${formatNumber(trend.recent28Days, false)} recent contributions · new activity`;
  if (trend.direction === "flat") return `${formatNumber(trend.recent28Days, false)} recent contributions · flat vs prior 28 days`;
  if (!Number.isFinite(trend.changePercent)) return `${formatNumber(trend.recent28Days, false)} recent contributions · trend change unavailable`;
  const change = trend.changePercent as number;
  const sign = change > 0 ? "+" : "";
  return `${formatNumber(trend.recent28Days, false)} recent contributions · ${sign}${change.toFixed(1).replace(/\.0$/, "")}% vs prior 28 days`;
}

/** Render the personal, window-bounded contribution consistency card. */
export function renderRhythmCard(data: RhythmCardData, options?: RenderOptions): string {
  const normalizedWidth = dimension(options?.width, 720, MIN_WIDTH, MAX_WIDTH);
  const compact = normalizedWidth < 600;
  const o = optionsFor(
    { ...options, width: normalizedWidth },
    compact ? 300 : 220,
    "Personal contribution rhythm",
    "A personal consistency summary based on active-day density and current streak.",
    compact ? 300 : 220,
    compact ? 360 : 280,
  );
  const t = o.theme;
  const width = o.width;
  const score = Math.min(100, finite(data.rhythm.score));
  // Level and basis are caller-supplied prose; bound them so a direct caller cannot inflate the card.
  const level = truncateText(data.rhythm.level, MAX_RHYTHM_LEVEL_LENGTH);
  const basis = truncateText(data.rhythm.basis, MAX_RHYTHM_BASIS_LENGTH);
  const current = formatNumber(finite(data.currentStreak), false);
  const open = data.currentStreakBoundary === "open";
  const currentThrough = isValidIsoDate(data.currentStreakThrough) ? data.currentStreakThrough : null;
  const throughPriorDay = currentThrough && currentThrough !== data.window.to;
  const streakText = open ? `at least ${current} days · OPEN` : `${current} days · CLOSED`;
  const streakBoundedText = open ? "open at the returned-window boundary" : "closed within the returned window";
  const metadata = sourceMetadata(data.source, o.title, o.description);
  const accessibleDescription = `${metadata.description} Personal consistency score ${Math.round(score)} out of 100, ${level}; this is not a GitHub rank. ${basis}. Density ${finite(data.density).toFixed(1).replace(/\.0$/, "")} percent across ${formatNumber(data.activeDays, false)} active days in a ${formatNumber(data.window.days, false)}-day window. Current streak: ${streakText}${currentThrough ? ` through ${currentThrough}` : ""}; it is ${streakBoundedText}. ${rhythmTrendLabel(data.trend)}.`;
  let out = svgStart(width, o.height, t, metadata.title, metadata.description, accessibleDescription);
  out += cardMotionStyle(options?.motion) + `<g class="card-enter">`;
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += numeral(34, 48, 1, "PERSONAL CONSISTENCY", t);
  out += sourceMarker(data.source, width - 34, 48, t);
  const radius = compact ? 42 : 43;
  const centerX = compact ? 91 : 88;
  const centerY = compact ? 120 : 112;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * score / 100;
  out += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" stroke="${t.background}" stroke-width="10"/><circle cx="${centerX}" cy="${centerY}" r="${radius}" stroke="${t.accent}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${progress.toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 ${centerX} ${centerY})"/>`;
  out += text(centerX, centerY + 7, `${Math.round(score)}`, 28, t.text, 800, "middle") + text(centerX, centerY + 24, "/ 100", 10, t.muted, 650, "middle");
  const infoX = compact ? 164 : 166;
  out += text(infoX, compact ? 91 : 88, level.toUpperCase(), 11, t.accent, 750);
  out += text(infoX, compact ? 114 : 111, `${finite(data.density).toFixed(1).replace(/\.0$/, "")}% density · ${formatNumber(data.activeDays, false)} active days`, 11, t.text, 600);
  out += text(infoX, compact ? 134 : 131, `${formatNumber(data.window.days, false)}-day window · current ${streakText}`, 10, t.muted, 550);
  out += text(infoX, compact ? 154 : 151, throughPriorDay ? `Current streak observed through ${currentThrough}` : open ? "Streak can continue beyond this window" : "Streak is bounded to this window", 9, t.muted, 550);
  const trendX = compact ? 28 : 400;
  const trendTop = compact ? 187 : 76;
  const trendWidth = compact ? width - 56 : width - trendX - 34;
  const buckets = data.trend.buckets.slice(-12).map((value) => finite(value));
  const trendMax = Math.max(1, ...buckets);
  out += `<line x1="${compact ? 28 : 370}" y1="${compact ? 174 : 65}" x2="${width - 28}" y2="${compact ? 174 : 65}" stroke="${t.border}"/>`;
  out += text(trendX, trendTop, "WEEKLY RHYTHM", 10, t.muted, 700);
  out += text(trendX, trendTop + 17, rhythmTrendLabel(data.trend), 9, t.text, 550);
  const baseline = compact ? 264 : 166;
  const gap = 4;
  const barWidth = Math.max(4, (trendWidth - Math.max(0, buckets.length - 1) * gap) / Math.max(1, buckets.length));
  buckets.forEach((value, index) => {
    // Divide before scaling: multiplying a huge finite value first can overflow to Infinity.
    const height = value > 0 ? Math.max(3, 48 * (value / trendMax)) : 2;
    const x = trendX + index * (barWidth + gap);
    out += `<rect x="${x.toFixed(2)}" y="${(baseline - height).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" rx="3" fill="${value > 0 ? t.accent : t.background}"/>`;
  });
  out += mono(34, o.height - 11, "COMMITATLAS CONSISTENCY · NOT A GITHUB RANK", 8.5, t.muted, 500, "start", 0.06);
  return out + `</g>` + svgEnd();
}

export function renderLanguagesCard(data: LanguagesCardData, options?: RenderOptions): string {
  const o = optionsFor(options, 230, "Languages", "Programming languages used across GitHub repositories.", 190, 320); const t = o.theme; const width = o.width;
  const languages = data.languages.slice(0, 8);
  const hasBytes = data.languages.some((item) => Number.isFinite(item.bytes));
  const hasPercentages = data.languages.some((item) => Number.isFinite(item.percentage));
  const everyByteItem = data.languages.length > 0 && data.languages.every((item) => Number.isFinite(item.bytes));
  const everyPercentageItem = data.languages.length > 0 && data.languages.every((item) => Number.isFinite(item.percentage));
  const canonicalBasis = everyByteItem && everyPercentageItem;
  const standaloneBasis = (everyByteItem && !hasPercentages) || (everyPercentageItem && !hasBytes);
  if ((hasBytes || hasPercentages) && !canonicalBasis && !standaloneBasis) {
    throw new RangeError("Language statistics must use all bytes, all percentages, or canonical bytes and percentages together.");
  }
  const sourceByteTotal = data.languages.reduce((sum, item) => sum + finite(item.bytes), 0);
  const byteTotal = finite(data.totalBytes) > 0 ? finite(data.totalBytes) : sourceByteTotal;
  const percentageFor = (item: LanguageStat): number => Number.isFinite(item.percentage)
    ? Math.min(100, finite(item.percentage))
    : finite(item.bytes) / Math.max(1, byteTotal) * 100;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  let out = svgStart(width, o.height, t, metadata.title, metadata.description);
  out += cardMotionStyle(options?.motion) + `<g class="card-enter">`;
  out += panel(16, 16, width - 32, o.height - 32, t) + numeral(34, 48, 1, "LANGUAGES", t);
  out += sourceMarker(data.source, width - 34, 48, t);
  const barX = 34; const barY = 68; const barW = width - 68; const barH = 12; let cursor = barX;
  languages.forEach((item, index) => {
    const raw = percentageFor(item);
    const segment = barW * Math.max(0, Math.min(100, raw)) / 100;
    if (segment > 0) { out += `<rect x="${cursor.toFixed(2)}" y="${barY}" width="${segment.toFixed(2)}" height="${barH}" fill="${safeColor(item.color, t.languagePalette[index % t.languagePalette.length])}"/>`; cursor += segment; }
  });
  languages.forEach((item, index) => {
    const raw = percentageFor(item);
    const x = 34 + (index % 2) * (barW / 2); const y = 111 + Math.floor(index / 2) * 25;
    const color = safeColor(item.color, t.languagePalette[index % t.languagePalette.length]);
    const label = item.name ?? item.language ?? "Unknown language";
    // Square swatch, not a disc: it matches the density cell so the two surfaces read as one
    // system, and a square survives at the sizes a README actually renders at.
    out += `<rect x="${x + 1}" y="${y - 8}" width="8" height="8" fill="${color}"/>` + text(x + 16, y, truncateText(label, 19), 11.5, t.text, 600) + mono(x + barW / 2 - 10, y, `${raw.toFixed(1).replace(/\.0$/, "")}%`, 9.5, t.muted, 500, "end", 0.04);
  });
  return out + `</g>` + svgEnd();
}

export function renderProjectBoard(data: ProjectBoardData, options?: RenderOptions): string {
  const projects = data.projects.slice(0, 6); const totalProjects = data.projects.length;
  const normalizedWidth = dimension(options?.width, DEFAULT_OPTIONS.width, MIN_WIDTH, MAX_WIDTH);
  const columns = normalizedWidth >= 620 ? 2 : 1; const rows = Math.max(1, Math.ceil(projects.length / columns));
  const o = optionsFor(options, 68 + rows * 90, "Project signals", "Project lifecycle and CI signals for selected GitHub repositories.", 68 + rows * 90, 700); const t = o.theme; const width = o.width;
  const height = o.height; const cardWidth = (width - 48 - (columns - 1) * 12) / columns;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  let out = svgStart(width, height, t, metadata.title, metadata.description);
  out += cardMotionStyle(options?.motion) + `<g class="card-enter">`;
  out += sourceMarker(data.source, width - 24, 18, t);
  out += numeral(24, 34, 1, "PROJECT SIGNALS", t);
  if (projects.length < totalProjects) out += text(width - 24, 34, `${projects.length} of ${totalProjects} shown`, 11, t.muted, 500, "end");
  projects.forEach((project, index) => {
    const col = index % columns; const row = Math.floor(index / columns); const x = 24 + col * (cardWidth + 12); const y = 50 + row * 90;
    const ciColor = statusColor(project.ci, t); const projectName = truncateText(project.name, 25);
    out += panel(x, y, cardWidth, 78, t);
    out += text(x + 14, y + 23, projectName, 15, t.text, 700);
    out += text(x + 14, y + 43, `${lifecycleLabel(project.lifecycle)} · CI ${statusLabel(project.ci)}`, 11, t.muted, 550);
    out += `<circle cx="${x + cardWidth - 19}" cy="${y + 20}" r="5" fill="${ciColor}"/>`;
    if (project.version) out += text(x + 14, y + 64, truncateText(project.version, 15), 10, t.muted);
    // A zero-star chip is noise, not signal — the corner stays empty until there is a count worth showing.
    if (Number.isFinite(project.stars) && (project.stars as number) > 0) out += text(x + cardWidth - 14, y + 64, `★ ${formatNumber(finite(project.stars))}`, 10, t.muted, 500, "end");
  });
  return out + `</g>` + svgEnd();
}

function atlasMotionStyle(motion: RenderOptions["motion"]): string {
  if (motion !== "subtle") return "";
  // Chromium never runs CSS animations inside an SVG rendered through <img> — GitHub's README
  // pipeline — so the card must be finished before any keyframe applies. That means fill-mode
  // none with a small delay, never "both": a renderer that ignores or freezes the animation sits
  // in the delay phase and shows the natural, final geometry, while an animating renderer still
  // gets the rise. Bars overlay static tracks, so their pre-run state must be exact, not close.
  return `<style>
@keyframes atlas-rise{from{transform:translateY(5px)}to{transform:translateY(0)}}
.atlas-enter{animation:atlas-rise .42s ease-out .06s}.atlas-delay{animation-delay:.16s}.atlas-bar{animation:atlas-rise .55s ease-out .06s}.atlas-cell{animation:atlas-rise .32s ease-out .06s}
@media (prefers-reduced-motion:reduce){.atlas-enter,.atlas-bar,.atlas-cell{animation:none!important}}
</style>`;
}

function atlasMetric(x: number, y: number, label: string, value: string, theme: SvgTheme): string {
  return text(x, y, value, 20, theme.text, 760) + text(x, y + 17, label.toUpperCase(), 9, theme.muted, 650);
}

function atlasTrendLabel(data: AtlasCardData): string {
  if (data.trend.direction === "unavailable") return `${formatNumber(data.trend.recent28Days)} in latest 28 days`;
  if (data.trend.direction === "new") return `${formatNumber(data.trend.recent28Days)} · new activity`;
  const change = data.trend.changePercent;
  if (change === null) return `${formatNumber(data.trend.recent28Days)} in latest 28 days`;
  // A non-finite change is an unknown signal, not a zero one: say so instead of printing NaN.
  if (!Number.isFinite(change)) return `${formatNumber(data.trend.recent28Days)} · trend change unavailable`;
  const sign = change > 0 ? "+" : "";
  return `${formatNumber(data.trend.recent28Days)} · ${sign}${change.toFixed(1).replace(/\.0$/, "")}% vs prior 28d`;
}

function atlasBreakdownValue(value: number, basis: AtlasCardData["breakdownBasis"]): string {
  if (basis === "public-profile-percentages") {
    return `${finite(value).toFixed(1).replace(/\.0$/, "")}%`;
  }
  return formatNumber(value);
}

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export function renderCadenceCard(data: CadenceCardData, options?: RenderOptions): string {
  const days = data.days
    .filter((day) => isValidIsoDate(day.date) && Number.isFinite(day.count) && day.count >= 0)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-MAX_ACTIVITY_DAYS);
  // getUTCDay puts Sunday first; the chassis reads weeks Monday-first. Normalize against the
  // largest finite count before summing so several Number.MAX_VALUE observations cannot turn the
  // total into Infinity and make every share appear to be zero.
  const scale = days.reduce((maximum, day) => Math.max(maximum, day.count), 0);
  const totals = Array.from({ length: 7 }, () => 0);
  if (scale > 0) {
    for (const day of days) totals[(new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7] += day.count / scale;
  }
  const normalizedTotal = totals.reduce((sum, value) => sum + value, 0);
  let total = 0;
  let totalOverflowed = false;
  for (const day of days) {
    if (totalOverflowed) continue;
    if (day.count > Number.MAX_VALUE - total) totalOverflowed = true;
    else total += day.count;
  }
  const o = optionsFor(options, 224, "Weekly cadence", "Contribution share by day of week for the returned window, on UTC day boundaries.", 190, 300); const t = o.theme; const width = o.width;
  const shares = totals.map((value) => (normalizedTotal > 0 ? (value / normalizedTotal) * 100 : 0));
  const maxShare = normalizedTotal > 0 ? Math.max(...shares) : 0;
  const busiestDays = normalizedTotal > 0
    ? shares.flatMap((share, index) => share === maxShare ? [index] : [])
    : [];
  const metadata = sourceMetadata(data.source, o.title, o.description);
  const busiestDescription = busiestDays.length > 1
    ? ` Busiest days: ${busiestDays.map((index) => WEEKDAY_NAMES[index]).join(", ")} at ${maxShare.toFixed(1).replace(/\.0$/, "")}%.`
    : "";
  const normalizationDescription = totalOverflowed
    ? " Finite contribution counts were normalized to avoid total overflow."
    : "";
  const accessibleDescription = normalizedTotal > 0
    ? `${metadata.description}${normalizationDescription} ${WEEKDAY_NAMES.map((name, index) => `${name} ${shares[index]!.toFixed(1)}%`).join(", ")}.${busiestDescription}`
    : `${metadata.description} No contributions observed in this window.`;
  let out = svgStart(width, o.height, t, metadata.title, metadata.description, accessibleDescription);
  out += cardMotionStyle(options?.motion) + `<g class="card-enter">`;
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += numeral(34, 48, 1, "WEEKLY CADENCE", t);
  out += sourceMarker(data.source, width - 34, 31, t);
  if (normalizedTotal === 0) {
    out += text(34, o.height / 2 + 6, "No contributions observed in this window", 13, t.muted, 550);
    return out + `</g>` + svgEnd();
  }
  const shareLabel = maxShare.toFixed(1).replace(/\.0$/, "");
  const busiestLabel = busiestDays.length > 1
    ? width < 560 || busiestDays.length > 3
      ? `Busiest: ${busiestDays.length}-way tie · ${shareLabel}%`
      : `Busiest days: ${busiestDays.map((index) => WEEKDAY_NAMES[index]).join(", ")} carry ${shareLabel}%`
    : `${WEEKDAY_NAMES[busiestDays[0]!]} carries ${shareLabel}%`;
  out += text(width - 34, 50, truncateText(busiestLabel, width < 560 ? MAX_COMPACT_CADENCE_LABEL_LENGTH : 72), 12, t.text, 600, "end");
  const baseline = o.height - 62; const chartTop = 78;
  const gap = 14; const barWidth = (width - 68 - gap * 6) / 7;
  const chartMaxShare = Math.max(1, ...shares);
  shares.forEach((share, index) => {
    const x = 34 + index * (barWidth + gap);
    const barHeight = Math.max(2, (share / chartMaxShare) * (baseline - chartTop));
    const isBusiest = busiestDays.includes(index);
    out += `<rect x="${x.toFixed(2)}" y="${(baseline - barHeight).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="3" fill="${isBusiest ? t.accent : t.track}"/>`;
    out += mono(x + barWidth / 2, baseline - barHeight - 7, `${share.toFixed(1).replace(/\.0$/, "")}%`, 8.5, isBusiest ? t.text : t.muted, 550, "middle", 0.04);
    out += mono(x + barWidth / 2, baseline + 16, WEEKDAY_LABELS[index], 8.5, t.muted, 550, "middle");
  });
  const totalLabel = totalOverflowed ? "NORMALIZED FINITE COUNTS" : `${formatNumber(total)} CONTRIBUTIONS`;
  out += mono(34, o.height - 26, `SHARE OF ${totalLabel} · UTC DAY BOUNDARIES · WINDOW-SCOPED`, 7.5, t.muted, 550, "start", 0.08);
  return out + `</g>` + svgEnd();
}

const RELEASE_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function renderReleasesCard(data: ReleasesCardData, options?: RenderOptions): string {
  const sorted = data.releases
    .map((release) => ({ release, timestamp: Date.parse(String(release.publishedAt ?? "")) }))
    .filter(({ release, timestamp }) => String(release.project ?? "").trim() && String(release.tag ?? "").trim()
      && RELEASE_TIMESTAMP_PATTERN.test(String(release.publishedAt ?? ""))
      && isValidIsoDate(String(release.publishedAt).slice(0, 10)) && Number.isFinite(timestamp))
    // Parse rather than compare strings: ".5Z" would sort before "Z" lexically despite being later.
    .sort((left, right) => right.timestamp - left.timestamp);
  // Keep only the newest release for each project before applying the six-row cap and absence
  // arithmetic. This pass is linear after sorting; trimming the identity also makes whitespace-
  // only presentation differences safe without the former quadratic findIndex scan.
  const seenProjects = new Set<string>();
  const valid = [];
  for (const { release } of sorted) {
    const project = String(release.project).trim();
    if (seenProjects.has(project)) continue;
    seenProjects.add(project);
    valid.push({ ...release, project });
  }
  const releases = valid.slice(0, 6);
  // The absence footer is computed from the pre-cap count: a release cut by the six-row display
  // cap still exists, and counting it as "no published release" would state a falsehood.
  const observed = Number.isFinite(data.projectsObserved)
    ? Math.max(valid.length, Math.max(0, Math.min(50, Math.round(data.projectsObserved as number))))
    : null;
  const unavailable = Number.isFinite(data.projectsUnavailable)
    ? Math.max(0, Math.min(50 - (observed ?? valid.length), Math.round(data.projectsUnavailable as number)))
    : null;
  const unavailableCount = unavailable ?? 0;
  const total = observed !== null || unavailable !== null
    ? Math.min(50, (observed ?? valid.length) + unavailableCount)
    : null;
  const absentCount = observed === null ? 0 : Math.max(0, observed - valid.length);
  const rows = releases.length > 0 ? releases.length : unavailableCount > 0 ? 2 : 1;
  // The minimum height scales with the rows actually drawn, so a caller-supplied height can
  // shrink margins but never clip a release row out of the panel.
  const rowsHeight = 92 + rows * 34 + 30;
  const o = optionsFor(options, rowsHeight, "Latest releases", "The most recent published release per curated project, newest first.", rowsHeight, 420); const t = o.theme; const width = o.width;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  const absenceSentence = absentCount > 0
    ? ` ${absentCount} of ${observed} observed curated projects have no published release observed.`
    : "";
  const unavailableSentence = unavailableCount > 0 && total !== null
    ? ` Release evidence was unavailable for ${unavailableCount} of ${total} curated projects.`
    : "";
  const emptySentence = unavailableCount > 0 && observed === 0
    ? `Release evidence was unavailable for all ${total} curated projects.`
    : unavailableCount > 0
      ? `No published releases were observed for ${observed ?? valid.length} observed curated projects.${unavailableSentence}`
      : observed !== null
        ? `No published releases were observed for ${observed} observed curated projects.`
        : "No published releases observed for the curated projects.";
  const accessibleDescription = releases.length
    ? `${metadata.description} ${releases.map((release) => `${truncateText(release.project, 25)} ${truncateText(release.tag, 18)} on ${release.publishedAt.slice(0, 10)}`).join("; ")}.${absenceSentence}${unavailableSentence}`
    : `${metadata.description} ${emptySentence}`;
  let out = svgStart(width, o.height, t, metadata.title, metadata.description, accessibleDescription);
  out += cardMotionStyle(options?.motion) + `<g class="card-enter">`;
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += numeral(34, 48, 1, "LATEST RELEASES", t);
  out += sourceMarker(data.source, width - 34, 31, t);
  if (!releases.length) {
    if (unavailableCount > 0) {
      const allUnavailable = observed === 0;
      out += text(34, 88, allUnavailable ? "Release evidence unavailable" : "No published releases in observed projects", 13, t.muted, 550);
      out += text(34, 112, allUnavailable
        ? `${unavailableCount} of ${total} curated projects were not observed`
        : `${unavailableCount} of ${total} release lookups unavailable`, 11, t.muted, 500);
    } else {
      out += text(34, 92, "No published releases observed for the curated projects", 13, t.muted, 550);
    }
    const footer = [
      absentCount > 0 ? `${absentCount} OF ${observed} OBSERVED PROJECTS HAVE NO PUBLISHED RELEASE` : null,
      unavailableCount > 0 ? `${unavailableCount} OF ${total} RELEASE LOOKUPS UNAVAILABLE` : null,
    ].filter((part): part is string => part !== null).join(" · ");
    if (footer) out += mono(34, o.height - 28, footer, 7.5, t.muted, 550, "start", 0.08);
    return out + `</g>` + svgEnd();
  }
  if (releases.length < valid.length) out += text(width - 34, 50, `${releases.length} of ${valid.length} shown`, 11, t.muted, 500, "end");
  releases.forEach((release, index) => {
    const y = 88 + index * 34;
    if (index > 0) out += `<line x1="34" y1="${y - 22}" x2="${width - 34}" y2="${y - 22}" stroke="${t.border}"/>`;
    out += mono(34, y, release.publishedAt.slice(0, 10), 9.5, t.muted, 500, "start", 0.04);
    out += text(128, y, truncateText(release.project, width < 560 ? 16 : 30), 13.5, t.text, 700);
    out += mono(width - 34, y, truncateText(release.tag, width < 560 ? 12 : 18), 10.5, t.accent, 600, "end", 0.04);
  });
  const footer = [
    absentCount > 0 ? `${absentCount} OF ${observed} OBSERVED PROJECTS HAVE NO PUBLISHED RELEASE` : null,
    unavailableCount > 0 ? `${unavailableCount} OF ${total} RELEASE LOOKUPS UNAVAILABLE` : null,
  ].filter((part): part is string => part !== null).join(" · ");
  if (footer) out += mono(34, o.height - 28, footer, 7.5, t.muted, 550, "start", 0.08);
  return out + `</g>` + svgEnd();
}

/** Render the compact, source-labelled CommitAtlas overview card. */
export function renderAtlasCard(data: AtlasCardData, options?: RenderOptions): string {
  const normalizedWidth = dimension(options?.width, 860, MIN_WIDTH, MAX_WIDTH);
  const narrow = normalizedWidth < 620;
  const defaultHeight = narrow ? 570 : 380;
  const o = optionsFor(
    { ...options, width: options?.width ?? 860 },
    defaultHeight,
    "CommitAtlas developer atlas",
    "A source-labelled overview of public GitHub contribution rhythm, activity, collaboration, languages, and project health.",
    defaultHeight,
    narrow ? 640 : 460,
  );
  const t = o.theme;
  const width = o.width;
  const height = o.height;
  const name = truncateText(data.profile.name || data.profile.login || "GitHub user", narrow ? 22 : 30);
  const login = truncateText(String(data.profile.login ?? "").replace(/^@/, ""), 32);
  const sourceLabel = data.source === "synthetic-demo" ? "SYNTHETIC PREVIEW"
    : data.source === "public-profile" ? "PUBLIC PROFILE VIEW"
      : "PUBLIC GITHUB";
  const breakdownQualifier = data.breakdownBasis === "public-profile-percentages"
    ? "Public profile activity percentage mix from calendar-year views, not scoped to this contribution window"
    : "Breakdown";
  const currentStreakOpen = data.streakBoundary?.current === "open";
  // Window boundaries, the rhythm level, and the window length come from the caller, so bound and
  // clamp them here rather than trusting the adapter that normally supplies them.
  const windowFrom = truncateText(data.window.from, MAX_WINDOW_LABEL_LENGTH);
  const windowTo = truncateText(data.window.to, MAX_WINDOW_LABEL_LENGTH);
  const windowDays = formatNumber(data.window.days, false);
  const rhythmLevel = truncateText(data.rhythm.level, MAX_RHYTHM_LEVEL_LENGTH);
  const currentStreakThrough = isValidIsoDate(data.currentStreakThrough) ? data.currentStreakThrough : null;
  const currentStreakLabel = currentStreakThrough && currentStreakThrough !== data.window.to
    ? `Streak to ${currentStreakThrough.slice(5)}`
    : "Current streak";
  const accessibleDescription = `${o.description} ${formatNumber(data.total, false)} contributions across ${windowDays} days; ${formatNumber(data.activeDays, false)} active days; ${finite(data.density).toFixed(1).replace(/\.0$/, "")}% density; ${currentStreakOpen ? "at least " : ""}${formatNumber(data.currentStreak, false)} day current streak${currentStreakThrough ? ` through ${currentStreakThrough}` : ""} and ${formatNumber(data.longestStreak, false)} day longest streak in this window. Earlier streak history is not observed. ${breakdownQualifier}: ${atlasBreakdownValue(data.breakdown.commits, data.breakdownBasis)} commits, ${atlasBreakdownValue(data.breakdown.pullRequests, data.breakdownBasis)} pull requests, ${atlasBreakdownValue(data.breakdown.reviews, data.breakdownBasis)} reviews, and ${atlasBreakdownValue(data.breakdown.issues, data.breakdownBasis)} issues. Rhythm is a CommitAtlas consistency score, not a GitHub rank.`;
  let out = svgStart(width, height, t, o.title, o.description, accessibleDescription);
  out += atlasMotionStyle(options?.motion);
  out += `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="17" stroke="${t.border}"/>`;
  out += `<g class="atlas-enter"><circle cx="30" cy="32" r="16" fill="${t.accent}"/>`;
  out += text(30, 38, ([...name][0] ?? "?").toUpperCase(), 16, t.background, 800, "middle");
  out += text(56, 29, name, 18, t.text, 760) + text(56, 47, `@${login}`, 10, t.muted, 550);
  out += text(width - 22, 28, sourceLabel, 9, data.source === "synthetic-demo" ? t.warning : t.positive, 700, "end");
  out += text(width - 22, 45, `${windowDays}D · ${windowTo}`, 9, t.muted, 550, "end");
  out += `</g><line x1="22" y1="62" x2="${width - 22}" y2="62" stroke="${t.border}"/>`;

  const metricValues = [
    ["Contributions", formatNumber(data.total)],
    ["Active days", formatNumber(data.activeDays, false)],
    ["Density", `${finite(data.density).toFixed(1).replace(/\.0$/, "")}%`],
    ["Average / day", finite(data.averagePerDay).toFixed(1)],
    [currentStreakLabel, `${formatNumber(data.currentStreak, false)}${currentStreakOpen ? "+" : ""}d`],
    ["Longest in window", `${formatNumber(data.longestStreak, false)}d`],
  ] as const;
  if (narrow) {
    const metricWidth = (width - 44) / 3;
    metricValues.forEach(([label, value], index) => {
      out += `<g class="atlas-enter atlas-delay">${atlasMetric(22 + (index % 3) * metricWidth, index < 3 ? 91 : 135, label, value, t)}</g>`;
    });
    out += `<line x1="22" y1="160" x2="${width - 22}" y2="160" stroke="${t.border}"/>`;
  } else {
    const metricWidth = (width - 44) / metricValues.length;
    metricValues.forEach(([label, value], index) => {
      out += `<g class="atlas-enter atlas-delay">${atlasMetric(22 + index * metricWidth, 94, label, value, t)}</g>`;
    });
    out += `<line x1="22" y1="122" x2="${width - 22}" y2="122" stroke="${t.border}"/>`;
  }

  const heatmapTop = narrow ? 191 : 154;
  const heatmapLeft = 24;
  const heatmapWidth = narrow ? width - 48 : Math.floor(width * .61) - 34;
  const days = data.activity.filter((day) => isValidIsoDate(day.date)).sort((left, right) => left.date.localeCompare(right.date)).slice(-366);
  const grid = calendarGrid(days);
  const columns = grid.columns;
  const cell = Math.max(3, Math.min(7, Math.floor((heatmapWidth - Math.max(0, columns - 1) * 2) / columns)));
  const heatmapActualWidth = columns * cell + Math.max(0, columns - 1) * 2;
  out += numeral(heatmapLeft, heatmapTop - 14, 1, "CONTRIBUTION DENSITY", t);
  out += mono(heatmapLeft + heatmapWidth, heatmapTop - 14, `${formatNumber(data.peakDay.count, false)} PEAK · ${truncateText(data.peakDay.date, 10)}`, 8.5, t.muted, 500, "end", 0.1);
  const heatmapPaths = new Map<string, string[]>();
  grid.cells.forEach(({ day, column, row }) => {
    const level = Number.isFinite(day.level) ? Math.max(0, Math.min(4, Math.round(day.level as number))) : day.count > 0 ? 2 : 0;
    const x = heatmapLeft + column * (cell + 2);
    const y = heatmapTop + row * (cell + 2);
    const fill = densityFill(level, t);
    const paths = heatmapPaths.get(fill) ?? [];
    paths.push(`M${x} ${y}h${cell}v${cell}H${x}Z`);
    heatmapPaths.set(fill, paths);
  });
  out += [...heatmapPaths.entries()].map(([fill, paths]) => `<path class="atlas-cell" fill="${fill}" d="${paths.join("")}"/>`).join("");
  const heatmapBottom = heatmapTop + 7 * (cell + 2);
  out += mono(heatmapLeft, heatmapBottom + 13, windowFrom, 8, t.muted, 500, "start", 0.08);
  out += mono(heatmapLeft + heatmapActualWidth, heatmapBottom + 13, windowTo, 8, t.muted, 500, "end", 0.08);
  // The key sits under the grid it explains, so the ramp never needs to be inferred.
  const densityKeyX = Math.max(heatmapLeft, heatmapLeft + heatmapActualWidth - 118);
  out += `<g aria-hidden="true">${densityKey(densityKeyX, heatmapBottom + 22, t, 6)}</g>`;

  const breakdownX = narrow ? 24 : Math.floor(width * .64);
  const breakdownY = narrow ? 290 : 144;
  const breakdownWidth = width - breakdownX - 24;
  // One ink for all four rows. The bar's LENGTH is the variable, so its colour is free to stay
  // constant — and holding it constant is what stops this panel handing the reader a second,
  // contradictory colour vocabulary next to the density grid.
  const breakdown = [
    ["Commits", data.breakdown.commits],
    ["Pull requests", data.breakdown.pullRequests],
    ["Reviews", data.breakdown.reviews],
    ["Issues", data.breakdown.issues],
  ] as const;
  const breakdownMax = Math.max(1, ...breakdown.map(([, value]) => finite(value)));
  out += numeral(breakdownX, breakdownY, 2, data.breakdownBasis === "public-profile-percentages" ? "PROFILE MIX · NOT WINDOW-SCOPED" : "CONTRIBUTION MIX", t);
  breakdown.forEach(([label, value], index) => {
    const y = breakdownY + 18 + index * 24;
    const trackWidth = Math.max(1, breakdownWidth - 104);
    // Divide before scaling: multiplying a huge finite value first can overflow to Infinity.
    const barWidth = Math.max(2, trackWidth * (finite(value) / breakdownMax));
    out += mono(breakdownX, y + 8, label, 8.5, t.muted, 500, "start", 0.08);
    out += `<rect x="${breakdownX + 76}" y="${y + 1}" width="${trackWidth}" height="6" fill="${t.track}"/>`;
    out += `<rect class="atlas-bar" x="${breakdownX + 76}" y="${y + 1}" width="${barWidth.toFixed(2)}" height="6" fill="${t.mixInk}"/>`;
    out += mono(width - 24, y + 8, atlasBreakdownValue(value, data.breakdownBasis), 9, t.text, 600, "end", 0.04);
  });

  const footerTop = narrow ? 408 : 282;
  out += `<line x1="22" y1="${footerTop - 12}" x2="${width - 22}" y2="${footerTop - 12}" stroke="${t.border}"/>`;
  const trendX = 24;
  const trendWidth = narrow ? Math.floor((width - 60) * .58) : Math.floor(width * .34);
  const trendBaseline = footerTop + 48;
  // Bound the strip the way renderRhythmCard does: keep the most recent buckets, drop the rest.
  const trendBuckets = data.trend.buckets.slice(-MAX_ATLAS_TREND_BUCKETS);
  const trendMax = Math.max(1, ...trendBuckets.map((value) => finite(value)));
  out += text(trendX, footerTop + 2, "RECENT MOMENTUM", 10, t.muted, 700);
  out += text(trendX, footerTop + 18, atlasTrendLabel(data), 9, t.text, 550);
  const trendGap = 3;
  const trendBarWidth = Math.max(3, (trendWidth - Math.max(0, trendBuckets.length - 1) * trendGap) / Math.max(1, trendBuckets.length));
  trendBuckets.forEach((value, index) => {
    // Divide before scaling: multiplying a huge finite value first can overflow to Infinity.
    const barHeight = Math.max(2, 22 * (finite(value) / trendMax));
    out += `<rect class="atlas-bar" x="${(trendX + index * (trendBarWidth + trendGap)).toFixed(2)}" y="${(trendBaseline - barHeight).toFixed(2)}" width="${trendBarWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="2" fill="${t.accent}"/>`;
  });

  const rhythmX = narrow ? trendX + trendWidth + 22 : Math.floor(width * .40);
  out += text(rhythmX, footerTop + 2, "RHYTHM", 10, t.muted, 700);
  out += text(rhythmX, footerTop + 27, `${Math.round(finite(data.rhythm.score))}/100`, 23, t.text, 780);
  out += mono(rhythmX, footerTop + 43, `${rhythmLevel.toUpperCase()} · PERSONAL CONSISTENCY`, 7.5, t.muted, 600, "start", 0.08);

  const detailX = narrow ? 24 : Math.floor(width * .60);
  const detailY = narrow ? footerTop + 78 : footerTop;
  const languages = (data.languages ?? []).slice(0, 3);
  out += text(detailX, detailY + 2, "PORTFOLIO SIGNALS", 10, t.muted, 700);
  out += languages.length > 0
    ? text(detailX, detailY + 21, languages.map((language) => `${truncateText(language.name ?? language.language ?? "Other", 10)} ${finite(language.percentage).toFixed(0)}%`).join(" · "), 9, t.text, 550)
    : text(detailX, detailY + 21, "Languages unavailable", 9, t.muted, 550);
  const profileSignal = `${formatNumber(data.profile.repositories, false)} repos · ${formatNumber(data.profile.followers)} followers${Number.isFinite(data.profile.stars) ? ` · ${formatNumber(data.profile.stars)} stars` : " · stars unavailable"}`;
  out += text(detailX, detailY + 37, profileSignal, 9, t.text, 550);
  const projectCounts = data.projects;
  // A non-finite or negative count is an unknown project signal. Never render it as a real tally,
  // and never let `NaN`/`Infinity` reach visible text. Negative has to be rejected here rather than
  // left to `finite()`: that clamps to zero, so `attention: -1` would otherwise print a confident
  // `0 attention` in the muted healthy style — corrupt input presented as a clean signal, which is
  // exactly what the never-show-an-unknown-as-healthy rule forbids.
  const projectCountsKnown = projectCounts
    ? [projectCounts.total, projectCounts.passing, projectCounts.attention, projectCounts.unavailable]
      .every((count) => Number.isFinite(count) && (count as number) >= 0)
    : false;
  out += !projectCounts
    ? text(detailX, detailY + 53, "Project health not configured", 9, t.muted, 550)
    : projectCountsKnown
      ? text(detailX, detailY + 53, `${finite(projectCounts.passing)}/${finite(projectCounts.total)} CI passing · ${finite(projectCounts.attention)} attention · ${finite(projectCounts.unavailable)} unavailable`, 9, finite(projectCounts.attention) > 0 ? t.warning : t.muted, 550)
      : text(detailX, detailY + 53, "Project health unavailable", 9, t.muted, 550);
  out += text(width - 22, height - 10, `Generated ${truncateText(data.generatedAt, 25)} · longest streak is window-bounded · rhythm is not a GitHub rank`, 8, t.muted, 500, "end");
  return out + svgEnd();
}

export const renderProfile = renderProfileCard;
export const renderStreak = renderStreakCard;
export const renderActivity = renderActivityCard;
export const renderLanguages = renderLanguagesCard;
export const renderProjectSignalBoard = renderProjectBoard;
export const renderContributionBreakdown = renderContributionBreakdownCard;
export const renderRhythm = renderRhythmCard;
export const renderAtlas = renderAtlasCard;
