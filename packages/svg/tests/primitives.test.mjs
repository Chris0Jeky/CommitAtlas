import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { escapeXml, themes } from "../dist/index.js";
import { parseSceneXml, validateSceneSvg } from "../dist/scene-svg.js";
import { SCENE_INJECTION } from "./scene-harness.mjs";

const primitives = await import("../dist/primitives/index.js").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const context = { theme: "ember", pack: "survey", layout: "wide" };
function document(fragment) {
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Synthetic primitive fixture" viewBox="0 0 720 320"><title>Synthetic primitive fixture</title><desc>Structural fixture, not a profile claim.</desc>${fragment}</svg>`;
  const parsed = parseSceneXml(xml);
  validateSceneSvg(parsed, "fixture");
  return parsed;
}
function fragments(ctx, label = "Synthetic fixture") {
  return [
    primitives.frame(ctx, { title: label, ref: label, family: "scene", stale: true }),
    primitives.metric(ctx, { label, value: label, unit: label }),
    primitives.badge(ctx, { label }),
    ...["observed", "derived", "hypothesis"].map(rung => primitives.evidenceLabel(ctx, rung)),
    ...[
      { state: "complete", observed: 12, total: 12 },
      { state: "partial", observed: 4, total: 12 },
      { state: "unavailable" }, { state: "not-observed" },
    ].map(state => primitives.coverageBar(ctx, state)),
  ];
}

test("structural primitives have an additive public package entrypoint", () => {
  for (const name of ["frame", "metric", "badge", "evidenceLabel", "coverageBar"]) {
    assert.equal(typeof primitives[name], "function", `missing primitive ${name}`);
  }
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.exports["./primitives"].import, "./dist/primitives/index.js");
  assert.equal(pkg.exports["./primitives"].types, "./dist/primitives/index.d.ts");
});

test("every primitive is valid scene XML in all four themes with escaped injected text", () => {
  for (const theme of Object.keys(themes)) {
    for (const fragment of fragments({ ...context, theme }, SCENE_INJECTION)) {
      const parsed = document(fragment);
      assert.ok(parsed.nodes.every(node => !["script", "image", "foreignObject", "style"].includes(node.name)));
      for (const node of parsed.nodes) {
        assert.ok(Object.keys(node.attrs).every(name => !/^on/iu.test(name)));
      }
    }
    for (const fragment of fragments({ ...context, theme }, SCENE_INJECTION).slice(0, 3)) {
      assert.ok(fragment.includes(escapeXml(SCENE_INJECTION)), "full escaped input retained in accessible title");
    }
  }
});

test("evidence rungs have distinct words, dot fills, and borders without colour", () => {
  const observed = document(primitives.evidenceLabel(context, "observed"));
  const derived = document(primitives.evidenceLabel(context, "derived"));
  const hypothesis = document(primitives.evidenceLabel(context, "hypothesis"));
  assert.notEqual(observed.nodes.find(node => node.name === "circle").attrs.fill, "none");
  assert.equal(derived.nodes.find(node => node.name === "circle").attrs.fill, "none");
  assert.ok(derived.nodes.some(node => node.name === "path"));
  assert.equal(derived.nodes.filter(node => node.name === "rect").length, 2);
  assert.equal(observed.nodes.filter(node => node.name === "rect").length, 1);
  assert.equal(hypothesis.nodes.find(node => node.name === "circle").attrs["stroke-dasharray"], "2 2");
  assert.equal(hypothesis.nodes.find(node => node.name === "rect").attrs["stroke-dasharray"], "4 3");
  for (const rung of ["observed", "derived", "hypothesis"]) {
    assert.match(primitives.evidenceLabel(context, rung), new RegExp(`>${rung.toUpperCase()}<`));
  }
});

test("unavailable and not-observed coverage remain neutral and still under every motion request", () => {
  for (const theme of Object.keys(themes)) {
    for (const state of ["unavailable", "not-observed"]) {
      const base = primitives.coverageBar({ ...context, theme }, { state });
      assert.match(base, state === "unavailable" ? /NO SIGNAL/u : /NOT OBSERVED/u);
      assert.doesNotMatch(base, /animate|class=|\bid=|<style|%|COMPLETE|PASSING/u);
      for (const colour of [themes[theme].positive, themes[theme].warning, themes[theme].negative, themes[theme].accent, themes[theme].chrome]) {
        assert.equal(base.includes(colour), false, `${state} borrowed signal colour ${colour}`);
      }
      for (const motion of ["none", "subtle", "ambient", "cinematic"]) {
        assert.equal(primitives.coverageBar({ ...context, theme, motion }, { state }), base);
      }
    }
  }
});

