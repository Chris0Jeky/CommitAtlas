import { EVIDENCE_TIER_PRESENTATION, evidenceLadder, type EvidenceSet } from "@/lib/evidence";
import { LANDING_EVIDENCE_IDS } from "@/lib/landing";
import { Ev } from "./evidence-ui";

/**
 * The evidence layer.
 *
 * The ladder on the left is the legend: three rungs, each shown with a real reading from this
 * page's own snapshot. The panel on the right is the instruction — every number on this page is a
 * button, and pressing one opens the drawer that answers how it is known.
 *
 * The rung is encoded three ways: the word, the dot fill, and the border style. It survives
 * greyscale for the same reason the CI rack does, and for the same reason.
 */
export function EvidenceLayer({ evidence }: { evidence: EvidenceSet }) {
  const ladder = evidenceLadder(evidence);
  const demo = evidence.byId.rhythm;

  return (
    <section className="section shell" id="evidence" aria-labelledby="evidence-title">
      <p className="numeral">05 // Evidence layer · observed → derived → hypothesis</p>
      <div className="section-head">
        <h2 id="evidence-title">
          Facts become rates. <em>Rates become guesses.</em>
        </h2>
        <p className="section-aside">
          {/* One interpolation, not a number beside a text node: React separates adjacent text
              nodes with a comment during SSR, which splits the sentence in the served HTML. */}
          {`${LANDING_EVIDENCE_IDS.length} readings explained on this page`}
          <br />
          Every dotted number opens the drawer
        </p>
      </div>
      <p className="section-lede">
        Every reading sits on one of three rungs, and every dotted number on screen answers
        &ldquo;how do you know that&rdquo;. CommitAtlas already refuses to paint an unknown signal
        green; this is the same rule one level up, applied to the difference between a number that
        was counted and a number that was inferred.
      </p>

      <div className="evidence-grid">
        <div className="ladder">
          <span className="ladder-spine" aria-hidden="true" />
          {ladder.map((record) => {
            const tier = EVIDENCE_TIER_PRESENTATION[record.tier];
            return (
              <article className="rung" data-tier={record.tier} key={record.id}>
                <span className="rung-dot" aria-hidden="true" />
                <div className="rung-head">
                  <span>Order {tier.order} · {tier.word} {tier.glyph}</span>
                  <span>{tier.claim}</span>
                </div>
                <p className="rung-claim">
                  <Ev id={record.id}>{record.value}</Ev> {record.label}
                </p>
                <p className="rung-rule">Rule: {record.rule}</p>
              </article>
            );
          })}
          <p className="ladder-note">
            Rung is encoded three ways: word · dot (solid / half / dashed) · border style.
            <br />
            Every reading sorts onto these three rungs — never a fourth.
          </p>
        </div>

        <div className="evidence-demo">
          <p className="evidence-demo-head">
            <span>Closed — every number is a button:</span>
            {demo ? <span className="rung-claim" style={{ margin: 0 }}><Ev id="rhythm">{demo.value}</Ev> {demo.label}</span> : null}
            <span className="cue">Press any dotted number: &ldquo;how do you know that?&rdquo;</span>
          </p>
          <div className="evidence-panel">
            <h3>What the drawer shows</h3>
            <p>
              One shared drawer rather than a popover per number: there is only ever one question
              being asked, and a single dialog is the only version of this that stays navigable by
              keyboard.
            </p>
            <dl>
              <dt>BASIS</dt>
              <dd>Where the number came from, naming the window and the source.</dd>
              <dt>FORMULA</dt>
              <dd>Printed in mono for every derived and hypothesis reading. An observed value has none to show, and shows none.</dd>
              <dt>CAVEAT</dt>
              <dd>What the number cannot see. Never omitted, never softened.</dd>
            </dl>
          </div>
          <p className="ladder-note">
            M8 — drawer: slides up 12px and settles · 260ms · cubic-bezier(.2,.9,.3,1) · ESC or click
            outside to close · reduced motion: appears in place, fully drawn.
          </p>
        </div>
      </div>

      <div className="section-foot">
        <span>{evidence.coverage}</span>
        <span>Source: {evidence.sourceLabel}</span>
      </div>
    </section>
  );
}
