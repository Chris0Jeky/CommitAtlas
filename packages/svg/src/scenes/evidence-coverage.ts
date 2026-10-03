import { isRecord, safeHttpsUrl } from '@commit-atlas/github';
import type { ContributionSnapshot, DataMode, PortfolioSnapshot, ProjectSnapshot } from '@commit-atlas/github';
import { escapeXml, themes } from '../index.js';
import { compileSceneMotion, sceneClassName, sceneElementId, sceneUnavailable } from '../scene.js';
import type { RenderContext, SceneDefinition, SceneUnavailable } from '../scene.js';
import { badge, coverageBar, evidenceLabel, frame } from '../primitives/index.js';
import type { CoverageState } from '../primitives/index.js';
import type { MotionApplication } from '../motion/types.js';

interface CoverageRow {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly coverage: CoverageState;
}
interface CoverageModel { readonly synthetic: boolean; readonly rows: readonly CoverageRow[] }
const MODES: readonly string[] = ['live', 'demo', 'partial', 'stale', 'unavailable'];
const SOURCES = ['github-rest', 'github-graphql', 'github-profile-html', 'synthetic-demo'];
const CI_STATES = ['passing', 'failing', 'pending', 'stale', 'unconfigured', 'unavailable'] as const;
const RELEASE_STATES = ['published', 'none', 'unavailable'] as const;
const NO_SIGNAL = { state: 'unavailable' } as const;
const NOT_OBSERVED = { state: 'not-observed' } as const;
const UNAVAILABLE_REASON = 'Calendar, activity mix, CI and releases unavailable. Line changes not observed. Private activity not requested. Snapshot unavailable. Bars are neutral; no scan runs.';
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

function mode(value: unknown): DataMode {
  return typeof value === 'string' && MODES.includes(value) ? value as DataMode : 'unavailable';
}
function count(value: unknown, maximum = 1_000_000): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}
function current(value: DataMode): boolean { return value === 'live' || value === 'demo'; }
function knownSource(value: unknown): boolean { return typeof value === 'string' && SOURCES.includes(value); }
function boundedText(value: unknown, maximum: number, nonempty = true): value is string {
  return typeof value === 'string' && (!nonempty || value.trim() !== '') && [...value].length <= maximum;
}
function publishedRelease(value: unknown): boolean {
  if (!isRecord(value) || !boundedText(value.tag, 200) || !boundedText(value.name, 200, false) ||
    !safeHttpsUrl(value.url) || !boundedText(value.publishedAt, 35)) return false;
  // GitHub release timestamps use UTC. Refuse rolled-over dates/times as well as missing fields.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value.publishedAt)) return false;
  const timestamp = Date.parse(value.publishedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 19) !== value.publishedAt.slice(0, 19)) return false;
  return value.download === null || isRecord(value.download) &&
    boundedText(value.download.name, 255, false) && safeHttpsUrl(value.download.url) !== null;
}
function observedZeroActivity(value: ContributionSnapshot): boolean {
  if (value.totalContributions !== 0 || !Array.isArray(value.days) || value.days.length < 1 || value.days.length > 366) return false;
  for (let i = 0; i < value.days.length; i++) {
    if (!isRecord(value.days[i]) || value.days[i]!.count !== 0) return false;
  }
  return true;
}
function fraction(observed: number, total: number): CoverageState {
  if (total === 0) return NOT_OBSERVED;
  if (observed === 0) return NO_SIGNAL;
  return { state: observed === total ? 'complete' : 'partial', observed, total };
}
function unavailableRows(): CoverageRow[] {
  return [
    { id: 'calendar', label: 'CONTRIBUTION CALENDAR', detail: 'UNAVAILABLE', coverage: NO_SIGNAL },
    { id: 'mix', label: 'ACTIVITY MIX', detail: 'UNAVAILABLE', coverage: NO_SIGNAL },
    { id: 'ci', label: 'CI', detail: 'UNAVAILABLE', coverage: NO_SIGNAL },
    { id: 'releases', label: 'RELEASES', detail: 'UNAVAILABLE', coverage: NO_SIGNAL },
    { id: 'line-changes', label: 'LINE CHANGES', detail: 'NOT OBSERVED', coverage: NOT_OBSERVED },
    { id: 'private-activity', label: 'PRIVATE ACTIVITY', detail: 'NOT REQUESTED', coverage: NOT_OBSERVED },
    { id: 'snapshot', label: 'SNAPSHOT', detail: 'UNAVAILABLE', coverage: NO_SIGNAL },
  ];
}
function summary<T extends string>(states: readonly T[], vocabulary: readonly T[]): string {
  return vocabulary.map(state => ({ state, n: states.filter(item => item === state).length }))
    .filter(item => item.n > 0).map(item => `${item.n} ${item.state.toUpperCase()}`).join(' · ');
}

