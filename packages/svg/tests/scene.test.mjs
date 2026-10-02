import assert from "node:assert/strict";
import test from "node:test";
import * as svg from "../dist/index.js";
import { assertSceneContract, assertWellFormedXml } from "./scene-harness.mjs";
import { exampleScene, exampleFixtures, sceneInputs, sceneContext } from "./scene.fixture.mjs";

test("scene contract and registry are additive package exports", () => {
  for (const name of ["registerScene", "getScene", "listScenes", "renderScene", "renderSceneDefinition", "sceneUnavailable", "compileSceneMotion", "sceneElementId", "sceneClassName", "createPublicDemoLensContext", "sceneLensDescription"]) {
    assert.equal(typeof svg[name], "function", `missing scene API ${name}`);
  }
});

test("test-only example passes the seven shared contracts", () => {
  assertSceneContract(exampleScene(), exampleFixtures());
});

test("harness detects nondeterminism, over-budget markup, injection, missing desc and changed frame zero", () => {
  let counter = 0;
  const base = exampleScene();
  const variants = [
    ["nondeterministic", { render(model, context) { return base.render(model, context).replace("</svg>", `<text>${counter++}</text></svg>`); } }, /nondeterministic/u],
    ["bytes", { render(model, context) { return base.render(model, context).replace("</svg>", `<text>${"x".repeat(125_000)}</text></svg>`); } }, /byte budget/u],
    ["injection", { render(model, context) { return base.render(model, context).replace(svg.escapeXml(model.label), model.label); } }, /XML|malformed|element|construct|namespace/iu],
    ["description", { render(model, context) { return base.render(model, context).replace(/<desc>[\s\S]*?<\/desc>/u, ""); } }, /desc|accessibility/iu],
    ["frame", { render(model, context) { return base.render(model, context).replace('height="4"', `height="${context.motion === "none" ? 4 : 5}"`); } }, /frame-zero/u],
  ];
  for (const [id, overrides, expected] of variants) {
    assert.throws(() => assertSceneContract(exampleScene({ id, ...overrides }), exampleFixtures()), expected, id);
  }
});

test("registry owns metadata, rejects duplicates and exposes sorted snapshots", () => {
  const scene = exampleScene({ id: "registry-example" });
  svg.registerScene(scene);
  scene.supportedPacks[0] = "invalid";
  assert.equal(svg.getScene("registry-example").supportedPacks[0], "orbital");
  assert.ok(Object.isFrozen(svg.getScene("registry-example")));
  assert.throws(() => svg.registerScene(exampleScene({ id: "registry-example" })), /already|duplicate/u);
  const listed = svg.listScenes();
  assert.ok(Object.isFrozen(listed));
  assert.deepEqual(listed.map(item => item.id), [...listed.map(item => item.id)].sort());
  assert.equal(svg.getScene("unknown"), undefined);
  assert.throws(() => svg.renderScene("unknown", sceneInputs(), sceneContext), /unknown/u);
  assert.equal(svg.renderScene("registry-example", sceneInputs(), sceneContext), svg.renderSceneDefinition(svg.getScene("registry-example"), sceneInputs(), sceneContext).svg);
});

test("context, definition and namespace validation reject coercions and wider budgets", () => {
  for (const namespace of ["", "1bad", "a b", "a\"", "a".repeat(33), null, { toString: () => "safe" }]) {
    assert.throws(() => svg.renderSceneDefinition(exampleScene(), sceneInputs(), { ...sceneContext, instanceNamespace: namespace }), /namespace/u);
  }
  for (const [key, value] of [["backend", null], ["backend", "auto"], ["theme", "unknown"], ["pack", "unknown"], ["motion", "unknown"], ["layout", "unknown"]]) {
    assert.throws(() => svg.renderSceneDefinition(exampleScene(), sceneInputs(), { ...sceneContext, [key]: value }), /invalid|unsupported/u);
  }
  assert.throws(() => svg.renderSceneDefinition(exampleScene({ id: "Bad-id" }), sceneInputs(), sceneContext), /scene id/u);
  assert.throws(() => svg.renderSceneDefinition(exampleScene({ family: "instrument", budget: "scene" }), sceneInputs(), sceneContext), /budget/u);
  for (const budget of [undefined, null, "unknown", { toString: () => "scene" }]) {
    assert.throws(() => svg.registerScene(exampleScene({ id: "invalid-budget", budget })), /budget/u);
  }
  const missingBudget = exampleScene({ id: "missing-budget" });
  delete missingBudget.budget;
  assert.throws(() => svg.registerScene(missingBudget), /budget/u);
});

