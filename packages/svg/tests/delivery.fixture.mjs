import { buildDeliveryQueryPlan, deriveDeliverySnapshot } from "../../github/dist/index.js";

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
export function deliveryFixture({ login, repositories, counts, benchmark } = {}) {
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
  return deriveDeliverySnapshot({ plan, counts: merged, ...(benchmark ? { benchmark } : {}) });
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
