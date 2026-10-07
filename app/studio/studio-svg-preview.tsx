"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import type { SceneImageReceipt, ScenePreviewState, ScenePreviewView } from "./studio-scene-preview";

interface Loaded<T> { readonly blob: Blob; readonly metadata: T | null; readonly state: ScenePreviewState }
interface ImageResource<T> extends Loaded<T> {
  readonly objectUrl: string;
  readonly onLoad: (event: SyntheticEvent<HTMLImageElement>) => void;
  readonly onError: () => void;
}
export interface PreviewIdentity {
  id: string; url: string; stillUrl: string; view: ScenePreviewView; token: string;
  onRendered: (id: string, token: string, receipt: SceneImageReceipt | null) => void;
}
/** The containing image is keyed by configuration/view/attempt. No observer or background refresh. */
export function useStudioSvgPreview<T>(identity: PreviewIdentity, loader: (response: Response, id: string, signal?: AbortSignal) => Promise<Loaded<T>>, enabled = true) {
  const { id, url, stillUrl, view, token, onRendered } = identity;
  const shown = view === "profile" ? url : stillUrl;
  const [resource, setResource] = useState<ImageResource<T> | null>(null);
  const [decoded, setDecoded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Effect-local ownership also protects a StrictMode setup/cleanup/setup sequence.
    let active = true;
    let accepting = true;
    let objectUrl: string | undefined;
    const controller = new AbortController();
    const reject = () => {
      if (!active || !accepting) return;
      accepting = false;
      setFailed(true); setDecoded(false); onRendered(id, token, null);
    };
    onRendered(id, token, null);
    const timeout = enabled ? setTimeout(() => { reject(); controller.abort(); }, 12_000) : undefined;
    if (enabled) void fetch(shown, { signal: controller.signal, redirect: "error", cache: "no-cache" })
      .then(response => loader(response, id, controller.signal))
      .then(result => {
        if (!active || !accepting || controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(result.blob);
        setResource({ ...result, objectUrl,
          onLoad(event) {
            if (!active || !accepting) return;
            const image = event.currentTarget;
            if (image.currentSrc !== objectUrl || !(image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth <= 4096 && image.naturalHeight <= 4096)) {
              reject(); clearTimeout(timeout); return;
            }
            accepting = false; clearTimeout(timeout); setDecoded(true);
            onRendered(id, token, { token, view, sourceUrl: shown, decoded: true, state: result.state });
          },
          onError() { reject(); clearTimeout(timeout); },
        });
      })
      .catch(() => { reject(); clearTimeout(timeout); });
    return () => {
      active = false; accepting = false;
      controller.abort(); clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      onRendered(id, token, null);
    };
  }, [enabled, id, loader, onRendered, shown, token, view]);
  return { resource, decoded, failed };
}

export function StudioImageTools({ title, view, choose }: {
  title: string; view: ScenePreviewView; choose: (view: ScenePreviewView) => void;
}) {
  return <div className="scene-image-tools" role="group" aria-label={`${title} preview tools`}>
    <button type="button" onClick={() => choose("profile")} aria-pressed={view === "profile"}>Profile view</button>
    <button type="button" onClick={() => choose("profile")}>Replay</button>
    <button type="button" onClick={() => choose("reduced")} aria-pressed={view === "reduced"}>Reduced-motion view</button>
    <button type="button" onClick={() => choose("frame-zero")} aria-pressed={view === "frame-zero"}>Frame zero</button>
  </div>;
}
