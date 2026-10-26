import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as core from "./src/lens-projection.js";

const file = new URL("../../research-contracts/lens-projection/v1/showcase.fixture.json", import.meta.url);
const bytes = readFileSync(file, "utf8");
const fixture = JSON.parse(bytes);
const clock = { generatedAt: fixture.generatedAt, repositoryNames: [] as string[] };
function changed(change: (value: typeof fixture) => void) {
  const value = structuredClone(fixture);
  change(value);
  const body = structuredClone(value);
  delete body.provenance.projectionHash;
  const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);
  value.provenance.projectionHash = `sha256:${createHash("sha256").update(canonical(body)).digest("hex")}`;
  return value;
}

describe("pinned PublicLensProjection.v1", () => {
  it("parses the unchanged producer C0 fixture with a stable parsed golden", () => {
    expect(typeof core.parseLensProjection).toBe("function");
    const parsed = core.parseLensProjection(fixture, clock);
    expect(parsed).toEqual(fixture);
    expect(parsed).toMatchSnapshot();
    expect(core.computeLensProjectionHash(parsed)).toBe("sha256:a97f47a7c76ee3bf0c4c44ec6730a88c6a0e47b2de95155c3f358ec920e5a9b3");
  });
  it("pins the published fixture bytes separately from its synthetic input commit", () => {
    expect(core.LENS_PROJECTION_CONTRACT_COMMIT).toBe("bae3bddf7295b767d57196887bd648ba1cfe2ab3");
    expect(`sha256:${createHash("sha256").update(bytes.replaceAll("\r\n", "\n")).digest("hex")}`).toBe(core.LENS_PROJECTION_FIXTURE_SHA256);
    const schema = readFileSync(new URL("../../research-contracts/lens-projection/v1/schema.json", import.meta.url), "utf8");
    expect(`sha256:${createHash("sha256").update(schema.replaceAll("\r\n", "\n")).digest("hex")}`).toBe(core.LENS_PROJECTION_SCHEMA_SHA256);
    expect(fixture.provenance.producerCommit).toBe("d05533bbe17b3db524f9d404ef6c4a95a482e4bd");
  });
  it.each([
    ["unknown field", (v: typeof fixture) => { v.extra = "invented"; }],
    ["nested unknown field", (v: typeof fixture) => { v.coverage.extra = true; }],
    ["unknown code", (v: typeof fixture) => { v.coverage.warnings[0].code = "new_warning"; }],
    ["wrong display text", (v: typeof fixture) => { v.coverage.warnings[0].displayText = "Unknown warning"; }],
    ["old score alias", (v: typeof fixture) => { v.coverage.score = v.coverage.scorePercent; delete v.coverage.scorePercent; }],
    ["old display_text alias", (v: typeof fixture) => { v.coverage.warnings[0].display_text = v.coverage.warnings[0].displayText; delete v.coverage.warnings[0].displayText; }],
    ["fractional percent", (v: typeof fixture) => { v.coverage.scorePercent = 0.83; }],
    ["count-inconsistent percent", (v: typeof fixture) => { v.coverage.scorePercent = 1; }],
    ["out of range share", (v: typeof fixture) => { v.themes[0].share = 1.1; }],
    ["share sum", (v: typeof fixture) => { v.themes = [{ key: "feat", share: 0.8 }, { key: "fix", share: 0.8 }]; }],
    ["duplicate DNA", (v: typeof fixture) => { v.dna[1].key = "focus"; }],
    ["non-synthetic C0 repository", (v: typeof fixture) => { v.repositories[0].disclosure = "public-name"; }],
    ["C0 scope mismatch", (v: typeof fixture) => { v.scope = "redacted-local"; }],
    ["C0 redaction mismatch", (v: typeof fixture) => { v.repositoryRedaction = "all-aliases"; }],
    ["null delivery", (v: typeof fixture) => { v.delivery.medianMergeHours = null; }],
    ["delivery sample mismatch", (v: typeof fixture) => { v.delivery.mergedSamples++; }],
    ["delivery censored mismatch", (v: typeof fixture) => { v.delivery.censored = !v.delivery.censored; }],
    ["unsorted repositories", (v: typeof fixture) => { v.repositories.reverse(); }],
    ["duplicate repository", (v: typeof fixture) => { v.repositories[1].label = v.repositories[0].label; }],
    ["narrative URL", (v: typeof fixture) => { v.narratives[0].body = "Visit https://example.invalid"; }],
    ["narrative handle", (v: typeof fixture) => { v.narratives[0].body = "Ask @_invented"; }],
    ["narrative issue", (v: typeof fixture) => { v.narratives[0].body = "Review #123"; }],
    ["absolute date", (v: typeof fixture) => { v.rangeLabel = "September 2026"; }],
    ["lone surrogate", (v: typeof fixture) => { v.archetype.name = "\ud800"; }],
  ] as const)("rejects %s without exposing input", (_label, mutate) => {
    const value = changed(mutate);
    expect(() => core.parseLensProjection(value, clock)).toThrow("LENS_INVALID_PROJECTION");
  });
  it("rejects an altered hash and future timestamp with bounded codes", () => {
    const altered = structuredClone(fixture);
    altered.provenance.projectionHash = `sha256:${"0".repeat(64)}`;
    expect(() => core.parseLensProjection(altered, clock)).toThrow("LENS_INVALID_PROJECTION");
    expect(() => core.parseLensProjection(fixture, { ...clock, generatedAt: "2026-09-01T11:59:59Z" })).toThrow("LENS_FUTURE_PROJECTION");
  });
  it("validates producer C1 semantics and rejects alias collisions with snapshot names", () => {
    const c1 = changed(v => {
      v.dataClass = "C1"; v.scope = "redacted-local"; v.repositoryRedaction = "all-aliases";
      delete v.provenance.showcaseUrl;
      v.repositories.forEach((r: { label: string; disclosure: string }, i: number) => { r.label = `Project Amber ${i + 1}`; r.disclosure = "masked-alias"; });
    });
    expect(core.parseLensProjection(c1, clock).dataClass).toBe("C1");
    const privateAliases = changed(v => { Object.assign(v, structuredClone(c1)); v.repositoryRedaction = "private-aliases"; v.repositories.forEach((r: { disclosure: string }) => { r.disclosure = "private-alias"; }); });
    expect(() => core.parseLensProjection(privateAliases, { ...clock, repositoryNames: ["project amber 1"] })).toThrow("LENS_ALIAS_COLLISION");
    expect(() => core.parseLensProjection(c1, { ...clock, repositoryNames: ["Project Amber 1"] })).toThrow("LENS_ALIAS_COLLISION");
    expect(() => core.parseLensProjection(changed(v => { Object.assign(v, c1); v.repositories[0].label = "real-private-name"; }), clock)).toThrow("LENS_INVALID_PROJECTION");
  });
  it("accepts the producer count-percent vectors and omitted delivery without conversion", () => {
    for (const [complete, partial, unavailable, total, scores] of [[2, 0, 0, 2, [100]], [1, 1, 1, 3, [55, 83]], [3, 1, 0, 4, [91]], [1, 0, 1, 2, [50, 100]], [0, 0, 0, 0, [0]]] as const) {
      expect(core.coverageScorePercentCandidates({ complete, partial, unavailable, total })).toEqual(scores);
      for (const scorePercent of scores) expect(core.parseLensProjection(changed(v => { Object.assign(v.coverage, { complete, partial, unavailable, total, scorePercent }); delete v.delivery; }), clock).coverage.scorePercent).toBe(scorePercent);
    }
  });
  it.each([[44, "fresh"], [45, "fresh"], [46, "stale"], [89, "stale"], [90, "stale"], [91, "expired"]] as const)("uses the snapshot clock at %i days (%s)", (days, status) => {
    const snapshotTime = new Date(Date.parse(fixture.generatedAt) + days * 86400000).toISOString();
    expect(core.lensProjectionFreshness(fixture.generatedAt, snapshotTime)).toEqual({ status, ageDays: days, maxAgeDays: 45 });
  });
  it("uses elapsed time at the exact stale/expired boundaries and rejects invalid policies", () => {
    expect(core.lensProjectionFreshness("2026-01-01T00:00:00Z", "2026-02-15T00:00:01Z").status).toBe("stale");
    expect(core.lensProjectionFreshness("2026-01-01T00:00:00Z", "2026-04-01T00:00:01Z").status).toBe("expired");
    for (const n of [0, -1, 1.5, Infinity]) expect(() => core.lensProjectionFreshness(fixture.generatedAt, fixture.generatedAt, n)).toThrow("LENS_INVALID_CLOCK");
  });
});
