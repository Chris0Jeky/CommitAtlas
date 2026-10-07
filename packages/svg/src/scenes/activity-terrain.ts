import type { PortfolioSnapshot } from '@commit-atlas/github';
import { escapeXml, themes } from '../index.js';
import { compileSceneMotion, sceneClassName, sceneElementId, sceneUnavailable } from '../scene.js';
import type { MotionApplication } from '../motion/types.js';
import type { RenderContext, SceneDefinition, SceneInputs, SceneUnavailable } from '../scene.js';
import { badge, evidenceLabel, frame } from '../primitives/index.js';
import { terrain } from '../primitives/geometric.js';

interface Peak { readonly index: number; readonly label: string }
interface TerrainModel {
  readonly weeks: readonly number[];
  readonly total: number;
  readonly peak: number;
  readonly quiet: number;
  readonly streak: number;
  readonly peaks: readonly Peak[];
  readonly blocked: number;
  readonly zero: boolean;
}
const DAY = 86_400_000;
const SURVEY = 'survey';

function xmlChars(value: string): string {
  return [...value].filter(character => {
    const code = character.codePointAt(0) ?? 0;
    return code === 9 || code === 10 || code === 13 ||
      code >= 0x20 && code <= 0xd7ff || code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff;
  }).join('');
}
function utcDay(value: string): number | null {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}
function instant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/u.exec(value);
  return match ? utcDay(match[1]!) : null;
}
function unavailable(reason: string): SceneUnavailable {
  return sceneUnavailable(reason);
}
function buildTerrain(snapshot: PortfolioSnapshot): TerrainModel | SceneUnavailable {
  if (snapshot.freshness?.mode === 'unavailable' || snapshot.contributions?.freshness?.mode === 'unavailable') {
    return unavailable('Contribution calendar unavailable.');
  }
  const from = instant(snapshot.metrics?.window?.from);
  const to = instant(snapshot.metrics?.window?.to);
  const days = snapshot.contributions?.days;
  const streak = snapshot.metrics?.streak?.current;
  if (from === null || to === null || to < from || !Array.isArray(days) || days.length < 1 || days.length > 800 ||
    typeof streak !== 'number' || !Number.isInteger(streak) || streak < 0 || streak > 800) {
    return unavailable('Contribution calendar unavailable.');
  }
  const parsed: { readonly date: string; readonly count: number }[] = [];
  for (const day of days) {
    const timestamp = day && typeof day.date === 'string' ? utcDay(day.date) : null;
    if (timestamp === null || timestamp < from || timestamp > to || typeof day.count !== 'number' ||
      !Number.isInteger(day.count) || day.count < 0 || day.count > 100_000) {
      return unavailable('Contribution calendar unavailable.');
    }
    parsed.push({ date: day.date, count: day.count });
  }
  parsed.sort((left, right) => left.date < right.date ? -1 : left.date > right.date ? 1 : 0);
  const first = utcDay(parsed[0]!.date)!;
  const gridStart = first - new Date(first).getUTCDay() * DAY;
  const sums = new Map<number, number>();
  let last = 0;
  for (const day of parsed) {
    const column = Math.floor((utcDay(day.date)! - gridStart) / DAY / 7);
    if (column < 0 || column > 366) return unavailable('Contribution calendar unavailable.');
    sums.set(column, (sums.get(column) ?? 0) + day.count);
    if (column > last) last = column;
  }
  const weeks = Array.from({ length: last + 1 }, (_, index) => sums.get(index) ?? 0);
  const projects = snapshot.projects?.projects ?? [];
  if (!Array.isArray(projects) || projects.length > 6) return unavailable('Project board unavailable.');
  const peaks: Peak[] = [];
  let blocked = 0;
  for (const project of projects) {
    if (project?.releaseState === 'unavailable') { blocked += 1; continue; }
    if (project?.releaseState !== 'published' || !project.release) continue;
    const published = instant(project.release.publishedAt);
    if (published === null || published < from || published > to || peaks.length >= 12) continue;
    const index = Math.floor((published - gridStart) / DAY / 7);
    const label = xmlChars(project.release.tag).trim().slice(0, 40) || 'release';
    if (index >= 0 && index < weeks.length && !peaks.some(peak => peak.index === index)) peaks.push({ index, label });
  }
  const total = weeks.reduce((sum, week) => sum + week, 0);
  let quiet = 0, run = 0;
  for (const week of weeks) { run = week === 0 ? run + 1 : 0; if (run > quiet) quiet = run; }
  return { weeks, total, peak: Math.max(...weeks), quiet, streak, peaks, blocked, zero: weeks.every(week => week === 0) };
}
function accessibility(model: TerrainModel): { title: string; description: string } {
  const blocked = model.blocked > 0 ? ` RELEASE SIGNAL BLOCKED ${model.blocked}.` : '';
  const basin = model.zero ? ' NO OBSERVED ACTIVITY IN WINDOW.' : '';
  return {
    title: 'Activity terrain',
    description: `TOTAL ${model.total}. PEAK WEEK ${model.peak}. QUIET RUN ${model.quiet}. CURRENT STREAK ${model.streak}.${basin}${blocked} Weekly elevation follows Sunday-column sums. Release peaks mark published releases inside the window. A flat basin means no observed activity. The survey line is decorative.`,
  };
}
function renderTerrain(model: TerrainModel, context: RenderContext, a: { title: string; description: string }): string {
  const theme = themes[context.theme];
  const width = context.layout === 'compact' ? 480 : 720;
  const height = 440;
  const applications: MotionApplication[] = context.motion === 'ambient' ? [{
    primitive: 'scan', target: SURVEY, decorative: true, loopGroup: 'terrain-survey', params: { x: width - 48, y: 0, steps: 24 },
  }] : [];
  const motion = compileSceneMotion(context, applications, { target: 'github-readme' });
  const binding = motion.bindings.find(item => item.target === SURVEY);
  let output = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(a.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(a.title)}</title><desc>${escapeXml(a.description)}</desc>${motion.style}`;
  output += frame(context, { title: 'Activity terrain', ref: 'TERRAIN / 01', family: 'map', width, height });
  output += `<g transform="translate(24 110)">${terrain(context, {
    width: width - 48, height: 220, series: model.weeks, label: 'Activity terrain', peaks: model.zero ? [] : model.peaks,
  })}</g>`;
  const ridge = 24 + Math.min(width - 72, Math.max(8, model.streak * 12));
  output += `<path d="M24 348H${ridge}" fill="none" stroke="${model.streak === 0 ? theme.muted : theme.chrome}"/>`;
  output += badge(context, { label: `CURRENT STREAK ${model.streak}`, x: 24, y: 360 });
  if (model.blocked > 0) output += badge(context, { label: `RELEASE SIGNAL BLOCKED ${model.blocked}`, x: 220, y: 360 });
  output += evidenceLabel(context, 'observed', { x: width - 160, y: 360 });
  output += `<g id="${sceneElementId(context, SURVEY)}" class="${sceneClassName(context, SURVEY)}" aria-hidden="true"><path d="M24 110V330" fill="none" stroke="${theme.chrome}"/>${binding?.children ?? ''}</g></svg>`;
  return output;
}

/** Weekly contribution elevation. Releases inside the window are peaks; unavailable release state stays visible. */
export const activityTerrainScene: SceneDefinition<TerrainModel> = {
  id: 'activity-terrain', family: 'map', budget: 'map',
  supportedPacks: ['survey'], supportedMotion: ['none', 'subtle', 'ambient'],
  buildModel: ({ snapshot }: SceneInputs) => buildTerrain(snapshot),
  accessibility,
  render: (model, context) => renderTerrain(model, context, accessibility(model)),
};
