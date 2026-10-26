import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as svg from "../dist/index.js";
import { exampleScene, sceneContext, sceneInputs } from "./scene.fixture.mjs";
const fixture = JSON.parse(await readFile(new URL("../../../research-contracts/lens-projection/v1/showcase.fixture.json", import.meta.url), "utf8"));
function inputsAt(days) {
  const inputs = sceneInputs();
  inputs.snapshot.freshness.generatedAt = new Date(Date.parse(fixture.generatedAt) + days * 86400000).toISOString();
  inputs.lens = svg.createLensProjectionContext(fixture, inputs.snapshot, 45);
  return inputs;
}
function signature(overrides = {}) {
  return exampleScene({ family: "signature", budget: "map", buildModel({ snapshot, lens }) { return { label: snapshot.profile.name, reading: snapshot.metrics.total, lens }; }, ...overrides });
}
test("full C0 scene adapter preserves producer data and detaches immutable context", () => {
  assert.equal(typeof svg.createLensProjectionContext, "function");
  const inputs = inputsAt(44);
  assert.equal(inputs.lens.summary.commits, fixture.summary.commits);
  assert.deepEqual(inputs.lens.coverage, fixture.coverage);
  assert.deepEqual(inputs.lens.freshness, { status: "fresh", ageDays: 44, maxAgeDays: 45 });
  assert.ok(Object.isFrozen(inputs.lens.repositories));
  assert.equal(svg.renderSceneDefinition(signature(), inputs, sceneContext).unavailable, false);
});
test("stale signatures receive an engine-owned strip and accessible age", () => {
  const result = svg.renderSceneDefinition(signature(), inputsAt(46), sceneContext);
  assert.equal(result.unavailable, false);
  assert.match(result.svg, /STALE PROJECTION/);
  assert.match(result.svg, /<desc>[^<]*46 days/);
  assert.match(result.svg, /<text[^>]*>STALE PROJECTION/);
});
test("expired signatures use unavailable composition before buildModel", () => {
  let called = false;
  const result = svg.renderSceneDefinition(signature({ buildModel() { called = true; throw Error("must not build"); } }), inputsAt(91), sceneContext);
  assert.equal(called, false);
  assert.equal(result.unavailable, true);
  assert.match(result.svg, /UNAVAILABLE/);
  assert.match(result.svg, /91 days/);
});
test("a context is rechecked against the render snapshot clock", () => {
  const inputs = inputsAt(0);
  inputs.snapshot.freshness.generatedAt = "2026-12-15T12:00:00Z";
  let called = false;
  const result = svg.renderSceneDefinition(signature({ buildModel() { called = true; throw Error("must not build"); } }), inputs, sceneContext);
  assert.equal(called, false);
  assert.equal(result.unavailable, true);
});

test("stale header expands a root viewBox with valid whitespace around equals", () => {
  const original = signature();
  const definition = signature({ render(model, context) { return original.render.call(this, model, context).replace('viewBox="', 'viewBox = "'); } });
  const result = svg.renderSceneDefinition(definition, inputsAt(46), sceneContext);
  assert.match(result.svg, /viewBox\s*=\s*"0 -28 1600 128"/);
  assert.match(result.svg, /<text[^>]*>STALE PROJECTION/);
});
