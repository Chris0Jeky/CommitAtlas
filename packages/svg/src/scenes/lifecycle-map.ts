import type { PortfolioSnapshot } from '@commit-atlas/github';
import { escapeXml, themes, truncateText } from '../index.js';
import { compileSceneMotion, sceneClassName, sceneElementId, sceneUnavailable } from '../scene.js';
import type { MotionApplication } from '../motion/types.js';
import type { RenderContext, SceneDefinition, SceneInputs, SceneUnavailable } from '../scene.js';
import { evidenceLabel, frame } from '../primitives/index.js';
import { timeline } from '../primitives/geometric.js';

const STATIONS = ['planned', 'active', 'maintenance', 'paused', 'archived'] as const;
const LAMPS = ['passing', 'failing', 'pending', 'stale', 'unconfigured', 'unavailable'] as const;
const ALIASES: Readonly<Record<string, (typeof STATIONS)[number]>> = { maintained: 'maintenance' };
type Station = (typeof STATIONS)[number];
type Lamp = (typeof LAMPS)[number];
interface Marker { readonly name: string; readonly station: Station; readonly lamp: Lamp; readonly release: string }
interface LifecycleModel { readonly stations: readonly Station[]; readonly markers: readonly Marker[] }

function xmlChars(value: string): string {
  return [...value].filter(character => {
    const code = character.codePointAt(0) ?? 0;
    return code === 9 || code === 10 || code === 13 ||
      code >= 0x20 && code <= 0xd7ff || code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff;
  }).join('');
}
function stationOf(value: unknown): Station | null {
  if (typeof value !== 'string') return null;
  if ((STATIONS as readonly string[]).includes(value)) return value as Station;
  return ALIASES[value] ?? null;
}
function buildLifecycle(snapshot: PortfolioSnapshot): LifecycleModel | SceneUnavailable {
  if (snapshot?.freshness?.mode === 'unavailable' || snapshot?.projects?.freshness?.mode === 'unavailable') {
    return sceneUnavailable('Configured projects are unavailable.');
  }
  const projects = snapshot?.projects?.projects;
  if (!Array.isArray(projects)) return sceneUnavailable('Configured projects are unavailable.');
  if (projects.length > 6) return sceneUnavailable('Configured projects are unavailable.');
  const markers: Marker[] = [];
  for (const project of projects) {
    const station = stationOf(project?.lifecycle);
    const lamp = LAMPS.find(state => state === project?.ci?.state);
    const release = project?.releaseState;
    if (!station || !lamp || (release !== 'published' && release !== 'none' && release !== 'unavailable')) {
      return sceneUnavailable('Configured projects are unavailable.');
    }
    const name = truncateText(xmlChars(typeof project.name === 'string' ? project.name : ''), 25) || 'project';
    markers.push({ name, station, lamp, release });
  }
  return { stations: STATIONS, markers };
}
function accessibility(model: LifecycleModel): { title: string; description: string } {
  const names = model.markers.map(marker => marker.name).join(', ') || 'none';
  return {
    title: 'Lifecycle map',
    description: `${names}. LIFECYCLE · DECLARED. Each project sits once on its declared station. The CI lamp shows the observed check. A dashed socket is unconfigured. An unavailable lamp stays unlit.`,
  };
}
function stationX(index: number, width: number): number {
  const inner = width - 48, inset = 16, span = inner - inset * 2;
  return 24 + inset + index / (STATIONS.length - 1) * span;
}
function renderLifecycle(model: LifecycleModel, context: RenderContext, a: { title: string; description: string }): string {
  const theme = themes[context.theme];
  const width = context.layout === 'compact' ? 480 : 720;
  const height = 420;
  const applications: MotionApplication[] = [];
  if (context.motion === 'ambient') {
    model.markers.forEach((marker, index) => {
      const x = stationX(STATIONS.indexOf(marker.station), width);
      applications.push({ primitive: 'breathe', target: `marker${index}`, decorative: true, loopGroup: 'lifecycle-breathe', params: { cx: x, cy: 230, scale: 1.04 } });
      if (marker.lamp === 'pending') {
        applications.push({ primitive: 'pulse', target: `lamp${index}`, decorative: true, loopGroup: 'lifecycle-pending', params: { state: 'pending', minOpacity: 0.45 } });
      }
    });
  }
  const motion = compileSceneMotion(context, applications, { target: 'github-readme' });
  const binding = (target: string) => motion.bindings.find(item => item.target === target);
  let output = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(a.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(a.title)}</title><desc>${escapeXml(a.description)}</desc>${motion.style}`;
  output += frame(context, { title: 'Lifecycle map', ref: 'LINE / 02', family: 'map', width, height });
  output += `<g transform="translate(24 96)">${timeline(context, { width: width - 48, height: 72, stations: STATIONS.map(station => station.toUpperCase()) })}</g>`;
  const used = new Map<string, number>();
  model.markers.forEach((marker, index) => {
    const slot = used.get(marker.station) ?? 0;
    used.set(marker.station, slot + 1);
    const x = stationX(STATIONS.indexOf(marker.station), width);
    const y = 210 + slot * 28;
    const dashed = marker.lamp === 'unconfigured' ? ' stroke-dasharray="4 3"' : '';
    const ink = marker.lamp === 'unavailable' || marker.lamp === 'unconfigured' || marker.lamp === 'stale' ? theme.muted : theme.chrome;
    const lampTitle = marker.lamp === 'unavailable' ? 'CI UNAVAILABLE' : marker.lamp === 'unconfigured' ? 'CI UNCONFIGURED' : `CI ${marker.lamp.toUpperCase()}`;
    const lampBody = `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${ink}"${dashed}/>`;
    if (marker.lamp === 'pending') {
      const lampTarget = `lamp${index}`;
      output += `<g id="${sceneElementId(context, lampTarget)}" class="${sceneClassName(context, lampTarget)}"><title>${escapeXml(lampTitle)}</title>${lampBody}${binding(lampTarget)?.children ?? ''}</g>`;
    } else {
      output += `<g><title>${escapeXml(lampTitle)}</title>${lampBody}</g>`;
    }
    const markerTarget = `marker${index}`;
    const markerBody = `<text x="${x + 10}" y="${y + 4}" fill="${theme.text}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="12">${escapeXml(marker.name)}</text><text x="${x + 10}" y="${y + 18}" fill="${theme.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="10">${escapeXml(marker.release.toUpperCase())}</text>`;
    output += `<g id="${sceneElementId(context, markerTarget)}" class="${sceneClassName(context, markerTarget)}">${markerBody}${binding(markerTarget)?.children ?? ''}</g>`;
  });
  output += evidenceLabel(context, 'hypothesis', { x: 24, y: height - 48 });
  output += evidenceLabel(context, 'observed', { x: 176, y: height - 48 });
  return `${output}</svg>`;
}

/** Declared lifecycle stations. CI and release are observed; position is never inferred from activity. */
export const lifecycleMapScene: SceneDefinition<LifecycleModel> = {
  id: 'lifecycle-map', family: 'map', budget: 'map',
  supportedPacks: ['survey'], supportedMotion: ['none', 'subtle', 'ambient'],
  buildModel: ({ snapshot }: SceneInputs) => buildLifecycle(snapshot),
  accessibility,
  render: (model, context) => renderLifecycle(model, context, accessibility(model)),
};