function buildCoverage(snapshot: PortfolioSnapshot): CoverageModel | SceneUnavailable {
  const overall = mode(snapshot.freshness?.mode);
  if (overall === 'unavailable' || !knownSource(snapshot.freshness?.source)) return sceneUnavailable(UNAVAILABLE_REASON);
  const rows = unavailableRows();
  const contributions = snapshot.contributions;
  const contributionMode = overall === 'stale' ? 'stale' : mode(contributions?.freshness?.mode);
  const source = contributions?.freshness?.source;
  const sourceKnown = knownSource(source);
  const window = snapshot.metrics?.window;
  const windowValid = window && count(window.days, 366) && window.days > 0 && count(window.observedDays, window.days) &&
    typeof window.complete === 'boolean' && window.complete === (window.observedDays === window.days);
  const calendarCurrent = current(contributionMode) || contributionMode === 'partial' && windowValid && !window.complete;
  rows[0] = { id: 'calendar', label: source === 'github-profile-html' ? 'PUBLIC PROFILE VIEW' : 'CONTRIBUTION CALENDAR',
    detail: sourceKnown && windowValid && calendarCurrent
      ? `${window.observedDays} OF ${window.days} DAYS OBSERVED` : `${contributionMode.toUpperCase()} · CURRENT WINDOW UNVERIFIED`,
    coverage: sourceKnown && windowValid && calendarCurrent ? fraction(window.observedDays, window.days) : NO_SIGNAL };
  const mix = contributions && [contributions.commits, contributions.issues, contributions.pullRequests, contributions.reviews];
  const basis = contributions?.breakdownBasis;
  const mixValid = mix && mix.every(value => basis === 'public-profile-percentages'
    ? typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    : count(value, Number.MAX_SAFE_INTEGER));
  const mixTotal = mix?.reduce((sum, value) => sum + value, 0);
  // Match the public parser/core rounding tolerance and its explicit zero-activity form.
  const mixConsistent = basis !== 'public-profile-percentages' || mixTotal === 0 && observedZeroActivity(contributions) ||
    typeof mixTotal === 'number' && mixTotal >= 99 && mixTotal <= 101;
  if (sourceKnown && current(contributionMode) && mixValid && mixConsistent && (basis === 'exact-counts' || basis === 'public-profile-percentages')) {
    rows[1] = { id: 'mix', label: 'ACTIVITY MIX',
      detail: basis === 'public-profile-percentages' ? 'ANNUAL PERCENTAGES · NOT WINDOW-SCOPED' : 'EXACT COUNTS · WINDOW-SCOPED',
      coverage: { state: 'complete', observed: 4, total: 4 } };
  } else rows[1] = { ...rows[1]!, detail: `${contributionMode.toUpperCase()} · ACTIVITY MIX UNVERIFIED` };

  const board = snapshot.projects;
  const boardMode = overall === 'stale' ? 'stale' : mode(board?.freshness?.mode);
  const boardSourceKnown = knownSource(board?.freshness?.source);
  if (board === null || Array.isArray(board?.projects) && board.projects.length === 0) {
    rows[2] = { id: 'ci', label: 'CI', detail: 'NOT CONFIGURED', coverage: NOT_OBSERVED };
    rows[3] = { id: 'releases', label: 'RELEASES', detail: 'NOT REQUESTED', coverage: NOT_OBSERVED };
  } else if (boardSourceKnown && board && Array.isArray(board.projects) && board.projects.length <= 6 &&
    (current(boardMode) || boardMode === 'partial')) {
    const ci = board.projects.map(project => {
      const state = project?.ci?.state;
      return CI_STATES.includes(state) ? state : 'unavailable';
    });
    const releases = board.projects.map((project: ProjectSnapshot) => {
      if (project?.releaseState === 'none' && project.release === null) return 'none';
      if (project?.releaseState === 'published' && publishedRelease(project.release)) return 'published';
      return 'unavailable';
    });
    rows[2] = { id: 'ci', label: 'CI', detail: summary(ci, CI_STATES),
      coverage: fraction(ci.filter(state => state === 'passing' || state === 'failing' || state === 'pending').length, ci.length) };
    rows[3] = { id: 'releases', label: 'RELEASES', detail: summary(releases, RELEASE_STATES),
      coverage: fraction(releases.filter(state => state !== 'unavailable').length, releases.length) };
  } else {
    rows[2] = { ...rows[2]!, detail: `${boardMode.toUpperCase()} · CURRENT CI UNVERIFIED` };
    rows[3] = { ...rows[3]!, detail: `${boardMode.toUpperCase()} · CURRENT RELEASES UNVERIFIED` };
  }
  rows[6] = { id: 'snapshot', label: 'SNAPSHOT', detail: overall.toUpperCase(), coverage: NOT_OBSERVED };
  const synthetic = [snapshot.freshness, contributions?.freshness, board?.freshness]
    .some(value => value?.mode === 'demo' || value?.source === 'synthetic-demo');
  return { rows, synthetic };
}
function accessibility(model: CoverageModel): { title: string; description: string } {
  const readings = model.rows.map(row => `${row.label}: ${row.detail}${'observed' in row.coverage ? `; ${row.coverage.observed}/${row.coverage.total} observed` : ''}.`).join(' ');
  return { title: 'Evidence coverage', description: `${model.synthetic ? 'Synthetic preview. ' : ''}${readings} Bar length records coverage, not performance: observed calendar days, four supplied activity-mix fields, or current project observations. Neutral ink marks unobserved or stale sources. Row order follows calendar, mix, CI, releases and collection scope. Dashed tracks mark partial or not-observed coverage. The scan is decorative, illuminates only observed rows, and carries no reading.` };
}
function text(x: number, y: number, content: string, ink: string, size: number): string {
  return `<text x="${x}" y="${y}" fill="${ink}" font-family="${MONO}" font-size="${size}">${escapeXml(content)}</text>`;
}
function lines(value: string, width: number): string[] {
  const maximum = Math.floor(width / 12), result: string[] = [];
  let line = '';
  for (const word of value.split(' ')) {
    if (line && line.length + word.length + 1 > maximum) { result.push(line); line = ''; }
    line += `${line ? ' ' : ''}${word}`;
  }
  if (line) result.push(line);
  return result;
}
function renderRows(model: CoverageModel, context: RenderContext, a: { title: string; description: string }, unavailable = false): string {
  const theme = themes[context.theme], width = context.layout === 'compact' ? 480 : 720;
  const barWidth = Math.min(640, width - 48);
  let y = 126;
  const placed = model.rows.map(row => {
    const detail = lines(row.detail, width - 48), barY = 34 + (detail.length - 1) * 14;
    const result = { row, detail, barY, y };
    y += barY + 50;
    return result;
  });
  const height = y + 42;
  const applications: MotionApplication[] = !unavailable && context.motion === 'ambient' ? placed
    .filter(({ row }) => 'observed' in row.coverage)
    .map(({ row }) => ({ primitive: 'scan', target: `scan-${row.id}`, decorative: true, loopGroup: 'coverage-scan', params: { x: barWidth - 4, y: 0, steps: 48 } })) : [];
  const motion = compileSceneMotion(context, applications, { target: 'github-readme' });
  let output = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(a.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(a.title)}</title><desc>${escapeXml(a.description)}</desc>${motion.style}`;
  output += frame(context, { title: unavailable ? 'Evidence unavailable' : 'Evidence coverage', ref: 'SCOPE / 07', family: 'instrument', width, height });
  output += badge(context, { label: unavailable ? 'UNAVAILABLE' : model.synthetic ? 'SYNTHETIC PREVIEW' : 'PUBLIC SNAPSHOT', x: 24, y: 84 });
  output += evidenceLabel(context, 'observed', { x: width - 160, y: 84 });
  for (const { row, detail, barY, y: top } of placed) {
    const known = 'observed' in row.coverage, ink = known ? theme.text : theme.muted;
    output += `<g id="${sceneElementId(context, `row-${row.id}`)}" transform="translate(24 ${top})"><title>${escapeXml(`${row.label}: ${row.detail}`)}</title>`;
    output += text(0, 14, row.label, ink, 13);
    detail.forEach((line, i) => { output += text(0, 30 + 14 * i, line, ink, 12); });
    output += row.id === 'snapshot'
      ? badge(context, { label: row.detail, y: barY })
      : coverageBar(context, row.coverage, { width: barWidth, y: barY });
    if (known && !unavailable) {
      const name = `scan-${row.id}`, binding = motion.bindings.find(item => item.target === name);
      output += `<g id="${sceneElementId(context, name)}" class="${sceneClassName(context, name)}" aria-hidden="true"><path d="M2 ${barY + 30}V${barY + 38}" fill="none" stroke="${theme.chrome}" stroke-width="2"/>${binding?.children ?? ''}</g>`;
    }
    output += '</g>';
  }
  output += text(24, height - 24, 'Coverage of this source, not all work.', theme.muted, 11);
  output += text(24, height - 8, 'Unavailable is not zero. Scope is not performance.', theme.muted, 10);
  return `${output}</svg>`;
}

/** Reads only source metadata, coverage counts, CI states and release states; never fetches data. */
export const evidenceCoverageScene: SceneDefinition<CoverageModel> = {
  id: 'evidence-coverage', family: 'instrument', budget: 'instrument',
  supportedPacks: ['survey'], supportedMotion: ['none', 'subtle', 'ambient'],
  buildModel: ({ snapshot }) => buildCoverage(snapshot),
  accessibility,
  render: (model, context) => renderRows(model, context, accessibility(model)),
  renderUnavailable: (_state, context, a) => renderRows({ synthetic: false, rows: unavailableRows() }, context, a, true),
};
