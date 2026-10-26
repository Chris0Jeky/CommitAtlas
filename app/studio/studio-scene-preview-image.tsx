"use client";

import { useState } from "react";
import type { ScenePack } from "@/packages/svg/src/index";
import { isHostedSceneId, HOSTED_SCENE_PACKS } from "@/lib/hosted-scene-catalog";
import { readStudioScenePreview, type SceneImageReceipt, type ScenePreviewView } from "./studio-scene-preview";

import { useStudioSvgPreview, StudioImageTools } from "./studio-svg-preview";
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
  return <article className="studio-card-preview span-full card-scene" data-scene-preview={props.id}>
    <header><div><h4>{props.title}</h4><p>{view === "profile" ? "Profile view" : view === "reduced" ? "Reduced-motion still twin" : "Frame-zero still twin"}</p></div></header>
    <StudioImageTools title={props.title} view={view} choose={choose} />
    {/* Keep the controls mounted while a new keyed response invalidates and reloads its receipt. */}
    <SceneImage {...props} view={view} key={JSON.stringify([props.token, view, attempt])} />
  </article>;
}
function SceneImage({ id, title, pack, url, stillUrl, view, token, onRendered }: Props) {
  const supported = isHostedSceneId(id) && (HOSTED_SCENE_PACKS[id] as readonly string[]).includes(pack);
  const { resource, decoded, failed } = useStudioSvgPreview({ id, url, stillUrl, view, token, onRendered }, readStudioScenePreview, supported);
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
    <div className="studio-preview-resource">
      <div className="card-preview-media" aria-busy={supported && !decoded && !failed}>
        {supported && !decoded && <div className="preview-media-placeholder" aria-hidden="true"><span>{failed ? "Preview unavailable" : "Preparing preview"}</span></div>}
        {!supported ? <p>UNAVAILABLE. This scene does not support the {pack} pack.</p>
          : resource && !failed ? (
            // Display precisely the response that supplied the counters, not a second live request.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resource.objectUrl} alt={`CommitAtlas ${title} preview`}
              onLoad={resource.onLoad} onError={resource.onError} />
          ) : null}
      </div>
      <div className="preview-readout">
        {supported && <p className="scene-preview-status" role="status">{note}</p>}
        <dl className="scene-motion-counters" aria-label="Renderer counters for the loaded image">
          <div><dt>Bytes</dt><dd>{reading(counters?.bytes)}</dd></div>
          <div><dt>Animated elements</dt><dd>{reading(counters?.animatedElements)}</dd></div>
          <div><dt>Looping groups</dt><dd>{reading(counters?.loopingGroups)}</dd></div>
        </dl>
      </div>
    </div>
  );
}