test("canonical owned models determine seeds without mutating caller inputs", () => {
  const inputs = sceneInputs();
  const before = structuredClone(inputs);
  const definition = exampleScene();
  const result = svg.renderSceneDefinition(definition, inputs, sceneContext);
  assert.equal(result.seed, svg.stableHash(svg.canonicalJson(definition.buildModel(inputs))));
  assert.deepEqual(inputs, before);
  assert.equal(result.svg, svg.renderSceneDefinition(definition, inputs, { ...sceneContext, seed: "another-caller-seed" }).svg);
  assert.ok(Object.isFrozen(result));
  const mutatingBuild = exampleScene({ buildModel(owned) { owned.snapshot.metrics.total = 999; return {}; } });
  assert.throws(() => svg.renderSceneDefinition(mutatingBuild, inputs, sceneContext), /read only|readonly|assign/iu);
  const mutatingRender = exampleScene({ render(model) { model.reading = 999; return ""; } });
  assert.throws(() => svg.renderSceneDefinition(mutatingRender, inputs, sceneContext), /read only|readonly|assign/iu);
  const getter = Object.defineProperty({}, "value", { enumerable: true, get() { throw new Error("evaluated getter"); } });
  assert.throws(() => svg.renderSceneDefinition(exampleScene({ buildModel: () => getter }), inputs, sceneContext), /accessor/u);
  assert.deepEqual(inputs, before);
});

test("signature common C0 context is validated, preserved and described", () => {
  const lens = svg.createPublicDemoLensContext({ dataClass: "C0", scope: "public-demo", coverage: { complete: 2, partial: 1, unavailable: 1, total: 4, warnings: ["Synthetic warning"] }, privacyNote: "Invented public demo; no private repository data." });
  const inputs = sceneInputs({ lens });
  const definition = exampleScene({ id: "signature-example", family: "signature", budget: "map", supportedMotion: ["none", "ambient"] });
  assertSceneContract(definition, exampleFixtures(inputs));
  const result = svg.renderSceneDefinition(definition, inputs, sceneContext);
  assert.match(result.svg, /2 complete, 1 partial, 1 unavailable, 4 total/u);
  assert.match(result.svg, /Bar length/u);
  const missing = exampleScene({ ...definition, buildModel: () => ({ label: "Synthetic", reading: 1 }) });
  assert.throws(() => svg.renderSceneDefinition(missing, inputs, sceneContext), /coverage|privacy|lens/u);
  const noVisible = exampleScene({ ...definition, render(model, context) { return definition.render(model, context).replace(/<text x="10" y="80">[\s\S]*?<\/text>/u, ""); } });
  assert.throws(() => svg.renderSceneDefinition(noVisible, inputs, sceneContext), /visible|coverage|privacy/u);
  for (const hidden of ["<defs>$&</defs>", '<g opacity="0">$&</g>', '<g opacity="0%">$&</g>', '<g aria-hidden="true">$&</g>', '<g fill-opacity="0">$&</g>', '<g fill="none">$&</g>', '<g font-size="0">$&</g>']) {
    const hiddenContext = exampleScene({ ...definition, render(model, context) { return definition.render(model, context).replace(/<text x="10" y="80">[\s\S]*?<\/text>/u, hidden); } });
    assert.throws(() => svg.renderSceneDefinition(hiddenContext, inputs, sceneContext), /visible|coverage|privacy/u);
  }
  const unavailable = svg.renderSceneDefinition(definition, sceneInputs(), sceneContext);
  assert.equal(unavailable.unavailable, true);
  assert.match(unavailable.svg, /unavailable/iu);
  assert.throws(() => svg.createPublicDemoLensContext({ ...lens, schemaVersion: "PublicLensProjection.v1" }), /unknown|artifact/u);
  assert.throws(() => svg.createPublicDemoLensContext({ ...lens, dataClass: "C1", scope: "redacted-local" }), /C0|public-demo/u);
  assert.throws(() => svg.createPublicDemoLensContext({ ...lens, coverage: { ...lens.coverage, score: 0.75 } }), /unknown|score/u);
  assert.throws(() => svg.createPublicDemoLensContext({ ...lens, coverage: { ...lens.coverage, total: 99 } }), /coverage|total/u);
  assert.equal(svg.renderSceneDefinition(definition, sceneInputs({ lens: structuredClone(lens) }), sceneContext).unavailable, true);
});

test("unavailable is owned, static, readable and seeded; reserved projection seams fail closed", () => {
  const definition = exampleScene({ render() { throw new Error("unavailable must bypass renderer"); } });
  const inputs = sceneInputs();
  inputs.snapshot.freshness.mode = "unavailable";
  const result = svg.renderSceneDefinition(definition, inputs, { ...sceneContext, motion: "ambient" });
  assert.equal(result.unavailable, true);
  assert.equal(result.counters.animatedElements, 0);
  assert.equal(result.counters.loopingGroups, 0);
  assert.match(result.svg, /unavailable/iu);
  assert.doesNotMatch(result.svg, /<style|<animate/u);
  for (const reserved of [{ findings: [] }, { identity: { name: "Synthetic" } }]) {
    assert.equal(svg.renderSceneDefinition(exampleScene(), sceneInputs(reserved), sceneContext).unavailable, true);
  }
});

