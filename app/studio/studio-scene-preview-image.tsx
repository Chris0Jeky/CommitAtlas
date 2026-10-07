"use client";

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
