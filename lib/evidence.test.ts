import assert from "node:assert/strict";
import test from "node:test";
import {
  EVIDENCE_TIERS,
  EVIDENCE_TIER_PRESENTATION,
  buildEvidence,
  evidenceLadder,
  formatUtcDate,
  formatUtcRange,
} from "./evidence";
import { landingSnapshot } from "./landing";
import type { PortfolioSnapshot } from "./github/types";

const snapshot = await landingSnapshot();
const evidence = buildEvidence(snapshot);

test("the synthetic window this page renders is the one the design was measured against", () => {
  // Every headline number on the landing page comes out of this snapshot. If the demo generator
  // drifts, the design's copy and the page stop agreeing — so pin the readings, not the prose.
  assert.equal(snapshot.metrics.total, 1_142);
  assert.equal(snapshot.metrics.activeDays, 284);
  assert.equal(snapshot.metrics.density, 77.8);
  assert.equal(snapshot.metrics.rhythm.score, 72);
  assert.equal(snapshot.metrics.rhythm.level, "strong");
  assert.equal(snapshot.metrics.trend.recent28Days, 88);
  assert.equal(snapshot.metrics.trend.changePercent, -1.1);
  assert.deepEqual(snapshot.metrics.breakdown, { commits: 731, pullRequests: 160, reviews: 194, issues: 57 });
  assert.equal(snapshot.freshness.mode, "demo");
});

test("every record names a tier from the ladder and nothing outside it", () => {
  assert.ok(evidence.records.length > 0);
  for (const record of evidence.records) {
    assert.ok(EVIDENCE_TIERS.includes(record.tier), `${record.id} claims an unknown tier: ${record.tier}`);
    for (const key of ["id", "label", "value", "rule", "basis", "caveat"] as const) {
      assert.notEqual(record[key].trim(), "", `${record.id}.${key} is blank`);
    }
  }
  const ids = evidence.records.map((record) => record.id);
  assert.equal(new Set(ids).size, ids.length, "two records share an id, so the drawer cannot address them");
  assert.deepEqual(Object.keys(evidence.byId).sort(), [...ids].sort());
});

test("a derived or hypothesis value always shows its working; an observed one has none to show", () => {
  for (const record of evidence.records) {
    if (record.tier === "observed") {
      assert.equal(record.formula, null, `${record.id} is observed but carries a formula`);
    } else {
      assert.notEqual(record.formula, null, `${record.id} is ${record.tier} but shows no formula`);
      assert.notEqual((record.formula ?? "").trim(), "");
    }
  }
});

test("a derived reading shows its working even when there is nothing to compare against", () => {
  // A 30-day window has no prior 28-day period. The reading is still derived — the rule that
  // produced the absence is a derivation — so the drawer must show what the rule required, rather
  // than a DERIVED pill over `—` with nothing behind it.
  const short: PortfolioSnapshot = {
    ...snapshot,
    metrics: {
      ...snapshot.metrics,
      window: { ...snapshot.metrics.window, days: 30 },
      trend: { ...snapshot.metrics.trend, previous28Days: null, changePercent: null, direction: "unavailable" },
    },
  };
  const record = buildEvidence(short).byId["momentum-change"]!;
  assert.equal(record.tier, "derived");
  assert.equal(record.value, "—");
  assert.notEqual(record.formula, null);
  assert.match(record.formula ?? "", /needs a 56-day window; this one is 30 days/);
  assert.match(record.basis, /no prior 28-day period/);
});

test("every caveat says what the number cannot see, in a full sentence", () => {
  for (const record of evidence.records) {
    assert.ok(record.caveat.length > 40, `${record.id} has a caveat too short to say anything: "${record.caveat}"`);
    assert.match(record.caveat, /\.$/, `${record.id}'s caveat is not a sentence`);
  }
});

