import type { PortfolioSnapshot } from "@/lib/github/types";
import {
  CARD_THEMES,
  landingCardUrl,
  landingCompactAtlasUrl,
  landingThemedAtlasUrl,
  specimenCards,
} from "@/lib/landing";

/**
 * The specimen tray.
 *
 * Plates, not cards: the page frames, and the SVG inside is the untouched specimen. Nothing here
 * restyles a card — the chassis owns the frame, the crop marks, and the beam, and the card owns
 * everything inside its own viewBox. That separation is what lets the same file be pasted into a
 * README and look identical there.
 *
 * Every image is a real response from the same route a README would embed, rendered from the
 * deterministic synthetic snapshot. No GitHub request is made to draw this section.
 */
export function SpecimenTray({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const flagship = landingCardUrl("atlas");
  const cards = specimenCards(snapshot);

  return (
    <section className="section shell" id="cards" aria-labelledby="cards-title">
      <p className="numeral">02 // Specimen tray · 8 live SVG routes</p>
      <div className="section-head">
        <h2 id="cards-title">See the whole toolkit.</h2>
        <p className="section-aside">
          Every preview is a real SVG response
          <br />
          Safe, deterministic octocat data · No GitHub calls are made to render this page
        </p>
      </div>

      <div className="flagship">
        <span className="crop crop-tl" aria-hidden="true" />
        <span className="crop crop-tr" aria-hidden="true" />
        <span className="crop crop-bl" aria-hidden="true" />
        <span className="crop crop-br" aria-hidden="true" />
        <div className="flagship-media">
          <a href={flagship} aria-label="Open the synthetic Developer atlas SVG">
            {/* A dynamic SVG endpoint already returns the exact vector asset; routing it through the
                image optimiser would proxy a file that is smaller than the request to fetch it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flagship} width={860} height={380} alt="Synthetic demo: Developer atlas for octocat" fetchPriority="high" />
          </a>
          <span className="m6-beam" aria-hidden="true" />
        </div>
        <div className="flagship-meta">
          <div>
            <h3 className="flagship-head">
              <span>CARD 00 {"//"} ATLAS · FLAGSHIP</span>
              <span className="ref">M6</span>
            </h3>
            <p className="spec-rows">
              ROUTE &nbsp;<b>/api/v1/cards/atlas.svg</b>
              <br />
              SIZE &nbsp;&nbsp;<b>860×380 fixed · &lt;30 KiB</b>
              <br />
              LIMITS <b>No script · No foreignObject · No external refs</b>
              <br />
              MOTION <b>none | subtle (transform-only)</b>
            </p>
          </div>
          <p className="flagship-caveat">
            Caveat printed on every atlas: longest streak is window-bounded · rhythm is not a GitHub rank
            <br />
            <b>M6 — survey beam:</b> a 70px gradient sweeps the plate left to right, 7s, linear, infinite. The card beneath never moves.
          </p>
        </div>
      </div>

      <div className="tray">
        {cards.map((card) => {
          const url = card.compact ? landingCompactAtlasUrl() : landingCardUrl(card.kind);
          return (
            <article
              className={card.compact ? "specimen specimen--tall" : "specimen"}
              key={card.number}
              id={card.kind === "projects" ? "projects" : undefined}
            >
              <h3 className="specimen-head">
                <span>{card.number} {"//"} {card.name}</span>
                <span>{card.size}</span>
              </h3>
              <a className="specimen-media" href={url} aria-label={`Open the synthetic ${card.title} SVG`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  width={card.width}
                  height={card.height}
                  alt={`Synthetic demo: ${card.title} for octocat`}
                  loading="lazy"
                />
              </a>
              <p className="specimen-purpose">{card.purpose}</p>
              <div className="specimen-foot">
                <span>{card.note}</span>
                {/* Eight of these otherwise resolve to the identical name "Open SVG". Same name and
                    same destination as the plate's image link, which is what keeps them distinct
                    from each other rather than from their sibling. */}
                <a href={url} aria-label={`Open the synthetic ${card.title} SVG`}>Open SVG <span aria-hidden="true">↗</span></a>
              </div>
            </article>
          );
        })}
      </div>

      <p className="numeral" style={{ marginTop: 26 }}>03 // Atlas × 4 card themes — paper ships for light READMEs</p>
      <div className="filmstrip">
        {CARD_THEMES.map((theme) => (
          <figure key={theme.id} className={theme.light ? "film-light" : theme.id === "ember" ? "film-ember" : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={landingThemedAtlasUrl(theme.id)}
              width={860}
              height={380}
              alt={`Synthetic demo: Developer atlas in the ${theme.id} card theme`}
              loading="lazy"
            />
            <figcaption>{theme.label}</figcaption>
          </figure>
        ))}
      </div>

      <div className="section-foot">
        <span>Hover: the plate lifts 3px · crop marks brighten · transform-only, 180ms ease</span>
        <span>Plates, not cards: the page frames; the SVG is the untouched specimen</span>
      </div>
    </section>
  );
}
