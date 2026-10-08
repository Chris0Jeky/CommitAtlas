import assert from "node:assert/strict";
import test from "node:test";
import * as preview from "./studio-scene-preview";
import { parseCardResponseMetadata } from "@/lib/card-metadata";

const body = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 200"><text>é card</text></svg>';
const metadata = { version: 1, card: "profile", bytes: new TextEncoder().encode(body).length,
  animatedElements: 1, loopingGroups: 0, state: "ready" };
const response = (patch = {}, text = body, headers = {}) => new Response(text, { headers: {
  "content-type": "image/svg+xml", "x-commitatlas-card-metadata": JSON.stringify({ ...metadata, ...patch }), ...headers,
} });
for (const [name, patch] of Object.entries({ scene: { card: "lifecycle-map" }, otherCard: { card: "atlas" },
  bytes: { bytes: 1 }, loops: { loopingGroups: 1 }, negative: { animatedElements: -1 }, fraction: { animatedElements: 0.5 },
  version: { version: 2 }, extra: { extra: true }, state: { state: "healthy" } })) {
  test(`card receipt refuses ${name}`, () => assert.throws(() => parseCardResponseMetadata(JSON.stringify({ ...metadata, ...patch }), "profile", metadata.bytes)));
}
test("card loader preserves exact bytes, partial disclosure, and does not authorize absent or stale metadata", async () => {
  assert.equal(typeof preview.readStudioCardPreview, "function", "card loader is absent");
  for (const state of ["ready", "partial", "stale", "unavailable"]) {
    const loaded = await preview.readStudioCardPreview(response({ state }), "profile");
    assert.equal(await loaded.blob.text(), body);
    assert.equal(loaded.state, state === "partial" ? "ready" : state);
    if (state === "partial") assert.equal(loaded.metadata?.state, "partial");
  }
  const old = await preview.readStudioCardPreview(response({}, body, { "x-commitatlas-card-metadata": "" }), "profile");
  assert.equal(old.state, "unverified"); assert.equal(old.metadata, null);
  const stale = await preview.readStudioCardPreview(response({}, body, { "x-commitatlas-data-state": "stale" }), "profile");
  assert.equal(stale.state, "stale"); assert.equal(stale.metadata, null);
});
test("card loader uses the same bounded, abortable MIME and UTF-8 boundary as scenes", async () => {
  assert.equal(typeof preview.readStudioCardPreview, "function", "card loader is absent");
  for (const value of [response({}, body, { "content-type": "text/html" }), response({}, "<html>ok</html>"), response({ card: "atlas" })])
    await assert.rejects(() => preview.readStudioCardPreview(value, "profile"));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => preview.readStudioCardPreview(response(), "profile", controller.signal));
});
test("a receipt recorded for a still view cannot impersonate a profile even with matching URL", () => {
  const token = preview.scenePreviewToken("config", "profile", "profile", 2);
  assert.equal(preview.sceneReceiptMatches({ token, view: "reduced", sourceUrl: "/same-none-url", decoded: true, state: "ready" }, token, "/same-none-url", "profile"), false);
});
test("each card has labelled controls and previews only its chosen Atlas layout", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { StudioCardPreview } = await import("./studio-card-preview-image");
  const html = renderToStaticMarkup(createElement(StudioCardPreview, { card: { kind: "atlas", title: "Atlas", purpose: "Overview", dimensions: "860 × 540", span: "full", compact: false },
    url: "/chosen-layout", stillUrl: "/still", login: "demo", source: "Synthetic", retained: false, view: "profile", token: "attempt", onRendered() {} }));
  for (const label of ["Profile view", "Replay", "Reduced-motion view", "Frame zero"]) assert.ok(html.includes(`>${label}</button>`));
  assert.match(html, /data-card-preview="atlas"/);
  assert.doesNotMatch(html, /<picture|srcSet|srcset/);
});
