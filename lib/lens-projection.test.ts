import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import raw from "@/research-contracts/lens-projection/v1/showcase.fixture.json";
import { LENS_PROJECTION_FIXTURE_SHA256 } from "@/packages/core/src/lens-projection";
import { demoContributions, demoProfile } from "./github/demo";
import { assembleStaticPortfolio } from "@/packages/static/src/render";
import { toSceneInputs } from "./svg-adapters";
import { parseSvgSceneQuery } from "./svg-routes";
function snapshot() {
  const now = new Date("2026-09-02T12:00:00Z");
  const contributions = demoContributions("octocat", 7, now);
  return assembleStaticPortfolio(demoProfile("octocat", now), contributions, { version: 1, owner: "octocat", projects: [], freshness: contributions.freshness });
}
test("hosted adapter supplies only the pinned C0 artifact under explicit demo=true", async () => {
  const input = snapshot();
  assert.equal(toSceneInputs(input).lens, undefined);
  assert.equal(toSceneInputs(input, { demo: false }).lens, undefined);
  const lens = toSceneInputs(input, { demo: true }).lens;
  assert.ok(lens && "schemaVersion" in lens);
  assert.equal(lens.schemaVersion, "PublicLensProjection.v1");
  assert.equal(lens.provenance.projectionHash, raw.provenance.projectionHash);
  assert.equal(lens.dataClass, "C0");
  assert.deepEqual(lens.freshness, { status: "fresh", ageDays: 1, maxAgeDays: 45 });
  const bytes = await readFile(new URL("../research-contracts/lens-projection/v1/showcase.fixture.json", import.meta.url), "utf8");
  assert.equal(`sha256:${createHash("sha256").update(bytes.replaceAll("\r\n", "\n")).digest("hex")}`, LENS_PROJECTION_FIXTURE_SHA256);
});
test("public live snapshots and snapshots earlier than the pinned fixture receive no lens", () => {
  const live = snapshot();
  live.freshness = { ...live.freshness, source: "github-rest", mode: "live" };
  assert.equal(toSceneInputs(live, { demo: true }).lens, undefined);
  const earlier = snapshot();
  earlier.freshness.generatedAt = "2026-08-01T12:00:00Z";
  assert.equal(toSceneInputs(earlier, { demo: true }).lens, undefined);
});
test("hosted scene query rejects projection URLs, paths, bodies and freshness policies", () => {
  for (const key of ["lens", "lensUrl", "projection", "path", "body", "maxAgeDays"]) {
    assert.throws(() => parseSvgSceneQuery(new URLSearchParams({ user: "octocat", demo: "true", [key]: "invented" })));
  }
});
