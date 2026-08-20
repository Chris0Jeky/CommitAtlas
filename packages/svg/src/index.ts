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
  readonly languagePalette: readonly string[];
}

export const themes: Readonly<Record<ThemeName, SvgTheme>> = {
  aurora: {
    background: "#09131f", surface: "#102238", text: "#f6fbff", muted: "#a9c1d5",
    accent: "#79f2c0", positive: "#79f2c0", warning: "#ffd166", negative: "#ff7b9c",
    border: "#26445f", languagePalette: ["#79f2c0", "#6cc6ff", "#c4a7ff", "#ffd166", "#ff9f68"],
  },
  midnight: {
    background: "#05070d", surface: "#111827", text: "#f8fafc", muted: "#b5c1d5",
    accent: "#a78bfa", positive: "#6ee7b7", warning: "#fbbf24", negative: "#fb7185",
    border: "#2f3b53", languagePalette: ["#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#f472b6"],
  },
  paper: {
    background: "#f8fafc", surface: "#ffffff", text: "#0f172a", muted: "#475569",
    accent: "#0f766e", positive: "#15803d", warning: "#b45309", negative: "#b91c1c",
    border: "#cbd5e1", languagePalette: ["#0f766e", "#2563eb", "#7c3aed", "#b45309", "#be185d"],
  },
  ember: {
    background: "#0d1117", surface: "#161b22", text: "#f2f4f7", muted: "#a7adb7",
    accent: "#ff9f68", positive: "#75d69b", warning: "#ffd166", negative: "#ff7b7b",
    border: "#30363d", languagePalette: ["#ff9f68", "#ffd166", "#75d69b", "#9bd5ff", "#d7a8ff"],
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
    `<rect width="${width}" height="${height}" rx="18" fill="${theme.background}"/>`;
}

function svgEnd(): string { return "</svg>"; }

function text(x: number, y: number, value: unknown, size: number, fill: string, weight = 400, anchor = "start"): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter,ui-sans-serif,system-ui,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

function panel(x: number, y: number, width: number, height: number, theme: SvgTheme): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${theme.surface}" stroke="${theme.border}"/>`;
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
  return out + svgEnd();
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
  const currentOpen = data.boundary?.current === "open";
  const currentValue = `${formatNumber(finite(data.current), false)}${currentOpen ? "+" : ""}`;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  const accessibleDescription = data.boundary
    ? `${metadata.description} Current streak: ${currentOpen ? "at least " : ""}${formatNumber(finite(data.current), false)} days. Longest observed in the ${windowLabel}: ${formatNumber(finite(data.longest), false)} days. History before this window is not observed.${data.lastActive ? ` Last active ${truncateText(data.lastActive, 22)}.` : ""}`
    : metadata.description;
  let out = svgStart(width, o.height, t, metadata.title, metadata.description, accessibleDescription);
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += sourceMarker(data.source, width - 34, 31, t);
  out += text(34, 48, "CONTRIBUTION STREAK", 11, t.muted, 700);
  out += text(34, 94, currentValue, 46, t.accent, 800) + text(34, 116, currentOpen ? "days current · at least" : data.boundary ? "days current" : "days in returned window", 12, t.text, 600);
  out += `<line x1="${width / 2}" y1="38" x2="${width / 2}" y2="${o.height - 38}" stroke="${t.border}"/>`;
  out += text(width / 2 + 28, personalBestY, `Longest in ${windowLabel}`, 12, t.muted) + text(width / 2 + 28, longestY, `${formatNumber(finite(data.longest), false)} days`, 24, t.text, 750);
  const totalLabel = Number.isFinite(data.total) ? `Total ${formatNumber(finite(data.total))}` : "Total unavailable";
  const activeDaysLabel = Number.isFinite(data.activeDays) ? `${formatNumber(finite(data.activeDays))} active days` : "Active days unavailable";
  out += text(width / 2 + 28, statusY, `${totalLabel} · ${activeDaysLabel}`, 11, t.muted);
  const historyLabel = width < 560
    ? "Earlier history not observed"
    : `${data.lastActive ? `Last active ${truncateText(data.lastActive, 10)} · ` : ""}earlier history not observed`;
  out += text(width / 2 + 28, lastActiveY, historyLabel, width < 560 ? 9 : 10, t.muted);
  return out + svgEnd();
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
  out += panel(16, 16, width - 32, o.height - 32, t) + text(34, 48, periodLabel, 11, t.muted, 700);
  out += sourceMarker(data.source, width - 34, 29, t);
  out += text(width - 34, 48, `${formatNumber(finite(data.total ?? days.reduce((sum, day) => sum + day.count, 0)))} contributions`, 12, t.text, 600, "end");
  const columns = Math.min(53, Math.max(1, Math.ceil(days.length / 7))); const cell = Math.max(4, Math.min(11, Math.floor((width - 86 - 2 * (columns - 1)) / columns)));
  const start = 40; const top = 66;
  const cells: string[] = [];
  days.forEach((day, index) => {
    const column = Math.floor(index / 7); const row = index % 7; const intensity = Math.min(1, finite(day.count) / max);
    const fill = intensity === 0 ? t.background : intensity < 0.34 ? t.border : intensity < 0.67 ? t.accent : t.positive;
    const x = start + column * (cell + 2); const y = top + row * (cell + 2);
    cells.push(`<path fill="${fill}" d="M${x} ${y}h${cell}v${cell}H${x}"/>`);
  });
  out += `<g aria-hidden="true">${cells.join("")}</g>`;
  out += text(40, top + 7 * (cell + 2) + 19, "Less", 10, t.muted) + text(78, top + 7 * (cell + 2) + 19, "More", 10, t.muted);
  out += `<rect x="${width - 94}" y="${top + 7 * (cell + 2) + 10}" width="9" height="9" rx="2" fill="${t.background}"/><rect x="${width - 78}" y="${top + 7 * (cell + 2) + 10}" width="9" height="9" rx="2" fill="${t.border}"/><rect x="${width - 62}" y="${top + 7 * (cell + 2) + 10}" width="9" height="9" rx="2" fill="${t.accent}"/><rect x="${width - 46}" y="${top + 7 * (cell + 2) + 10}" width="9" height="9" rx="2" fill="${t.positive}"/>`;
  return out + svgEnd();
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
  const o = optionsFor(
    options,
    220,
    "Contribution breakdown",
    "Contribution activity broken down by type for the selected window.",
    220,
    280,
  );
  const t = o.theme;
  const width = o.width;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  const values = breakdownLabels.map(([, key]) => finite(data.breakdown[key]));
  const total = values.reduce((sum, value) => sum + value, 0);
  const colors = [t.accent, t.negative, t.positive, t.warning] as const;
  const basisLabel = data.basis === "public-profile-percentages" ? "PUBLIC PROFILE %" : "EXACT COUNTS";
  const basisDescription = data.basis === "public-profile-percentages"
    ? "public profile percentages; exact counts and a total are unavailable"
    : "exact categorized counts";
  const accessibleDescription = `${metadata.description} Basis: ${basisDescription}. Window ${data.window.from} to ${data.window.to}, ${formatNumber(data.window.days, false)} days. ${breakdownLabels.map(([label], index) => `${label}: ${breakdownValue(values[index], data.basis)}`).join(", ")}.`;
  let out = svgStart(width, o.height, t, metadata.title, metadata.description, accessibleDescription);
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += text(34, 48, "CONTRIBUTION BREAKDOWN", 11, t.muted, 750);
  out += `<rect x="${width - 150}" y="31" width="116" height="22" rx="11" fill="${t.background}" stroke="${t.border}"/>`;
  out += text(width - 92, 46, basisLabel, 9, data.basis === "public-profile-percentages" ? t.warning : t.positive, 750, "middle");
  out += sourceMarker(data.source, width - 34, 70, t);
  out += text(34, 70, `${data.window.from} → ${data.window.to} · ${formatNumber(data.window.days, false)} days`, 10, t.muted, 550);
  const barX = Math.min(174, Math.max(136, width * 0.24));
  const barWidth = Math.max(40, width - barX - 106);
  breakdownLabels.forEach(([label], index) => {
    const y = 82 + index * 26;
    const value = values[index];
    const normalized = data.basis === "public-profile-percentages"
      ? Math.min(100, value) / 100
      : total > 0 ? value / total : 0;
    const fillWidth = barWidth * normalized;
    out += text(34, y + 10, label, 10, t.text, 600);
    out += `<rect x="${barX}" y="${y}" width="${barWidth}" height="10" rx="5" fill="${t.background}"/>`;
    if (fillWidth > 0) out += `<rect x="${barX}" y="${y}" width="${fillWidth.toFixed(2)}" height="10" rx="5" fill="${colors[index]}"/>`;
    out += text(width - 34, y + 10, breakdownValue(value, data.basis), 10, t.text, 700, "end");
  });
  out += `<line x1="34" y1="190" x2="${width - 34}" y2="190" stroke="${t.border}"/>`;
  out += text(34, 208, data.basis === "public-profile-percentages"
    ? "Exact counts unavailable · public profile percentages only"
    : "Categorized exact counts · bars normalized to categorized total", 9, t.muted, 550);
  return out + svgEnd();
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
  const current = formatNumber(finite(data.currentStreak), false);
  const open = data.currentStreakBoundary === "open";
  const streakText = open ? `at least ${current} days · OPEN` : `${current} days · CLOSED`;
  const streakBoundedText = open ? "open at the returned-window boundary" : "closed within the returned window";
  const metadata = sourceMetadata(data.source, o.title, o.description);
  const accessibleDescription = `${metadata.description} Personal consistency score ${Math.round(score)} out of 100, ${data.rhythm.level}. ${data.rhythm.basis}. Density ${finite(data.density).toFixed(1).replace(/\.0$/, "")} percent across ${formatNumber(data.activeDays, false)} active days in a ${formatNumber(data.window.days, false)}-day window. Current streak: ${streakText}; it is ${streakBoundedText}. ${rhythmTrendLabel(data.trend)}.`;
  let out = svgStart(width, o.height, t, metadata.title, metadata.description, accessibleDescription);
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += text(34, 48, "PERSONAL CONSISTENCY", 11, t.muted, 750);
  out += sourceMarker(data.source, width - 34, 48, t);
  const radius = compact ? 42 : 43;
  const centerX = compact ? 91 : 88;
  const centerY = compact ? 120 : 112;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * score / 100;
  out += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" stroke="${t.background}" stroke-width="10"/><circle cx="${centerX}" cy="${centerY}" r="${radius}" stroke="${t.accent}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${progress.toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 ${centerX} ${centerY})"/>`;
  out += text(centerX, centerY + 7, `${Math.round(score)}`, 28, t.text, 800, "middle") + text(centerX, centerY + 24, "/ 100", 10, t.muted, 650, "middle");
  const infoX = compact ? 164 : 166;
  out += text(infoX, compact ? 91 : 88, data.rhythm.level.toUpperCase(), 11, t.accent, 750);
  out += text(infoX, compact ? 114 : 111, `${finite(data.density).toFixed(1).replace(/\.0$/, "")}% density · ${formatNumber(data.activeDays, false)} active days`, 11, t.text, 600);
  out += text(infoX, compact ? 134 : 131, `${formatNumber(data.window.days, false)}-day window · current ${streakText}`, 10, t.muted, 550);
  out += text(infoX, compact ? 154 : 151, open ? "Streak can continue beyond this window" : "Streak is bounded to this window", 9, t.muted, 550);
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
    const height = value > 0 ? Math.max(3, 48 * value / trendMax) : 2;
    const x = trendX + index * (barWidth + gap);
    out += `<rect x="${x.toFixed(2)}" y="${(baseline - height).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" rx="3" fill="${value > 0 ? t.accent : t.background}"/>`;
  });
  out += text(34, o.height - 11, "CommitAtlas personal consistency · not a GitHub rank", 9, t.muted, 550);
  return out + svgEnd();
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
  out += panel(16, 16, width - 32, o.height - 32, t) + text(34, 48, "LANGUAGES", 11, t.muted, 700);
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
    out += `<circle cx="${x + 5}" cy="${y - 4}" r="4" fill="${color}"/>` + text(x + 16, y, truncateText(label, 19), 12, t.text, 600) + text(x + barW / 2 - 10, y, `${raw.toFixed(1).replace(/\.0$/, "")}%`, 11, t.muted, 500, "end");
  });
  return out + svgEnd();
}

