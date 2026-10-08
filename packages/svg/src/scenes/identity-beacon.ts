import type { PortfolioSnapshot, ProjectSnapshot } from '@commit-atlas/github';
import { escapeXml, themes } from '../index.js';
import { isIdentityConfig, type IdentityConfig } from '../identity.js';
import { compileSceneMotion, sceneClassName, sceneElementId, sceneUnavailable } from '../scene.js';
import type { MotionApplication } from '../motion/types.js';
import type { RenderContext, SceneDefinition, SceneInputs, SceneUnavailable } from '../scene.js';
import { evidenceLabel, frame } from '../primitives/index.js';
import { projectNode } from '../primitives/geometric.js';

const SOURCES = ['github-rest', 'github-graphql', 'github-profile-html', 'synthetic-demo'] as const;
const SANS = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const NODE_WIDTH = 160;
const NODE_HEIGHT = 120;

interface Body { readonly name: string; readonly issues: number; readonly size: number }
interface BeaconModel {
  readonly name: string;
  readonly tagline: string;
  readonly bodies: readonly Body[];
  readonly unmatched: readonly string[];
  readonly generatedAt: string;
  readonly source: string;
  readonly disclosure: 'public' | 'synthetic';
}

function num(value: number): string {
  return String(Number(value.toFixed(3)));
}
function unavailable(reason: string): SceneUnavailable {
  return sceneUnavailable(reason);
}
function issuesOf(project: ProjectSnapshot): number | null {
  const value = project?.openIssuesAndPullRequests;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
}
function buildBeacon({ snapshot, identity }: SceneInputs): BeaconModel | SceneUnavailable {
  if (!identity || !isIdentityConfig(identity)) return unavailable('A beacon without an identity is not rendered.');
  return buildIdentified(snapshot, identity);
}
function buildIdentified(snapshot: PortfolioSnapshot, identity: IdentityConfig): BeaconModel | SceneUnavailable {
  if (snapshot?.freshness?.mode === 'unavailable') return unavailable('Snapshot freshness is unavailable.');
  const generatedAt = snapshot?.freshness?.generatedAt;
  const source = snapshot?.freshness?.source;
  if (typeof generatedAt !== 'string' || generatedAt.trim() === '' || generatedAt.length > 40) return unavailable('Snapshot date is unavailable.');
  if (typeof source !== 'string' || !SOURCES.includes(source as typeof SOURCES[number])) return unavailable('Snapshot source is unavailable.');
  const projects = readProjects(snapshot);
  if (projects === null) return unavailable('Configured projects are unavailable.');
  const used = new Set<number>();
  const matched: { readonly name: string; readonly issues: number }[] = [];
  const unmatched: string[] = [];
  for (const label of identity.focus) {
    const index = projects.findIndex((project, position) => !used.has(position) && project.name === label);
    const issues = index < 0 ? null : issuesOf(projects[index]!);
    if (index < 0 || issues === null) unmatched.push(label);
    else { used.add(index); matched.push({ name: label, issues }); }
  }
  const peak = Math.max(0, ...matched.map(body => body.issues));
  return {
    name: identity.name, tagline: identity.tagline ?? '', unmatched,
    bodies: matched.map(body => ({ ...body, size: peak === 0 ? 0 : body.issues / peak })),
    generatedAt, source, disclosure: source === 'synthetic-demo' ? 'synthetic' : 'public',
  };
}
function readProjects(snapshot: PortfolioSnapshot): readonly ProjectSnapshot[] | null {
  const board = snapshot?.projects;
  if (board === null || board === undefined) return [];
  if (board.freshness?.mode === 'unavailable') return [];
  if (!Array.isArray(board.projects) || board.projects.length > 6) return null;
  return board.projects;
}
function accessibility(model: BeaconModel): { title: string; description: string } {
  const bodies = model.bodies.map(body => body.name).join(', ') || 'none';
  const plain = model.unmatched.join(', ');
  const tagline = model.tagline ? `${model.tagline}. ` : '';
  return {
    title: model.name,
    description: `${model.name}. ${tagline}${plain}. ${bodies}. Coordinate grid. OPEN ISSUES AND PULL REQUESTS. Survey beam crosses the field. Project bodies breathe under ambient. ${model.generatedAt}. ${model.source}.`,
  };
}
function renderBeacon(model: BeaconModel, context: RenderContext, text: { title: string; description: string }): string {
  const theme = themes[context.theme];
  const width = context.layout === 'compact' ? 480 : 860;
  const height = 520;
  const nameSize = Math.min(36, Math.floor((width - 64) / Math.max([...model.name].length, 1)));
  const applications: MotionApplication[] = [];
  if (context.motion === 'ambient' || context.motion === 'cinematic') {
    const beam: MotionApplication = { primitive: 'sweep', target: 'beam', decorative: true, loopGroup: 'beacon-beam', params: { x: width - 48, y: 0 } };
    if (context.motion === 'cinematic' && beam.params) applications.push({ ...beam, params: { ...beam.params, durationMs: 12_000, delayMs: 2_000 } });
    else applications.push(beam);
  }
  if (context.motion === 'cinematic') {
    applications.push({ primitive: 'acquisitionFailure', target: 'field', decorative: true, params: { cx: width / 2, cy: 180 } });
    model.bodies.forEach((_, index) => {
      applications.push({ primitive: 'enter', target: `body${index}`, decorative: true, params: { y: 8, delayMs: 1_200 + index * 120 } });
    });
  }
  if (context.motion === 'ambient') {
    model.bodies.forEach((_, index) => {
      applications.push({ primitive: 'breathe', target: `body${index}`, decorative: true, loopGroup: 'beacon-breathe', params: { cx: NODE_WIDTH / 2, cy: 38, scale: 1.04 } });
    });
  }
  const motion = compileSceneMotion(context, applications, { target: 'github-readme' });
  const binding = (target: string) => motion.bindings.find(item => item.target === target);
  const wrap = (target: string, body: string) => `<g id="${sceneElementId(context, target)}" class="${sceneClassName(context, target)}">${body}${binding(target)?.children ?? ''}</g>`;
  let output = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(text.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(text.title)}</title><desc>${escapeXml(text.description)}</desc>${motion.style}`;
  output += frame(context, { title: model.name, ref: 'BEACON / 04', family: 'scene', width, height });
  output += `<text x="24" y="108" fill="${theme.text}" font-family="${SANS}" font-size="${nameSize}">${escapeXml(model.name)}</text>`;
  if (model.tagline) output += `<text x="24" y="132" fill="${theme.muted}" font-family="${SANS}" font-size="16">${escapeXml(model.tagline)}</text>`;
  output += `<g transform="translate(24 156)">`;
  output += `<path d="M0 24H${width - 48}M0 72H${width - 48}M40 0V120M${width - 88} 0V120" fill="none" stroke="${theme.border}"/>`;
  output += wrap('field', `<path d="M${num((width - 48) / 2)} 48h12M${num((width - 48) / 2 + 6)} 42v12" fill="none" stroke="${theme.chrome}"/>`);
  output += wrap('beam', `<path d="M0 96H70" fill="none" stroke="${theme.chrome}" stroke-width="2"/>`);
  output += `</g>`;
  const columns = width < 700 ? 2 : 4;
  model.bodies.forEach((body, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 24 + column * (NODE_WIDTH + 16);
    const y = 300 + row * (NODE_HEIGHT + 8);
    output += `<g transform="translate(${x} ${y})">${wrap(`body${index}`, projectNode(context, { width: NODE_WIDTH, height: NODE_HEIGHT, label: body.name, disclosure: model.disclosure, size: body.size }))}</g>`;
  });
  model.unmatched.forEach((label, index) => {
    output += `<text x="24" y="${470 + index * 16}" fill="${theme.muted}" font-family="${SANS}" font-size="12">${escapeXml(label)}</text>`;
  });
  output += `<text x="24" y="${height - 28}" fill="${theme.muted}" font-family="${SANS}" font-size="11">${escapeXml(`BODY SIZE · OPEN ISSUES AND PULL REQUESTS · ${model.generatedAt} · ${model.source}`)}</text>`;
  output += evidenceLabel(context, 'observed', { x: width - 160, y: height - 46 });
  return `${output}</svg>`;
}

export const identityBeaconScene: SceneDefinition<BeaconModel> = {
  id: 'identity-beacon', family: 'scene', budget: 'scene',
  supportedPacks: ['survey'], supportedMotion: ['none', 'ambient', 'cinematic'],
  buildModel: buildBeacon,
  accessibility,
  render: (model, context) => renderBeacon(model, context, accessibility(model)),
};
