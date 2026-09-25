import assert from "node:assert/strict";
import test from "node:test";
import {
  type DeliveryBenchmark,
  buildDeliveryQueryPlan,
  deriveDeliverySnapshot,
  type DeliveryQueryPlan,
} from "./delivery.js";

const SYNTHETIC_BENCHMARK: DeliveryBenchmark = {
  version: 1,
  id: "synthetic-reference",
  label: "Synthetic test reference",
  publisher: "Synthetic Tests",
  metric: "Invented pull request throughput",
  value: 2.2,
  unit: "merged-pull-requests-per-engineer-week",
  sourceUrl: "https://example.invalid/synthetic-benchmark",
  publishedAt: "2026-03-17",
  population: "Invented test population; not observed data.",
  cohort: "Synthetic fixture only.",
  caveats: ["This synthetic comparison is not a global percentile or real benchmark."],
};

const AS_OF = new Date("2026-09-21T18:22:00.000Z");
const REPOSITORIES = [
  "Chris0Jeky/Taskdeck",
  "Chris0Jeky/local-asset-studio",
  "Chris0Jeky/NavSentinel",
  "Chris0Jeky/Alibi",
  "Chris0Jeky/Pulseboard",
  "Chris0Jeky/CommitAtlas",
] as const;

function plan(): DeliveryQueryPlan {
  return buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: REPOSITORIES,
    asOf: AS_OF,
  });
}

function validCounts(queryPlan = plan()): Record<string, number> {
  const counts = Object.fromEntries(queryPlan.queries.map(({ alias }) => [alias, 0]));
  Object.assign(counts, {
    lifetimeAuthored: 4_605,
    lifetimeMerged: 4_227,
    lifetimeClosed: 4_413,
    lifetimeOpen: 192,
    lifetimeDrafts: 97,
    opened7: 682,
    merged7: 499,
    opened30: 1_973,
    merged30: 1_724,
    opened90: 3_240,
    merged90: 2_922,
    opened365: 4_550,
    merged365: 4_177,
  });
  const byRepository = new Map<string, number>([
    ["Chris0Jeky/Alibi", 111],
    ["Chris0Jeky/CommitAtlas", 270],
    ["Chris0Jeky/local-asset-studio", 483],
    ["Chris0Jeky/NavSentinel", 140],
    ["Chris0Jeky/Pulseboard", 86],
    ["Chris0Jeky/Taskdeck", 883],
  ]);
  for (const query of queryPlan.queries) {
    if (query.repository) counts[query.alias] = byRepository.get(query.repository) ?? 0;
  }
  return counts;
}

test("buildDeliveryQueryPlan scopes every count to configured repositories", () => {
  const queryPlan = plan();
  assert.equal(queryPlan.queries.length, 19);
  assert.deepEqual(queryPlan.repositories, [
    "Chris0Jeky/Alibi",
    "Chris0Jeky/CommitAtlas",
    "Chris0Jeky/local-asset-studio",
    "Chris0Jeky/NavSentinel",
    "Chris0Jeky/Pulseboard",
    "Chris0Jeky/Taskdeck",
  ]);
  const allowed = new Set(queryPlan.repositories);
  for (const item of queryPlan.queries) {
    assert.match(item.search, /\bis:pr\b/);
    assert.match(item.search, /\bauthor:Chris0Jeky\b/);
    const named = [...item.search.matchAll(/\brepo:([^ )]+)/g)].map((match) => match[1]!);
    assert.ok(named.length > 0, `${item.alias} must name at least one repository`);
    assert.ok(named.every((repository) => allowed.has(repository)), `${item.alias} escaped configured scope`);
    if (item.repository) {
      assert.deepEqual(named, [item.repository]);
    } else {
      assert.deepEqual(new Set(named), allowed);
    }
    assert.doesNotMatch(item.search, /Private|unconfigured/i);
  }
});

