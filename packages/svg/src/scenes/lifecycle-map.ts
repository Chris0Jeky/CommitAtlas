import type { PortfolioSnapshot, ProjectSnapshot } from "@commit-atlas/github";
import { escapeXml, themes } from "../index.js";
import { compileSceneMotion, sceneClassName, sceneElementId, sceneUnavailable } from "../scene.js";
import { sceneSafeText } from "../scene-svg.js";
import type { MotionApplication } from "../motion/types.js";
import type { RenderContext, SceneDefinition, SceneInputs, SceneUnavailable } from "../scene.js";
import { evidenceLabel, frame } from "../primitives/index.js";
import { timeline } from "../primitives/geometric.js";

const STATIONS = ["planned", "active", "maintenance", "paused", "archived"] as const;
const LAMPS = ["passing", "failing", "pending", "stale", "unconfigured", "unavailable"] as const;
const SOURCES = ["github-rest", "github-graphql", "github-profile-html", "synthetic-demo"] as const;
const MODES = ["live", "demo", "partial", "stale", "unavailable"] as const;
const STALE_MS = 72 * 3_600_000;
const ROW_HEIGHT = 96;
const ROW_TOP = 212;
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
type Station = typeof STATIONS[number];
type Lamp = typeof LAMPS[number];
type ReleaseState = "published" | "none" | "stale" | "unavailable";
interface Marker {
  readonly name: string;
  readonly station: Station;
  readonly lamp: Lamp;
  readonly workflow: string | null;
  readonly release: ReleaseState;
  readonly tag: string | null;
  readonly releasedAt: string | null;
}
interface LifecycleModel {
  readonly stations: readonly Station[];
  readonly markers: readonly Marker[];
  readonly observedAt: string;
  readonly asOf: string;
  readonly source: string;
  readonly synthetic: boolean;
  readonly state: "fresh" | "partial" | "stale";
}

/** UTC wire timestamps only; Date.parse alone normalizes impossible calendar dates. */
function instant(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)) return null;
  const normalized = value.includes(".") ? value.replace(/\.(\d+)Z$/u, (_, digits: string) => `.${digits.padEnd(3, "0")}Z`) : value.replace(/Z$/u, ".000Z");
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === normalized ? time : null;
}
function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string" || value.length > maximum * 2) return null;
  const clean = sceneSafeText(value).replace(/\s+/gu, " ").trim();
  return clean.length > 0 && [...clean].length <= maximum ? clean : null;
}
function stationOf(value: unknown): Station | null {
  if (value === "maintained") return "maintenance";
  return typeof value === "string" && (STATIONS as readonly string[]).includes(value) ? value as Station : null;
}
function freshness(value: unknown): { time: number; source: string; mode: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const time = instant(record.generatedAt);
  if (time === null || !(SOURCES as readonly unknown[]).includes(record.source) || !(MODES as readonly unknown[]).includes(record.mode)) return null;
  if (record.mode === "demo" && record.source !== "synthetic-demo") return null;
  return { time, source: record.source as string, mode: record.mode as string };
}
function unavailable(): SceneUnavailable { return sceneUnavailable("Configured project evidence is unavailable."); }

