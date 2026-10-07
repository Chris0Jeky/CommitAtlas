import assert from "node:assert/strict";
import test from "node:test";
import { lifecycleMapScene as scene } from "../dist/scenes/lifecycle-map.js";
import { renderSceneDefinition, themes } from "../dist/index.js";
import { parseSceneXml, sceneXmlText } from "../dist/scene-svg.js";
import { assertSceneContract, stripSceneMotion } from "./scene-harness.mjs";
import { inputs, project, live, OBSERVED_AT } from "./lifecycle-map.fixture.mjs";

const context = { theme: "aurora", pack: "survey", motion: "none", backend: "smil", layout: "wide", instanceNamespace: "slotA", seed: "" };
const render = (value = inputs(), options = {}) => renderSceneDefinition(scene, value, { ...context, ...options });
const model = value => scene.buildModel(value);
const painted = result => parseSceneXml(result.svg).nodes.filter(node => node.name === "text").map(sceneXmlText).join("\n");

for (const [name, mutate] of [
  ["inherited lifecycle alias", value => { value.snapshot.projects.projects[0].lifecycle = "toString"; }],
  ["constructor lifecycle alias", value => { value.snapshot.projects.projects[0].lifecycle = "constructor"; }],
  ["empty project board", value => { value.snapshot.projects.projects = []; }],
  ["duplicate repository identity", value => { value.snapshot.projects.projects[1].repo = "SCENE-DEMO/ALPHA"; }],
  ["missing root provenance", value => { delete value.snapshot.freshness; }],
  ["unknown source", value => { value.snapshot.projects.freshness.source = "unknown"; }],
  ["mixed synthetic and public provenance", value => { value.snapshot.projects.freshness.source = "github-rest"; value.snapshot.projects.freshness.mode = "live"; }],
  ["invalid calendar timestamp", value => { value.snapshot.projects.freshness.generatedAt = "2026-02-30T00:00:00.000Z"; }],
]) test(`lifecycle rejects ${name}`, () => {
  const value = inputs(); mutate(value);
  assert.equal(render(value).unavailable, true);
});

test("lifecycle prints declarations, observed state words, source and timestamp", () => {
  const result = render(); const text = painted(result);
  for (const word of ["LIFECYCLE", "DECLARED", "SYNTHETIC DEMO", "2026-01-17", "CI PASSING", "CI PENDING", "CI FAILING", "CI UNAVAILABLE", "CI UNCONFIGURED", "v1.0.0"])
    assert.ok(text.includes(word), `painted text omits ${word}`);
  for (const state of ["passing", "pending", "failing", "unavailable", "unconfigured"])
    assert.match(scene.accessibility(model(inputs())).description.toLowerCase(), new RegExp(`ci ${state}`));
});

test("known live provenance is printed rather than synthetic", () => {
  const text = painted(render(live()));
  assert.match(text, /PUBLIC GITHUB/); assert.doesNotMatch(text, /SYNTHETIC DEMO/);
});

for (const mode of ["stale"]) test(`${mode} board cannot display current passing CI or confirmed absent releases`, () => {
  const value = live(); value.snapshot.projects.freshness.mode = mode;
  const result = render(value, { motion: "ambient" }); const text = painted(result);
  assert.equal(result.unavailable, false);
  assert.doesNotMatch(text, /CI PASSING|CI FAILING|CI PENDING|RELEASE NONE/);
  assert.match(text, /STALE|UNAVAILABLE/);
  assert.equal(result.counters.animatedElements, 0);
});

test("old board timestamp degrades observations even when its mode says live", () => {
  const value = live(); value.snapshot.freshness.generatedAt = "2026-01-21T12:00:00.000Z";
  assert.doesNotMatch(painted(render(value)), /CI PASSING|RELEASE NONE/);
});

for (const [name, checkedAt, expected] of [
  ["at the 72-hour boundary", "2026-01-14T12:00:00Z", "passing"],
  ["older than 72 hours", "2026-01-14T11:59:59.999Z", "stale"],
  ["future dated", "2026-01-18T00:00:00Z", "unavailable"],
  ["missing", null, "unavailable"],
  ["invalid date", "2026-02-30T00:00:00Z", "unavailable"],
]) test(`CI observation ${name} is ${expected}`, () => {
  const value = live(inputs([project("Alpha")])); value.snapshot.projects.projects[0].ci.checkedAt = checkedAt;
  assert.equal(model(value).markers[0].lamp, expected);
});

test("missing or contradictory CI never hides a declared project", () => {
  for (const ci of [null, { state: "passing", workflow: null, checkedAt: OBSERVED_AT }, { state: "unconfigured", workflow: "ci.yml" }, { state: "unknown" }]) {
    const value = inputs([project("Alpha")]); value.snapshot.projects.projects[0].ci = ci;
    const result = render(value); assert.equal(result.unavailable, false);
    assert.match(painted(result), /Alpha/); assert.equal(model(value).markers[0].lamp, "unavailable");
  }
});

