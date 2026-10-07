import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as svg from "../dist/index.js";
import { parseSceneXml } from "../dist/scene-svg.js";
import { SCENE_PACKS, scenePackGeometry } from "../dist/packs.js";
import { assertSceneContract } from "./scene-harness.mjs";
import { exampleFixtures, sceneContext, sceneInputs } from "./scene.fixture.mjs";

const primitives = await import("../dist/primitives/index.js");
const PACKS = ["survey", "orbital", "spectral", "terminal"];
const THEMES = ["aurora", "midnight", "paper", "ember"];

function channel(value) {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  assert.ok(match, `not an opaque hex colour: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  return 0.2126 * channel((value >> 16) & 0xff)
    + 0.7152 * channel((value >> 8) & 0xff)
    + 0.0722 * channel(value & 0xff);
}
function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}
function themeColours(theme) {
  const colours = new Set();
  for (const value of Object.values(theme)) {
    if (typeof value === "string" && value.startsWith("#")) colours.add(value.toLowerCase());
    if (Array.isArray(value)) {
      for (const entry of value) if (typeof entry === "string" && entry.startsWith("#")) colours.add(entry.toLowerCase());
    }
  }
  return colours;
}
function paints(fragment) {
  const document = parseSceneXml(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`);
  return document.nodes.flatMap(node => ["fill", "stroke"].flatMap(name => {
    const paint = node.attrs[name];
    return paint && paint !== "none" ? [{ node: node.name, paint }] : [];
  }));
}

function packProofScene() {
  return {
    id: "pack-proof", family: "scene", budget: "scene",
    supportedPacks: PACKS, supportedMotion: ["none", "ambient"],
    buildModel(inputs) {
      if (inputs.snapshot.freshness.mode === "unavailable") return svg.sceneUnavailable("Pack proof has no signal");
      return { label: inputs.snapshot.profile.name, reading: inputs.snapshot.metrics.total };
    },
    accessibility(model) {
      return {
        title: `Pack proof ${model.label}`,
        description: `${model.label}: ${model.reading} observations. Plate corner follows the pack. Grid pitch follows the pack. Marker shape follows the pack. Border stroke marks the plate.`,
      };
    },
    render(model, context) {
      const accessibility = this.accessibility(model);
      const motion = svg.compileSceneMotion(context, [
        { primitive: "breathe", target: "marker", decorative: true, loopGroup: "pack-proof" },
      ], { target: "web" });
      const marker = motion.bindings[0];
      const plate = primitives.frame({ theme: context.theme, pack: context.pack, layout: context.layout }, {
        title: model.label, ref: String(model.reading), family: "scene",
      });
      return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${svg.escapeXml(accessibility.title)}" viewBox="0 0 720 320"><title>${svg.escapeXml(accessibility.title)}</title><desc>${svg.escapeXml(accessibility.description)}</desc>${motion.style}${plate}<g id="${marker.id}" class="${marker.className}" aria-hidden="true">${marker.children}</g></svg>`;
    },
    renderUnavailable(_state, context, accessibility) {
      const plate = primitives.frame({ theme: context.theme, pack: context.pack, layout: context.layout }, {
        title: "No signal", ref: "NONE", family: "scene", width: 640, height: 160,
      });
      const ink = svg.themes[context.theme].muted;
      return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${svg.escapeXml(accessibility.title)}" viewBox="0 0 640 160"><title>${svg.escapeXml(accessibility.title)}</title><desc>${svg.escapeXml(accessibility.description)}</desc>${plate}<text x="24" y="110" fill="${ink}">UNAVAILABLE</text></svg>`;
    },
  };
}

test("pack geometry is data, and the survey plate keeps the corner-18 frame", () => {
  assert.deepEqual(PACKS.map(pack => scenePackGeometry(pack).marker), ["plate", "ring", "band", "cell"]);
  assert.deepEqual(Object.keys(SCENE_PACKS), PACKS);
  const survey = primitives.frame({ theme: "ember", pack: "survey", layout: "wide" }, {
    title: "Fixture", ref: "01", family: "scene", width: 720, height: 320,
  });
  assert.match(survey, /d="M0 0H702L720 18V320H0Z"/u);
  assert.match(survey, /d="M1 1H701L719 19V319H1Z"/u);
  assert.equal(paints(survey).filter(item => item.node === "path").length, 3);
  for (const pack of ["orbital", "spectral", "terminal"]) {
    const marked = primitives.frame({ theme: "ember", pack, layout: "wide" }, {
      title: "Fixture", ref: "01", family: "scene", width: 720, height: 320,
    });
    assert.notEqual(marked, survey, `${pack} must change plate geometry`);
  }
});

