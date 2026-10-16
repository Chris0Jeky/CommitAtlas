import assert from "node:assert/strict";
import test from "node:test";
import { landingSnapshot } from "./landing";
import { GALLERY_CARD_IDS, buildGallery, galleryEntityTag, stampGalleryResponse } from "./gallery";
import { listScenes } from "@/packages/svg/src/index";

const originalFetch = globalThis.fetch;
globalThis.fetch = (() => {
  throw new Error("gallery must not issue network requests");
}) as typeof fetch;

const first = buildGallery(await landingSnapshot());
const second = buildGallery(await landingSnapshot());
globalThis.fetch = originalFetch;

test("gallery groups the registry under five families and stays byte-identical", () => {
  assert.deepEqual(first.families.map((family) => family.title), [
    "Instruments", "Maps", "Signatures", "Scenes", "Findings",
  ]);
  assert.equal(first.tiles.length, GALLERY_CARD_IDS.length + listScenes().length + 1);
  assert.equal(first.families.reduce((sum, family) => sum + family.tiles.length, 0), first.tiles.length);
  assert.equal(first.families.find((family) => family.id === "signature")?.tiles.length, 0);
  for (const family of first.families) {
    const ids = family.tiles.map((tile) => tile.id);
    assert.deepEqual(ids, [...ids].sort());
  }
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.tiles.filter((tile) => tile.marker === "SYNTHETIC DEMO").length, first.tiles.length);
});

test("an unavailable beacon is not labelled observed, and the finding stays C0", () => {
  const beacon = first.tiles.find((tile) => tile.id === "identity-beacon");
  assert.ok(beacon);
  assert.equal(beacon.state, "unavailable");
  assert.equal(beacon.rung, "unavailable");
  assert.match(beacon.svg, /UNAVAILABLE/);
  assert.equal(beacon.studioHref, "/studio");

  const finding = first.tiles.find((tile) => tile.id === "wbc1");
  assert.ok(finding);
  assert.equal(finding.rung, "C0");
  assert.equal(finding.state, "ready");
  assert.match(finding.svg, />C0</);
  assert.match(finding.svg, />reject</);
  assert.match(finding.svg, /WB-C1 method trial/);
  assert.equal(finding.studioHref, "/#research-bridge-title");

  const joined = first.tiles.map((tile) => `${tile.note}\n${tile.svg}`).join("\n");
  assert.doesNotMatch(joined, /promoted/i);
});

test("motion none emits no stylesheet, and lifecycle is declared rather than a score", () => {
  for (const tile of first.tiles) {
    assert.equal(tile.motion, "none");
    assert.doesNotMatch(tile.svg, /<style/i);
  }
  const lifecycle = first.tiles.find((tile) => tile.id === "lifecycle-map");
  assert.ok(lifecycle);
  assert.equal(lifecycle.state === "unavailable" ? lifecycle.rung : "declared", lifecycle.rung === "unavailable" ? "unavailable" : "declared");
  if (lifecycle.state === "ready") assert.equal(lifecycle.rung, "declared");
  const nebula = first.tiles.find((tile) => tile.id === "nebula");
  assert.ok(nebula);
  if (nebula.state === "ready") assert.equal(nebula.rung, "derived");
  assert.notEqual(nebula.rung, "observed");
  const chronograph = first.tiles.find((tile) => tile.id === "chronograph");
  assert.ok(chronograph);
  assert.equal(chronograph.studioHref, "/studio?scene=chronograph");
  assert.equal(first.tiles.find((tile) => tile.id === "cadence")?.studioHref, "/studio");
  assert.equal(first.tiles.find((tile) => tile.id === "atlas")?.studioHref, "/studio?card=atlas");
});

test("gallery responses carry a stable weak entity tag", async () => {
  const body = "<!doctype html><title>Gallery</title>";
  const stamped = await stampGalleryResponse(
    new Request("https://example.test/gallery"),
    new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } }),
  );
  const etag = stamped.headers.get("etag");
  assert.equal(etag, await galleryEntityTag(body));
  assert.match(etag ?? "", /^W\/"[a-f0-9]{64}"$/);
  assert.equal(stamped.headers.get("cache-control"), "public, max-age=300");
  assert.equal(await stamped.text(), body);

  const cached = await stampGalleryResponse(
    new Request("https://example.test/gallery", { headers: { "if-none-match": etag ?? "" } }),
    new Response(body, { headers: { "content-type": "text/html" } }),
  );
  assert.equal(cached.status, 304);
  assert.equal(cached.headers.get("etag"), etag);
  assert.equal(await cached.text(), "");

  const json = new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  const passed = await stampGalleryResponse(new Request("https://example.test/gallery"), json);
  assert.equal(passed, json);
});
