import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { themes, escapeXml } from "../dist/index.js";
import { parseSceneXml, validateSceneSvg, sceneXmlText } from "../dist/scene-svg.js";
const geometry = await import("../dist/primitives/geometric.js").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const ctx = { theme: "ember", pack: "survey" };
import { keys, fixtures } from "./geometric.fixture.mjs";
function render(name, options = fixtures[name], context = ctx) { return geometry[name](context, options); }
function document(fragment) {
  const parsed = parseSceneXml(`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Synthetic geometric fixture" viewBox="0 0 320 180"><title>Synthetic geometric fixture</title><desc>Bounded synthetic geometry, not a profile claim.</desc>${fragment}</svg>`);
  validateSceneSvg(parsed, "fixture");
  return parsed;
}
function assertBounds(fragment, width, height) {
  for (const node of document(fragment).nodes) {
    const a = node.attrs;
    for (const attr of ["x", "x1", "x2", "cx"]) if (a[attr] !== undefined) assert.ok(Number(a[attr]) >= 0 && Number(a[attr]) <= width, `${node.name}.${attr}=${a[attr]}`);
    for (const attr of ["y", "y1", "y2", "cy"]) if (a[attr] !== undefined) assert.ok(Number(a[attr]) >= 0 && Number(a[attr]) <= height, `${node.name}.${attr}=${a[attr]}`);
    if (node.name === "circle") {
      const r = Number(a.r), x = Number(a.cx), y = Number(a.cy);
      assert.ok(x - r >= 0 && x + r <= width && y - r >= 0 && y + r <= height);
    }
    if (a.d) {
      // The geometry vocabulary deliberately emits only absolute M/L coordinate pairs and Z.
      assert.match(a.d, /^[MLZ0-9., \-]+$/u);
      const values = a.d.match(/-?\d+(?:\.\d+)?/gu).map(Number);
      assert.equal(values.length % 2, 0);
      for (let i = 0; i < values.length; i += 2) assert.ok(values[i] >= 0 && values[i] <= width && values[i + 1] >= 0 && values[i + 1] <= height, a.d);
    }
  }
  assert.doesNotMatch(fragment, /NaN|Infinity|undefined|<animate|<style|\bid=|\bclass=/u);
}

test("all six geometric APIs are available", () => {
  for (const name of Object.keys(fixtures)) assert.equal(typeof geometry[name], "function", name);
  assert.deepEqual([...geometry.DNA_AXES], keys);
});

test("geometries are deterministic, bounded, immutable and XML-safe in every theme", () => {
  for (const theme of Object.keys(themes)) {
    for (const [name, options] of Object.entries(fixtures)) {
      const original = structuredClone(options);
      const output = render(name, options, { ...ctx, theme });
      assert.equal(output, render(name, options, { ...ctx, theme }));
      assert.deepEqual(options, original);
      assertBounds(output, 320, 180);
      assert.ok(Buffer.byteLength(output) < 12_000);
    }
  }
});

test("each primitive has an inspectable per-theme golden digest", () => {
  const expected = JSON.parse(readFileSync(new URL("./geometric.snapshots.json", import.meta.url), "utf8"));
  for (const theme of Object.keys(themes)) for (const name of Object.keys(fixtures)) {
    assert.equal(createHash("sha256").update(render(name, fixtures[name], { ...ctx, theme })).digest("hex"), expected[theme][name], `${theme}/${name}`);
  }
});

test("finite extremes clamp without overflowing arithmetic", () => {
  const huge = Number.MAX_VALUE;
  const cases = {
    orbit: { rings: [1e9], bodies: [{ ring: 0, angle: huge, size: huge }] },
    radar: { axes: ["a", "b", "c"], values: [-huge, huge, 1e9] },
    terrain: { series: [0, huge, huge], peaks: [] },
    timeline: { stations: ["a", "b"], position: huge },
    projectNode: { label: "a", disclosure: "public", size: huge },
    sparkline: { series: [-huge, huge, huge] },
  };
  for (const [name, options] of Object.entries(cases)) {
    const fragment = render(name, options);
    assertBounds(fragment, 320, 180);
    assert.match(fragment, /GEOMETRY CLAMPED/u, name);
  }
});

test("non-finite readings are neutral unavailable states, never zeros", () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const cases = {
      orbit: { rings: [invalid], bodies: [] },
      radar: { axes: ["a", "b", "c"], values: [0, invalid, 1] },
      terrain: { series: [1, invalid] },
      timeline: { stations: ["a", "b"], position: invalid },
      projectNode: { label: "a", disclosure: "public", language: "TypeScript", size: invalid },
      sparkline: { series: [1, invalid] },
    };
    for (const [name, options] of Object.entries(cases)) {
      const fragment = render(name, options);
      assertBounds(fragment, 320, 180);
      assert.match(fragment, /UNAVAILABLE/u);
      for (const colour of [themes.ember.accent, themes.ember.chrome, ...themes.ember.languagePalette]) assert.equal(fragment.includes(colour), false);
    }
  }
});

