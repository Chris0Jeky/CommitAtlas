import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as svg from "../dist/index.js";
import { parseSceneXml, sceneXmlText } from "../dist/scene-svg.js";
import { assertSceneContract, stripSceneMotion } from "./scene-harness.mjs";
const fields = await import("../dist/primitives/field.js").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const context = { theme: "ember", pack: "survey", motion: "none", backend: "css", layout: "wide", instanceNamespace: "slotA", seed: svg.stableHash("synthetic") };
const pathData = "M8 140L60 120L140 60L220 100L312 20";
function recipes(ctx, state = "pending", count = 12) {
  return [
    fields.particleField(ctx, { key: "dust", count }),
    fields.scanline(ctx, { key: "scan" }),
    fields.plotterPath(ctx, { key: "trace", d: pathData }),
    fields.signalPulse(ctx, { key: "status", state }),
  ];
}
function scene(factory = recipes, options = {}) {
  return {
    id: "field-fixture", family: "scene", budget: "scene", supportedPacks: ["survey"], supportedMotion: ["none", "subtle", "ambient", "cinematic"],
    buildModel(inputs) { return inputs.snapshot.marker === "unavailable" ? svg.sceneUnavailable("Synthetic fixture unavailable") : { marker: inputs.snapshot.marker }; },
    accessibility() { return { title: "Synthetic field fixture", description: "Decorative particles, scan and plotter texture. The supplied signal state is explicit; texture motion encodes no reading." }; },
    render(model, ctx) {
      const result = fields.compileFieldPrimitives(ctx, factory(ctx, model), { target: "github-readme", ...options });
      const a = this.accessibility(model);
      return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${a.title}" viewBox="0 0 320 180"><title>${a.title}</title><desc>${a.description}</desc>${result.motion.style}${result.fragment}</svg>`;
    },
  };
}
function render(factory = (ctx) => recipes(ctx), overrides = {}, marker = "first", options = {}) {
  return svg.renderSceneDefinition(scene(factory, options), { snapshot: { marker } }, { ...context, ...overrides });
}
function nodes(result) { return parseSceneXml(result.svg).nodes; }

test("field APIs and the single-plan assembler are available", () => {
  for (const name of ["particleField", "scanline", "plotterPath", "signalPulse", "compileFieldPrimitives"]) assert.equal(typeof fields[name], "function", name);
});

test("seeded fields are reproducible and change with model seed", () => {
  assert.deepEqual(render(), render());
  assert.notEqual(render().svg, render(undefined, {}, "changed").svg);
  for (const theme of Object.keys(svg.themes)) {
    const a = render(undefined, { theme });
    assert.equal(a.unavailable, false);
    assert.ok(a.counters.bytes < 30_000);
    assert.equal(a.counters.animatedElements, 0);
  }
});

test("particle count is explicitly capped at 96 and zero is decoration-free", () => {
  for (const count of [0, 1, 96, 97, 1e9]) {
    const recipe = fields.particleField(context, { key: "stars", count });
    assert.equal(recipe.count, Math.min(count, 96));
    assert.equal(recipe.capped, count > 96);
    const output = render(() => [recipe], { motion: "ambient" });
    assert.equal(output.counters.animatedElements, Math.min(count, 96));
    assert.equal(output.counters.loopingGroups, count ? 1 : 0);
    assert.equal(nodes(output).filter(n => n.name === "circle").length, Math.min(count, 96));
  }
  for (const count of [-1, 0.5, NaN, Infinity, "1"]) assert.throws(() => fields.particleField(context, { key: "stars", count }), /count/u);
});

test("particle geometry is bounded at the minimum and maximum layouts", () => {
  for (const width of [160, 1600]) for (const height of [96, 1000]) {
    const output = render(ctx => [fields.particleField(ctx, { key: "stars", count: 96, width, height })]);
    for (const node of nodes(output).filter(n => n.name === "circle")) {
      const a = node.attrs, x = Number(a.cx), y = Number(a.cy), r = Number(a.r);
      assert.ok(x - r >= 0 && x + r <= width && y - r >= 0 && y + r <= height);
    }
  }
});