function ciSignal(project: ProjectSnapshot, observedAt: number, asOf: number, state: LifecycleModel["state"]): { lamp: Lamp; workflow: string | null } {
  const ci = project?.ci;
  const workflow = boundedText(ci?.workflow, 200);
  if (!ci || !(LAMPS as readonly unknown[]).includes(ci.state) || ci.state === "unavailable") return { lamp: "unavailable", workflow };
  if (ci.state === "unconfigured") return { lamp: ci.workflow === null ? "unconfigured" : "unavailable", workflow };
  const checkedAt = instant(ci.checkedAt);
  if (!workflow || checkedAt === null || checkedAt > observedAt) return { lamp: "unavailable", workflow };
  if (state === "stale" || ci.state === "stale" || asOf - checkedAt > STALE_MS) return { lamp: "stale", workflow };
  return { lamp: ci.state, workflow };
}
function releaseSignal(project: ProjectSnapshot, observedAt: number, state: LifecycleModel["state"]): Pick<Marker, "release" | "tag" | "releasedAt"> {
  const blocked = { release: "unavailable", tag: null, releasedAt: null } as const;
  if (project.releaseState === "unavailable") return blocked;
  if (project.releaseState !== "none" && project.releaseState !== "published") return blocked;
  if (project.releaseState === "none" && project.release !== null) return blocked;
  if (state === "stale") return { ...blocked, release: "stale" };
  if (project.releaseState === "none") return { ...blocked, release: "none" };
  const published = instant(project.release?.publishedAt);
  const tag = boundedText(project.release?.tag, 100);
  if (published === null || published > observedAt || !tag) return blocked;
  return { release: "published", tag, releasedAt: new Date(published).toISOString().slice(0, 10) };
}

