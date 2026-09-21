import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveryQueryPlan, deriveDeliverySnapshot } from "@commit-atlas/github";
import { renderDeliveryCard, renderDeliveryEvidence } from "../dist/index.js";

const NOW = new Date("2026-09-21T18:22:00.000Z");

function snapshot(options = {}) {
  const plan = buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: ["Chris0Jeky/CommitAtlas", "Chris0Jeky/Taskdeck"],
    asOf: NOW,
  });
  const counts = Object.fromEntries(plan.queries.map(({ alias }) => [alias, 0]));
  Object.assign(counts, {
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
  });
  const repositoryCounts = new Map([
    ["Chris0Jeky/CommitAtlas", 15],
    ["Chris0Jeky/Taskdeck", 35],
  ]);
  for (const query of plan.queries) {
    if (query.repository) counts[query.alias] = repositoryCounts.get(query.repository) ?? 0;
  }
  return deriveDeliverySnapshot({
    plan,
    counts,
    ...(options.benchmark ? { benchmark: options.benchmark } : {}),
  });
}

test("delivery evidence JSON is deterministic, versioned, sorted, and self-explanatory", () => {
  const first = renderDeliveryEvidence(snapshot());
  const second = renderDeliveryEvidence(snapshot());
  assert.equal(first, second);
  assert.ok(first.endsWith("\n"));
  const parsed = JSON.parse(first);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.kind, "commitatlas-delivery-evidence");
  assert.equal(parsed.scope.kind, "configured-public-repositories");
  assert.deepEqual(parsed.repositories.map(({ repository }) => repository), [
    "Chris0Jeky/CommitAtlas",
    "Chris0Jeky/Taskdeck",
  ]);
  assert.equal(parsed.formulas.resolvedMergeConversion, "lifetime.merged / lifetime.closed");
  assert.equal(parsed.benchmark.publisher, "Jellyfish Research");
  assert.match(parsed.benchmark.sourceUrl, /^https:\/\//);
  assert.ok(parsed.limitations.some((limitation) => /not.*quality|quality.*not/i.test(limitation)));
});

test("delivery card presents the focal rate, comparison, supporting evidence, and non-claim accessibly", () => {
  const svg = renderDeliveryCard(snapshot(), { theme: "ember", width: 860, motion: "none" });
  assert.match(svg, /^<svg/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-labelledby="delivery-title delivery-desc"/);
  assert.match(svg, /<title id="delivery-title">/);
  assert.match(svg, /<desc id="delivery-desc">/);
  assert.match(svg, /DELIVERY EVIDENCE/);
  assert.match(svg, />12<\/text>/);
  assert.match(svg, /PRs \/ WEEK/);
  assert.match(svg, /5\.5×/);
  assert.match(svg, /90\.9%/);
  assert.match(svg, /88\.0%/);
  assert.match(svg, /10 OPEN · 0\.83 MERGE-WEEKS/);
  assert.match(svg, /100\.0%/);
  assert.match(svg, /2 CONFIGURED PUBLIC REPOS/);
  assert.match(svg, /2026-09-15 → 2026-09-21/);
  assert.match(svg, /ACTIVITY FLOW · NOT QUALITY OR IMPACT/);
  assert.doesNotMatch(svg, /<script\b|<foreignObject\b|<image\b/i);
  assert.ok(Buffer.byteLength(svg, "utf8") < 96 * 1024);
});

test("delivery card supports the paired light theme and compact layout", () => {
  const wide = renderDeliveryCard(snapshot(), { theme: "paper", width: 860, motion: "none" });
  const compact = renderDeliveryCard(snapshot(), { theme: "paper", width: 480, motion: "none" });
  assert.match(wide, /viewBox="0 0 860 360"/);
  assert.match(compact, /viewBox="0 0 480 520"/);
  assert.match(wide, /#dfe4c9/);
  assert.match(compact, /#dfe4c9/);
  assert.match(compact, /ACTIVITY FLOW · NOT QUALITY OR IMPACT/);
});

test("delivery card renders unavailable ratios without NaN or Infinity", () => {
  const plan = buildDeliveryQueryPlan({
    login: "Chris0Jeky",
    repositories: ["Chris0Jeky/CommitAtlas"],
    asOf: NOW,
  });
  const counts = Object.fromEntries(plan.queries.map(({ alias }) => [alias, 0]));
  const svg = renderDeliveryCard(deriveDeliverySnapshot({ plan, counts }), {
    theme: "aurora",
    width: 860,
    motion: "none",
  });
  assert.match(svg, /UNAVAILABLE/);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

test("delivery card escapes hostile benchmark presentation text", () => {
  const base = snapshot().benchmark;
  const svg = renderDeliveryCard(snapshot({
    benchmark: {
      ...base,
      label: "<script>alert('x')</script>",
      population: "A & B < C",
    },
  }), { theme: "midnight", width: 860, motion: "none" });
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /A &amp; B &lt; C/);
});
