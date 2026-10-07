import type { PortfolioSnapshot } from '@commit-atlas/github';
import { escapeXml, themes, truncateText } from '../index.js';
import { compileSceneMotion, sceneClassName, sceneElementId, sceneUnavailable } from '../scene.js';
import type { MotionApplication } from '../motion/types.js';
import type { RenderContext, SceneDefinition, SceneInputs, SceneUnavailable } from '../scene.js';
import { badge, frame } from '../primitives/index.js';
import { terrain } from '../primitives/geometric.js';

interface Peak { readonly index: number; readonly label: string }
interface TerrainModel {
  readonly weeks: readonly number[];
  readonly total: number;
  readonly peak: number;
  readonly quiet: number;
  readonly streak: number;
  readonly streakOpen: boolean;
  readonly peaks: readonly Peak[];
  readonly blocked: number;
  readonly zero: boolean;
  readonly from: string;
  readonly to: string;
  readonly generatedAt: string;
  readonly source: string;
  readonly synthetic: boolean;
  readonly releaseScope: string;
}
const DAY = 86_400_000;
const MAX_DAYS = 731;
const SOURCES = ['github-rest', 'github-graphql', 'github-profile-html', 'synthetic-demo'];
const CALENDAR_SOURCES = ['github-graphql', 'github-profile-html', 'synthetic-demo'];
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
const SURVEY = 'survey';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}
/** Parse an actual UTC instant, rejecting Date.parse normalization of impossible dates or 24:00. */
function instant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u.exec(value);
  if (!match || utcDay(match[1]) === null || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
function freshnessProblem(value: unknown, allowPartial = false): string | null {
  if (!record(value) || typeof value.source !== 'string' || !SOURCES.includes(value.source) || instant(value.generatedAt) === null) {
    return 'Source or observation timestamp is unavailable.';
  }
  if (value.mode === 'stale') return `STALE snapshot captured ${String(value.generatedAt)}; current activity is UNAVAILABLE.`;
  if (value.mode !== 'live' && value.mode !== 'demo' && !(allowPartial && value.mode === 'partial')) {
    return 'Current observations are unavailable.';
  }
  if (value.mode !== 'partial' && (value.mode === 'demo') !== (value.source === 'synthetic-demo')) {
    return 'Source and observation mode disagree.';
  }
  return null;
}
function buildTerrain(snapshot: PortfolioSnapshot): TerrainModel | SceneUnavailable {
  const overallProblem = freshnessProblem(snapshot?.freshness, true);
  const calendarProblem = freshnessProblem(snapshot?.contributions?.freshness);
  if (overallProblem || calendarProblem) return sceneUnavailable(overallProblem ?? calendarProblem!);
  const contributions = snapshot.contributions;
  if (!CALENDAR_SOURCES.includes(contributions.freshness.source)) return sceneUnavailable('Contribution source is unavailable.');
  const window = snapshot.metrics?.window;
  const from = utcDay(window?.from), to = utcDay(window?.to);
  const days = contributions.days;
  const streak = snapshot.metrics?.streak?.current;
  if (from === null || to === null || to < from || !Number.isInteger(window.days) || window.days < 1 || window.days > MAX_DAYS ||
    (to - from) / DAY + 1 !== window.days || window.observedDays !== window.days || window.complete !== true ||
    !Array.isArray(days) || days.length !== window.days ||
    typeof streak !== 'number' || !Number.isSafeInteger(streak) || streak < 0 || streak > window.days) {
    return sceneUnavailable('Complete contribution calendar or streak is unavailable.');
  }
  const seen = new Set<number>();
  const parsed: { readonly timestamp: number; readonly count: number }[] = [];
  for (const day of days) {
    const timestamp = utcDay(day?.date);
    if (timestamp === null || timestamp < from || timestamp > to || seen.has(timestamp) ||
      typeof day?.count !== 'number' || !Number.isSafeInteger(day.count) || day.count < 0 || day.count > 100_000) {
      return sceneUnavailable('Complete contribution calendar is unavailable.');
    }
    seen.add(timestamp);
    parsed.push({ timestamp, count: day.count });
  }
  // Exact cardinality, unique dates and inclusive bounds prove coverage without inventing zero days.
  parsed.sort((left, right) => left.timestamp - right.timestamp);
  const gridStart = from - new Date(from).getUTCDay() * DAY;
  const weeks = Array.from({ length: Math.floor((to - gridStart) / DAY / 7) + 1 }, () => 0);
  for (const day of parsed) {
    const column = Math.floor((day.timestamp - gridStart) / DAY / 7);
    weeks[column] = weeks[column]! + day.count;
  }
  const board = snapshot.projects;
  const projects = board?.projects;
  const peaks: Peak[] = [];
  let blocked = 0;
  let releaseScope = 'RELEASES NOT REQUESTED';
  if (board !== null && board !== undefined) {
    if (!Array.isArray(projects) || projects.length > 6) {
      blocked = 1;
      releaseScope = 'RELEASE BOARD UNAVAILABLE';
    } else if (projects.length > 0) {
      releaseScope = `LATEST RELEASE PER PROJECT / ${projects.length} CONFIGURED`;
      const boardProblem = freshnessProblem(board.freshness, true);
      if (boardProblem || !['github-rest', 'synthetic-demo'].includes(board.freshness.source)) {
        blocked = projects.length;
      } else for (const project of projects) {
        if (project?.releaseState === 'none' && project.release === null) continue;
        if (project?.releaseState !== 'published' || !record(project.release) ||
          typeof project.release.tag !== 'string' || project.release.tag.length < 1 || project.release.tag.length > 200) {
          blocked += 1;
          continue;
        }
        const published = instant(project.release.publishedAt);
        if (published === null || published > instant(board.freshness.generatedAt)!) {
          blocked += 1;
          continue;
        }
        // The inclusive final date ends at the next UTC midnight, which is excluded.
        if (published < from || published >= to + DAY) continue;
        const index = Math.floor((published - gridStart) / DAY / 7);
        const label = truncateText(xmlChars(project.release.tag).replace(/\s+/gu, ' ').trim(), 40) || 'release';
        peaks.push({ index, label });
      }
    }
  }
  const total = weeks.reduce((sum, week) => sum + week, 0);
  let quiet = 0, run = 0;
  for (const week of weeks) { run = week === 0 ? run + 1 : 0; quiet = Math.max(quiet, run); }
  return {
    weeks, total, peak: Math.max(...weeks), quiet, streak,
    streakOpen: snapshot.metrics.streak.boundary?.current === 'open', peaks, blocked, zero: total === 0,
    from: window.from, to: window.to, generatedAt: contributions.freshness.generatedAt,
    source: contributions.freshness.source, releaseScope,
    synthetic: [snapshot.freshness, contributions.freshness, board?.freshness].some(value => value?.source === 'synthetic-demo'),
  };
}
function accessibility(model: TerrainModel): { title: string; description: string } {
  return {
    title: 'Activity terrain',
    description: `${model.synthetic ? 'SYNTHETIC PREVIEW. ' : 'PUBLIC SNAPSHOT. '}TOTAL ${model.total}. PEAK WEEK ${model.peak}. QUIET RUN ${model.quiet} WEEKS. CURRENT STREAK ${model.streak}${model.streakOpen ? '+ (open boundary)' : ''} DAYS. ` +
      `UTC window ${model.from} to ${model.to}. Source ${model.source}; captured ${model.generatedAt}. ` +
      `${model.zero ? 'NO OBSERVED ACTIVITY IN WINDOW. ' : ''}${model.releaseScope}. RELEASE SIGNAL BLOCKED ${model.blocked}. ` +
      `${model.peaks.map(peak => `Release ${peak.label}, week column ${peak.index + 1}.`).join(' ')} ` +
      'Weekly elevation follows Sunday-column sums. Boundary weeks may be partial. Release peaks are independent published-release markers, retained on a flat basin. Only the latest release per configured project is observed; this is not complete release history. The survey line is decorative.',
  };
}
function text(x: number, y: number, value: string, ink: string, size = 12): string {
  return `<text x="${x}" y="${y}" fill="${ink}" font-family="${MONO}" font-size="${size}">${escapeXml(value)}</text>`;
}
function renderTerrain(model: TerrainModel, context: RenderContext, a: { title: string; description: string }): string {
  const theme = themes[context.theme];
  const width = context.layout === 'compact' ? 480 : 720;
  const releaseRows = Math.max(1, model.peaks.length);
  const height = 626 + releaseRows * 20;
  const plotY = 176, plotHeight = 190, plotWidth = width - 48;
  const applications: MotionApplication[] = context.motion === 'ambient' ? [{
    primitive: 'scan', target: SURVEY, decorative: true, loopGroup: 'terrain-survey', params: { x: plotWidth - 16, y: 0, steps: 24 },
  }] : [];
  const motion = compileSceneMotion(context, applications, { target: 'github-readme' });
  const binding = motion.bindings.find(item => item.target === SURVEY);
  let output = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(a.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(a.title)}</title><desc>${escapeXml(a.description)}</desc>${motion.style}`;
  output += frame(context, { title: 'Activity terrain', ref: 'TERRAIN / 01', family: 'map', width, height });
  output += badge(context, { label: model.synthetic ? 'SYNTHETIC PREVIEW' : 'PUBLIC SNAPSHOT', x: 24, y: 88 });
  output += text(24, 140, `UTC ${model.from} TO ${model.to}`, theme.text);
  output += text(24, 158, `CAPTURED ${model.generatedAt}`, theme.muted, 11);
  output += `<g transform="translate(24 ${plotY})">${terrain(context, { width: plotWidth, height: plotHeight, series: model.weeks, label: 'Activity terrain' })}</g>`;
  // Release markers carry evidence, never motion or terrain elevation. Same-week releases keep separate rows.
  const slots = new Map<number, number>();
  model.peaks.forEach((peak, index) => {
    const x = 24 + (model.weeks.length === 1 ? plotWidth / 2 : 8 + peak.index / (model.weeks.length - 1) * (plotWidth - 16));
    const slot = slots.get(peak.index) ?? 0;
    slots.set(peak.index, slot + 1);
    const y = plotY + plotHeight - 42 - slot * 18;
    output += `<path d="M${x} ${y - 5}l5 5 -5 5 -5 -5Z" fill="${theme.background}" stroke="${theme.chrome}"><title>${escapeXml(peak.label)}</title></path>`;
    output += text(x > width - 56 ? x - 18 : x + 8, y + 4, String(index + 1), theme.text, 10);
  });
  const readings = [
    ['TOTAL', `${model.total} CONTRIBUTIONS`], ['PEAK WEEK', `${model.peak} CONTRIBUTIONS`],
    ['QUIET RUN', `${model.quiet} WEEKS`], ['CURRENT STREAK', `${model.streak}${model.streakOpen ? '+' : ''} DAYS`],
  ];
  readings.forEach(([label, value], index) => {
    const x = 24 + index % 2 * (width - 48) / 2;
    const y = 384 + Math.floor(index / 2) * 52;
    output += text(x, y, label!, theme.muted, 11) + text(x, y + 23, value!, theme.text, 14);
  });
  output += text(24, 493, 'SUNDAY COLUMNS / BOUNDARY WEEKS MAY BE PARTIAL', theme.muted, 10);
  output += text(24, 518, model.releaseScope, theme.muted, 10);
  if (!model.peaks.length) output += text(24, 540, 'NO VERIFIED RELEASE MARKERS IN WINDOW', theme.muted, 11);
  model.peaks.forEach((peak, index) => {
    // Conservative width bound also covers wide Unicode labels in the compact layout.
    const label = truncateText(peak.label, context.layout === 'compact' ? 22 : 38);
    output += text(24, 540 + index * 20, `${index + 1}. WEEK ${peak.index + 1}: ${label}`, theme.text, 11);
  });
  const footer = 540 + releaseRows * 20;
  output += text(24, footer + 14, `RELEASE SIGNAL BLOCKED ${model.blocked}`, model.blocked ? theme.text : theme.muted, 11);
  output += text(24, footer + 36, `SOURCE ${model.source.toUpperCase()} / OBSERVED CALENDAR`, theme.muted, 10);
  output += text(24, footer + 56, model.streakOpen ? 'STREAK + MEANS AT LEAST / OPEN WINDOW BOUNDARY' : 'ACTIVITY COUNTS ARE NOT A QUALITY OR IMPACT SCORE', theme.muted, 10);
  output += `<g id="${sceneElementId(context, SURVEY)}" class="${sceneClassName(context, SURVEY)}" aria-hidden="true"><path d="M32 ${plotY}V${plotY + plotHeight - 40}" fill="none" stroke="${theme.chrome}"/>${binding?.children ?? ''}</g></svg>`;
  return output;
}

/** Preserve the engine-owned unavailable reason without overflowing a compact embed. */
function renderUnavailable(state: SceneUnavailable, context: RenderContext, labels: Readonly<{ title: string; description: string }>): string {
  const theme = themes[context.theme];
  const width = context.layout === 'compact' ? 480 : 720;
  const limit = context.layout === 'compact' ? 44 : 72;
  const lines: string[] = [];
  let line = '';
  for (const word of state.reason.split(/\s+/u)) {
    const chunks = [...word];
    while (chunks.length > limit) {
      if (line) { lines.push(line); line = ''; }
      lines.push(chunks.splice(0, limit).join(''));
    }
    const rest = chunks.join('');
    if (line && line.length + rest.length + 1 > limit) { lines.push(line); line = ''; }
    if (rest) line += `${line ? ' ' : ''}${rest}`;
  }
  if (line) lines.push(line);
  const height = Math.max(240, 190 + lines.length * 22);
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(labels.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(labels.title)}</title><desc>${escapeXml(labels.description)}</desc>` +
    frame(context, { title: 'Activity terrain', ref: 'TERRAIN / 01', family: 'map', width, height }) +
    text(24, 112, 'UNAVAILABLE', theme.text, 18) +
    lines.map((value, index) => text(24, 144 + index * 22, value, theme.muted, 12)).join('') +
    text(24, height - 24, 'NO CURRENT ACTIVITY READING', theme.muted, 11) + '</svg>';
}

/** Complete public calendar, separate latest-release evidence, and explicit observation provenance. */
export const activityTerrainScene: SceneDefinition<TerrainModel> = {
  id: 'activity-terrain', family: 'map', budget: 'map',
  supportedPacks: ['survey'], supportedMotion: ['none', 'subtle', 'ambient'],
  buildModel: ({ snapshot }: SceneInputs) => buildTerrain(snapshot),
  accessibility,
  renderUnavailable,
  render: (model, context) => renderTerrain(model, context, accessibility(model)),
};