test("radar preserves generic axis order and canonicalizes the complete DNA key set", () => {
  assert.throws(() => render("radar", { axes: ["a", "b"], values: [0, 1] }), /axes/u);
  assert.throws(() => render("radar", { axes: ["a", "a", "b"], values: [0, 1, 1] }), /axes/u);
  assert.throws(() => render("radar", { axes: ["a", "b", "c"], values: [0] }), /values/u);
  const reverse = { axes: [...keys].reverse(), values: [...fixtures.radar.values].reverse() };
  assert.equal(render("radar", reverse), render("radar"));
  const labels = document(render("radar")).nodes.filter(n => n.name === "text").map(sceneXmlText).join(" ");
  assert.ok(labels.indexOf("focus") < labels.indexOf("shipping"));
});

test("zero, absent and one-point series are different stable states", () => {
  assert.match(render("terrain", { series: [0, 0, 0] }), /NO OBSERVED ACTIVITY IN WINDOW/u);
  for (const name of ["terrain", "sparkline"]) {
    assert.match(render(name, { series: [] }), /UNAVAILABLE/u);
    assert.doesNotMatch(render(name, { series: [0] }), /UNAVAILABLE/u);
    assertBounds(render(name, { series: [5] }), 320, 180);
  }
});

test("disclosure uses structure and unavailable projects never borrow language ink", () => {
  for (const disclosure of ["public", "synthetic", "private-alias", "masked-alias"]) {
    const output = render("projectNode", { ...fixtures.projectNode, disclosure });
    assert.equal(output.includes('stroke-dasharray="4 3"'), disclosure.endsWith("alias"));
  }
  const missing = render("projectNode", { ...fixtures.projectNode, state: "unavailable" });
  assert.match(missing, /UNAVAILABLE/u);
  assert.throws(() => render("projectNode", { ...fixtures.projectNode, disclosure: "private" }), /disclosure/u);
});

test("hostile and wide labels remain escaped, accessible and structurally bounded", () => {
  const injection = '</text><script>alert("x")</script>&';
  const cases = {
    orbit: { rings: [1], bodies: [{ ring: 0, angle: 0, label: injection }] },
    radar: { axes: [injection, "b", "c"], values: [0, 1, 0] },
    terrain: { series: [1, 2], peaks: [{ index: 1, label: injection }] },
    timeline: { stations: [injection, "b"], position: 0 },
    projectNode: { ...fixtures.projectNode, label: injection, language: injection },
    sparkline: { series: [1, 2], label: injection },
  };
  for (const [name, options] of Object.entries(cases)) {
    const output = render(name, options);
    assertBounds(output, 320, 180);
    assert.ok(output.includes(escapeXml(injection)), name);
  }
  assertBounds(render("projectNode", { ...fixtures.projectNode, label: "界".repeat(160), width: 160, height: 96 }), 160, 96);
});

test("structural limits reject sparse arrays, bad indices, overlong text and invalid layout", () => {
  assert.throws(() => render("orbit", { rings: [1], bodies: [{ ring: 1, angle: 0 }] }), /ring/u);
  assert.throws(() => render("terrain", { series: [1], peaks: [{ index: 1, label: "bad" }] }), /peak/u);
  assert.throws(() => render("sparkline", { series: Array(2) }), /sparse/u);
  assert.throws(() => render("terrain", { series: Array(367).fill(1) }), /series/u);
  assert.throws(() => render("timeline", { stations: Array(13).fill("a") }), /stations/u);
  assert.throws(() => render("projectNode", { ...fixtures.projectNode, label: "a".repeat(161) }), /text/u);
  for (const name of Object.keys(fixtures)) {
    assert.throws(() => render(name, { ...fixtures[name], width: NaN }), /dimension/u);
    assert.throws(() => render(name, fixtures[name], { theme: "toString" }), /theme/u);
    assert.throws(() => render(name, fixtures[name], { ...ctx, pack: "orbital" }), /pack/u);
  }
});

test("single zero terrain still draws a visible basin", () => {
  const parsed = document(render("terrain", { series: [0] }));
  const trace = parsed.nodes.find(node => node.name === "path");
  assert.match(trace.attrs.d, /L/u, "a move-only path is not visible terrain");
});

test("clamped project labels reserve independent rows for disclosure and limit status", () => {
  const parsed = document(render("projectNode", { ...fixtures.projectNode, size: 1e9, width: 160, height: 96 }));
  const text = parsed.nodes.filter(node => node.name === "text");
  const status = text.find(node => sceneXmlText(node) === "GEOMETRY CLAMPED");
  const disclosure = text.find(node => sceneXmlText(node) === "PUBLIC");
  assert.ok(Number(status.attrs.y) - Number(disclosure.attrs.y) >= 12);
});

test("runtime theme values cannot exploit property-key coercion", () => {
  assert.throws(() => render("sparkline", fixtures.sparkline, { theme: ["ember"] }), /theme/u);
});

test("dense geometry respects small, fractional, large and clamped viewport bounds", () => {
  for (const width of [1, 160, 160.0004, 161.9, 480, 1600, 1e9]) {
    for (const height of [1, 96, 96.0004, 97.9, 320, 1000, 1e9]) {
      for (const [name, base] of Object.entries(fixtures)) {
        const options = { ...base, width, height };
        if (name === "orbit") options.bodies = Array.from({ length: 12 }, (_, i) => ({ ring: 2, angle: i * 30, size: 12 }));
        if (name === "radar") { options.axes = Array.from({ length: 8 }, (_, i) => `axis-${i}`); options.values = [0, 1, 0, 1, 0, 1, 0, 1]; }
        assertBounds(render(name, options), Math.min(1600, Math.max(160, width)), Math.min(1000, Math.max(96, height)));
      }
    }
  }
});