test("plotter base retains the complete dim trace outside the animated wrapper", () => {
  for (const backend of ["css", "smil"]) {
    const output = render(ctx => [fields.plotterPath(ctx, { key: "trace", d: pathData })], { backend, motion: "ambient" });
    const paths = nodes(output).filter(n => n.name === "path");
    assert.equal(paths.length, 2);
    assert.equal(paths[0].attrs.d, paths[1].attrs.d);
    assert.equal(paths[0].attrs.opacity, "0.22");
    assert.equal(paths[0].attrs["stroke-dasharray"], undefined);
    assert.equal(output.counters.animatedElements, 1);
    assert.equal(output.counters.loopingGroups, 1);
    const base = render(ctx => [fields.plotterPath(ctx, { key: "trace", d: pathData })], { backend });
    assert.equal(stripSceneMotion(output.svg), base.svg);
  }
});

test("unknown signal states stay neutral and hook-free under every profile", () => {
  for (const state of ["unavailable", "unconfigured", "stale"]) {
    for (const theme of Object.keys(svg.themes)) {
      const base = render(ctx => [fields.signalPulse(ctx, { key: "status", state })], { theme });
      for (const motion of ["none", "subtle", "ambient", "cinematic"]) {
        const output = render(ctx => [fields.signalPulse(ctx, { key: "status", state })], { theme, motion });
        assert.equal(output.svg, base.svg);
        assert.equal(output.counters.animatedElements, 0);
        assert.doesNotMatch(output.svg, /<animate|<style|\bclass=|\bid=/u);
        for (const ink of [svg.themes[theme].chrome, svg.themes[theme].positive, svg.themes[theme].negative, svg.themes[theme].warning]) assert.equal(output.svg.includes(ink), false);
      }
    }
  }
});

test("only pending signals pulse and their literal label is outside motion", () => {
  for (const state of ["pending", "passing", "failing", "unavailable", "unconfigured", "stale"]) {
    const output = render(ctx => [fields.signalPulse(ctx, { key: "status", state })], { motion: "ambient", backend: "smil" });
    assert.equal(output.counters.animatedElements, state === "pending" ? 1 : 0);
    assert.ok(nodes(output).some(n => n.name === "text" && sceneXmlText(n) === state.toUpperCase()));
    for (const wrapper of nodes(output).filter(n => n.attrs.class)) assert.equal(wrapper.children.some(n => n.name === "text"), false);
  }
  assert.throws(() => fields.signalPulse(context, { key: "status", state: "healthy" }), /state/u);
});

test("one shared plan counts every field contribution in both backends", () => {
  for (const backend of ["css", "smil"]) {
    const output = render(undefined, { backend, motion: "ambient" });
    assert.equal(output.counters.animatedElements, 15);
    assert.equal(output.counters.loopingGroups, 4);
    assert.equal(stripSceneMotion(output.svg), render(undefined, { backend }).svg);
    assert.equal(render(undefined, { backend, motion: "subtle" }).counters.animatedElements, 0);
    if (backend === "css") assert.equal(output.reducedMotion, "css-media-query");
    else {
      assert.equal(output.reducedMotion, "none-twin-required");
      for (const node of nodes(output).filter(n => n.name.startsWith("animate"))) assert.equal(node.attrs.fill, "remove");
    }
  }
});

test("whole-scene budgets cannot be bypassed with several separately created fields", () => {
  assert.throws(() => render(ctx => recipes(ctx, "pending", 96), { motion: "ambient" }), /budget/u);
  assert.throws(() => render(ctx => Array.from({ length: 7 }, (_, i) => fields.scanline(ctx, { key: `scan${i}` })), { motion: "ambient" }), /looping group budget/u);
});

test("duplicate keys, forged recipes, wrong themes and conflicting extra applications fail", () => {
  assert.throws(() => render(ctx => [fields.scanline(ctx, { key: "a" }), fields.scanline(ctx, { key: "a" })]), /duplicate/u);
  assert.throws(() => render(() => [{ key: "fake", count: 1, capped: false }]), /recipe/u);
  assert.throws(() => render(ctx => [fields.scanline({ ...ctx, theme: "paper" }, { key: "a" })]), /theme/u);
  assert.throws(() => render(ctx => [fields.scanline(ctx, { key: "scan" })], {}, "first", {
    applications: [{ primitive: "enter", target: "scan-beam", decorative: true }],
  }), /reserved/u);
});

