import type { CiState } from "@commit-atlas/core";
import { CI_RACK_ORDER, CI_STATE_PRESENTATION, type CiReading } from "@/lib/health";
import { AcquisitionGauge, RackLamp, RackTrace } from "./instruments";
import { Ev } from "./evidence-ui";

/**
 * The CI state rack.
 *
 * Six equal bays, the three "we do not know" states first. This is a legend, not a scoreboard: it
 * teaches the vocabulary once so a reader recognises it everywhere else — on the cards, in the
 * Studio dashboard, and in the generated catalog. The live reading in the header says which of
 * these six states this page is actually in.
 *
 * Every bay is drawn so it survives greyscale: a distinct lamp shape, a distinct trace pattern, and
 * the state word printed in full. Colour is the fourth channel, never the first.
 */
export function HealthRack({ reading }: { reading: CiReading }) {
  return (
    <section className="section shell" id="health" aria-labelledby="health-title">
      <p className="numeral">04 // Portfolio signals · CI state rack</p>
      <div className="section-head">
        <h2 id="health-title">
          A dark gauge is a finding, <em>not a failure of the page.</em>
        </h2>
        <p className="section-aside">
          {/* The trigger wraps the ratio alone, so the drawer's title echoes what was pressed
              rather than a prefix of a longer line. */}
          Live synthetic reading: <b><Ev id="ci-passing">{reading.passing}/{reading.total}</Ev> CI passing · {reading.attention} attention{reading.unknown > 0 ? ` · ${reading.unknown} unknown` : ""}</b>
          <br />
          72h freshness window · calculateCiState()
        </p>
      </div>
      <p className="section-lede">
        Every state gets a distinct lamp shape, a distinct trace, and a printed word — colour is
        never the only encoding. The three &ldquo;we do not know&rdquo; states are deliberately the
        most visually interesting bays in the rack.
      </p>

      <div className="rack">
        {CI_RACK_ORDER.map((state) => (
          <RackBay key={state} state={state} count={reading.counts[state]} />
        ))}
      </div>

      <div className="acquisition">
        <AcquisitionGauge />
        <div className="acquisition-body">
          <div className="acquisition-head">
            <span>M7 // Acquisition sequence — how a gauge fails honestly</span>
            <span className="ref">M7</span>
          </div>
          <p>
            On load, an <b>unavailable</b> gauge does not snap to an error badge — the needle hunts:
            it rises toward a reading, stutters twice, falls back to the −90° rest stop, and the lamp
            never lights. The plate reads NO SIGNAL from frame zero, so the motion adds theatre,
            never information.
          </p>
          <p className="acquisition-spec">
            5.5s cycle · cubic-bezier(.4,0,.3,1) · transform-only · reduced motion: needle rests at −90°, plate unchanged
          </p>
        </div>
      </div>

      <div className="section-foot">
        <span>Six shapes: plate · socket · frozen clock · disc · diamond · half-disc — legible in greyscale</span>
        <span>An unknown, missing, or stale signal is never displayed as healthy</span>
      </div>
    </section>
  );
}

function RackBay({ state, count }: { state: CiState; count: number }) {
  const presentation = CI_STATE_PRESENTATION[state];
  return (
    <article className="rack-bay" data-state={state}>
      <div className="rack-head">
        <span>{presentation.word}</span>
        {/* `—` rather than `×0`: this bay is documenting a state nothing is currently in, which is
            different from having counted zero of something that was measured. */}
        <span>{count > 0 ? `×${count}` : "—"}</span>
      </div>
      <div className="lamp-zone">
        <RackLamp state={state} />
      </div>
      <RackTrace state={state} />
      <p className="rack-desc">
        {presentation.description.map((line, index) => (
          <span key={line}>
            {index === 2 ? <b>{line}</b> : line}
            {index < 2 ? <br /> : null}
          </span>
        ))}
      </p>
    </article>
  );
}
