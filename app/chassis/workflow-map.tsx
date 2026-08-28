import Link from "next/link";
import { SOURCE_REPOSITORY } from "@/lib/site";

const EXAMPLE_PROFILE = "https://github.com/Chris0Jeky";

/** A concise map of the shipped paths from public evidence to a usable embed. */
export function WorkflowMap({ compact = false }: { compact?: boolean }) {
  const titleId = compact ? "studio-workflow-title" : "workflow-title";

  return (
    <section className={`workflow-map shell${compact ? " workflow-map-compact" : ""}`} id={compact ? undefined : "workflow"} aria-labelledby={titleId}>
      <p className="numeral">{compact ? "00 // The path to an embed" : "02 // From evidence to embed"}</p>
      <div className="section-head">
        <h2 id={titleId}>One source. <em>Several useful exits.</em></h2>
        <p className="section-aside">Preview, generate, embed<br />No publishing service implied</p>
      </div>
      <p className="workflow-lede">
        Start with a preview, then choose the distribution surface that fits the place your work has to live.
        Each path keeps the source and its limits visible.
      </p>
      <ol className="workflow-steps">
        <li>
          <span className="workflow-step-number">01</span>
          <div>
            <h3>Preview the evidence</h3>
            <p>Use synthetic data to explore safely, or enter a GitHub handle for a public-only preview.</p>
            <Link href="/studio">Open Studio <span aria-hidden="true">→</span></Link>
          </div>
        </li>
        <li>
          <span className="workflow-step-number">02</span>
          <div>
            <h3>Take the hosted exit</h3>
            <p>Use an eight-route SVG URL or copy the Studio&apos;s HTTPS Markdown after a validated preview.</p>
            <a href="/api/v1/cards/atlas.svg?user=octocat&demo=true&theme=ember&days=365&motion=none">Open Atlas SVG example <span aria-hidden="true">↗</span></a>
          </div>
        </li>
        <li>
          <span className="workflow-step-number">03</span>
          <div>
            <h3>Generate the static exit</h3>
            <p>The static CLI or pinned Action fetches once, stages the selected ten cards, and writes a byte/SHA-256 manifest.</p>
            <span className="workflow-links">
              <a href={`${SOURCE_REPOSITORY}/tree/main/packages/static`}>Static CLI <span aria-hidden="true">↗</span></a>
              <a href={`${SOURCE_REPOSITORY}/blob/main/action.yml`}>Pinned Action <span aria-hidden="true">↗</span></a>
            </span>
          </div>
        </li>
        <li>
          <span className="workflow-step-number">04</span>
          <div>
            <h3>Embed the committed output</h3>
            <p>Commit the generated artifacts to a profile README or site. The <code>manifest.json</code> records what was actually written.</p>
            <a href={EXAMPLE_PROFILE}>See an example profile <span aria-hidden="true">↗</span></a>
          </div>
        </li>
      </ol>
      <div className="workflow-boundary">
        <p><strong>Hosted:</strong> 8 SVG routes and Studio previews. <strong>Static:</strong> 10 card types, including <em>Cadence</em> and <em>Releases</em>, which are static-only.</p>
        <p className="workflow-boundary-note">The design lab below is optional: it explains evidence, freshness, and state vocabulary on this page; it is not an export, monitoring service, or extra card.</p>
      </div>
    </section>
  );
}
