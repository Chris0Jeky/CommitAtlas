import { CARD_METADATA_HEADER, parseCardResponseMetadata, type CardResponseMetadata } from "@/lib/card-metadata";
import { MAX_SCENE_PREVIEW_BYTES, SCENE_METADATA_HEADER, parseSceneResponseMetadata, type SceneResponseMetadata } from "@/lib/scene-metadata";

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
  return view === "profile" && receipt?.view === "profile" && receipt.decoded === true && receipt.state === "ready" && receipt.token === token && receipt.sourceUrl === sourceUrl;
}

/** Cards and scenes use separate closed receipts over the same bounded transport. */
export function readStudioScenePreview(response: Response, scene: string, signal?: AbortSignal) {
  return readStudioSvgPreview<SceneResponseMetadata>(response, scene, signal, SCENE_METADATA_HEADER,
    parseSceneResponseMetadata, metadata => metadata.unavailable ? "unavailable" : "ready");
}
export function readStudioCardPreview(response: Response, card: string, signal?: AbortSignal) {
  return readStudioSvgPreview<CardResponseMetadata>(response, card, signal, CARD_METADATA_HEADER,
    parseCardResponseMetadata, metadata => metadata.state === "partial" ? "ready" : metadata.state);
}

/** One bounded response becomes the exact Blob loaded by the image. Fetch is not decode proof. */
async function readStudioSvgPreview<T>(response: Response, id: string, signal: AbortSignal | undefined,
  metadataHeader: string, parse: (header: string, id: string, bytes: number) => T,
  stateOf: (metadata: T) => ScenePreviewState,
): Promise<{ readonly blob: Blob; readonly metadata: T | null; readonly state: ScenePreviewState }> {
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
  const header = response.headers.get(metadataHeader);
  if (!header) return { blob, metadata: null, state: "unverified" };
  const metadata = parse(header, id, bytes.length);
  return { blob, metadata, state: stateOf(metadata) };
}
