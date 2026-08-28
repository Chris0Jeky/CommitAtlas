import {
  developerLensMethodTrialSummary as summary,
  DEVELOPER_LENS_PRODUCER_COMMIT,
} from "@/lib/research-bridge";

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function decimal(value: number) {
  return String(Number(value.toFixed(2)));
}

export function ResearchBridge() {
  const detection = summary.metrics.detection_rate;
  const falseAlerts = summary.metrics.false_alerts_per_year;

  return (
    <section className="research-bridge shell" aria-labelledby="research-bridge-title">
      <div className="research-bridge-head">
        <div>
          <p className="numeral">05 // Research bridge · C0 invented evidence</p>
          <h2 id="research-bridge-title">The baseline won. <em>That is the finding.</em></h2>
        </div>
        <span className="research-bridge-status">Decision · reject BOCPD</span>
      </div>

      <p className="research-bridge-lede">
        An offline method trial compared {summary.methods.candidate.display_name} with the retained {summary.methods.baseline.display_name} baseline.
        The evidence is an invented C0 weekly system series — not GitHub profile evidence and not production monitoring.
      </p>

      <div className="research-bridge-metrics" aria-label="Method trial headline results">
        <div>
          <span>Detection · baseline / candidate</span>
          <strong>{percentage(detection.baseline.value)} / {percentage(detection.candidate.value)}</strong>
          <small>Equal measured detection</small>
        </div>
        <div>
          <span>False alerts / year · baseline / candidate</span>
          <strong>{decimal(falseAlerts.baseline.value)} / {decimal(falseAlerts.candidate.value)}</strong>
          <small>Lower is better; candidate is higher</small>
        </div>
        <div>
          <span>Threshold viability</span>
          <strong>Both nonviable</strong>
          <small>Neither selection cleared its gate</small>
        </div>
      </div>

      <div className="research-bridge-outcome">
        <p><strong>{summary.trial.verdict_summary}</strong> {summary.methods.baseline.display_name} stays as the retained fallback.</p>
        <a href={summary.provenance.public_url}>Open the public method trial <span aria-hidden="true">↗</span></a>
      </div>

      <div className="research-bridge-boundary">
        <p><strong>Read this as research, not a product signal.</strong> It does not establish real-repository validity, support person-level inference, promote a model, or establish online PELT performance.</p>
        <p className="research-bridge-provenance">Pinned from Developer Lens producer commit <code>{DEVELOPER_LENS_PRODUCER_COMMIT.slice(0, 12)}</code> · run {summary.provenance.run_id} · no runtime fetch</p>
      </div>
    </section>
  );
}
