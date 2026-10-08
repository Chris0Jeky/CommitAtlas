import type { PortfolioSnapshot } from '@commit-atlas/github';
import { escapeXml, themes, truncateText } from '../index.js';
import { compileSceneMotion, sceneClassName, sceneElementId, sceneUnavailable } from '../scene.js';
import type { MotionApplication } from '../motion/types.js';
import type { RenderContext, SceneDefinition, SceneInputs, SceneUnavailable } from '../scene.js';
import { badge, evidenceLabel, frame } from '../primitives/index.js';
import { orbit } from '../primitives/geometric.js';

const DAY = 86_400_000;
// Requested contribution windows are 7..730 days. Automatic history fetch is 731 (core AUTO_WINDOW_DAYS); this package does not depend on core.
const MAX_WINDOW_DAYS = 731;
const MAX_WEEK_INDEX = Math.ceil(MAX_WINDOW_DAYS / 7) + 2;
const NEEDLE_CAP = 30;
const RING_FRACTIONS = [0.42, 0.68, 0.94] as const;
const RING_TARGETS = ['ringDay', 'ringWeek', 'ringMonth'] as const;
// Day, week, and month rings: 600ms × 1 / 7 / 30, inside the compiler's 60..20000ms range.
const RING_PERIODS = [600, 4_200, 18_000] as const;
const RING_GROUPS = ['day', 'week', 'month'] as const;
const FACE_TICKS = [-90, -60, -30, 0, 30, 60, 90] as const;
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

interface ReleaseMark { readonly tag: string; readonly angle: number }
interface ChronographModel {
  readonly current: number;
  readonly longest: number;
  readonly activeWeeks: number;
  readonly totalWeeks: number;
  readonly activeDays: number;
  readonly observedDays: number;
  readonly activeMonths: number;
  readonly observedMonths: number;
  readonly needle: number;
  readonly open: boolean;
  readonly ticks: readonly number[];
  readonly releases: readonly ReleaseMark[];
  readonly releasesBlocked: boolean;
  readonly stale: boolean;
  readonly synthetic: boolean;
  readonly observed: boolean;
  readonly source: string;
  readonly observedAt: string;
  readonly windowFrom: string;
  readonly windowTo: string;
}

function num(value: number): string {
  return String(Number(value.toFixed(3)));
}
function plateText(x: number, y: number, content: string, ink: string, size: number, anchor = 'start'): string {
  const aligned = anchor === 'start' ? '' : ` text-anchor="${anchor}"`;
  return `<text x="${x}" y="${y}" fill="${ink}" font-family="${MONO}" font-size="${size}"${aligned}>${escapeXml(content)}</text>`;
}
function xmlChars(value: string): string {
  return [...value].filter(character => {
    const code = character.codePointAt(0) ?? 0;
    return code === 9 || code === 10 || code === 13 ||
      (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff);
  }).join('');
}
function utcDay(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}
function utcStamp(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)) return null;
  const timestamp = Date.parse(value);
  const normalized = value.includes('.')
    ? value.replace(/\.(\d+)Z$/u, (_, digits: string) => `.${digits.padEnd(3, '0')}Z`)
    : value.replace(/Z$/u, '.000Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === normalized ? timestamp : null;
}
function unavailable(): SceneUnavailable {
  return sceneUnavailable('Contribution calendar or streak is unavailable.');
}
function polar(cx: number, cy: number, radius: number, degrees: number): [number, number] {
  const radians = degrees * Math.PI / 180;
  return [cx + Math.cos(radians) * radius, cy + Math.sin(radians) * radius];
}
function fraction(active: number, total: number): number {
  return total > 0 ? active / total : 0;
}
/** Gauge runs −90°..+90° across a 30-day cap. Zero stays at the M2 unlit rest, never at 0°. */
function needleDegrees(current: number): number {
  return -90 + Math.min(current, NEEDLE_CAP) / NEEDLE_CAP * 180;
}

