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
const STALE_MS = 72 * 3_600_000;
const MAX_FORWARD_SKEW_MS = 60_000;
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
function textLines(value: string, width: number, size: number): string[] {
  // Reserve more than one em for fallback glyphs and never split a surrogate pair.
  const capacity = Math.max(1, Math.floor(width / (size * 1.05)));
  const characters = [...value];
  const lines: string[] = [];
  for (let index = 0; index < characters.length;) {
    let end = Math.min(characters.length, index + capacity);
    if (end < characters.length) {
      // Prefer a nearby word boundary without allowing many short lines to exceed the frame.
      for (let boundary = end - 1; boundary >= index + Math.ceil(capacity * 0.75) - 1; boundary -= 1) {
        if (characters[boundary] === ' ') { end = boundary + 1; break; }
      }
    }
    lines.push(characters.slice(index, end).join(''));
    index = end;
  }
  return lines;
}
function unavailable(reason: string): SceneUnavailable {
  return sceneUnavailable(reason);
}
function issuesOf(project: ProjectSnapshot): number | null {
  const value = project?.openIssuesAndPullRequests;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
}
/** Validate the UTC wire value rather than accepting Date.parse's rolled dates. */
function observation(value: unknown): { time: number; source: string } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const stamp = record.generatedAt;
  if (typeof stamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(stamp)) return null;
  const normalized = stamp.includes('.') ? stamp.replace(/\.(\d+)Z$/u, (_, digits: string) => `.${digits.padEnd(3, '0')}Z`) : stamp.replace(/Z$/u, '.000Z');
  const time = Date.parse(stamp);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== normalized) return null;
  if (!(SOURCES as readonly unknown[]).includes(record.source) || (record.mode !== 'live' && record.mode !== 'demo')) return null;
  if ((record.mode === 'demo') !== (record.source === 'synthetic-demo')) return null;
  return { time, source: record.source as string };
}
function buildBeacon({ snapshot, identity }: SceneInputs): BeaconModel | SceneUnavailable {
  if (!identity || !isIdentityConfig(identity)) return unavailable('A beacon without an identity is not rendered.');
  return buildIdentified(snapshot, identity);
}
function buildIdentified(snapshot: PortfolioSnapshot, identity: IdentityConfig): BeaconModel | SceneUnavailable {
  const root = observation(snapshot?.freshness);
  const board = observation(snapshot?.projects?.freshness);
  if (!root || !board || (root.source === 'synthetic-demo') !== (board.source === 'synthetic-demo')) return unavailable('Snapshot or project observations are unavailable.');
  // The root is the deterministic as-of clock, not the current wall clock.
  // Allow bounded independent fetch completion, never arbitrary future evidence.
  if (root.time - board.time > STALE_MS || board.time - root.time > MAX_FORWARD_SKEW_MS) return unavailable('Project observations fall outside the snapshot window.');
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
    generatedAt: new Date(board.time).toISOString(), source: board.source,
    disclosure: board.source === 'synthetic-demo' ? 'synthetic' : 'public',
  };
}
function readProjects(snapshot: PortfolioSnapshot): readonly ProjectSnapshot[] | null {
  const board = snapshot?.projects;
  if (!board || !Array.isArray(board.projects) || board.projects.length > 6) return null;
  if (board.projects.some(project => !project || typeof project.name !== 'string' || project.name.length === 0 || project.name.length > 100 || issuesOf(project) === null)) return null;
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
  const nameLines = textLines(model.name, width - 48, 28);
  const taglineLines = textLines(model.tagline, width - 48, 16);
  const nameBottom = 108 + (nameLines.length - 1) * 34;
  const taglineTop = nameBottom + 28;
  const gridTop = taglineLines.length ? taglineTop + (taglineLines.length - 1) * 20 + 24 : nameBottom + 24;
  const columns = context.layout === 'compact' ? 1 : 3;
  const nodeWidth = (width - 48 - (columns - 1) * 16) / columns;
  const bodyTop = gridTop + 144;
  const bodyRows = Math.ceil(model.bodies.length / columns);
  const bodyBottom = bodyRows ? bodyTop + (bodyRows - 1) * (NODE_HEIGHT + 8) + NODE_HEIGHT : gridTop + 120;
  const focusTop = bodyBottom + 24;
  const contentBottom = model.unmatched.length ? focusTop + model.unmatched.length * 18 : bodyBottom;
  const height = Math.max(520, contentBottom + 132);
  const applications: MotionApplication[] = [];
  if (context.motion === 'ambient' || context.motion === 'cinematic') {
    const beam: MotionApplication = { primitive: 'sweep', target: 'beam', decorative: true, loopGroup: 'beacon-beam', params: { x: width - 48, y: 0 } };
    if (context.motion === 'cinematic' && beam.params) applications.push({ ...beam, params: { ...beam.params, durationMs: 12_000, delayMs: 2_000 } });
    else applications.push(beam);
  }
  if (context.motion === 'cinematic') {
    applications.push({ primitive: 'acquisitionFailure', target: 'field', decorative: true, params: { cx: (width - 48) / 2 + 6, cy: 48 } });
    model.bodies.forEach((_, index) => {
      applications.push({ primitive: 'enter', target: `body${index}`, decorative: true, params: { y: 8, delayMs: 1_200 + index * 120 } });
    });
  }
  if (context.motion === 'ambient') {
    model.bodies.forEach((_, index) => {
      applications.push({ primitive: 'breathe', target: `body${index}`, decorative: true, loopGroup: 'beacon-breathe', params: { cx: nodeWidth / 2, cy: 38, scale: 1.04 } });
    });
  }
  const motion = compileSceneMotion(context, applications, { target: 'github-readme' });
  const binding = (target: string) => motion.bindings.find(item => item.target === target);
  const wrap = (target: string, body: string) => `<g id="${sceneElementId(context, target)}" class="${sceneClassName(context, target)}">${body}${binding(target)?.children ?? ''}</g>`;
  let output = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(text.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(text.title)}</title><desc>${escapeXml(text.description)}</desc>${motion.style}`;
  output += frame(context, { title: model.name, ref: 'BEACON / 04', family: 'scene', width, height });
  output += `<g id="${sceneElementId(context, 'name')}">${nameLines.map((line, index) => `<text x="24" y="${108 + index * 34}" fill="${theme.text}" font-family="${SANS}" font-size="28">${escapeXml(line)}</text>`).join('')}</g>`;
  if (model.tagline) output += `<g id="${sceneElementId(context, 'tagline')}">${taglineLines.map((line, index) => `<text x="24" y="${taglineTop + index * 20}" fill="${theme.muted}" font-family="${SANS}" font-size="16">${escapeXml(line)}</text>`).join('')}</g>`;
  output += `<g transform="translate(24 ${gridTop})">`;
  output += `<path d="M0 24H${width - 48}M0 72H${width - 48}M40 0V120M${width - 88} 0V120" fill="none" stroke="${theme.border}"/>`;
  output += wrap('field', `<path d="M${num((width - 48) / 2)} 48h12M${num((width - 48) / 2 + 6)} 42v12" fill="none" stroke="${theme.chrome}"/>`);
  output += wrap('beam', `<path d="M0 96H70" fill="none" stroke="${theme.chrome}" stroke-width="2"/>`);
  output += `</g>`;
  model.bodies.forEach((body, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 24 + column * (nodeWidth + 16);
    const y = bodyTop + row * (NODE_HEIGHT + 8);
    output += `<g transform="translate(${x} ${y})">${wrap(`body${index}`, projectNode(context, { width: nodeWidth, height: NODE_HEIGHT, label: body.name, disclosure: model.disclosure, size: body.size }))}</g>`;
  });
  model.unmatched.forEach((label, index) => {
    output += `<text class="${sceneClassName(context, 'unmatched')}" x="24" y="${focusTop + index * 18}" fill="${theme.muted}" font-family="${SANS}" font-size="12">${escapeXml(label)}</text>`;
  });
  output += `<g id="${sceneElementId(context, 'footer')}">${['BODY SIZE · OPEN ISSUES AND PULL REQUESTS', model.generatedAt, `SOURCE · ${model.source}`].map((line, index) => `<text x="24" y="${height - 100 + index * 16}" fill="${theme.muted}" font-family="${SANS}" font-size="11">${escapeXml(line)}</text>`).join('')}</g>`;
  output += evidenceLabel(context, 'observed', { x: width - 160, y: height - 40 });
  return `${output}</svg>`;
}

export const identityBeaconScene: SceneDefinition<BeaconModel> = {
  id: 'identity-beacon', family: 'scene', budget: 'scene',
  supportedPacks: ['survey'], supportedMotion: ['none', 'ambient', 'cinematic'],
  buildModel: buildBeacon,
  accessibility,
  render: (model, context) => renderBeacon(model, context, accessibility(model)),
};
