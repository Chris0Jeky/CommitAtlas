import Link from "next/link";
import type { Metadata } from "next";
import { StructuredData } from "./structured-data";
import { ChassisFooter, ConsoleHeader, LANDING_LINKS } from "./chassis/console";
import { DensitySurvey, MomentumPlotter, PortfolioReticle, RhythmGauge } from "./chassis/instruments";
import { EvidenceProvider, Ev } from "./chassis/evidence-ui";
import { EvidenceLayer } from "./chassis/evidence-layer";
import { HealthRack } from "./chassis/health-rack";
import { SpecimenTray } from "./chassis/specimen-tray";
import { buildEvidence } from "@/lib/evidence";
import { summariseCiStates } from "@/lib/health";
import { compactCount, signedPercent } from "@/lib/instruments";
import { LANDING_DAYS, landingSnapshot } from "@/lib/landing";
import { PAGE_ROBOTS, SOURCE_REPOSITORY } from "@/lib/site";

// Only the indexing directive. Title, description, canonical, and the social cards all come from
// the root layout, which already describes this page.
export const metadata: Metadata = { robots: PAGE_ROBOTS };

/**
 * The landing page is the product measuring itself.
 *
 * Every number in the instrument fascia, the health rack, and the evidence drawer comes out of one
 * `landingSnapshot()` call — the same `fetchPortfolioSnapshot` the SVG routes use, in demo mode. No
 * value on this page is typed in, and none of it costs a GitHub request, so the front page cannot
 * be taken down by a rate limit and cannot drift away from what the routes actually render.
 */