interface FreshnessEvidence { readonly time: number; readonly source: string; readonly mode: string }
function freshness(value: unknown): FreshnessEvidence | null {
  if (!value || typeof value !== 'object') return null;
  const fields = value as Record<string, unknown>;
  const time = utcStamp(fields.generatedAt);
  const sources: readonly unknown[] = ['github-rest', 'github-graphql', 'github-profile-html', 'synthetic-demo'];
  const modes: readonly unknown[] = ['live', 'demo', 'partial', 'stale', 'unavailable'];
  if (time === null || !sources.includes(fields.source) || !modes.includes(fields.mode)) return null;
  if (fields.mode === 'demo' && fields.source !== 'synthetic-demo') return null;
  return { time, source: fields.source as string, mode: fields.mode as string };
}
function disclosure(snapshot: PortfolioSnapshot) {
  const root = freshness(snapshot?.freshness);
  const days = freshness(snapshot?.contributions?.freshness);
  if (!root || !days || root.mode === 'unavailable' || days.mode === 'unavailable' || days.mode === 'partial' ||
    (root.source === 'synthetic-demo') !== (days.source === 'synthetic-demo')) return null;
  const stale = root.mode === 'stale' || days.mode === 'stale';
  return {
    stale, synthetic: days.source === 'synthetic-demo', observed: !stale,
    source: days.source, observedAt: new Date(days.time).toISOString(),
  };
}

function buildChronograph(snapshot: PortfolioSnapshot): ChronographModel | SceneUnavailable {
  const evidence = disclosure(snapshot);
  if (!evidence) return unavailable();
  const metrics = snapshot?.metrics;
  const from = utcDay(metrics?.window?.from);
  const to = utcDay(metrics?.window?.to);
  const span = metrics?.window?.days;
  if (from === null || to === null || typeof span !== 'number' || !Number.isInteger(span) || span < 1 || span > MAX_WINDOW_DAYS) return unavailable();
  if ((to - from) / DAY + 1 !== span || to > Math.floor(Date.parse(evidence.observedAt) / DAY) * DAY) return unavailable();
  const streak = metrics?.streak;
  const current = streak?.current;
  const longest = streak?.longest;
  const boundary = streak?.boundary?.current;
  if (typeof current !== 'number' || typeof longest !== 'number' || !Number.isInteger(current) || !Number.isInteger(longest)) return unavailable();
  if (current < 0 || longest < 0 || current > longest || longest > 100_000) return unavailable();
  if (boundary !== 'closed' && boundary !== 'open') return unavailable();
  const supplied = snapshot?.contributions?.days;
  if (!Array.isArray(supplied) || supplied.length !== span) return unavailable();
  const seen = new Set<string>();
  const days: { readonly time: number; readonly date: string; readonly count: number }[] = [];
  for (const entry of supplied) {
    if (!entry || typeof entry !== 'object') return unavailable();
    const date = entry.date;
    const count = entry.count;
    const time = utcDay(date);
    if (time === null || time < from || time > to || seen.has(date)) return unavailable();
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 100_000) return unavailable();
    seen.add(date);
    days.push({ time, date, count });
  }
  if (days.length !== span) return unavailable();
  for (let time = from; time <= to; time += DAY) {
    if (!seen.has(new Date(time).toISOString().slice(0, 10))) return unavailable();
  }
  const earliest = Math.min(...days.map(day => day.time));
  const anchor = earliest - new Date(earliest).getUTCDay() * DAY;
  const weeks = new Map<number, number>();
  const months = new Map<string, number>();
  let maxWeek = 0;
  let activeDays = 0;
  for (const day of days) {
    const index = Math.floor((day.time - anchor) / DAY / 7);
    if (index < 0 || index > MAX_WEEK_INDEX) return unavailable();
    weeks.set(index, (weeks.get(index) ?? 0) + day.count);
    if (index > maxWeek) maxWeek = index;
    const month = day.date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + day.count);
    if (day.count > 0) activeDays += 1;
  }
  const releases = readReleases(snapshot, from, to);
  if (releases === null) return unavailable();
  return {
    current, longest, activeWeeks: [...weeks.values()].filter(sum => sum > 0).length, totalWeeks: maxWeek + 1,
    activeDays, observedDays: days.length, activeMonths: [...months.values()].filter(sum => sum > 0).length,
    observedMonths: months.size, needle: needleDegrees(current), open: boundary === 'open', ticks: FACE_TICKS,
    releases: releases.marks, releasesBlocked: releases.blocked, ...evidence,
    windowFrom: metrics.window.from, windowTo: metrics.window.to,
  };
}