test("buildDeliveryQueryPlan uses inclusive UTC calendar windows across year boundaries", () => {
  const queryPlan = buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: ["Chris0Jeky/CommitAtlas"],
    asOf: new Date("2026-01-03T23:59:59.999Z"),
  });
  assert.deepEqual(queryPlan.windows, [
    { days: 7, from: "2025-12-28", to: "2026-01-03" },
    { days: 30, from: "2025-12-05", to: "2026-01-03" },
    { days: 90, from: "2025-10-06", to: "2026-01-03" },
    { days: 365, from: "2025-01-04", to: "2026-01-03" },
  ]);
  assert.match(queryPlan.queries.find(({ alias }) => alias === "opened7")!.search, /created:2025-12-28\.\.2026-01-03/);
  assert.match(queryPlan.queries.find(({ alias }) => alias === "merged365")!.search, /merged:2025-01-04\.\.2026-01-03/);
});

test("buildDeliveryQueryPlan rejects unsafe, duplicate, cross-owner, empty, and oversized scope", () => {
  assert.throws(() => buildDeliveryQueryPlan({ login: "bad login", repositories: ["bad login/repo"], asOf: AS_OF }), /login/i);
  assert.throws(() => buildDeliveryQueryPlan({ login: "Chris0Jeky", repositories: [], asOf: AS_OF }), /repository/i);
  assert.throws(() => buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: ["Chris0Jeky/Taskdeck", "chris0jeky/taskdeck"],
    asOf: AS_OF,
  }), /duplicate/i);
  assert.throws(() => buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: ["someone-else/repo"],
    asOf: AS_OF,
  }), /owned/i);
  assert.throws(() => buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: Array.from({ length: 7 }, (_, index) => `Chris0Jeky/repo-${index}`),
    asOf: AS_OF,
  }), /six/i);
  assert.throws(() => buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: ["Chris0Jeky/repo) OR is:private"],
    asOf: AS_OF,
  }), /repository/i);
});

test("deriveDeliverySnapshot calculates transparent high-volume flow signals", () => {
  const queryPlan = plan();
  const snapshot = deriveDeliverySnapshot({
    plan: queryPlan,
    counts: validCounts(queryPlan),
    benchmark: SYNTHETIC_BENCHMARK,
  });

  assert.deepEqual(snapshot.lifetime, {
    authored: 4_605,
    merged: 4_227,
    closed: 4_413,
    closedWithoutMerge: 186,
    open: 192,
    drafts: 97,
  });
  assert.deepEqual(snapshot.windows.map(({ days, opened, merged, mergedPerWeek }) => ({ days, opened, merged, mergedPerWeek })), [
    { days: 7, opened: 682, merged: 499, mergedPerWeek: 499 },
    { days: 30, opened: 1_973, merged: 1_724, mergedPerWeek: 402.2667 },
    { days: 90, opened: 3_240, merged: 2_922, mergedPerWeek: 227.2667 },
    { days: 365, opened: 4_550, merged: 4_177, mergedPerWeek: 80.1068 },
  ]);
  assert.deepEqual(snapshot.derived, {
    resolvedMergeConversion: 0.9579,
    integrationBalance30: 0.8738,
    wipMergeWeeks: 0.3848,
    topTwoConcentration30: 0.6923,
    topSixConcentration30: 1,
    benchmarkMultiple7: 226.8182,
  });
  assert.equal(snapshot.repositories[0]?.repository, "Chris0Jeky/Alibi");
  assert.equal(snapshot.repositories.at(-1)?.repository, "Chris0Jeky/Taskdeck");
  assert.equal(snapshot.source.queryCount, 19);
  assert.equal(snapshot.scope.kind, "configured-public-repositories");
  assert.equal(snapshot.benchmark?.id, "synthetic-reference");
  assert.match(snapshot.formulas.benchmarkMultiple7, /mergedPerWeek7 \/ benchmark\.value/);
  assert.ok(snapshot.limitations.some((limitation) => /not.*quality|quality.*not/i.test(limitation)));
});

test("deriveDeliverySnapshot leaves zero-denominator ratios unavailable", () => {
  const queryPlan = buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: ["Chris0Jeky/CommitAtlas"],
    asOf: AS_OF,
  });
  const counts = Object.fromEntries(queryPlan.queries.map(({ alias }) => [alias, 0]));
  const snapshot = deriveDeliverySnapshot({ plan: queryPlan, counts });
  assert.deepEqual(snapshot.derived, {
    resolvedMergeConversion: null,
    integrationBalance30: null,
    wipMergeWeeks: null,
    topTwoConcentration30: null,
    topSixConcentration30: null,
    benchmarkMultiple7: null,
  });
  assert.ok(snapshot.windows.every(({ mergedPerWeek }) => mergedPerWeek === 0));
});