test("the ladder always shows all three rungs, including the guess", () => {
  const ladder = evidenceLadder(evidence);
  assert.deepEqual(ladder.map((record) => record.tier), ["observed", "derived", "hypothesis"]);
  for (const tier of EVIDENCE_TIERS) {
    const presentation = EVIDENCE_TIER_PRESENTATION[tier];
    assert.equal(presentation.tier, tier);
    assert.ok(presentation.order >= 1 && presentation.order <= 3);
  }
  // Rung is encoded three ways — word, dot, border — so it survives greyscale like the CI rack.
  const rungs = Object.values(EVIDENCE_TIER_PRESENTATION);
  for (const key of ["word", "glyph", "dot", "border", "order"] as const) {
    const values = rungs.map((rung) => rung[key]);
    assert.equal(new Set(values).size, values.length, `${key} does not distinguish the three rungs`);
  }
});

test("the rhythm band is labelled a hypothesis and the score is not", () => {
  // The score follows from a stated formula over observed values. The *word* attached to it is a
  // threshold CommitAtlas invented, and nothing in GitHub's data draws that line.
  assert.equal(evidence.byId.rhythm!.tier, "derived");
  assert.match(evidence.byId.rhythm!.formula ?? "", /min\(1, density \/ 80\)/);
  assert.equal(evidence.byId["rhythm-level"]!.tier, "hypothesis");
  assert.match(evidence.byId["rhythm-level"]!.caveat, /CommitAtlas invention/);
  assert.match(evidence.byId.rhythm!.caveat, /not a GitHub rank/);
});

test("the activity mix changes tier with its basis, rather than always claiming to be counted", () => {
  assert.equal(snapshot.metrics.breakdownBasis, "exact-counts");
  assert.equal(evidence.byId.mix!.tier, "observed");

  // The same metric, sourced from GitHub's annual public-profile percentages, is a proxy for a
  // window those percentages do not describe. That is a guess, and it has to be labelled as one.
  const proxied: PortfolioSnapshot = {
    ...snapshot,
    metrics: { ...snapshot.metrics, breakdownBasis: "public-profile-percentages" },
  };
  const proxiedEvidence = buildEvidence(proxied);
  assert.equal(proxiedEvidence.byId.mix!.tier, "hypothesis");
  assert.equal(proxiedEvidence.byId.mix!.rule, "profile-percentage-proxy");
  assert.match(proxiedEvidence.byId.mix!.caveat, /percentages of a whole year/);
});

test("a truncated repository list demotes the star total instead of publishing a partial sum", () => {
  const truncated: PortfolioSnapshot = {
    ...snapshot,
    profile: { ...snapshot.profile, repositoriesTruncated: true },
  };
  const record = buildEvidence(truncated).byId.stars!;
  assert.equal(record.tier, "hypothesis");
  assert.match(record.caveat, /lower bound/);
});

test("the CI record reports the declared board honestly, including when nothing is declared", () => {
  assert.equal(evidence.byId["ci-passing"]!.value, "0/2");
  assert.match(evidence.byId["ci-passing"]!.basis, /UNCONFIGURED/);
  assert.match(evidence.byId["ci-passing"]!.caveat, /never as passing/);

  const boardless = buildEvidence({ ...snapshot, projects: null });
  assert.equal(boardless.byId["ci-passing"]!.value, "0/0");
  assert.match(boardless.byId["ci-passing"]!.basis, /no CI evidence to report/);
});

test("the source label never presents synthetic data as live", () => {
  assert.equal(evidence.sourceLabel, "SYNTHETIC OCTOCAT");
  for (const record of evidence.records) {
    if (record.formula === null) {
      assert.match(record.basis, /synthetic|no public repository languages|No projects are declared|72-hour freshness/i, record.id);
    }
  }
  assert.match(evidence.coverage, /^COVERAGE: \d+ DIMENSIONS · 365-DAY PUBLIC WINDOW/);
});

test("window boundaries print as UTC days, never as a local timestamp", () => {
  assert.equal(formatUtcDate("2026-02-18"), "18 Feb 2026");
  assert.equal(formatUtcDate("2026-12-01"), "1 Dec 2026");
  assert.equal(formatUtcRange("2026-02-18", "2026-08-18"), "18 Feb 2026 — 18 Aug 2026");
  // A value that is not a UTC day is echoed rather than silently reformatted into a wrong one.
  assert.equal(formatUtcDate("not-a-date"), "not-a-date");
});