function readReleases(snapshot: PortfolioSnapshot, from: number, to: number): { readonly marks: ReleaseMark[]; readonly blocked: boolean } | null {
  const projects = snapshot?.projects;
  if (projects === null || projects === undefined) return { marks: [], blocked: false };
  const board = freshness(projects.freshness);
  const root = freshness(snapshot.freshness);
  if (!board || !root || board.mode === 'unavailable' || board.mode === 'stale' ||
    (board.source === 'synthetic-demo') !== (root.source === 'synthetic-demo')) return { marks: [], blocked: true };
  const list = projects.projects;
  if (!Array.isArray(list) || list.length > 6) return { marks: [], blocked: true };
  const windowMs = to + DAY - from;
  const marks: ReleaseMark[] = [];
  let blocked = false;
  for (const project of list) {
    const state = project?.releaseState;
    if (state === 'none' && project.release === null) continue;
    if (state !== 'published') { blocked = true; continue; }
    const published = utcStamp(project.release?.publishedAt);
    const rawTag = project.release?.tag;
    if (published === null || published > board.time || typeof rawTag !== 'string' ||
      rawTag.length > 160 || !xmlChars(rawTag).trim()) { blocked = true; continue; }
    if (published < from || published >= to + DAY) continue;
    marks.push({ tag: truncateText(xmlChars(rawTag), 40), angle: (published - from) / windowMs * 360 - 90 });
  }
  return { marks, blocked };
}

function accessibility(model: ChronographModel): { title: string; description: string } {
  const streak = model.current === 0 ? 'NO CURRENT STREAK' : `CURRENT STREAK ${model.current}`;
  const tags = model.releases.map(mark => mark.tag).join(', ');
  const blocked = model.releasesBlocked ? ' RELEASE SIGNAL BLOCKED.' : '';
  const open = model.open ? ' Open boundary.' : '';
  return {
    title: 'Chronograph',
    description: `${model.synthetic ? 'Synthetic preview. ' : ''}${model.stale ? 'STALE SNAPSHOT. ' : ''}Source ${model.source}, observed ${model.observedAt}. Window ${model.windowFrom} to ${model.windowTo}. ${streak}. LONGEST STREAK ${model.longest}. ACTIVE WEEKS ${model.activeWeeks}.${tags ? ` ${tags}.` : ''} Illuminated arcs show observed active-day, active-week, and active-month coverage. Release ticks mark published releases, latest per configured project rather than full history. The streak needle rests at -90 degrees when there is no current streak. Ring rotation is decorative.${open}${blocked}`,
  };
}

function arc(cx: number, cy: number, radius: number, coverage: number, ink: string): string {
  if (!(coverage > 0)) return '';
  if (coverage >= 1) return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(radius)}" fill="none" stroke="${ink}" stroke-width="3"/>`;
  const sweep = coverage * 360;
  const start = -Math.PI / 2;
  const end = start + sweep * Math.PI / 180;
  const x1 = cx + Math.cos(start) * radius;
  const y1 = cy + Math.sin(start) * radius;
  const x2 = cx + Math.cos(end) * radius;
  const y2 = cy + Math.sin(end) * radius;
  return `<path d="M${num(x1)} ${num(y1)} A ${num(radius)} ${num(radius)} 0 ${sweep > 180 ? 1 : 0} 1 ${num(x2)} ${num(y2)}" fill="none" stroke="${ink}" stroke-width="3"/>`;
}

