import assert from "node:assert/strict";
import test from "node:test";
import { readStudioScenePreview, scenePreviewToken, sceneReceiptMatches, type SceneImageReceipt } from "./studio-scene-preview";
const id = "evidence-coverage";
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 200"><title>Example</title><text>é</text></svg>';
const metadata = { version: 1, scene: id, bytes: new TextEncoder().encode(svg).length, animatedElements: 2, loopingGroups: 1, unavailable: false };
const response = (body = svg, changes: Record<string, string> = {}) => new Response(body, { headers: {
  "content-type": "image/svg+xml; charset=utf-8", "x-commitatlas-scene-metadata": JSON.stringify(metadata), ...changes,
} });
test("loads one bounded SVG and takes counters from its renderer metadata, not syntax", async () => {
  const result = await readStudioScenePreview(response(), id);
  assert.equal(result.state, "ready");
  assert.equal(result.metadata?.animatedElements, 2); assert.equal(result.metadata?.loopingGroups, 1);
  assert.equal(await result.blob.text(), svg); assert.equal(result.blob.type, "image/svg+xml");
});
for (const [label, make] of [
  ["HTML with status 200", () => response("<html>not an image</html>", { "content-type": "text/html" })],
  ["wrong content", () => response("<html>not an image</html>")],
  ["error status", () => new Response(svg, { status: 502, headers: { "content-type": "image/svg+xml" } })],
  ["different byte span", () => response(svg + " ")],
  ["unknown scene", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, scene: "other" }) })],
  ["unknown version", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, version: 2 }) })],
  ["fractional count", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, loopingGroups: 1.5 }) })],
  ["negative count", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, animatedElements: -1 }) })],
  ["unknown state", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, unavailable: "false" }) })],
  ["unexpected metadata field", () => response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, trustMe: true }) })],
] as const) test(`rejects ${label}`, async () => {
  await assert.rejects(() => readStudioScenePreview(make(), id), /scene|SVG|metadata/i);
});
test("missing metadata and stale last-good bodies remain displayable but cannot authorize copying", async () => {
  for (const headers of [{ "x-commitatlas-scene-metadata": "" }, { "x-commitatlas-data-state": "stale" }] as Record<string, string>[]) {
    const result = await readStudioScenePreview(response(svg, headers), id);
    assert.notEqual(result.state, "ready"); assert.equal(result.metadata, null);
    assert.equal(await result.blob.text(), svg);
  }
});
test("a well-formed unavailable plate is distinct from rendered evidence", async () => {
  const result = await readStudioScenePreview(response(svg, { "x-commitatlas-scene-metadata": JSON.stringify({ ...metadata, unavailable: true, animatedElements: 0, loopingGroups: 0 }) }), id);
  assert.equal(result.state, "unavailable");
});
test("streaming response is bounded before decoding and cancels overflow", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(200_000)); }, cancel() { cancelled = true; } });
  await assert.rejects(() => readStudioScenePreview(new Response(body, { headers: { "content-type": "image/svg+xml" } }), id), /byte|large|limit/i);
  assert.equal(cancelled, true);
});
test("an aborted load cannot return a successful resource", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => readStudioScenePreview(response(), id, controller.signal));
});
test("only a loaded image for the current profile attempt can authorize copying", () => {
  const current = scenePreviewToken("config", id, "profile", 3);
  const receipt: SceneImageReceipt = { token: current, view: "profile", sourceUrl: "/profile", decoded: true, state: "ready" };
  assert.equal(sceneReceiptMatches(receipt, current, "/profile", "profile"), true);
  assert.equal(sceneReceiptMatches(receipt, current, "/profile", "reduced"), false);
  assert.equal(sceneReceiptMatches(receipt, scenePreviewToken("config", id, "profile", 4), "/profile", "profile"), false);
  assert.equal(sceneReceiptMatches(receipt, current, "/still", "profile"), false);
  assert.equal(sceneReceiptMatches({ ...receipt, decoded: false }, current, "/profile", "profile"), false);
  assert.equal(sceneReceiptMatches({ ...receipt, state: "unavailable" }, current, "/profile", "profile"), false);
  assert.equal(sceneReceiptMatches(undefined, current, "/profile", "profile"), false);
});

test("scene previews use the gallery's full-width class, not an undefined span", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { StudioScenePreview } = await import("./studio-scene-preview-image");
  const html = renderToStaticMarkup(createElement(StudioScenePreview, {
    id, title: "Evidence coverage", pack: "survey", url: "/profile", stillUrl: "/still", view: "profile", token: "attempt", onRendered() {},
  }));
  assert.match(html, /class="studio-card-preview span-full card-scene"/);
});
