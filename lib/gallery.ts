import type { Freshness, PortfolioSnapshot } from "@/lib/github/types";
import { HOSTED_SCENE_IDS } from "@/lib/hosted-scene-catalog";
import { toAtlasCard } from "@/lib/portfolio";
import { developerLensMethodTrialSummary } from "@/lib/research-bridge";
import {
  toActivityCard,
  toContributionMetricsCards,
  toLanguagesCard,
  toProfileCard,
  toProjectBoard,
  toSceneInputs,
  toStreakCard,
} from "@/lib/svg-adapters";
import {
  escapeXml,
  MOTION_BACKEND_DEFAULTS,
  renderActivityCard,
  renderAtlasCard,
  renderCadenceCard,
  renderContributionBreakdownCard,
  renderLanguagesCard,
  renderProfileCard,
  renderProjectBoard,
  renderReleasesCard,
  renderRhythmCard,
  renderStreakCard,
  listScenes,
  renderSceneDefinition,
  type CardDataState,
  type CardSource,
  type RenderContext,
  type ScenePack,
} from "@/packages/svg/src/index";
export const GALLERY_CARD_IDS = [
  "atlas",
  "profile",
  "streak",
  "breakdown",
  "rhythm",
  "activity",
  "languages",
  "projects",
  "cadence",
  "releases",
] as const;

export type GalleryCardId = (typeof GALLERY_CARD_IDS)[number];
export type GalleryFamily = "instrument" | "map" | "signature" | "scene" | "finding";
export type GalleryRung = "observed" | "derived" | "hypothesis" | "C0" | "declared" | "partial" | "stale" | "unavailable";
export type GalleryState = "ready" | "unavailable";

export interface GalleryTile {
  readonly id: string;
  readonly label: string;
  readonly family: GalleryFamily;
  readonly rung: GalleryRung;
  readonly pack: string;
  readonly motion: string;
  readonly state: GalleryState;
  readonly marker: "SYNTHETIC DEMO";
  readonly note: string;
  readonly studioHref: string;
  readonly svg: string;
}

export interface GalleryFamilySection {
  readonly id: GalleryFamily;
  readonly title: string;
  readonly tiles: readonly GalleryTile[];
}

export interface GalleryModel {
  readonly tiles: readonly GalleryTile[];
  readonly families: readonly GalleryFamilySection[];
}

const FAMILIES: readonly { id: GalleryFamily; title: string }[] = [
  { id: "instrument", title: "Instruments" },
  { id: "map", title: "Maps" },
  { id: "signature", title: "Signatures" },
  { id: "scene", title: "Scenes" },
  { id: "finding", title: "Findings" },
];

const CARD_FAMILY: Record<GalleryCardId, GalleryFamily> = {
  atlas: "instrument",
  profile: "instrument",
  streak: "instrument",
  breakdown: "instrument",
  rhythm: "instrument",
  activity: "instrument",
  languages: "instrument",
  projects: "instrument",
  cadence: "instrument",
  releases: "instrument",
};

const CARD_LABEL: Record<GalleryCardId, string> = {
  atlas: "Atlas",
  profile: "Profile",
  streak: "Streak",
  breakdown: "Breakdown",
  rhythm: "Rhythm",
  activity: "Activity",
  languages: "Languages",
  projects: "Projects",
  cadence: "Cadence",
  releases: "Releases",
};

const HOSTED_CARDS = new Set<string>([
  "atlas", "profile", "streak", "breakdown", "rhythm", "activity", "languages", "projects",
]);

const RENDER_OPTIONS = { theme: "ember", motion: "none" } as const;

function cardEvidence(freshness: Freshness): { readonly source: CardSource; readonly dataState?: CardDataState } {
  const source: CardSource = freshness.mode === "demo" || freshness.source === "synthetic-demo"
    ? "synthetic-demo"
    : freshness.source === "github-profile-html" ? "public-profile" : "public-github";
  const dataState = freshness.mode === "partial" || freshness.mode === "stale" || freshness.mode === "unavailable"
    ? freshness.mode
    : undefined;
  return { source, ...(dataState ? { dataState } : {}) };
}

