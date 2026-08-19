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
    background: "#20100b", surface: "#321710", text: "#fff6ed", muted: "#e8c9b3",
    accent: "#ff9f68", positive: "#75d69b", warning: "#ffd166", negative: "#ff7b7b",
    border: "#653220", languagePalette: ["#ff9f68", "#ffd166", "#75d69b", "#9bd5ff", "#d7a8ff"],
  },
};

export interface RenderOptions {
  readonly theme?: ThemeName;
  readonly width?: number;
  readonly height?: number;
  readonly title?: string;
  readonly description?: string;
}

export interface ProfileCardData {
  readonly name: string;
  readonly login: string;
  readonly bio?: string;
  readonly location?: string;
  readonly website?: string;
  readonly repositories: number;
  readonly followers: number;
  readonly following: number;
  readonly contributions?: number;
}

export interface StreakCardData {
  readonly current: number;
  readonly longest: number;
  readonly total?: number;
  readonly activeDays?: number;
  readonly lastActive?: string;
}

export interface ActivityDay {
  readonly date: string;
  readonly count: number;
}

export interface ActivityCardData {
  readonly days: readonly ActivityDay[];
  readonly total?: number;
  readonly periodLabel?: string;
}

export interface LanguageStat {
  readonly name: string;
  readonly bytes?: number;
  readonly percentage?: number;
  readonly color?: string;
}

export interface LanguagesCardData {
  readonly languages: readonly LanguageStat[];
  readonly totalBytes?: number;
}

export type Lifecycle = "active" | "maintained" | "paused" | "archived" | "experimental";
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

export interface ProjectBoardData {
  readonly projects: readonly ProjectSignal[];
}

const DEFAULT_OPTIONS: Required<Pick<RenderOptions, "theme" | "width" | "height">> = {
  theme: "aurora", width: 720, height: 180,
};

