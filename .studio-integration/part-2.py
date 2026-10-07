edit('app/studio/studio-scene-preview-image.tsx', None, [
    (0, 0, r'''"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ScenePack } from "@/packages/svg/src/index";
import { isHostedSceneId, HOSTED_SCENE_PACKS } from "@/lib/hosted-scene-catalog";
import { readStudioScenePreview, type SceneImageReceipt, type ScenePreviewView } from "./studio-scene-preview";

type Resource = Awaited<ReturnType<typeof readStudioScenePreview>> & { objectUrl: string };
interface Props {
  id: string; title: string; pack: ScenePack; url: string; stillUrl: string; view: ScenePreviewView; token: string;
  onRendered: (id: string, token: string, receipt: SceneImageReceipt | null) => void;
}
/** Parent keys this component by configuration/global attempt; local controls affect only this image. */
export function StudioScenePreview(props: Props) {
  const [view, setView] = useState(props.view);
  const [attempt, setAttempt] = useState(0);
  function choose(next: ScenePreviewView) {
    props.onRendered(props.id, props.token, null);
    setView(next); setAttempt(current => current + 1);
  }
  const tools = <div className="scene-image-tools" role="group" aria-label={`${props.title} preview tools`}>
    <button type="button" onClick={() => choose("profile")} aria-pressed={view === "profile"}>Profile view</button>
    <button type="button" onClick={() => choose("profile")}>Replay</button>
    <button type="button" onClick={() => choose("reduced")} aria-pressed={view === "reduced"}>Reduced-motion view</button>
    <button type="button" onClick={() => choose("frame-zero")} aria-pressed={view === "frame-zero"}>Frame zero</button>
  </div>;
  return <SceneImage {...props} view={view} key={JSON.stringify([props.token, view, attempt])} tools={tools} />;
}
function SceneImage({ id, title, pack, url, stillUrl, view, token, onRendered, tools }: Props & { tools: ReactNode }) {
  const supported = isHostedSceneId(id) && (HOSTED_SCENE_PACKS[id] as readonly string[]).includes(pack);
  const shown = view === "profile" ? url : stillUrl;
  const active = useRef(false);
  const [resource, setResource] = useState<Resource | null>(null);
  const [decoded, setDecoded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    active.current = true;
    onRendered(id, token, null);
    if (!supported) return () => { active.current = false; };
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let expired = false;
    const timeout = setTimeout(() => { expired = true; controller.abort(); }, 12_000);
    fetch(shown, { signal: controller.signal, redirect: "error", cache: "no-cache" })
      .then(response => readStudioScenePreview(response, id, controller.signal))
      .then(result => {
        if (!active.current || controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(result.blob);
        setResource({ ...result, objectUrl });
      })
      .catch(() => {
        if (!active.current || (controller.signal.aborted && !expired)) return;
        setFailed(true);
        onRendered(id, token, null);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active.current = false;
      controller.abort();
      clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      onRendered(id, token, null);
    };
  }, [id, onRendered, shown, supported, token]);
  const counters = decoded && !failed ? resource?.metadata : null;
  const reading = (value: number | undefined) => value === undefined ? "Unavailable" : String(value);
  const note = failed ? "UNAVAILABLE. The scene image could not be validated and loaded."
    : !decoded ? "Loading the scene image…"
      : resource?.state === "stale" ? "STALE SNAPSHOT. Counters and scene copying are unavailable."
        : resource?.state === "unverified" ? "Image loaded without a current renderer receipt. Scene copying is unavailable."
          : resource?.state === "unavailable" ? "UNAVAILABLE. This plate does not confirm the requested evidence."
            : view === "profile" ? "Image loaded. Compiler counters are not browser playback measurements."
              : "Still twin loaded. Return to Profile view to validate and copy the selected motion profile.";
  return (
    <article className="studio-card-preview span-wide card-scene" data-scene-preview={id}>
      <header><div><h4>{title}</h4><p>{view === "profile" ? "Profile view" : view === "reduced" ? "Reduced-motion still twin" : "Frame-zero still twin"}</p></div></header>
      {tools}
      <div className="card-preview-media">
        {!supported ? <p>UNAVAILABLE. This scene does not support the {pack} pack.</p>
          : resource && !failed ? (
            // Display precisely the response that supplied the counters, not a second live request.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resource.objectUrl} alt={`CommitAtlas ${title} preview`}
              onLoad={event => {
                if (!active.current) return;
                const image = event.currentTarget;
                if (!(image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth <= 4096 && image.naturalHeight <= 4096)) {
                  setFailed(true); onRendered(id, token, null); return;
                }
                setDecoded(true);
                onRendered(id, token, { token, view, sourceUrl: shown, decoded: true, state: resource.state });
              }}
              onError={() => { if (active.current) { setFailed(true); setDecoded(false); onRendered(id, token, null); } }} />
          ) : null}
      </div>
      {supported && <p className="scene-preview-status" role="status">{note}</p>}
      <dl className="scene-motion-counters" aria-label="Renderer counters for the loaded image">
        <div><dt>Bytes</dt><dd>{reading(counters?.bytes)}</dd></div>
        <div><dt>Animated elements</dt><dd>{reading(counters?.animatedElements)}</dd></div>
        <div><dt>Looping groups</dt><dd>{reading(counters?.loopingGroups)}</dd></div>
      </dl>
    </article>
  );
}
'''),
])
edit('app/studio/studio-scene-preview.test.ts', None, [
    (0, 0, r'''import assert from "node:assert/strict";
import test from "node:test";
import { readStudioScenePreview, scenePreviewToken, sceneReceiptMatches, type SceneImageReceipt } from "./studio-scene-preview";
const id = "evidence-coverage";
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 200"><title>Example</title><text>é</text></svg>';
const metadata = { version: 1, scene: id, bytes: new TextEncoder().encode(svg).length, animatedElements: 2, loopingGroups: 1, unavailable: false };
const response = (body = svg, changes: Record<string, string> = {}) => new Response(body, { headers: {
  "content-type": "image/svg+xml; charset=utf-8", "x-commitatlas-scene-metadata": JSON.stringify(metadata), ...changes,
} });
test("loads one bounded SVG and takes counters from its renderer metadata, not syntax", async () => {
  const result = await readStudioScenePreview(response(), id);
  assert.equal(result.state, "ready");
  assert.equal(result.metadata?.animatedElements, 2); assert.equal(result.metadata?.loopingGroups, 1);
  assert.equal(await result.blob.text(), svg); assert.equal(result.blob.type, "image/svg+xml");
});
for (const [label, make] of [
  ["HTML with status 200", () => response("<html>not an image</html>", { "content-type": "text/html" })],
  ["wrong content", () => response("<html>not an image</html>")],
  ["error status", () => new Response(svg, { status: 502, headers: { "content-type": "image/svg+xml" } })],
  ["different byte span", () => response(svg + " ")],
  ["unknown scene", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, scene: "other" }) })],
  ["unknown version", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, version: 2 }) })],
  ["fractional count", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, loopingGroups: 1.5 }) })],
  ["negative count", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, animatedElements: -1 }) })],
  ["unknown state", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, unavailable: "false" }) })],
  ["unexpected metadata field", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, trustMe: true }) })],
] as const) test(`rejects ${label}`, async () => {
  await assert.rejects(() => readStudioScenePreview(make(), id), /scene|SVG|metadata/i);
});
test("missing metadata and stale last-good bodies remain displayable but cannot authorize copying", async () => {
  for (const headers of [{ "x-commitatlas-scene-metadata": "" }, { "x-commitatlas-data-state": "stale" }] as Record<string, string>[]) {
    const result = await readStudioScenePreview(response(svg, headers), id);
    assert.notEqual(result.state, "ready"); assert.equal(result.metadata, null);
    assert.equal(await result.blob.text(), svg);
  }
});
test("a well-formed unavailable plate is distinct from rendered evidence", async () => {
  const result = await readStudioScenePreview(response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, unavailable: true, animatedElements: 0, loopingGroups: 0 }) }), id);
  assert.equal(result.state, "unavailable");
});
test("streaming response is bounded before decoding and cancels overflow", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(200_000)); }, cancel() { cancelled = true; } });
  await assert.rejects(() => readStudioScenePreview(new Response(body, { headers: { "content-type": "image/svg+xml" } }), id), /byte|large|limit/i);
  assert.equal(cancelled, true);
});
test("an aborted load cannot return a successful resource", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => readStudioScenePreview(response(), id, controller.signal));
});
test("only a loaded image for the current profile attempt can authorize copying", () => {
  const current = scenePreviewToken("config", id, "profile", 3);
  const receipt: SceneImageReceipt = { token: current, view: "profile", sourceUrl: "/profile", decoded: true, state: "ready" };
  assert.equal(sceneReceiptMatches(receipt, current, "/profile", "profile"), true);
  assert.equal(sceneReceiptMatches(receipt, current, "/profile", "reduced"), false);
  assert.equal(sceneReceiptMatches(receipt, scenePreviewToken("config", id, "profile", 4), "/profile", "profile"), false);
  assert.equal(sceneReceiptMatches(receipt, current, "/still", "profile"), false);
  assert.equal(sceneReceiptMatches({ ...receipt, decoded: false }, current, "/profile", "profile"), false);
  assert.equal(sceneReceiptMatches({ ...receipt, state: "unavailable" }, current, "/profile", "profile"), false);
  assert.equal(sceneReceiptMatches(undefined, current, "/profile", "profile"), false);
});
'''),
])
edit('app/studio/studio-scene-preview.ts', None, [
    (0, 0, r'''import { MAX_SCENE_PREVIEW_BYTES, SCENE_METADATA_HEADER, parseSceneResponseMetadata, type SceneResponseMetadata } from "@/lib/scene-metadata";

export type ScenePreviewView = "profile" | "reduced" | "frame-zero";
export type ScenePreviewState = "ready" | "unavailable" | "stale" | "unverified";
export interface SceneImageReceipt {
  readonly token: string;
  readonly view: ScenePreviewView;
  readonly sourceUrl: string;
  readonly decoded: boolean;
  readonly state: ScenePreviewState;
}
export function scenePreviewToken(configuration: string, id: string, view: ScenePreviewView, revision: number): string {
  return JSON.stringify([configuration, id, view, revision]);
}
export function sceneReceiptMatches(receipt: SceneImageReceipt | undefined, token: string, sourceUrl: string, view: ScenePreviewView): boolean {
  return view === "profile" && receipt?.decoded === true && receipt.state === "ready" && receipt.token === token && receipt.sourceUrl === sourceUrl;
}

/** One bounded response becomes the exact Blob loaded by the image. Fetch completion is not decode proof. */
export async function readStudioScenePreview(response: Response, scene: string, signal?: AbortSignal): Promise<{
  readonly blob: Blob; readonly metadata: SceneResponseMetadata | null; readonly state: ScenePreviewState;
}> {
  signal?.throwIfAborted();
  if (response.status !== 200 || !/^image\/svg\+xml(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !response.body) {
    await response.body?.cancel(); throw new Error("Scene preview did not return an SVG image");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_SCENE_PREVIEW_BYTES) { await reader.cancel(); throw new Error("Scene preview exceeds the byte limit"); }
      chunks.push(value);
    }
  } finally { signal?.removeEventListener("abort", abort); reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("Scene SVG is not valid UTF-8"); }
  // The server validates scene XML; this boundary also rejects wrong documents before image loading.
  if (!/^<svg\s/i.test(text) || !/<\/svg>\s*$/i.test(text) || /<(?:script|foreignObject|iframe)\b/i.test(text)) throw new Error("Scene response is not an SVG preview");
  const blob = new Blob([bytes], { type: "image/svg+xml" });
  const stale = response.headers.get("x-commitatlas-data-state") === "stale" || /^<svg\b[^>]*\bdata-commitatlas-state="stale"/i.test(text);
  if (stale) return { blob, metadata: null, state: "stale" };
  const header = response.headers.get(SCENE_METADATA_HEADER);
  if (!header) return { blob, metadata: null, state: "unverified" };
  const metadata = parseSceneResponseMetadata(header, scene, bytes.length);
  return { blob, metadata, state: metadata.unavailable ? "unavailable" : "ready" };
}
'''),
])
edit('app/studio/studio-urls.test.ts', '57b023cfca139d595e264068601d4a9a447e9b2c', [
    (3, 3, r'''import { parseSvgSceneQuery } from "@/lib/svg-routes";
import { listScenes } from "@/packages/svg/src/index";
'''),
    (6, 6, r'''  buildStudioSceneUrl,
'''),
    (9, 9, r'''  STUDIO_SCENE_IDS,
  STUDIO_SCENE_PACKS,
  STUDIO_SCENE_SUPPORTED_PACKS,
'''),
    (239, 239, r'''
test("lists exactly the hosted instrument and map scenes", () => {
  const hosted = listScenes()
    .filter((scene) => scene.family === "instrument" || scene.family === "map")
    .map((scene) => scene.id);
  assert.deepEqual([...STUDIO_SCENE_IDS], hosted);
  for (const id of STUDIO_SCENE_IDS) {
    const scene = listScenes().find((item) => item.id === id);
    assert.ok(scene);
    assert.deepEqual([...STUDIO_SCENE_SUPPORTED_PACKS[id]], [...scene.supportedPacks]);
  }
});

test("scene preview URLs are the route canonical query", () => {
  assert.deepEqual([...STUDIO_SCENE_PACKS], ["survey", "orbital", "spectral", "terminal"]);
  const defaults = buildStudioSceneUrl("evidence-coverage", {
    owner: "octocat",
    theme: "aurora",
    demo: true,
    days: 365,
    motion: "none",
    layout: "wide",
    pack: "survey",
  });
  assert.equal(defaults, "/api/v1/scenes/evidence-coverage.svg?user=octocat&demo=true");
  const selected = buildStudioSceneUrl("evidence-coverage", {
    owner: "octocat",
    theme: "ember",
    demo: true,
    days: 365,
    motion: "ambient",
    layout: "compact",
    pack: "orbital",
    projects,
  });
  const parsed = new URL(`https://example.test${selected}`);
  assert.equal(parsed.pathname, "/api/v1/scenes/evidence-coverage.svg");
  assert.equal(parsed.searchParams.get("pack"), "orbital");
  assert.equal(parsed.searchParams.get("motion"), "ambient");
  assert.equal(parsed.searchParams.get("layout"), "compact");
  assert.equal(parsed.searchParams.has("days"), false);
  const query = parseSvgSceneQuery(parsed.searchParams);
  assert.equal(query.canonical, parsed.search.slice(1));
  assert.equal(query.pack, "orbital");
  assert.throws(() => buildStudioSceneUrl("not-a-scene", {
    owner: "octocat", theme: "ember", demo: true,
  }), /unknown studio scene/);
});

test("pack and scene selection change the preview configuration key", () => {
  const baseline = { owner: "octocat", theme: "ember", demo: true };
  const key = buildStudioConfigurationKey(baseline);
  assert.equal(key, buildStudioConfigurationKey({ ...baseline, pack: "survey", scenes: [] }));
  assert.notEqual(key, buildStudioConfigurationKey({ ...baseline, pack: "orbital" }));
  assert.notEqual(key, buildStudioConfigurationKey({ ...baseline, scenes: ["evidence-coverage"] }));
});
'''),
])
edit('app/studio/studio-urls.ts', 'd26a7ad45bcf6c1da26bc6ceb328a4b562fe3e8c', [
    (16, 17, r'''import type { HostedMotionProfile, ScenePack } from "@/packages/svg/src/index";
'''),
    (23, 23, r'''
/** Closed pack enum the hosted scene route accepts. Survey is the canonical default. */
export const STUDIO_SCENE_PACKS = ["survey", "orbital", "spectral", "terminal"] as const;

/** The public allowlist is shared without importing renderers into the browser. */
export { HOSTED_SCENE_IDS as STUDIO_SCENE_IDS, HOSTED_SCENE_LABELS as STUDIO_SCENE_LABELS,
  HOSTED_SCENE_PACKS as STUDIO_SCENE_SUPPORTED_PACKS } from "@/lib/hosted-scene-catalog";
import { HOSTED_SCENE_IDS as STUDIO_SCENE_IDS } from "@/lib/hosted-scene-catalog";
'''),
    (32, 32, r'''  pack?: ScenePack;
  scenes?: readonly string[];
'''),
    (42, 42, r'''    pack: options.pack ?? "survey",
    scenes: [...(options.scenes ?? [])].sort(),
'''),
    (137, 137, r'''
/** Canonical scene URL. Defaults the route omits stay omitted so the preview does not redirect. */
export function buildStudioSceneUrl(id: string, options: StudioRouteOptions): string {
  if (!(STUDIO_SCENE_IDS as readonly string[]).includes(id)) throw new Error(`unknown studio scene: ${id}`);
  const query = new URLSearchParams();
  const owner = options.owner.trim();
  const projects = (options.projects ?? [])
    .map((project) => ({
      repo: project.repo.trim(),
      lifecycle: project.lifecycle,
      workflow: project.workflow?.trim() ?? "",
    }))
    .filter((project) => project.repo);
  query.set("user", owner);
  if (projects.length > 0) {
    query.set("repos", projects.map((project) => project.repo).join(","));
    query.set("states", projects.map((project) => `${project.repo}:${project.lifecycle}`).join(","));
    const workflows = projects
      .filter((project) => project.workflow)
      .map((project) => `${project.repo}:${encodeWorkflowMapComponent(project.workflow)}`);
    if (workflows.length > 0) query.set("workflows", workflows.join(","));
  }
  query.set("demo", String(options.demo));
  if (options.theme !== "aurora") query.set("theme", options.theme);
  if (options.days !== undefined && options.days !== 365) query.set("days", String(options.days));
  if ((options.motion ?? "none") !== "none") query.set("motion", options.motion ?? "none");
  if ((options.layout ?? "wide") !== "wide") query.set("layout", options.layout ?? "wide");
  if ((options.pack ?? "survey") !== "survey") query.set("pack", options.pack ?? "survey");
  return `/api/v1/scenes/${id}.svg?${query.toString()}`;
}
'''),
])
edit('docs/PRODUCT_DIRECTION.md', '32fdeadd10ca9b4b3b8ad6e1297437441c301016', [
    (30, 31, r'''- a live Studio with hosted SVG cards and scenes;
'''),
])
