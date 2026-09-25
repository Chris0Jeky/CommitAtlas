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

// A fixed demo-free snapshot for value pinning. Every number is hand-chosen so the printed
// strings asserted below are exact: a wrong interpolation, a moved compactCount threshold, or a
// reformatted date fails the equality rather than a fuzzy match.
function fixedLiveSnapshot(): PortfolioSnapshot {
  const freshness = {
    generatedAt: "2026-03-31T00:00:00.000Z",
    source: "github-rest" as const,
    mode: "live" as const,
  };
  return {
    version: 1,
    freshness,
    profile: {
      version: 1,
      login: "evidence-user",
      name: "Evidence User",
      profileUrl: "https://github.com/evidence-user",
      publicRepositories: 27,
      followers: 1500,
      following: 12,
      stars: 321,
      forks: 40,
      primaryLanguages: [{ name: "TypeScript", repositories: 3, share: 60 }],
      latestPushAt: "2026-03-30T00:00:00.000Z",
      repositoriesTruncated: false,
      freshness,
    },
    contributions: {
      version: 1,
      login: "evidence-user",
      totalContributions: 1234,
      commits: 800,
      issues: 84,
      pullRequests: 200,
      reviews: 150,
      breakdownBasis: "exact-counts",
      days: Array.from({ length: 90 }, () => ({ date: "2026-01-01", count: 0 })),
      freshness,
    },
    metrics: {
      version: 1,
      window: { from: "2026-01-01", to: "2026-03-31", days: 90, observedDays: 90, complete: true },
      total: 1234,
      activeDays: 45,
      density: 50,
      averagePerDay: 13.71,
      averagePerActiveDay: 27.42,
      peakDay: { date: "2026-02-14", count: 42 },
      streak: {
        version: 1,
        asOf: "2026-03-31",
        current: 6,
        currentThrough: "2026-03-30",
        longest: 12,
        boundary: { current: "closed", longest: "closed" },
        basis: "returned-window",
      },
      breakdown: { commits: 800, issues: 84, pullRequests: 200, reviews: 150 },
      breakdownBasis: "exact-counts",
      trend: { buckets: [], recent28Days: 320, previous28Days: 256, changePercent: 25, direction: "up" },
      rhythm: {
        score: 55,
        level: "steady",
        basis: "70% active-day density (capped at 80%) + 30% current streak (capped at 30 days)",
      },
    },
    projects: null,
  };
}
test("evidence pins the printed contributions value for a fixed live snapshot", () => {
  const base = fixedLiveSnapshot();
  const evidence = buildEvidence(base);
  assert.equal(evidence.sourceLabel, "PUBLIC GITHUB");
  assert.equal(evidence.records.length, 17);
  const record = evidence.byId["contributions"]!;
  assert.equal(record.value, "1.2k");
  assert.equal(record.tier, "observed");
  assert.equal(record.rule, "contribution-total-observed");
  assert.equal(record.formula, null);
  assert.match(record.basis, /1,234 contributions summed across the 90-day window/);
  // Boundary: just below the compact threshold the figure prints in full, at it compacts.
  const below = buildEvidence({ ...base, metrics: { ...base.metrics, total: 999 } });
  assert.equal(below.byId["contributions"]!.value, "999");
  const at = buildEvidence({ ...base, metrics: { ...base.metrics, total: 1000 } });
  assert.equal(at.byId["contributions"]!.value, "1k");
});

test("evidence pins the printed active-days value for a fixed live snapshot", () => {
  const base = fixedLiveSnapshot();
  const record = buildEvidence(base).byId["active-days"]!;
  assert.equal(record.value, "45");
  assert.equal(record.tier, "observed");
  assert.equal(record.rule, "contribution-days-observed");
  assert.equal(record.formula, null);
  assert.match(record.basis, /45 of the 90 days in the window/);
  // Boundary: a window with no active day prints zero rather than an absence marker.
  const empty = buildEvidence({ ...base, metrics: { ...base.metrics, activeDays: 0 } });
  assert.equal(empty.byId["active-days"]!.value, "0");
});

test("evidence pins the printed density value and its formula for a fixed live snapshot", () => {
  const base = fixedLiveSnapshot();
  const record = buildEvidence(base).byId["density"]!;
  assert.equal(record.value, "50%");
  assert.equal(record.tier, "derived");
  assert.equal(record.rule, "density-derived");
  assert.equal(record.formula, "active_days / window_days × 100 — 45 / 90 × 100 = 50%");
  // Boundary: no active days is a zero density, not a missing one.
  const empty = buildEvidence({ ...base, metrics: { ...base.metrics, activeDays: 0, density: 0 } });
  assert.equal(empty.byId["density"]!.value, "0%");
  assert.equal(empty.byId["density"]!.formula, "active_days / window_days × 100 — 0 / 90 × 100 = 0%");
});