test("path grammar, coordinate, key, seed and ink boundaries fail before markup", () => {
  for (const d of ["", "M0 0", "M0 0LNaN 1", "M0 0L1e999 1", "M-1 0L1 1", "M0 0L321 1", "m0 0l1 1", 'M0 0L1 1\"/><script/>', "M0 0C1 1 2 2 3 3", "M0 0L1 1Z"]) {
    assert.throws(() => fields.plotterPath(context, { key: "trace", d }), /path/u, d);
  }
  assert.throws(() => fields.particleField(context, { key: 'x"', count: 1 }), /key/u);
  assert.throws(() => fields.particleField({ ...context, seed: "bad" }, { key: "a", count: 1 }), /seed/u);
  assert.throws(() => fields.particleField(context, { key: "a", count: 1, ink: "#fff" }), /ink/u);
  assert.throws(() => fields.scanline(context, { key: "a", orientation: "diagonal" }), /orientation/u);
});

test("field composition satisfies the shared scene contract", () => {
  const definition = scene(ctx => recipes(ctx));
  assertSceneContract(definition, {
    ready: { inputs: { snapshot: { marker: "ready" } }, readings: [], encodings: ["Decorative", "no reading"], textFields: [] },
    changed: { inputs: { snapshot: { marker: "changed" } } },
    unavailable: { inputs: { snapshot: { marker: "unavailable" } } },
  });
});

test("the package exposes the field entrypoint", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.exports["./primitives/field"].import, "./dist/primitives/field.js");
});

test("the assembler exposes individually placeable fragments without recompiling", () => {
  const definition = scene(ctx => recipes(ctx));
  definition.render = function (model, ctx) {
    const output = fields.compileFieldPrimitives(ctx, recipes(ctx), { target: "web" });
    assert.deepEqual(Object.keys(output.fragments), ["dust", "scan", "trace", "status"]);
    assert.equal(Object.values(output.fragments).join(""), output.fragment);
    assert.ok(Object.isFrozen(output.fragments));
    const placed = Object.values(output.fragments).map(fragment => `<g transform="translate(8 8)">${fragment}</g>`).join("");
    const a = this.accessibility(model);
    return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${a.title}" viewBox="0 0 400 220"><title>${a.title}</title><desc>${a.description}</desc>${output.motion.style}${placed}</svg>`;
  };
  const output = svg.renderSceneDefinition(definition, { snapshot: { marker: "placed" } }, { ...context, motion: "ambient" });
  assert.equal(output.counters.animatedElements, 15);
});

test("plotter paths cannot turn empty or over-budget traces into motion", () => {
  for (const d of ["M10 10L10 10", "M10 10L10.00001 10.00001", Array.from({ length: 366 }, (_, i) => `${i ? 'L' : 'M'}${i % 2 ? 320 : 0} 0`).join("")]) {
    assert.throws(() => fields.plotterPath(context, { key: "trace", d }), /path/u);
  }
});

test("reading entrances share the field plan without escaping its counters", () => {
  const definition = scene();
  definition.render = function (model, ctx) {
    const output = fields.compileFieldPrimitives(ctx, recipes(ctx), { target: "web", applications: [
      { primitive: "enter", target: "reading", decorative: false },
    ] });
    const reading = output.motion.bindings.find(binding => binding.target === "reading"), a = this.accessibility(model);
    return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${a.title}" viewBox="0 0 400 220"><title>${a.title}</title><desc>${a.description}</desc>${output.motion.style}${output.fragment}<g id="${reading.id}" class="${reading.className}"><text x="8" y="200">Synthetic reading</text>${reading.children}</g></svg>`;
  };
  const output = svg.renderSceneDefinition(definition, { snapshot: { marker: "reading" } }, { ...context, motion: "ambient" });
  assert.equal(output.counters.animatedElements, 16);
  assert.equal(output.counters.loopingGroups, 4);
});