export function renderProjectBoard(data: ProjectBoardData, options?: RenderOptions): string {
  const projects = data.projects.slice(0, 6); const totalProjects = data.projects.length;
  const normalizedWidth = dimension(options?.width, DEFAULT_OPTIONS.width, MIN_WIDTH, MAX_WIDTH);
  const columns = normalizedWidth >= 620 ? 2 : 1; const rows = Math.max(1, Math.ceil(projects.length / columns));
  const o = optionsFor(options, 68 + rows * 90, "Project signals", "Project lifecycle and CI signals for selected GitHub repositories.", 68 + rows * 90, 700); const t = o.theme; const width = o.width;
  const height = o.height; const cardWidth = (width - 48 - (columns - 1) * 12) / columns;
  const metadata = sourceMetadata(data.source, o.title, o.description);
  let out = svgStart(width, height, t, metadata.title, metadata.description);
  out += sourceMarker(data.source, width - 24, 18, t);
  out += text(24, 34, "PROJECT SIGNALS", 12, t.muted, 750);
  if (projects.length < totalProjects) out += text(width - 24, 34, `${projects.length} of ${totalProjects} shown`, 11, t.muted, 500, "end");
  projects.forEach((project, index) => {
    const col = index % columns; const row = Math.floor(index / columns); const x = 24 + col * (cardWidth + 12); const y = 50 + row * 90;
    const ciColor = statusColor(project.ci, t); const projectName = truncateText(project.name, 25);
    out += panel(x, y, cardWidth, 78, t);
    out += text(x + 14, y + 23, projectName, 15, t.text, 700);
    out += text(x + 14, y + 43, `${lifecycleLabel(project.lifecycle)} · CI ${statusLabel(project.ci)}`, 11, t.muted, 550);
    out += `<circle cx="${x + cardWidth - 19}" cy="${y + 20}" r="5" fill="${ciColor}"/>`;
    if (project.version) out += text(x + 14, y + 64, truncateText(project.version, 15), 10, t.muted);
    if (Number.isFinite(project.stars) && (project.stars as number) >= 0) out += text(x + cardWidth - 14, y + 64, `★ ${formatNumber(finite(project.stars))}`, 10, t.muted, 500, "end");
  });
  return out + svgEnd();
}