test("evidence pins the printed average-per-day value and its formula for a fixed live snapshot", () => {
  const base = fixedLiveSnapshot();
  const record = buildEvidence(base).byId["average-per-day"]!;
  assert.equal(record.value, "13.71");
  assert.equal(record.tier, "derived");
  assert.equal(record.rule, "average-derived");
  assert.equal(record.formula, "total / window_days — 1234 / 90 = 13.71");
  assert.match(record.caveat, /active-day average is 27\.42/);
  // Boundary: a total of nothing averages to zero, printed to two places.
  const empty = buildEvidence({
    ...base,
    metrics: { ...base.metrics, total: 0, averagePerDay: 0, averagePerActiveDay: 0 },
  });
  assert.equal(empty.byId["average-per-day"]!.value, "0.00");
});

test("evidence pins the printed momentum value for a fixed live snapshot", () => {
  const base = fixedLiveSnapshot();
  const record = buildEvidence(base).byId["momentum"]!;
  assert.equal(record.value, "320");
  assert.equal(record.tier, "observed");
  assert.equal(record.rule, "momentum-window-observed");
  assert.equal(record.formula, null);
  assert.match(record.basis, /320 contributions in the most recent 28 days/);
  // Boundary: a quiet recent window prints zero rather than an absence marker.
  const quiet = buildEvidence({
    ...base,
    metrics: { ...base.metrics, trend: { ...base.metrics.trend, recent28Days: 0 } },
  });
  assert.equal(quiet.byId["momentum"]!.value, "0");
});

test("evidence pins the printed streak values for a fixed live snapshot", () => {
  const base = fixedLiveSnapshot();
  const evidence = buildEvidence(base);
  assert.equal(evidence.byId["current-streak"]!.value, "6");
  assert.equal(evidence.byId["current-streak"]!.tier, "observed");
  assert.equal(evidence.byId["current-streak"]!.rule, "streak-observed");
  assert.match(evidence.byId["current-streak"]!.basis, /6 consecutive active days ending 30 Mar 2026/);
  assert.equal(evidence.byId["longest-streak"]!.value, "12");
  assert.equal(evidence.byId["longest-streak"]!.tier, "observed");
  // Boundary: no streak at the window end reports the absence instead of a count.
  const none = buildEvidence({
    ...base,
    metrics: {
      ...base.metrics,
      streak: { ...base.metrics.streak, current: 0, currentThrough: null, longest: 0 },
    },
  });
  assert.equal(none.byId["current-streak"]!.value, "0");
  assert.match(none.byId["current-streak"]!.basis, /No current active-day streak was observed/);
  assert.equal(none.byId["longest-streak"]!.value, "0");
});

test("evidence pins the printed peak-day value for a fixed live snapshot", () => {
  const base = fixedLiveSnapshot();
  const record = buildEvidence(base).byId["peak-day"]!;
  assert.equal(record.value, "42");
  assert.equal(record.tier, "observed");
  assert.equal(record.rule, "peak-observed");
  assert.match(record.basis, /42 contributions on 14 Feb 2026, the busiest observed day/);
  // Boundary: a window with no peak prints zero rather than an absence marker.
  const flat = buildEvidence({
    ...base,
    metrics: { ...base.metrics, peakDay: { date: "2026-01-01", count: 0 } },
  });
  assert.equal(flat.byId["peak-day"]!.value, "0");
  assert.match(flat.byId["peak-day"]!.basis, /0 contributions on 1 Jan 2026/);
});

test("evidence pins the printed repositories value for a fixed live snapshot", () => {
  const base = fixedLiveSnapshot();
  const record = buildEvidence(base).byId["repositories"]!;
  assert.equal(record.value, "27");
  assert.equal(record.tier, "observed");
  assert.equal(record.rule, "profile-observed");
  assert.equal(record.formula, null);
  assert.match(record.basis, /27 public repositories for @evidence-user/);
  // Boundary: a handle with no public repositories prints zero rather than an absence marker.
  const none = buildEvidence({
    ...base,
    profile: { ...base.profile, publicRepositories: 0 },
  });
  assert.equal(none.byId["repositories"]!.value, "0");
});

test("evidence pins the printed followers value for a fixed live snapshot", () => {
  const base = fixedLiveSnapshot();
  const record = buildEvidence(base).byId["followers"]!;
  assert.equal(record.value, "1.5k");
  assert.equal(record.tier, "observed");
  assert.equal(record.rule, "profile-observed");
  assert.equal(record.formula, null);
  assert.match(record.basis, /1,500 followers for @evidence-user/);
  // Boundary: just below the compact threshold the figure prints in full.
  const below = buildEvidence({ ...base, profile: { ...base.profile, followers: 999 } });
  assert.equal(below.byId["followers"]!.value, "999");
  const none = buildEvidence({ ...base, profile: { ...base.profile, followers: 0 } });
  assert.equal(none.byId["followers"]!.value, "0");
});