function buildLifecycle(snapshot: PortfolioSnapshot): LifecycleModel | SceneUnavailable {
  const root = freshness(snapshot?.freshness);
  const board = freshness(snapshot?.projects?.freshness);
  const projects = snapshot?.projects?.projects;
  if (!root || !board || root.mode === "unavailable" || board.mode === "unavailable" ||
    (root.source === "synthetic-demo") !== (board.source === "synthetic-demo") ||
    !Array.isArray(projects) || projects.length < 1 || projects.length > 6) return unavailable();
  // Component fetches finish independently. The contribution timestamp is not a global clock.
  const asOf = Math.max(root.time, board.time);
  const state = board.mode === "stale" || asOf - board.time > STALE_MS ? "stale" : board.mode === "partial" ? "partial" : "fresh";
  const markers: Marker[] = [];
  const seen = new Set<string>();
  for (const project of projects) {
    const station = stationOf(project?.lifecycle);
    const name = boundedText(project?.name, 100);
    const repo = project?.repo;
    if (!station || !name || typeof repo !== "string" || repo.length > 140 || !/^[a-z\d][a-z\d-]{0,38}\/[a-z\d_.-]{1,100}$/iu.test(repo) || seen.has(repo.toLowerCase())) return unavailable();
    seen.add(repo.toLowerCase());
    markers.push({ name, station, ...ciSignal(project, board.time, asOf, state), ...releaseSignal(project, board.time, state) });
  }
  return {
    stations: STATIONS, markers, observedAt: new Date(board.time).toISOString(), asOf: new Date(asOf).toISOString(),
    source: board.source, synthetic: root.source === "synthetic-demo" || board.source === "synthetic-demo", state,
  };
}
function releaseReading(marker: Marker): string {
  return marker.release === "published" ? `RELEASE ${marker.tag} · ${marker.releasedAt}` : `RELEASE ${marker.release.toUpperCase()}`;
}
function accessibility(model: LifecycleModel): { title: string; description: string } {
  return {
    title: "Lifecycle map",
    description: `LIFECYCLE · DECLARED. ${model.synthetic ? "SYNTHETIC DEMO" : "PUBLIC GITHUB"}. Source ${model.source}. Observed ${model.observedAt}; as of ${model.asOf}. ${model.state.toUpperCase()} BOARD. ` +
      model.markers.map((marker, index) => `${index + 1}. ${marker.name}: declared ${marker.station}; CI ${marker.lamp.toUpperCase()}, workflow ${marker.workflow ?? "not configured or unavailable"}; ${releaseReading(marker)}.`).join(" ") +
      " Stations 1 planned, 2 active, 3 maintenance, 4 paused, 5 archived. Positions are owner declarations, not inferred maturity. Each row has one station marker. CI words and shapes distinguish passing, failing, pending, stale, unconfigured and unavailable. Only pending CI pulses; unavailable signals stay unlit. Releases show the latest published release per project, not complete history. Visible labels may be shortened.",
  };
}
function short(value: string, maximum: number): string {
  const points = [...value]; return points.length <= maximum ? value : `${points.slice(0, maximum - 1).join("")}…`;
}
function text(value: string, x: number, y: number, width: number, ink: string, size = 12): string {
  return `<text x="${x}" y="${y}" fill="${ink}" font-family="${MONO}" font-size="${size}">${escapeXml(short(value, Math.max(1, Math.floor(width / size))))}</text>`;
}
function grid(width: number): { left: number; right: number } { return { left: width === 480 ? 294 : 410, right: width - 40 }; }
function stationX(station: Station, width: number): number {
  const { left, right } = grid(width); return left + STATIONS.indexOf(station) / (STATIONS.length - 1) * (right - left);
}
/** Mirrors the chassis's monochrome lamp vocabulary, with state words painted separately. */
function lamp(state: Lamp, theme: typeof themes.aurora, x: number, y: number): string {
  if (state === "passing") return `<circle cx="${x}" cy="${y}" r="6" fill="${theme.positive}"/><path d="M${x - 3} ${y}l2 2 4-4" fill="none" stroke="${theme.background}" stroke-width="1.5"/>`;
  if (state === "failing") return `<path d="M${x} ${y - 7}l7 7-7 7-7-7Z" fill="${theme.negative}"/><path d="M${x - 2} ${y - 2}l4 4m0-4-4 4" stroke="${theme.background}"/>`;
  if (state === "pending") return `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="${theme.warning}"/><path d="M${x} ${y - 6}a6 6 0 0 1 0 12Z" fill="${theme.warning}"/>`;
  if (state === "stale") return `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="${theme.muted}" stroke-dasharray="2 2"/><path d="M${x} ${y - 4}v4h3" fill="none" stroke="${theme.muted}"/>`;
  if (state === "unconfigured") return `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="none" stroke="${theme.muted}" stroke-dasharray="3 2"/>`;
  return `<path d="M${x - 7} ${y - 3}l14-1v7l-14 1Z" fill="${theme.socket}" stroke="${theme.muted}"/><path d="M${x - 4} ${y}h8" stroke="${theme.muted}"/>`;
}
function renderLifecycle(model: LifecycleModel, context: RenderContext, a: { title: string; description: string }): string {
  const theme = themes[context.theme];
  const width = context.layout === "compact" ? 480 : 720;
  const height = ROW_TOP + model.markers.length * ROW_HEIGHT + 132;
  const { left, right } = grid(width);
  const applications: MotionApplication[] = [];
  if (context.motion === "ambient") model.markers.forEach((marker, index) => {
    if (marker.lamp === "passing" || marker.lamp === "failing" || marker.lamp === "pending") {
      applications.push({ primitive: "breathe", target: `marker${index}`, decorative: true, loopGroup: "lifecycle-breathe",
        params: { cx: stationX(marker.station, width), cy: ROW_TOP + index * ROW_HEIGHT + 18, scale: 1.045 } });
    }
    if (marker.lamp === "pending") applications.push({ primitive: "pulse", target: `lamp${index}`, decorative: true, loopGroup: "lifecycle-pending", params: { state: "pending", minOpacity: 0.45 } });
  });
  const motion = compileSceneMotion(context, applications, { target: "github-readme" });
  const wrap = (target: string, body: string) => `<g id="${sceneElementId(context, target)}" class="${sceneClassName(context, target)}">${body}${motion.bindings.find(item => item.target === target)?.children ?? ""}</g>`;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(a.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(a.title)}</title><desc>${escapeXml(a.description)}</desc>${motion.style}`;
  out += frame(context, { title: a.title, ref: "LINE / 02", family: "map", width, height, stale: model.state === "stale" });
  out += text(`${model.synthetic ? "SYNTHETIC DEMO" : "PUBLIC GITHUB"} · ${model.source}`, 24, 98, width - 48, theme.text, 11);
  out += text(`Observed ${model.observedAt.replace(".000Z", "Z")}`, 24, 117, width - 48, theme.muted, 11);
  out += text(`As of ${model.asOf.replace(".000Z", "Z")}`, 24, 135, width - 48, theme.muted, 11);
  out += evidenceLabel(context, "hypothesis", { x: 24, y: 150 });
  out += text("LIFECYCLE · DECLARED", 24, 194, left - 36, theme.text, 12);
  out += `<g transform="translate(${left - 16} 125)">${timeline(context, { width: right - left + 32, height: 96, stations: ["1", "2", "3", "4", "5"] })}</g>`;
  model.markers.forEach((marker, index) => {
    const y = ROW_TOP + index * ROW_HEIGHT;
    const x = stationX(marker.station, width);
    out += `<path d="M24 ${y + ROW_HEIGHT - 8}H${width - 24}" stroke="${theme.border}"/>`;
    out += text(`${index + 1}. ${marker.name}`, 24, y + 18, left - 62, theme.text, 13);
    out += text(`DECLARED ${marker.station.toUpperCase()}`, 24, y + 36, left - 54, theme.muted, 11);
    out += `<path d="M${left} ${y + 18}H${right}" fill="none" stroke="${theme.muted}" stroke-dasharray="3 4"/>`;
    for (let station = 0; station < STATIONS.length; station++) {
      const gx = left + station / 4 * (right - left);
      out += `<circle cx="${gx}" cy="${y + 18}" r="2" fill="${theme.muted}"/>`;
    }
    // Only the outer geometric halo breathes; the declared point and all reading text are static.
    out += wrap(`marker${index}`, `<circle cx="${x}" cy="${y + 18}" r="9" fill="none" stroke="${theme.muted}" stroke-dasharray="3 2"/>`);
    out += `<circle cx="${x}" cy="${y + 18}" r="4" fill="${theme.text}"/>`;
    out += wrap(`lamp${index}`, lamp(marker.lamp, theme, 32, y + 53));
    out += text(`CI ${marker.lamp.toUpperCase()} · ${marker.workflow ?? (marker.lamp === "unconfigured" ? "no workflow" : "workflow unavailable")}`, 48, y + 57, width - 72, theme.text, 11);
    out += text(marker.release === "published" ? `RELEASE ${short(marker.tag!, 16)} · ${marker.releasedAt}` : releaseReading(marker), 24, y + 77, width - 48, theme.muted, 11);
  });
  const footer = ROW_TOP + model.markers.length * ROW_HEIGHT;
  out += text("1 planned · 2 active · 3 maintenance", 24, footer + 10, width - 48, theme.muted, 11);
  out += text("4 paused · 5 archived", 24, footer + 27, width - 48, theme.muted, 10);
  out += text("Latest release only; not full history", 24, footer + 44, width - 48, theme.muted, 10);
  out += text("Long labels shortened; full text in desc.", 24, footer + 61, width - 48, theme.muted, 10);
  if (model.state === "partial") out += text("PARTIAL BOARD · inspect each signal", 24, footer + 79, width - 48, theme.muted, 11);
  return `${out}</svg>`;
}

/** Declared lifecycle is independent of observed CI/release evidence; no new GitHub fetches. */
export const lifecycleMapScene: SceneDefinition<LifecycleModel> = {
  id: "lifecycle-map", family: "map", budget: "map", supportedPacks: ["survey"], supportedMotion: ["none", "subtle", "ambient"],
  buildModel: ({ snapshot }: SceneInputs) => buildLifecycle(snapshot), accessibility,
  render: (model, context) => renderLifecycle(model, context, accessibility(model)),
  renderUnavailable: (_state, context, a) => {
    const width = context.layout === "compact" ? 480 : 720;
    const theme = themes[context.theme];
    return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(a.title)}" viewBox="0 0 ${width} 200"><title>${escapeXml(a.title)}</title><desc>${escapeXml(a.description)}</desc>${frame(context, { title: "Lifecycle map", ref: "LINE / 02", family: "map", width, height: 200 })}${text("PROJECT EVIDENCE UNAVAILABLE", 24, 114, width - 48, theme.text)}${text("No lifecycle or healthy signal is inferred.", 24, 143, width - 48, theme.muted, 10)}</svg>`;
  },
};