function atlasMotionStyle(motion: RenderOptions["motion"]): string {
  if (motion !== "subtle") return "";
  return `<style>
@keyframes atlas-rise{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
@keyframes atlas-grow{from{opacity:.2;transform:scaleY(.08)}to{opacity:1;transform:scaleY(1)}}
.atlas-enter{animation:atlas-rise .42s ease-out both}.atlas-delay{animation-delay:.1s}.atlas-bar{transform-box:fill-box;transform-origin:center bottom;animation:atlas-grow .55s ease-out both}.atlas-cell{animation:atlas-rise .32s ease-out both}
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
  const sign = change > 0 ? "+" : "";
  return `${formatNumber(data.trend.recent28Days)} · ${sign}${change.toFixed(1).replace(/\.0$/, "")}% vs prior 28d`;
}

function atlasBreakdownValue(value: number, basis: AtlasCardData["breakdownBasis"]): string {
  if (basis === "public-profile-percentages") {
    return `${finite(value).toFixed(1).replace(/\.0$/, "")}%`;
  }
  return formatNumber(value);
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
  const breakdownQualifier = data.breakdownBasis === "public-profile-percentages" ? "Public profile activity mix" : "Breakdown";
  const currentStreakOpen = data.streakBoundary?.current === "open";
  const accessibleDescription = `${o.description} ${formatNumber(data.total, false)} contributions across ${data.window.days} days; ${formatNumber(data.activeDays, false)} active days; ${finite(data.density).toFixed(1).replace(/\.0$/, "")}% density; ${currentStreakOpen ? "at least " : ""}${formatNumber(data.currentStreak, false)} day current streak and ${formatNumber(data.longestStreak, false)} day longest streak in this window. Earlier streak history is not observed. ${breakdownQualifier}: ${atlasBreakdownValue(data.breakdown.commits, data.breakdownBasis)} commits, ${atlasBreakdownValue(data.breakdown.pullRequests, data.breakdownBasis)} pull requests, ${atlasBreakdownValue(data.breakdown.reviews, data.breakdownBasis)} reviews, and ${atlasBreakdownValue(data.breakdown.issues, data.breakdownBasis)} issues. Rhythm is a CommitAtlas consistency score, not a GitHub rank.`;
  let out = svgStart(width, height, t, o.title, o.description, accessibleDescription);
  out += atlasMotionStyle(options?.motion);
  out += `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="17" stroke="${t.border}"/>`;
  out += `<g class="atlas-enter"><circle cx="30" cy="32" r="16" fill="${t.accent}"/>`;
  out += text(30, 38, ([...name][0] ?? "?").toUpperCase(), 16, t.background, 800, "middle");
  out += text(56, 29, name, 18, t.text, 760) + text(56, 47, `@${login}`, 10, t.muted, 550);
  out += text(width - 22, 28, sourceLabel, 9, data.source === "synthetic-demo" ? t.warning : t.positive, 700, "end");
  out += text(width - 22, 45, `${data.window.days}D · ${data.window.to}`, 9, t.muted, 550, "end");
  out += `</g><line x1="22" y1="62" x2="${width - 22}" y2="62" stroke="${t.border}"/>`;

  const metricValues = [
    ["Contributions", formatNumber(data.total)],
    ["Active days", formatNumber(data.activeDays, false)],
    ["Density", `${finite(data.density).toFixed(1).replace(/\.0$/, "")}%`],
    ["Average / day", finite(data.averagePerDay).toFixed(1)],
    ["Current streak", `${formatNumber(data.currentStreak, false)}${currentStreakOpen ? "+" : ""}d`],
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
  const columns = Math.max(1, Math.ceil(days.length / 7));
  const cell = Math.max(3, Math.min(7, Math.floor((heatmapWidth - Math.max(0, columns - 1) * 2) / columns)));
  const heatmapActualWidth = columns * cell + Math.max(0, columns - 1) * 2;
  out += text(heatmapLeft, heatmapTop - 14, "CONTRIBUTION DENSITY", 10, t.muted, 700);
  out += text(heatmapLeft + heatmapWidth, heatmapTop - 14, `${formatNumber(data.peakDay.count, false)} peak · ${truncateText(data.peakDay.date, 10)}`, 9, t.muted, 550, "end");
  const heatmapPaths = new Map<string, string[]>();
  days.forEach((day, index) => {
    const column = Math.floor(index / 7);
    const row = index % 7;
    const level = Number.isFinite(day.level) ? Math.max(0, Math.min(4, Math.round(day.level as number))) : day.count > 0 ? 2 : 0;
    const fill = level === 0 ? t.surface : level === 1 ? t.border : level === 2 ? t.accent : level === 3 ? t.positive : t.warning;
    const x = heatmapLeft + column * (cell + 2);
    const y = heatmapTop + row * (cell + 2);
    const paths = heatmapPaths.get(fill) ?? [];
    paths.push(`M${x} ${y}h${cell}v${cell}H${x}Z`);
    heatmapPaths.set(fill, paths);
  });
  out += [...heatmapPaths.entries()].map(([fill, paths]) => `<path class="atlas-cell" fill="${fill}" d="${paths.join("")}"/>`).join("");
  const heatmapBottom = heatmapTop + 7 * (cell + 2);
  out += text(heatmapLeft, heatmapBottom + 13, data.window.from, 8, t.muted, 500);
  out += text(heatmapLeft + heatmapActualWidth, heatmapBottom + 13, data.window.to, 8, t.muted, 500, "end");

  const breakdownX = narrow ? 24 : Math.floor(width * .64);
  const breakdownY = narrow ? 290 : 144;
  const breakdownWidth = width - breakdownX - 24;
  const breakdown = [
    ["Commits", data.breakdown.commits, t.accent],
    ["Pull requests", data.breakdown.pullRequests, t.positive],
    ["Reviews", data.breakdown.reviews, t.warning],
    ["Issues", data.breakdown.issues, t.negative],
  ] as const;
  const breakdownMax = Math.max(1, ...breakdown.map(([, value]) => finite(value)));
  out += text(breakdownX, breakdownY, data.breakdownBasis === "public-profile-percentages" ? "PUBLIC PROFILE ACTIVITY MIX" : "CONTRIBUTION MIX", 10, t.muted, 700);
  breakdown.forEach(([label, value, color], index) => {
    const y = breakdownY + 18 + index * 24;
    const trackWidth = Math.max(1, breakdownWidth - 104);
    const barWidth = Math.max(2, trackWidth * finite(value) / breakdownMax);
    out += text(breakdownX, y + 8, label, 9, t.muted, 550);
    out += `<rect x="${breakdownX + 76}" y="${y}" width="${trackWidth}" height="8" rx="4" fill="${t.surface}"/>`;
    out += `<rect class="atlas-bar" x="${breakdownX + 76}" y="${y}" width="${barWidth.toFixed(2)}" height="8" rx="4" fill="${color}"/>`;
    out += text(width - 24, y + 8, atlasBreakdownValue(value, data.breakdownBasis), 9, t.text, 650, "end");
  });

  const footerTop = narrow ? 408 : 282;
  out += `<line x1="22" y1="${footerTop - 12}" x2="${width - 22}" y2="${footerTop - 12}" stroke="${t.border}"/>`;
  const trendX = 24;
  const trendWidth = narrow ? Math.floor((width - 60) * .58) : Math.floor(width * .34);
  const trendBaseline = footerTop + 48;
  const trendMax = Math.max(1, ...data.trend.buckets.map(finite));
  out += text(trendX, footerTop + 2, "RECENT MOMENTUM", 10, t.muted, 700);
  out += text(trendX, footerTop + 18, atlasTrendLabel(data), 9, t.text, 550);
  const trendGap = 3;
  const trendBarWidth = Math.max(3, (trendWidth - Math.max(0, data.trend.buckets.length - 1) * trendGap) / Math.max(1, data.trend.buckets.length));
  data.trend.buckets.forEach((value, index) => {
    const barHeight = Math.max(2, 22 * finite(value) / trendMax);
    out += `<rect class="atlas-bar" x="${(trendX + index * (trendBarWidth + trendGap)).toFixed(2)}" y="${(trendBaseline - barHeight).toFixed(2)}" width="${trendBarWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="2" fill="${t.accent}"/>`;
  });

  const rhythmX = narrow ? trendX + trendWidth + 22 : Math.floor(width * .40);
  out += text(rhythmX, footerTop + 2, "RHYTHM", 10, t.muted, 700);
  out += text(rhythmX, footerTop + 27, `${Math.round(finite(data.rhythm.score))}/100`, 23, t.text, 780);
  out += text(rhythmX, footerTop + 43, `${data.rhythm.level.toUpperCase()} · PERSONAL CONSISTENCY`, 8, t.muted, 650);

  const detailX = narrow ? 24 : Math.floor(width * .60);
  const detailY = narrow ? footerTop + 78 : footerTop;
  const languages = (data.languages ?? []).slice(0, 3);
  out += text(detailX, detailY + 2, "PORTFOLIO SIGNALS", 10, t.muted, 700);
  out += languages.length > 0
    ? text(detailX, detailY + 21, languages.map((language) => `${truncateText(language.name ?? language.language ?? "Other", 10)} ${finite(language.percentage).toFixed(0)}%`).join(" · "), 9, t.text, 550)
    : text(detailX, detailY + 21, "Languages unavailable", 9, t.muted, 550);
  const profileSignal = `${formatNumber(data.profile.repositories, false)} repos · ${formatNumber(data.profile.followers)} followers${Number.isFinite(data.profile.stars) ? ` · ${formatNumber(data.profile.stars)} stars` : " · stars unavailable"}`;
  out += text(detailX, detailY + 37, profileSignal, 9, t.text, 550);
  out += data.projects
    ? text(detailX, detailY + 53, `${data.projects.passing}/${data.projects.total} CI passing · ${data.projects.attention} attention · ${data.projects.unavailable} unavailable`, 9, data.projects.attention > 0 ? t.warning : t.muted, 550)
    : text(detailX, detailY + 53, "Project health not configured", 9, t.muted, 550);
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
