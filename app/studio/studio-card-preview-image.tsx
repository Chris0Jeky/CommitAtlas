"use client";
import { useState } from "react";
import type { StudioGalleryCard } from "./studio-presentation";
import { readStudioCardPreview } from "./studio-scene-preview";
import { useStudioSvgPreview, StudioImageTools, type PreviewIdentity } from "./studio-svg-preview";

interface Props extends Omit<PreviewIdentity, "id"> {
  card: StudioGalleryCard; login: string; source: string; retained: boolean;
}
export function StudioCardPreview(props: Props) {
  const { card, url, source, retained } = props;
  const [view, setView] = useState(props.view);
  const [attempt, setAttempt] = useState(0);
  function choose(next: typeof view) {
    props.onRendered(props.card.kind, props.token, null);
    setView(next); setAttempt(current => current + 1);
  }
  return <article className={`studio-card-preview span-${card.span} card-${card.kind}${card.compact ? " compact-card" : ""}`} data-card-preview={card.kind}>
    <header><div><h4>{card.title}</h4><p>{card.purpose}</p></div><span className="card-source-badge">{source}</span></header>
    <StudioImageTools title={card.title} view={view} choose={choose} />
    {/* Only the response lifecycle remounts. Keyboard focus stays on the original tool button. */}
    <CardImage {...props} view={view} key={JSON.stringify([props.token, view, attempt])} />
    <footer><span>{card.dimensions}{retained ? " · retained preview" : ""}</span>
      <a href={url} target="_blank" rel="noreferrer" aria-label={`Open card for ${card.title} in a new tab`}>Open card <span aria-hidden="true">↗</span></a>
    </footer>
  </article>;
}
function CardImage(props: Props) {
  const { card, login, view } = props;
  const { resource, decoded, failed } = useStudioSvgPreview({ ...props, id: card.kind }, readStudioCardPreview);
  const counters = decoded && !failed ? resource?.metadata : null;
  const reading = (value: number | undefined) => value === undefined ? "Unavailable" : String(value);
  const note = failed ? "UNAVAILABLE. The card image could not be validated and loaded."
    : !decoded ? "Loading the card image…"
      : resource?.state === "stale" ? "STALE SNAPSHOT. Card copying is unavailable."
        : resource?.state === "unverified" ? "Image loaded without a current renderer receipt. Card copying is unavailable."
          : resource?.state === "unavailable" ? "UNAVAILABLE. This image does not confirm the requested evidence."
            : view !== "profile" ? "Still twin loaded. Return to Profile view to validate and copy the selected motion profile."
              : "Image loaded. Renderer counters are not browser playback measurements.";
  return <div className="studio-preview-resource">
    <div className="card-preview-media" aria-busy={!decoded && !failed}>
      {!decoded && <div className="preview-media-placeholder" aria-hidden="true"><span>{failed ? "Preview unavailable" : "Preparing preview"}</span></div>}
      {resource && !failed && (
        // Render the exact selected layout and response; never approve an unseen responsive twin.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resource.objectUrl} alt={`CommitAtlas ${card.title.toLowerCase()} preview for @${login}`}
          onLoad={resource.onLoad} onError={resource.onError} />
      )}
    </div>
    <div className="preview-readout">
      <p className="scene-preview-status" role="status">{note}</p>
      {counters?.state === "partial" && <p className="scene-preview-status">PARTIAL SNAPSHOT. Only the image&apos;s disclosed evidence is available.</p>}
      <dl className="scene-motion-counters" aria-label="Renderer counters for the loaded image">
        <div><dt>Bytes</dt><dd>{reading(counters?.bytes)}</dd></div>
        <div><dt>Animated elements</dt><dd>{reading(counters?.animatedElements)}</dd></div>
        <div><dt>Looping groups</dt><dd>{reading(counters?.loopingGroups)}</dd></div>
      </dl>
      {counters && <p className="scene-preview-status">Cards currently use {counters.animatedElements ? "entrance-only motion" : "no motion"}; ambient does not add a loop.</p>}
    </div>
  </div>;
}