test("coverage refuses contradictory, unbounded, or unknown states", () => {
  for (const state of [
    {}, { state: "passing" }, { state: "complete", observed: 0, total: 0 },
    { state: "complete", observed: 2, total: 3 },
    { state: "partial", observed: 3, total: 3 },
    { state: "partial", observed: -1, total: 3 },
    { state: "partial", observed: 0.5, total: 3 },
    { state: "partial", observed: 2, total: Infinity },
    { state: "partial", observed: 2, total: 1_000_001 },
    { state: "unavailable", observed: 0, total: 1 },
  ]) assert.throws(() => primitives.coverageBar(context, state), /coverage/u);
  assert.doesNotThrow(() => primitives.coverageBar(context, { state: "partial", observed: 0, total: 1 }));
});

test("zero is a reading, null is unavailable, and non-finite values are rejected", () => {
  assert.match(primitives.metric(context, { label: "Commits", value: 0 }), />0</u);
  const missing = primitives.metric(context, { label: "Commits", value: null, unit: "commits" });
  assert.match(missing, />UNAVAILABLE</u);
  assert.doesNotMatch(missing, />0<|>commits</u);
  for (const value of [NaN, Infinity, -Infinity, undefined, {}, true]) {
    assert.throws(() => primitives.metric(context, { label: "Commits", value }), /metric/u);
  }
});

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("body and small-text ink meet chassis floors on both opaque surfaces", () => {
  for (const [name, theme] of Object.entries(themes)) {
    for (const background of [theme.background, theme.surface]) {
      assert.ok(contrast(theme.text, background) >= 7, `${name}: body ink`);
      for (const ink of [theme.muted, theme.chrome]) assert.ok(contrast(ink, background) >= 4.5, `${name}: small text`);
    }
    for (const fragment of fragments({ ...context, theme: name })) {
      for (const node of document(fragment).nodes.filter(node => node.name === "text")) {
        assert.ok([theme.text, theme.muted, theme.chrome].includes(node.attrs.fill), "unverified text ink role");
        assert.doesNotMatch(node.attrs["font-family"], /https?:|Inter|Geist/u);
      }
    }
  }
});

test("family stamps, stale slots and survey defaults remain deterministic and bounded", () => {
  const familyLabels = { instrument: "INSTRUMENT", map: "MAP", signature: "DERIVED SIGNATURE", scene: "SCENE", finding: "RESEARCH FINDING" };
  for (const [family, stamp] of Object.entries(familyLabels)) {
    const fragment = primitives.frame(context, { title: "Fixture", ref: "01", family, stale: true });
    assert.ok(fragment.includes(stamp));
    assert.match(fragment, />STALE</u);
    if (family === "signature") assert.match(fragment, /not a productivity score/u);
    assert.equal(document(fragment).nodes.find(node => node.name === "path").attrs.fill, themes.ember.background);
  }
  assert.deepEqual(fragments(context), fragments({ theme: "ember" }));
  assert.deepEqual(fragments(context), fragments(context));
  for (const fragment of fragments(context, "&".repeat(160))) {
    assert.ok(Buffer.byteLength(fragment) < 8_000);
    assert.doesNotMatch(fragment, /\bid=|\bclass=|<style|<animate/u);
  }
  for (const bad of [{ ...context, theme: "toString" }, { ...context, pack: "orbital" }, { ...context, layout: "giant" }]) {
    assert.throws(() => primitives.badge(bad, { label: "Fixture" }), /theme|pack|layout/u);
  }
  assert.throws(() => primitives.frame(context, { title: "Fixture", ref: "01", family: "score" }), /family/u);
  assert.throws(() => primitives.badge(context, { label: "x".repeat(161) }), /text/u);
  assert.throws(() => primitives.badge(context, { label: "Fixture", x: NaN }), /coordinate/u);
  assert.throws(() => primitives.frame(context, { title: "Fixture", ref: "01", family: "scene", width: 1 }), /dimension/u);
});

test("short automatic-width badges retain their full visible label", () => {
  const label = "Coverage, not a score";
  assert.match(primitives.badge(context, { label }), />Coverage, not a score<\/text>/u);
});