function renderChronograph(model: ChronographModel, context: RenderContext, text: { title: string; description: string }): string {
  const theme = themes[context.theme];
  const width = context.layout === 'compact' ? 480 : 720;
  const height = 480;
  const plotWidth = width - 48;
  const plotHeight = 250;
  const cx = plotWidth / 2;
  const cy = (plotHeight - 28) / 2 + 4;
  const radius = Math.min(plotWidth / 2, (plotHeight - 28) / 2) - 16;
  const applications: MotionApplication[] = [];
  if (context.motion === 'ambient' && !model.stale) {
    RING_TARGETS.forEach((target, index) => {
      applications.push({ primitive: 'rotate', target, decorative: true, loopGroup: RING_GROUPS[index], params: { cx, cy, durationMs: RING_PERIODS[index] } });
    });
  }
  if (context.motion === 'subtle' && !model.stale) {
    model.ticks.forEach((_, index) => {
      applications.push({ primitive: 'stagger', target: `tick${index}`, decorative: true, params: { index, staggerMs: 14 } });
    });
  }
  const motion = compileSceneMotion(context, applications, { target: 'github-readme' });
  const binding = (target: string) => motion.bindings.find(item => item.target === target);
  const wrap = (target: string, body: string) => `<g id="${sceneElementId(context, target)}" class="${sceneClassName(context, target)}">${body}${binding(target)?.children ?? ''}</g>`;
  let output = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(text.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(text.title)}</title><desc>${escapeXml(text.description)}</desc>${motion.style}`;
  output += frame(context, { title: 'Chronograph', ref: 'CHRONO / 03', family: 'map', width, height, stale: model.stale });
  output += plateText(24, 88, `${model.synthetic ? 'SYNTHETIC PREVIEW' : 'PUBLIC GITHUB'} · ${model.source}`, theme.muted, 10);
  output += plateText(24, 104, `Observed ${model.observedAt.replace('.000Z', 'Z')}`, theme.muted, 10);
  output += plateText(24, 120, `Window ${model.windowFrom} to ${model.windowTo}`, theme.muted, 10);
  if (model.stale) output += plateText(width - 24, 104, 'STALE SNAPSHOT', theme.muted, 10, 'end');
  output += `<g transform="translate(24 134)">`;
  output += orbit(context, { width: plotWidth, height: plotHeight, rings: RING_FRACTIONS, bodies: [] });
  const coverages = [
    fraction(model.activeDays, model.observedDays),
    fraction(model.activeWeeks, model.totalWeeks),
    fraction(model.activeMonths, model.observedMonths),
  ];
  RING_FRACTIONS.forEach((ring, index) => {
    const ringRadius = ring * radius;
    output += arc(cx, cy, ringRadius, coverages[index] ?? 0, theme.chrome);
    output += wrap(RING_TARGETS[index] ?? 'ringDay', `<circle cx="${num(cx + ringRadius)}" cy="${num(cy)}" r="3" fill="${theme.chrome}"/>`);
  });
  model.ticks.forEach((angle, index) => {
    const [x1, y1] = polar(cx, cy, radius * 0.28, angle);
    const [x2, y2] = polar(cx, cy, radius * 0.38, angle);
    output += wrap(`tick${index}`, `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${theme.muted}" stroke-width="2"/>`);
  });
  for (const mark of model.releases) {
    const [x, y] = polar(cx, cy, RING_FRACTIONS[2] * radius, mark.angle);
    output += `<circle cx="${num(x)}" cy="${num(y)}" r="4" fill="none" stroke="${theme.chrome}"/>`;
    output += `<text x="${num(x + 8)}" y="${num(y - 6)}" fill="${theme.text}" font-family="${MONO}" font-size="9">${escapeXml(truncateText(mark.tag, Math.max(1, Math.floor((width - x - 56) / 9))))}</text>`;
  }
  const needleLength = radius * 0.36;
  output += `<g id="${sceneElementId(context, 'needle')}" transform="rotate(${num(model.needle)} ${num(cx)} ${num(cy)})"><line x1="${num(cx)}" y1="${num(cy)}" x2="${num(cx + needleLength)}" y2="${num(cy)}" stroke="${model.current === 0 ? theme.muted : theme.text}" stroke-width="2"/></g>`;
  output += `</g>`;
  const streak = model.current === 0 ? 'NO CURRENT STREAK' : `CURRENT STREAK ${model.current}`;
  output += `<text x="24" y="${height - 84}" fill="${theme.text}" font-family="${MONO}" font-size="12">${escapeXml(streak)}</text>`;
  output += `<text x="24" y="${height - 68}" fill="${theme.text}" font-family="${MONO}" font-size="12">${escapeXml(`LONGEST STREAK ${model.longest}`)}</text>`;
  output += `<text x="24" y="${height - 52}" fill="${theme.text}" font-family="${MONO}" font-size="12">${escapeXml(`ACTIVE WEEKS ${model.activeWeeks}`)}</text>`;
  if (model.releasesBlocked) {
    const label = 'RELEASE SIGNAL BLOCKED';
    const badgeWidth = Math.min(320, Math.max(64, [...label].length * 11 + 24));
    const badgeX = width - 24 - badgeWidth;
    const badgeY = height - 110;
    output += badge(context, { label, x: badgeX, y: badgeY });
  }
  if (model.observed) output += evidenceLabel(context, 'observed', { x: width - 160, y: height - 80 });
  return `${output}</svg>`;
}

export const chronographScene: SceneDefinition<ChronographModel> = {
  id: 'chronograph', family: 'map', budget: 'map',
  supportedPacks: ['survey'], supportedMotion: ['none', 'subtle', 'ambient'],
  buildModel: ({ snapshot }: SceneInputs) => buildChronograph(snapshot),
  accessibility,
  render: (model, context) => renderChronograph(model, context, accessibility(model)),
};