function plate(reason: string): string {
  const detail = escapeXml(reason).slice(0, 240);
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="UNAVAILABLE" viewBox="0 0 720 160"><title>UNAVAILABLE</title><desc>${detail}</desc><rect width="720" height="160" fill="#11110f"/><text x="24" y="64" fill="#edf0e2" font-size="16">UNAVAILABLE</text><text x="24" y="96" fill="#9aa08c" font-size="12">${detail}</text></svg>`;
}

function reasonOf(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : "Output unavailable.";
}

function rungFor(planned: GalleryRung, dataState: CardDataState | undefined): GalleryRung {
  if (dataState === "unavailable") return "unavailable";
  if (dataState === "stale" || dataState === "partial") return dataState;
  return planned;
}

function tile(input: Omit<GalleryTile, "marker">): GalleryTile {
  return { ...input, marker: "SYNTHETIC DEMO" };
}

function failed(id: string, label: string, family: GalleryFamily, pack: string, error: unknown): GalleryTile {
  return tile({
    id,
    label,
    family,
    rung: "unavailable",
    pack,
    motion: "none",
    state: "unavailable",
    note: "Unavailable",
    studioHref: studioHref(id, family),
    svg: plate(reasonOf(error)),
  });
}

function studioHref(id: string, family: GalleryFamily): string {
  if (family === "finding") return "/#research-bridge-title";
  if (HOSTED_CARDS.has(id)) return `/studio?card=${id}`;
  if ((HOSTED_SCENE_IDS as readonly string[]).includes(id)) return `/studio?scene=${id}`;
  return "/studio";
}

function cardTile(
  id: GalleryCardId,
  planned: GalleryRung,
  dataState: CardDataState | undefined,
  svg: string,
): GalleryTile {
  const rung = rungFor(planned, dataState);
  const unavailable = rung === "unavailable";
  return tile({
    id,
    label: CARD_LABEL[id],
    family: CARD_FAMILY[id],
    rung,
    pack: "card",
    motion: "none",
    state: unavailable ? "unavailable" : "ready",
    note: unavailable ? "Unavailable" : "",
    studioHref: studioHref(id, CARD_FAMILY[id]),
    svg,
  });
}

function renderCard(snapshot: PortfolioSnapshot, id: GalleryCardId): GalleryTile {
  const family = CARD_FAMILY[id];
  try {
    if (id === "atlas") {
      const data = toAtlasCard(snapshot);
      return cardTile(id, "derived", data.dataState, renderAtlasCard(data, RENDER_OPTIONS));
    }
    if (id === "profile") {
      const data = toProfileCard(snapshot.profile);
      return cardTile(id, "observed", data.dataState, renderProfileCard(data, RENDER_OPTIONS));
    }
    if (id === "streak") {
      const data = toStreakCard(snapshot.contributions, snapshot.metrics.window.days);
      return cardTile(id, "observed", data.dataState, renderStreakCard(data, RENDER_OPTIONS));
    }
    if (id === "activity") {
      const data = toActivityCard(snapshot.contributions, snapshot.metrics.window.days);
      return cardTile(id, "observed", data.dataState, renderActivityCard(data, RENDER_OPTIONS));
    }
    if (id === "languages") {
      const data = toLanguagesCard(snapshot.profile);
      return cardTile(id, "observed", data.dataState, renderLanguagesCard(data, RENDER_OPTIONS));
    }
    if (id === "projects") {
      if (!snapshot.projects) return failed(id, CARD_LABEL[id], family, "card", new Error("Project board is unavailable."));
      const data = toProjectBoard(snapshot.projects);
      return cardTile(id, "observed", data.dataState, renderProjectBoard(data, RENDER_OPTIONS));
    }
    if (id === "cadence") {
      const evidence = cardEvidence(snapshot.contributions.freshness);
      return cardTile(id, "observed", evidence.dataState, renderCadenceCard({
        ...evidence,
        days: snapshot.contributions.days,
      }, RENDER_OPTIONS));
    }
    if (id === "breakdown" || id === "rhythm") {
      const metrics = toContributionMetricsCards(snapshot.contributions, snapshot.metrics.window.days);
      if (id === "breakdown") {
        const planned = metrics.breakdown.basis === "exact-counts" ? "observed" : "hypothesis";
        return cardTile(id, planned, metrics.breakdown.dataState, renderContributionBreakdownCard(metrics.breakdown, RENDER_OPTIONS));
      }
      return cardTile(id, "derived", metrics.rhythm.dataState, renderRhythmCard(metrics.rhythm, RENDER_OPTIONS));
    }
    if (!snapshot.projects) return failed(id, CARD_LABEL[id], family, "card", new Error("Release evidence is unavailable."));
    const projects = snapshot.projects.projects;
    const observed = projects.filter((project) => project.releaseState !== "unavailable");
    const evidence = cardEvidence(snapshot.projects.freshness);
    const unavailableCount = projects.length - observed.length;
    const planned: GalleryRung = unavailableCount > 0 ? "partial" : "observed";
    return cardTile(id, planned, evidence.dataState, renderReleasesCard({
      ...evidence,
      releases: observed.flatMap((project) => project.release
        ? [{ project: project.name, tag: project.release.tag, publishedAt: project.release.publishedAt }]
        : []),
      projectsObserved: observed.length,
      projectsUnavailable: unavailableCount,
    }, RENDER_OPTIONS));
  } catch (error) {
    return failed(id, CARD_LABEL[id], family, "card", error);
  }
}

function sceneContext(pack: ScenePack): RenderContext {
  return {
    theme: "ember",
    pack,
    motion: "none",
    backend: MOTION_BACKEND_DEFAULTS["github-readme"],
    layout: "wide",
    instanceNamespace: "gallery",
    seed: "",
  };
}

function sceneRung(id: string, unavailable: boolean): GalleryRung {
  if (unavailable) return "unavailable";
  if (id === "lifecycle-map") return "declared";
  if (id === "nebula") return "derived";
  return "observed";
}

function renderScenes(snapshot: PortfolioSnapshot): GalleryTile[] {
  return listScenes().map((definition) => {
    const pack = definition.supportedPacks.includes("survey") ? "survey" : definition.supportedPacks[0] ?? "survey";
    const motion = definition.supportedMotion.includes("none") ? "none" : definition.supportedMotion[0] ?? "none";
    try {
      const rendered = renderSceneDefinition(definition, toSceneInputs(snapshot), {
        ...sceneContext(pack),
        motion,
      });
      const unavailable = rendered.unavailable;
      return tile({
        id: definition.id,
        label: definition.id,
        family: definition.family,
        rung: sceneRung(definition.id, unavailable),
        pack,
        motion,
        state: unavailable ? "unavailable" : "ready",
        note: unavailable ? "Unavailable" : "",
        studioHref: studioHref(definition.id, definition.family),
        svg: rendered.svg,
      });
    } catch (error) {
      return failed(definition.id, definition.id, definition.family, pack, error);
    }
  });
}

function findingTile(): GalleryTile {
  const summary = developerLensMethodTrialSummary;
  const title = escapeXml(summary.trial.title);
  const verdict = escapeXml(summary.trial.verdict);
  const grade = escapeXml(summary.classification);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}" viewBox="0 0 720 180"><title>${title}</title><desc>Classification ${grade}. Decision ${verdict}.</desc><rect width="720" height="180" fill="#11110f"/><text x="24" y="48" fill="#edf0e2" font-size="14">${grade}</text><text x="24" y="80" fill="#edf0e2" font-size="14">${verdict}</text><text x="24" y="120" fill="#edf0e2" font-size="16">${title}</text></svg>`;
  return tile({
    id: "wbc1",
    label: "WB-C1",
    family: "finding",
    rung: "C0",
    pack: "record",
    motion: "none",
    state: "ready",
    note: `${summary.classification} · ${summary.trial.verdict}`,
    studioHref: "/#research-bridge-title",
    svg,
  });
}