export default async function Home() {
  const snapshot = await landingSnapshot();
  const { metrics, profile } = snapshot;
  const evidence = buildEvidence(snapshot);
  const states = (snapshot.projects?.projects ?? []).map((project) => project.ci.state);
  const reading = summariseCiStates(states);
  const change = signedPercent(metrics.trend.changePercent);
  const recentCounts = metrics.trend.buckets.length > 0
    ? snapshot.contributions.days.slice(-28).map((day) => day.count)
    : [];

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="survey" aria-hidden="true" />
      <StructuredData />
      <ConsoleHeader section="Observatory" reference="ATL/CH-REV-B" links={LANDING_LINKS} />

      <EvidenceProvider evidence={evidence}>
        <main id="main" tabIndex={-1}>
          <section className="hero shell" aria-labelledby="hero-title">
            <span className="watermark" aria-hidden="true">01//</span>
            <div className="hero-copy">
              <p className="eyebrow"><span aria-hidden="true" /> 00 // One open-source instrument for the whole trail</p>
              <h1 id="hero-title">
                Your GitHub work,<br />
                <em>mapped clearly.</em>
              </h1>
              <p className="lede">
                CommitAtlas renders the trail as embeddable evidence: eight accessible SVG cards, a
                project-health dashboard that never paints an unknown signal green, and a
                credential-free generator that produces the same files offline. Every reading below
                is live from the same routes a README can embed.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/studio">Build your atlas <span aria-hidden="true">→</span></Link>
                <a className="button button-secondary" href="#cards">Explore the system</a>
              </div>
            </div>
          </section>

          <div className="shell">
            {/* ── Instrument fascia ─────────────────────────────────────────── */}
            <div className="fascia cut">
              <span className="hazard" aria-hidden="true" />
              <span className="screw screw-tl" aria-hidden="true" />
              <span className="screw screw-tr" aria-hidden="true" />
              <span className="screw screw-bl" aria-hidden="true" />
              <span className="screw screw-br" aria-hidden="true" />

              <div className="fascia-bays">
                <div className="bay">
                  <div className="bay-head">
                    <span className="bay-scope stn-a">01 // Momentum plotter · 28d</span>
                    <span className="ref">M1</span>
                  </div>
                  <MomentumPlotter
                    counts={recentCounts}
                    total={metrics.trend.recent28Days}
                    change={<Ev id="momentum-change">{change}</Ev>}
                    label={`28-day momentum trace: ${metrics.trend.recent28Days} contributions, ${change} against the prior 28 days.`}
                  />
                </div>

                <div className="bay">
                  <div className="bay-head">
                    <span className="bay-scope">02 // Rhythm · 0–100</span>
                    <span className="ref">M2</span>
                  </div>
                  <RhythmGauge score={metrics.rhythm.score} caption="Evenness · not a rank" />
                </div>

                <div className="bay">
                  <div className="bay-head">
                    <span className="bay-scope stn-a">03 // Density survey · {metrics.window.days}d</span>
                    <span className="ref">M3</span>
                  </div>
                  <DensitySurvey
                    days={snapshot.contributions.days}
                    density={metrics.density}
                    caption={<><Ev id="active-days">{metrics.activeDays}</Ev> active days · <Ev id="average-per-day">{metrics.averagePerDay}</Ev>/day</>}
                    label={`${metrics.window.days}-day contribution calendar: ${metrics.activeDays} active days out of ${metrics.window.days}.`}
                  />
                </div>

                <div className="bay">
                  <div className="bay-head">
                    <span className="bay-scope stn-b">04 // Portfolio reticle · CI</span>
                    <span className="ref">M4</span>
                  </div>
                  <PortfolioReticle
                    states={states}
                    passing={reading.passing}
                    caption="Unknown is never green"
                  />
                </div>
              </div>

              {/* The values above are printed as text, so this rail is the only purely
                  decorative element in the fascia. */}
              <div className="scale-rail">
                <span>Instrument scale</span>
                <div className="scale-bar" aria-hidden="true"><i /></div>
                <span className="scale-hinge">Hinge #FFD166 · lives in the cards</span>
                {/* Named the default theme on every theme, which was false on three of the four.
                    The rail's job is to show the scale; the label is rendered *in* the current
                    chrome, so it demonstrates the fact instead of asserting the wrong one. */}
                <span className="scale-chrome console-hide-sm">Chrome · per theme</span>
              </div>
            </div>

            {/* ── Station tiles ─────────────────────────────────────────────── */}
            <div className="stations">
              <section className="station station-a" aria-labelledby="station-a-title">
                <div className="station-head">
                  <span>STN A // Contribution signals</span>
                  <span>Distribution · R0</span>
                </div>
                <h2 id="station-a-title">
                  The trail, <em>counted honestly.</em>
                </h2>
                <div className="station-stats">
                  <div>
                    <b><Ev id="contributions">{compactCount(metrics.total)}</Ev></b>
                    <span>Contributions</span>
                  </div>
                  <div>
                    <b><Ev id="active-days">{metrics.activeDays}</Ev></b>
                    <span>Active days</span>
                  </div>
                  <div>
                    <b>
                      <Ev id="mix">
                        {compactCount(metrics.breakdown.commits)}<i>/</i>
                        {compactCount(metrics.breakdown.pullRequests)}<i>/</i>
                        {compactCount(metrics.breakdown.reviews)}<i>/</i>
                        {compactCount(metrics.breakdown.issues)}
                      </Ev>
                    </b>
                    <span>Cmt / PR / Rev / Iss</span>
                  </div>
                </div>
                <p className="station-foot">
                  {states.map((state, index) => (
                    // Derived from the same board the headline beside them is derived from. As
                    // literals they were a shape-encoded claim that could outlive the reading.
                    <span key={`${state}-${index}`} className="signal-mark" data-state={state} aria-hidden="true" />
                  ))}
                  {reading.headline} — shown dark, never green
                </p>
              </section>

              <section className="station station-b" aria-labelledby="station-b-title">
                <div className="station-head">
                  <span>STN B // Distribution surfaces</span>
                  <span>Four ways out · R12</span>
                </div>
                <h2 id="station-b-title">
                  The same evidence, <em>wherever it has to live.</em>
                </h2>
                <div className="station-stats">
                  <div>
                    <b>8</b>
                    <span>SVG routes</span>
                  </div>
                  <div>
                    <b>4</b>
                    <span>Card themes</span>
                  </div>
                  <div>
                    <b>0</b>
                    <span>Credentials required</span>
                  </div>
                </div>
                <div className="station-links">
                  <Link href="/studio">Studio</Link>
                  <a href={`${SOURCE_REPOSITORY}/tree/main/packages/static`}>Static CLI <span aria-hidden="true">↗</span></a>
                  <a href={`${SOURCE_REPOSITORY}/blob/main/action.yml`}>GitHub Action <span aria-hidden="true">↗</span></a>
                  <a href="/api/v1/health">Health JSON</a>
                </div>
                <p className="station-foot">Observed → derived → hypothesis · every number carries its caveat</p>
              </section>
            </div>

            <p className="trust-strip">
              <span>✓ Public by default &nbsp; ✓ Honest freshness &nbsp; ✓ Live or static</span>
              <span className="barcode" aria-hidden="true" />
              <span>Reduced motion: complete static page · nothing enters from invisible</span>
            </p>
          </div>

          <SpecimenTray snapshot={snapshot} />
          <HealthRack reading={reading} />
          <EvidenceLayer evidence={evidence} />

          <section className="cta shell" aria-labelledby="cta-title">
            <span className="hazard" aria-hidden="true" />
            <div>
              <p className="numeral">06 // Configure without guesswork</p>
              <h2 id="cta-title">One toolkit. <em>Every signal.</em></h2>
              <p>
                Choose live public data or a clearly marked synthetic preview, declare your own
                project lifecycles, then copy only the cards you want as README Markdown.
              </p>
            </div>
            <Link className="button button-primary" href="/studio">Open the Studio <span aria-hidden="true">→</span></Link>
          </section>
        </main>
      </EvidenceProvider>

      <ChassisFooter note={`Synthetic octocat · ${LANDING_DAYS}-day public window · @${profile.login}`} />
    </>
  );
}
