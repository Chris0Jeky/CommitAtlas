import { buildDeliveryQueryPlan, deriveDeliverySnapshot } from "../../github/dist/index.js";

export const SYNTHETIC_BENCHMARK = {
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

const CANONICAL_COUNTS = {
  lifetimeAuthored: 120,
  lifetimeMerged: 100,
  lifetimeClosed: 110,
  lifetimeOpen: 10,
  lifetimeDrafts: 4,
  opened7: 14,
  merged7: 12,
  opened30: 50,
  merged30: 44,
  opened90: 88,
  merged90: 72,
  opened365: 120,
  merged365: 100,
};

const CANONICAL_REPOSITORIES = new Map([
  ["Chris0Jeky/CommitAtlas", 15],
  ["Chris0Jeky/Taskdeck", 35],
]);

/**
 * A validated DeliverySnapshot for the delivery card tests.
 *
 * Counts travel the real `deriveDeliverySnapshot` path, so the fixture carries the exact
 * windows, rates, ratios, benchmark, formulas, and limitations production evidence has.
 * `counts` replaces individual aliases (callers must keep the lifetime and repository
 * aggregate identities intact); `benchmark` replaces the versioned benchmark wholesale.
 */
export function deliveryFixture({ login, repositories, counts, benchmark = SYNTHETIC_BENCHMARK } = {}) {
  const plan = buildDeliveryQueryPlan({
    login: login ?? "Chris0Jeky",
    repositories: repositories ?? [...CANONICAL_REPOSITORIES.keys()],
    asOf: AS_OF,
  });
  const merged = {
    ...Object.fromEntries(plan.queries.map(({ alias }) => [alias, 0])),
    ...CANONICAL_COUNTS,
  };
  for (const query of plan.queries) {
    if (query.repository && !(query.alias in (counts ?? {}))) {
      merged[query.alias] = CANONICAL_REPOSITORIES.get(query.repository) ?? 0;
    }
  }
  Object.assign(merged, counts ?? {});
  return deriveDeliverySnapshot({ plan, counts: merged, benchmark });
}

/** Every count is zero, so every denominator-driven ratio is null upstream. */
export function emptyDeliveryFixture() {
  const plan = buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: ["Chris0Jeky/CommitAtlas"],
    asOf: AS_OF,
  });
  return deriveDeliverySnapshot({
    plan,
    counts: Object.fromEntries(plan.queries.map(({ alias }) => [alias, 0])),
  });
}