for (const [name, mutate] of [
  ["impossible timestamp", p => { p.release.publishedAt = "2026-02-30T12:00:00Z"; }],
  ["invalid time", p => { p.release.publishedAt = "2026-01-16T99:99:99Z"; }],
  ["future release", p => { p.release.publishedAt = "2026-01-18T00:00:00Z"; }],
  ["contradictory none", p => { p.releaseState = "none"; }],
  ["missing published record", p => { p.release = null; }],
]) test(`release ${name} stays unavailable without dropping the project`, () => {
  const p = project("Alpha", "active", "passing", "published"); mutate(p);
  const result = render(inputs([p])); assert.equal(result.unavailable, false);
  assert.match(painted(result), /RELEASE UNAVAILABLE/);
  assert.doesNotMatch(painted(result), /v1.0.0|RELEASE NONE/);
});

test("readings never belong to an opacity or scale animation wrapper", () => {
  for (const backend of ["smil", "css"]) {
    const result = render(inputs(), { motion: "ambient", backend });
    const document = parseSceneXml(result.svg);
    for (const node of document.nodes.filter(node => node.name === "g" && /(?:marker|lamp)\d/.test(node.attrs.id ?? "")))
      assert.doesNotMatch(node.raw, /<text\b/, "an animated wrapper contains text");
    assert.ok(result.counters.animatedElements > 0);
    assert.equal(stripSceneMotion(result.svg), render(inputs(), { backend }).svg);
  }
});

test("passing and failing lamps have distinct monochrome geometry", () => {
  const passing = render(inputs([project("Alpha", "active", "passing")]));
  const failing = render(inputs([project("Alpha", "active", "failing")]));
  const geometry = result => result.svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, "").replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/g, "")
    .replace(/#[a-f\d]{6}/gi, "#000000").replace(/data-scene-seed="[^"]*"/g, "");
  assert.notEqual(geometry(passing), geometry(failing));
});

test("six long archived labels fit both layouts in all themes", () => {
  const value = inputs(Array.from({ length: 6 }, (_, index) => project(`Project${index}`, "archived", "unavailable", "unavailable")));
  value.snapshot.projects.projects.forEach((p, index) => { p.name = `${index} ${"W".repeat(90)}`; });
  for (const theme of Object.keys(themes)) for (const layout of ["wide", "compact"]) {
    const result = render(value, { theme, layout }); const document = parseSceneXml(result.svg);
    const [, , width, height] = document.root.attrs.viewBox.split(" ").map(Number);
    assert.ok(height <= 1000); assert.equal(result.counters.animatedElements, 0);
    for (const node of document.nodes.filter(node => node.name === "text" && Number(node.attrs.x) > width * 0.6 && Number(node.attrs.y) > 180))
      assert.ok(Number(node.attrs.x) + [...sceneXmlText(node)].length * Number(node.attrs["font-size"]) * 0.62 <= width - 8,
        `right-edge text overflows: ${sceneXmlText(node)}`);
  }
});

test("unavailable rendering retains theme and requested width without animation", () => {
  for (const theme of Object.keys(themes)) for (const layout of ["wide", "compact"]) {
    const value = inputs(); value.snapshot.projects = null;
    const result = render(value, { theme, layout, motion: "ambient" });
    assert.equal(result.unavailable, true); assert.equal(result.counters.animatedElements, 0);
    assert.match(result.svg, new RegExp(`viewBox="0 0 ${layout === "compact" ? 480 : 720} `));
    assert.ok(result.svg.includes(themes[theme].text));
  }
});

test("shared scene contract proves deterministic, bounded, escaped and available readings", () => {
  const ready = inputs(); const changed = inputs(); changed.snapshot.projects.projects[0].lifecycle = "paused";
  const unavailable = inputs(); unavailable.snapshot.projects = null;
  assertSceneContract(scene, { ready: { inputs: ready, textFields: ["snapshot.projects.projects.0.name"],
    readings: ["Alpha", "LIFECYCLE", "DECLARED"], visibleReadings: ["Alpha", "CI PASSING", "SYNTHETIC DEMO"], encodings: [] },
    changed: { inputs: changed }, unavailable: { inputs: unavailable } });
});


test("the exact declaration stamp is painted intact in the compact header", () => {
  const texts = parseSceneXml(render(inputs(), { layout: "compact" }).svg).nodes.filter(node => node.name === "text").map(sceneXmlText);
  assert.ok(texts.includes("LIFECYCLE · DECLARED"));
  assert.ok(texts.includes("Latest release only; not full history"));
  assert.ok(texts.includes("Long labels shortened; full text in desc."));
});


test("independently completed project fetches may finish after the contribution fetch", () => {
  const value = live(); value.snapshot.projects.freshness.generatedAt = "2026-01-17T12:00:15.000Z";
  const result = render(value); assert.equal(result.unavailable, false);
  assert.match(painted(result), /CI PASSING/);
  assert.equal(model(value).asOf, "2026-01-17T12:00:15.000Z");
});

test("a partial board preserves each independently confirmed signal", () => {
  const value = live(); value.snapshot.projects.freshness.mode = "partial";
  const result = render(value, { motion: "ambient" });
  const text = painted(result);
  assert.match(text, /PARTIAL BOARD/); assert.match(text, /CI PASSING/);
  assert.match(text, /CI UNAVAILABLE/); assert.match(text, /RELEASE UNAVAILABLE/);
  assert.equal(model(value).markers[2].lamp, "unavailable");
  assert.ok(result.counters.animatedElements > 0);
});