test("deriveDeliverySnapshot rejects malformed or contradictory count evidence", () => {
  const queryPlan = plan();
  const base = validCounts(queryPlan);
  const expectInvalid = (changes: Record<string, number>, pattern: RegExp) => {
    assert.throws(() => deriveDeliverySnapshot({ plan: queryPlan, counts: { ...base, ...changes } }), pattern);
  };
  expectInvalid({ lifetimeMerged: 4_414 }, /merged.*closed/i);
  expectInvalid({ lifetimeAuthored: 4_604 }, /authored.*closed.*open/i);
  expectInvalid({ lifetimeDrafts: 193 }, /draft.*open/i);
  expectInvalid({ opened30: 1_972 }, /repository.*opened30/i);
  expectInvalid({ merged7: -1 }, /non-negative integer/i);
  expectInvalid({ opened7: 1.5 }, /non-negative integer/i);
  const missing = { ...base };
  delete missing.merged90;
  assert.throws(() => deriveDeliverySnapshot({ plan: queryPlan, counts: missing }), /missing.*merged90/i);
});

test("only an explicit structurally valid reference enables a comparison", () => {
  const queryPlan = plan();
  const snapshot = deriveDeliverySnapshot({ plan: queryPlan, counts: validCounts(queryPlan), benchmark: SYNTHETIC_BENCHMARK });
  assert.equal(snapshot.benchmark?.id, "synthetic-reference");
  assert.equal(snapshot.derived.benchmarkMultiple7, 226.8182);
  for (const value of [0, -1, NaN, Infinity]) {
    assert.throws(() => deriveDeliverySnapshot({ plan: queryPlan, counts: validCounts(queryPlan),
      benchmark: { ...SYNTHETIC_BENCHMARK, value } }), /finite positive/);
  }
});

test("all delivery searches explicitly exclude private and internal repositories", () => {
  for (const repositories of [REPOSITORIES.slice(0, 1), REPOSITORIES]) {
    const queryPlan = buildDeliveryQueryPlan({ login: "Chris0Jeky", repositories, asOf: AS_OF });
    for (const query of queryPlan.queries) {
      assert.match(query.search, /(?:^|\s)is:public(?:\s|$)/, `${query.alias} must remain public-only with a private-capable token`);
    }
  }
});

test("nested delivery windows cannot exceed a longer window or their lifetime total", () => {
  const queryPlan = plan();
  for (const metric of ["opened", "merged"] as const) {
    for (const [shorter, longer] of [[7, 30], [30, 90], [90, 365], [365, null]] as const) {
      const counts = validCounts(queryPlan);
      const key = `${metric}${shorter}`;
      const limitKey = longer === null ? (metric === "opened" ? "lifetimeAuthored" : "lifetimeMerged") : `${metric}${longer}`;
      const before = counts[key]!;
      counts[key] = counts[limitKey]! + 1;
      if (metric === "opened" && shorter === 30) {
        // Keep the existing repository sum invariant valid to isolate the new boundary.
        counts.repoOpened30_0! += counts[key]! - before;
      }
      assert.throws(() => deriveDeliverySnapshot({ plan: queryPlan, counts }), /cannot exceed/i, `${key} > ${limitKey}`);
    }
  }
});

test("delivery without an explicit benchmark preserves counts but publishes no comparison", () => {
  const queryPlan = plan();
  for (const benchmark of [undefined, null]) {
    const snapshot = deriveDeliverySnapshot({ plan: queryPlan, counts: validCounts(queryPlan), benchmark });
    assert.equal(snapshot.benchmark, null);
    assert.equal(snapshot.derived.benchmarkMultiple7, null);
    assert.equal(snapshot.windows[0]?.mergedPerWeek, 499);
    assert.equal(snapshot.lifetime.merged, 4227);
    assert.ok(snapshot.limitations.some((line) => /benchmark.*unavailable/i.test(line)));
    assert.doesNotMatch(JSON.stringify(snapshot), /Jellyfish|jellyfish|226\.8182/);
  }
});