test("one scene renders four byte-distinct packs that pass the scene contract", () => {
  const definition = packProofScene();
  const fixtures = exampleFixtures();
  fixtures.ready.readings = [String(fixtures.ready.inputs.snapshot.metrics.total), fixtures.ready.inputs.snapshot.profile.name];
  fixtures.ready.encodings = ["Plate corner", "Grid pitch", "Marker shape", "Border stroke"];
  fixtures.ready.textFields = ["snapshot.profile.name"];
  assertSceneContract(definition, fixtures);
  const outputs = PACKS.map(pack => svg.renderSceneDefinition(definition, sceneInputs(), { ...sceneContext, pack }).svg);
  assert.equal(new Set(outputs).size, 4);
  const again = PACKS.map(pack => svg.renderSceneDefinition(definition, sceneInputs(), { ...sceneContext, pack }).svg);
  assert.deepEqual(outputs, again);
});

test("an unavailable fixture stays explicit, unlit, and steady under every pack", () => {
  const definition = packProofScene();
  const unavailable = exampleFixtures().unavailable.inputs;
  for (const pack of PACKS) {
    for (const themeName of THEMES) {
      const theme = svg.themes[themeName];
      const result = svg.renderSceneDefinition(definition, unavailable, { ...sceneContext, pack, theme: themeName });
      assert.equal(result.unavailable, true, pack);
      assert.equal(result.counters.animatedElements, 0, pack);
      assert.equal(result.counters.loopingGroups, 0, pack);
      assert.match(result.svg, /<desc>[^<]*unavailable/iu);
      assert.match(result.svg, />UNAVAILABLE</u);
      assert.doesNotMatch(result.svg, /<animate/iu);
      for (const signal of [theme.accent, theme.positive, theme.warning, theme.negative]) {
        assert.equal(result.svg.includes(signal), false, `${pack} ${themeName} lights ${signal}`);
      }
    }
  }
});

test("pack marks introduce no colour outside the theme, and their ink clears the chassis floors", () => {
  for (const themeName of THEMES) {
    const theme = svg.themes[themeName];
    const allowed = themeColours(theme);
    for (const pack of PACKS) {
      const fragment = primitives.frame({ theme: themeName, pack, layout: "wide" }, {
        title: "Fixture", ref: "01", family: "scene", width: 720, height: 320,
      });
      for (const item of paints(fragment)) {
        assert.equal(allowed.has(item.paint.toLowerCase()), true, `${pack} on ${themeName} introduced ${item.paint}`);
        if (item.node !== "text") continue;
        assert.ok(contrast(item.paint, theme.background) >= 4.5, `${pack} ${themeName} text on ground`);
        assert.ok(contrast(item.paint, theme.surface) >= 4.5, `${pack} ${themeName} text on plate`);
      }
      if (pack === "survey") continue;
      const mark = paints(fragment).find(item => item.node !== "path" && item.node !== "text");
      assert.ok(mark, `${pack} paints a marker`);
      assert.equal(mark.paint.toLowerCase(), theme.chrome.toLowerCase());
      assert.ok(contrast(theme.chrome, theme.background) >= 3, `${pack} ${themeName} marker on ground`);
      assert.ok(contrast(theme.chrome, theme.surface) >= 3, `${pack} ${themeName} marker on plate`);
    }
  }
});

test("pack source has no colour literal and theme source has no geometry numbers", () => {
  const packSource = readFileSync(new URL("../src/packs.ts", import.meta.url), "utf8");
  assert.doesNotMatch(packSource, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/u);
  const themeSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const themesBlock = themeSource.slice(themeSource.indexOf("export const themes"), themeSource.indexOf("export interface RenderOptions"));
  assert.doesNotMatch(themesBlock.replace(/#[0-9a-fA-F]{3,8}/gu, ""), /\d/u);
});