/** Group every registered card, scene, and the vendored C0 finding. Demo snapshots only. */
export function buildGallery(snapshot: PortfolioSnapshot): GalleryModel {
  const tiles = [
    ...GALLERY_CARD_IDS.map((id) => renderCard(snapshot, id)),
    ...renderScenes(snapshot),
    findingTile(),
  ];
  const families = FAMILIES.map((family) => ({
    ...family,
    tiles: tiles
      .filter((item) => item.family === family.id)
      .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  }));
  return { families, tiles: families.flatMap((family) => family.tiles) };
}

export async function galleryEntityTag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `W/"${hash}"`;
}

function noneMatch(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").map((value) => value.trim()).some((candidate) => {
    if (candidate === "*") return true;
    return candidate.replace(/^W\//, "") === etag.replace(/^W\//, "");
  });
}

/** Weak ETag for the gallery HTML body. Non-HTML and non-200 responses pass through. */
export async function stampGalleryResponse(request: Request, response: Response): Promise<Response> {
  if (response.status !== 200) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("text/html")) return response;
  const body = await response.text();
  const etag = await galleryEntityTag(body);
  const headers = new Headers(response.headers);
  headers.set("etag", etag);
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=300");
  headers.delete("content-length");
  if (noneMatch(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, statusText: "Not Modified", headers });
  }
  return new Response(body, { status: 200, statusText: response.statusText, headers });
}