test("engine counts actual compiler targets/groups and rejects missing, altered or unowned motion", () => {
  const definition = exampleScene();
  for (const backend of ["css", "smil"]) {
    const result = svg.renderSceneDefinition(definition, sceneInputs(), { ...sceneContext, backend, motion: "ambient" });
    assert.equal(result.counters.animatedElements, 2);
    assert.equal(result.counters.loopingGroups, 1);
    assert.equal(result.counters.bytes, Buffer.byteLength(result.svg));
    const missing = exampleScene({ render(model, context) { return definition.render(model, context).replace(/<style>[\s\S]*?<\/style>/u, "").replace(/<animate(?:Transform|Motion)?\b[^>]*\/>/gu, ""); } });
    assert.throws(() => svg.renderSceneDefinition(missing, sceneInputs(), { ...sceneContext, backend, motion: "ambient" }), /motion|compiler|fragment/u);
    const transformed = exampleScene({ render(model, context) { return definition.render(model, context).replace(/<g id=/u, '<g transform="translate(5 0)" id='); } });
    assert.throws(() => svg.renderSceneDefinition(transformed, sceneInputs(), { ...sceneContext, backend, motion: "ambient" }), /wrapper|transform|identity/u);
  }
  assert.throws(() => svg.compileSceneMotion(sceneContext, [], { target: "web" }), /render|active/u);
  const duplicatePlan = exampleScene({ render(model, context) { svg.compileSceneMotion(context, [], { target: "web" }); return definition.render(model, context); } });
  assert.throws(() => svg.renderSceneDefinition(duplicatePlan, sceneInputs(), sceneContext), /one|already|once/u);
  const rawMotion = exampleScene({ render(model, context) { return definition.render(model, context).replace("</svg>", '<animate attributeName="opacity" dur="1s" repeatCount="indefinite"/></svg>'); } });
  assert.throws(() => svg.renderSceneDefinition(rawMotion, sceneInputs(), sceneContext), /motion|compiler|animation/u);
  const cloned = exampleScene({ render(model, context) { return definition.render(model, context).replace("</svg>", `${`<use href="#${svg.sceneElementId(context, "decoration")}"/>`.repeat(100)}</svg>`); } });
  assert.equal(svg.renderSceneDefinition(cloned, sceneInputs(), sceneContext).counters.animatedElements, 0, "static clone control");
  for (const backend of ["css", "smil"]) {
    assert.throws(() => svg.renderSceneDefinition(cloned, sceneInputs(), { ...sceneContext, backend, motion: "ambient" }), /motion|clone|animated/u);
    const reusableMotion = exampleScene({ render(model, context) { return definition.render(model, context).replace(/<g id="[^"]*-element-decoration"[\s\S]*?<\/g>/u, "<defs>$&</defs>"); } });
    assert.throws(() => svg.renderSceneDefinition(reusableMotion, sceneInputs(), { ...sceneContext, backend, motion: "ambient" }), /motion|reusable|definition|paint/iu);
  }
});

test("same SVG paint references work; external, missing and cross-namespace references fail", () => {
  const definition = exampleScene();
  assertWellFormedXml(svg.renderSceneDefinition(definition, sceneInputs(), sceneContext).svg);
  for (const reference of ["url(https://example.invalid/paint)", "url(#unknown)", "url(#ca-5-slotB-7-example-element-paint)", "url(&#35;unknown)", "URL(#unknown)"]) {
    const broken = exampleScene({ render(model, context) { return definition.render(model, context).replace(/url\(#[^)]+\)/u, reference); } });
    assert.throws(() => svg.renderSceneDefinition(broken, sceneInputs(), sceneContext), /reference|url|URL/u);
  }
  for (const extra of ['<script/>', '<foreignObject/>', '<image href="https://example.invalid/a.svg"/>', '<g onload="alert(1)"/>', '<g xmlns="http://www.w3.org/1999/xhtml"/>', '<a href="javascript:alert(1)"/>', '<style>@import "https://example.invalid/a.css";</style>']) {
    const broken = exampleScene({ render(model, context) { return definition.render(model, context).replace("</svg>", `${extra}</svg>`); } });
    assert.throws(() => svg.renderSceneDefinition(broken, sceneInputs(), sceneContext), /forbidden|namespace|element|href|style|compiler/iu);
  }
});

test("shared XML scanner rejects malformed structure, entities, duplicate attributes and roots", () => {
  for (const malformed of ['<svg><g></svg>', '<svg a="1" a="2"/>', '<svg/><svg/>', '<!DOCTYPE svg><svg/>', '<svg>&unknown;</svg>', '<svg>&#0;</svg>', '<svg><text>raw > text</text></svg>', '<svg>\ud800</svg>', '<svg></svg x="1">', '<svg\u00a0xmlns="http://www.w3.org/2000/svg"/>', '\u00a0<svg/>', '<svg/>\u00a0', '&#32;<svg/>']) {
    assert.throws(() => assertWellFormedXml(malformed), /XML|attribute|root|malformed|entity|character|closing|escaped/iu);
  }
  assertWellFormedXml('<svg><text>&amp;&lt;&gt;&#x1F680;</text></svg>');
  assertWellFormedXml(' \t\r\n<svg/> \t\r\n');
});