/** Escape text and attribute values before they enter an SVG document. */
export function escapeXml(value: unknown): string {
  return String(value ?? "")
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
  if (number < 1_000_000) return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  if (number < 1_000_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  return `${(number / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
}

function finite(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, value as number) : fallback;
}

function themeFor(options?: RenderOptions): SvgTheme {
  return themes[options?.theme ?? DEFAULT_OPTIONS.theme] ?? themes.aurora;
}

function dimension(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? Math.round(value as number) : fallback;
}

function safeHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function safeColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

function optionsFor(options: RenderOptions | undefined, defaultHeight: number): { theme: SvgTheme; width: number; height: number; title: string; description: string } {
  return {
    theme: themeFor(options), width: dimension(options?.width, DEFAULT_OPTIONS.width),
    height: dimension(options?.height, defaultHeight),
    title: options?.title ?? "CommitAtlas GitHub card",
    description: options?.description ?? "A GitHub portfolio signal card generated by CommitAtlas.",
  };
}

function svgStart(width: number, height: number, theme: SvgTheme, title: string, description: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">` +
    `<title id="title">${escapeXml(title)}</title><desc id="desc">${escapeXml(description)}</desc>` +
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

export function renderProfileCard(data: ProfileCardData, options?: RenderOptions): string {
  const o = optionsFor(options, 220); const t = o.theme; const width = o.width;
  const name = truncateText(data.name, 30); const login = truncateText(data.login.replace(/^@/, ""), 32);
  const bio = truncateText(data.bio ?? "Building in public, one useful commit at a time.", 78);
  let out = svgStart(width, o.height, t, o.title ?? `${name} profile`, o.description ?? `GitHub profile for ${name}.`);
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += `<circle cx="64" cy="73" r="31" fill="${t.accent}"/><text x="64" y="82" fill="${t.background}" font-family="Inter,ui-sans-serif,system-ui,sans-serif" font-size="24" font-weight="800" text-anchor="middle">${escapeXml(([...name][0] ?? "?").toUpperCase())}</text>`;
  out += text(112, 54, name, 24, t.text, 750) + text(112, 77, `@${login}`, 13, t.muted);
  out += text(112, 103, bio, 13, t.text);
  if (data.location) out += text(112, 127, `⌖ ${truncateText(data.location, 35)}`, 12, t.muted);
  const stats = [["Repositories", data.repositories], ["Followers", data.followers], ["Following", data.following], ["Contributions", data.contributions]] as const;
  const statY = o.height - 46; const statWidth = (width - 64) / stats.length;
  stats.forEach(([label, value], index) => {
    if (value === undefined) return;
    const x = 32 + statWidth * index;
    out += text(x, statY - 13, formatNumber(finite(value)), 18, t.text, 750) + text(x, statY + 5, label, 10, t.muted);
  });
  if (data.website) out += link("Website ↗", data.website, width - 93, 34, t);
  return out + svgEnd();
}

export function renderStreakCard(data: StreakCardData, options?: RenderOptions): string {
  const o = optionsFor(options, 180); const t = o.theme; const width = o.width;
  let out = svgStart(width, o.height, t, o.title ?? "Contribution streak", o.description ?? "Current and longest GitHub contribution streaks.");
  out += panel(16, 16, width - 32, o.height - 32, t);
  out += text(34, 48, "CONTRIBUTION STREAK", 11, t.muted, 700);
  out += text(34, 94, formatNumber(finite(data.current), false), 46, t.accent, 800) + text(34, 116, "days current", 12, t.text, 600);
  out += `<line x1="${width / 2}" y1="38" x2="${width / 2}" y2="${o.height - 38}" stroke="${t.border}"/>`;
  out += text(width / 2 + 28, 65, "Personal best", 12, t.muted) + text(width / 2 + 28, 104, `${formatNumber(finite(data.longest), false)} days`, 24, t.text, 750);
  out += text(width / 2 + 28, 133, `Total ${formatNumber(finite(data.total))} · ${formatNumber(finite(data.activeDays))} active days`, 11, t.muted);
  if (data.lastActive) out += text(width / 2 + 28, 153, `Last active ${truncateText(data.lastActive, 22)}`, 11, t.muted);
  return out + svgEnd();
}

export function renderActivityCard(data: ActivityCardData, options?: RenderOptions): string {
  const o = optionsFor(options, 220); const t = o.theme; const width = o.width;
  const days = data.days.slice(-364); const max = Math.max(1, ...days.map((day) => finite(day.count)));
  let out = svgStart(width, o.height, t, o.title ?? "Contribution activity", o.description ?? "A compact contribution activity map with text labels for accessible status.");
  out += panel(16, 16, width - 32, o.height - 32, t) + text(34, 48, data.periodLabel ?? "ACTIVITY", 11, t.muted, 700);
  out += text(width - 34, 48, `${formatNumber(finite(data.total ?? days.reduce((sum, day) => sum + day.count, 0)))} contributions`, 12, t.text, 600, "end");
  const columns = Math.min(52, Math.max(1, Math.ceil(days.length / 7))); const cell = Math.max(4, Math.min(11, Math.floor((width - 86 - 2 * (columns - 1)) / columns)));
  const start = 40; const top = 66;
  days.forEach((day, index) => {
    const column = Math.floor(index / 7); const row = index % 7; const intensity = Math.min(1, finite(day.count) / max);
    const fill = intensity === 0 ? t.background : intensity < 0.34 ? t.border : intensity < 0.67 ? t.accent : t.positive;
    const x = start + column * (cell + 2); const y = top + row * (cell + 2);
    out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${escapeXml(`${day.date}: ${formatNumber(day.count, false)} contributions`)}</title></rect>`;
  });
  out += text(40, top + 7 * (cell + 2) + 19, "Less", 10, t.muted) + text(78, top + 7 * (cell + 2) + 19, "More", 10, t.muted);
  out += `<rect x="${width - 94}" y="${top + 7 * (cell + 2) + 10}" width="9" height="9" rx="2" fill="${t.background}"/><rect x="${width - 78}" y="${top + 7 * (cell + 2) + 10}" width="9" height="9" rx="2" fill="${t.border}"/><rect x="${width - 62}" y="${top + 7 * (cell + 2) + 10}" width="9" height="9" rx="2" fill="${t.accent}"/><rect x="${width - 46}" y="${top + 7 * (cell + 2) + 10}" width="9" height="9" rx="2" fill="${t.positive}"/>`;
  return out + svgEnd();
}

export function renderLanguagesCard(data: LanguagesCardData, options?: RenderOptions): string {
  const o = optionsFor(options, 230); const t = o.theme; const width = o.width;
  const languages = data.languages.slice(0, 8); const percentages = languages.map((item) => finite(item.percentage));
  const total = percentages.some(Boolean) ? percentages.reduce((sum, value) => sum + value, 0) : languages.reduce((sum, item) => sum + finite(item.bytes), 0);
  let out = svgStart(width, o.height, t, o.title ?? "Languages", o.description ?? "Programming languages used across GitHub repositories.");
  out += panel(16, 16, width - 32, o.height - 32, t) + text(34, 48, "LANGUAGES", 11, t.muted, 700);
  const barX = 34; const barY = 68; const barW = width - 68; const barH = 12; let cursor = barX;
  languages.forEach((item, index) => {
    const raw = percentages.some(Boolean) ? finite(item.percentage) : finite(item.bytes) / Math.max(1, total) * 100;
    const segment = barW * Math.max(0, Math.min(100, raw)) / 100;
    if (segment > 0) { out += `<rect x="${cursor.toFixed(2)}" y="${barY}" width="${segment.toFixed(2)}" height="${barH}" fill="${safeColor(item.color, t.languagePalette[index % t.languagePalette.length])}"/>`; cursor += segment; }
  });
  languages.forEach((item, index) => {
    const raw = percentages.some(Boolean) ? finite(item.percentage) : finite(item.bytes) / Math.max(1, total) * 100;
    const x = 34 + (index % 2) * (barW / 2); const y = 111 + Math.floor(index / 2) * 25;
    const color = safeColor(item.color, t.languagePalette[index % t.languagePalette.length]);
    out += `<circle cx="${x + 5}" cy="${y - 4}" r="4" fill="${color}"/>` + text(x + 16, y, truncateText(item.name, 19), 12, t.text, 600) + text(x + barW / 2 - 10, y, `${raw.toFixed(1).replace(/\.0$/, "")}%`, 11, t.muted, 500, "end");
  });
  return out + svgEnd();
}

export function renderProjectBoard(data: ProjectBoardData, options?: RenderOptions): string {
  const o = optionsFor(options, 302); const t = o.theme; const width = o.width;
  const projects = data.projects.slice(0, 6); const columns = width >= 620 ? 2 : 1; const rows = Math.max(1, Math.ceil(projects.length / columns));
  const height = dimension(options?.height, 68 + rows * 90); const cardWidth = (width - 48 - (columns - 1) * 12) / columns;
  let out = svgStart(width, height, t, o.title ?? "Project signals", o.description ?? "Project lifecycle and CI signals for selected GitHub repositories.");
  out += text(24, 34, "PROJECT SIGNALS", 12, t.muted, 750) + text(width - 24, 34, `${projects.length} of 6 shown`, 11, t.muted, 500, "end");
  projects.forEach((project, index) => {
    const col = index % columns; const row = Math.floor(index / columns); const x = 24 + col * (cardWidth + 12); const y = 50 + row * 90;
    const ciColor = statusColor(project.ci, t); const projectName = truncateText(project.name, 25);
    out += panel(x, y, cardWidth, 78, t);
    out += text(x + 14, y + 23, projectName, 15, t.text, 700);
    out += text(x + 14, y + 43, `${lifecycleLabel(project.lifecycle)} · CI ${statusLabel(project.ci)}`, 11, t.muted, 550);
    out += `<circle cx="${x + cardWidth - 19}" cy="${y + 20}" r="5" fill="${ciColor}"/>`;
    if (project.version) out += text(x + 14, y + 64, truncateText(project.version, 15), 10, t.muted);
    if (project.stars !== undefined) out += text(x + cardWidth - 14, y + 64, `★ ${formatNumber(finite(project.stars))}`, 10, t.muted, 500, "end");
    const links = project.links; if (links) {
      const labels: [string, string | undefined][] = [["Repo", links.repository], ["Docs", links.docs], ["Install", links.install], ["Download", links.download]];
      const available = labels.filter(([, href]) => safeHref(href));
      if (available.length) out += available.slice(0, 2).map(([label, href], linkIndex) => link(label, href, x + cardWidth - 100 + linkIndex * 48, y + 23, t)).join("");
    }
  });
  return out + svgEnd();
}

export const renderProfile = renderProfileCard;
export const renderStreak = renderStreakCard;
export const renderActivity = renderActivityCard;
export const renderLanguages = renderLanguagesCard;
export const renderProjectSignalBoard = renderProjectBoard;
