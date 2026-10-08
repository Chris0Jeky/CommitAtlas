import { isRecord } from "@commit-atlas/github";
import type { PortfolioSnapshot } from "@commit-atlas/github";
import { escapeXml, themes } from "../index.js";
import type { SvgTheme } from "../index.js";
import { compileSceneMotion, sceneUnavailable } from "../scene.js";
import type { RenderContext, SceneDefinition, SceneUnavailable } from "../scene.js";
import { coordinate, MONO } from "../primitives/common.js";
import { frame } from "../primitives/index.js";
import { seededRandom, stableHash } from "../seed.js";

interface Cluster {
  readonly language: string | null;
  readonly release: boolean;
  readonly publishedAt: string | null;
  readonly tag: string | null;
}
interface DayPoint { readonly date: string; readonly count: number }
interface NebulaModel {
  readonly generatedAtDate: string;
  readonly clusters: readonly Cluster[];
  readonly days: readonly DayPoint[];
}
interface Placed { readonly x: number; readonly y: number; readonly release: boolean; readonly cluster: number }

const USABLE = new Set(["live", "demo", "partial"]);
const ANONYMOUS: Cluster = { language: null, release: false, publishedAt: null, tag: null };
const REASON = "Contribution history is unavailable.";

function utcDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}
function utcStamp(value: string): string | null {
  const date = value.slice(0, 10);
  return utcDay(date) && value.startsWith(`${date}T`) ? date : null;
}
function usable(value: unknown): boolean {
  return isRecord(value) && USABLE.has(String(value.mode));
}
function languageName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed !== "" && trimmed.length <= 80 ? trimmed : null;
}
function boundedToken(value: unknown): string | null {
  return typeof value === "string" && value.length <= 64 && /^[A-Za-z0-9._+-]+$/u.test(value) ? value : null;
}
function readDays(value: unknown): DayPoint[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const days: DayPoint[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const day: unknown = value[index];
    if (!isRecord(day) || typeof day.date !== "string" || !utcDay(day.date) || seen.has(day.date)) return null;
    if (typeof day.count !== "number" || !Number.isSafeInteger(day.count) || day.count < 0 || day.count > 100_000) return null;
    seen.add(day.date);
    days.push({ date: day.date, count: day.count });
  }
  return days;
}
function readClusters(projects: unknown): Cluster[] {
  if (!isRecord(projects) || !Array.isArray(projects.projects) || projects.projects.length === 0) return [ANONYMOUS];
  const clusters: Cluster[] = [];
  for (let index = 0; index < projects.projects.length; index += 1) {
    const project: unknown = projects.projects[index];
    if (!isRecord(project)) continue;
    const releaseRecord = isRecord(project.release) ? project.release : null;
    const release = project.releaseState === "published" && releaseRecord !== null;
    clusters.push({
      language: languageName(project.primaryLanguage),
      release,
      publishedAt: releaseRecord && release && typeof releaseRecord.publishedAt === "string" ? utcStamp(releaseRecord.publishedAt) : null,
      tag: releaseRecord && release ? boundedToken(releaseRecord.tag) : null,
    });
  }
  return clusters.length > 0 ? clusters : [ANONYMOUS];
}
function buildNebula(snapshot: PortfolioSnapshot): NebulaModel | SceneUnavailable {
  if (!usable(snapshot.freshness) || !isRecord(snapshot.contributions) || !usable(snapshot.contributions.freshness)) return sceneUnavailable(REASON);
  const generatedAtDate = typeof snapshot.freshness.generatedAt === "string" ? utcStamp(snapshot.freshness.generatedAt) : null;
  const days = generatedAtDate === null ? null : readDays(snapshot.contributions.days);
  if (generatedAtDate === null || days === null) return sceneUnavailable(REASON);
  return { generatedAtDate, clusters: readClusters(snapshot.projects), days };
}
function accessibility(model: NebulaModel): { title: string; description: string } {
  return {
    title: "Nebula",
    description: `SCENE seeded from the ${model.generatedAtDate} snapshot. Star position comes from the snapshot seed. Colour uses the language palette. A large mark is a published release. Twinkle is decorative. No count, rate, or ranking is drawn.`,
  };
}
function languageInk(theme: SvgTheme, language: string | null): string {
  if (language === null) return theme.chrome;
  const index = Number.parseInt(stableHash(language).slice(0, 8), 16) % theme.languagePalette.length;
  return theme.languagePalette[index]!;
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function dimensions(context: RenderContext): { width: number; height: number } {
  return { width: context.layout === "compact" ? 480 : 720, height: 420 };
}
/** ParticleField keeps only 96 stars and drops the rest. Every contribution day stays a star; one group twinkles. */
function place(model: NebulaModel, seed: string, width: number, height: number): Placed[] {
  const random = seededRandom(seed);
  const left = 36;
  const right = width - 36;
  const top = 108;
  const bottom = height - 36;
  const origins = model.clusters.map(() => ({
    x: left + random() * (right - left),
    y: top + random() * (bottom - top),
  }));
  const placed: Placed[] = [];
  for (let index = 0; index < model.days.length; index += 1) {
    const cluster = Math.min(model.clusters.length - 1, Math.floor(random() * model.clusters.length));
    const origin = origins[cluster]!;
    placed.push({
      cluster, release: false,
      x: clamp(origin.x + (random() - 0.5) * 96, left, right),
      y: clamp(origin.y + (random() - 0.5) * 96, top, bottom),
    });
  }
  model.clusters.forEach((cluster, index) => {
    if (!cluster.release) return;
    const origin = origins[index]!;
    placed.push({
      cluster: index, release: true,
      x: clamp(origin.x + (random() - 0.5) * 24, left, right),
      y: clamp(origin.y + (random() - 0.5) * 24, top, bottom),
    });
  });
  return placed;
}
function text(x: number, y: number, content: string, ink: string, size: number): string {
  return `<text x="${x}" y="${y}" fill="${ink}" font-family="${MONO}" font-size="${size}">${escapeXml(content)}</text>`;
}
function root(context: RenderContext, labels: { title: string; description: string }, width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(labels.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(labels.title)}</title><desc>${escapeXml(labels.description)}</desc>${body}</svg>`;
}
function renderNebula(model: NebulaModel, context: RenderContext, labels: { title: string; description: string }): string {
  const { width, height } = dimensions(context);
  const theme = themes[context.theme];
  const motion = compileSceneMotion(context, [{
    primitive: "twinkle", target: "stars", decorative: true, loopGroup: "nebula-stars",
    params: { minOpacity: 0.35, durationMs: 7000 },
  }], { target: "github-readme" });
  const stars = motion.bindings[0];
  if (!stars) throw new Error("nebula star motion binding missing");
  const circles = place(model, context.seed, width, height).map(star => {
    const ink = languageInk(theme, model.clusters[star.cluster]?.language ?? null);
    return `<circle cx="${coordinate(star.x)}" cy="${coordinate(star.y)}" r="${star.release ? "5.5" : "1.6"}" fill="${ink}"/>`;
  }).join("");
  const body = `${motion.style}${frame(context, { title: "Nebula", ref: "PUBLIC FIELD", family: "scene", width, height })}` +
    `<g id="${stars.id}" class="${stars.className}" aria-hidden="true">${circles}${stars.children}</g>` +
    text(20, height - 18, `SCENE · seeded from the ${model.generatedAtDate} snapshot`, theme.muted, 12);
  return root(context, labels, width, height, body);
}
function renderEmpty(context: RenderContext, labels: { title: string; description: string }): string {
  const { width, height } = dimensions(context);
  const theme = themes[context.theme];
  const body = `${frame(context, { title: "Empty field", ref: "NO HISTORY", family: "scene", width, height })}` +
    `<rect x="36" y="108" width="${width - 72}" height="${height - 156}" fill="none" stroke="${theme.muted}" stroke-dasharray="4 3"/>` +
    text(48, 148, "EMPTY FIELD", theme.muted, 13) +
    text(48, 172, "UNAVAILABLE", theme.muted, 13);
  return root(context, labels, width, height, body);
}

/** Aesthetic field. It prints no count, rate, or ranking. */
export const nebulaScene: SceneDefinition<NebulaModel> = {
  id: "nebula", family: "scene", budget: "scene",
  supportedPacks: ["survey"], supportedMotion: ["none", "ambient"],
  buildModel: ({ snapshot }) => buildNebula(snapshot),
  accessibility,
  render: (model, context) => renderNebula(model, context, accessibility(model)),
  renderUnavailable: (_state, context, labels) => renderEmpty(context, labels),
};
