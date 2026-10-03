import assert from "node:assert/strict";
import * as svg from "../dist/index.js";
import { parseSceneXml, sceneXmlText } from "../dist/scene-svg.js";

export const SCENE_INJECTION = `<img src=x onerror="alert(1)"><script>alert(2)</script>&"'\u0000\u0008\ud800`;

// Lifted from svg.test.mjs; the shared scanner now also serves the render boundary.
export function assertXml10(output) {
  for (const character of output) {
    const codePoint = character.codePointAt(0);
    assert.ok(codePoint === 9 || codePoint === 10 || codePoint === 13 ||
      codePoint >= 0x20 && codePoint <= 0xd7ff || codePoint >= 0xe000 && codePoint <= 0xfffd ||
      codePoint >= 0x10000 && codePoint <= 0x10ffff, `forbidden XML character U+${codePoint.toString(16)}`);
  }
}
export function assertWellFormedXml(output) {
  assertXml10(output);
  return parseSceneXml(output);
}
export function stripSceneMotion(output) {
  return output.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gu, "")
    .replace(/<animate(?:Transform|Motion)?\b[^>]*\/>/gu, "");
}

function injectedInputs(inputs, path) {
  const copy = structuredClone(inputs);
  const keys = path.split(".");
  let parent = copy;
  for (const key of keys.slice(0, -1)) parent = parent[key];
  assert.equal(typeof parent[keys.at(-1)], "string", `text fixture path ${path} must be a string`);
  parent[keys.at(-1)] = SCENE_INJECTION;
  if (copy.lens) copy.lens = svg.createPublicDemoLensContext(copy.lens);
  return copy;
}

function checkAccessibility(result, fixture) {
  const document = assertWellFormedXml(result.svg);
  const title = document.nodes.find(node => node.name === "title");
  const desc = document.nodes.find(node => node.name === "desc");
  assert.ok(title && sceneXmlText(title).trim(), "missing title");
  assert.ok(desc && sceneXmlText(desc).trim(), "missing desc");
  const description = sceneXmlText(desc);
  for (const reading of fixture.readings ?? []) assert.ok(description.includes(reading), `description omits reading ${reading}`);
  for (const encoding of fixture.encodings ?? []) assert.ok(description.includes(encoding), `description omits encoding ${encoding}`);
  if (fixture.unavailable) {
    assert.equal(result.unavailable, true, "unavailable fixture produced a healthy model");
    assert.match(description, /unavailable/iu);
    assert.match(result.svg, /<text\b/u, "unavailable composition is blank");
    assert.equal(result.counters.animatedElements, 0);
  } else assert.equal(result.unavailable, false);
  return document;
}

/** Fixtures declare every scene-consumed text path and the meaning of every visual encoding. */
export function assertSceneContract(definition, fixtures) {
  assert.ok(fixtures.ready && fixtures.changed && fixtures.unavailable, "ready, one-field changed and unavailable fixtures required");
  assert.ok(Array.isArray(fixtures.ready.textFields), "declare consumed text fields, including an empty list for text-free input");
  const base = { theme: "aurora", pack: definition.supportedPacks[0], motion: "none", backend: "css", layout: "wide", instanceNamespace: "slotA", seed: "" };
  const render = (fixture, overrides = {}) => svg.renderSceneDefinition(definition, fixture.inputs, { ...base, ...overrides });
  for (const backend of ["css", "smil"]) {
    for (const pack of definition.supportedPacks) {
      for (const motion of definition.supportedMotion) {
        const context = { backend, pack, motion };
        const first = render(fixtures.ready, context);
        const second = render(fixtures.ready, context);
        assert.deepEqual(first, second, "nondeterministic scene render");
        checkAccessibility(first, fixtures.ready);
        const budget = svg.MOTION_BUDGETS[definition.budget];
        assert.ok(first.counters.bytes <= budget.bytes && (definition.budget !== "instrument" || first.counters.bytes < budget.bytes), "byte budget");
        assert.ok(first.counters.animatedElements <= budget.animatedElements, "animated element budget");
        assert.ok(first.counters.loopingGroups <= budget.loopingGroups, "looping group budget");
        if (motion === "ambient" || motion === "cinematic") {
          assert.equal(stripSceneMotion(first.svg), render(fixtures.ready, { backend, pack }).svg, "frame-zero geometry differs");
        }
      }
    }
  }
  const ready = render(fixtures.ready);
  const changed = render(fixtures.changed);
  assert.notEqual(ready.seed, changed.seed, "one-field model change did not change seed");
  assert.notEqual(ready.svg, changed.svg, "one-field model change did not change output");
  const slotB = render(fixtures.ready, { instanceNamespace: "slotB", motion: definition.supportedMotion.includes("ambient") ? "ambient" : "none" });
  const slotA = render(fixtures.ready, { motion: definition.supportedMotion.includes("ambient") ? "ambient" : "none" });
  const identities = output => [...output.matchAll(/\b(?:id|class)="([^"]*)"|@keyframes\s+([\w-]+)/gu)].flatMap(match => (match[1] ?? match[2]).split(/\s+/u));
  const firstIdentities = new Set(identities(slotA.svg));
  for (const identity of identities(slotB.svg)) assert.ok(!firstIdentities.has(identity), `instance collision ${identity}`);
  checkAccessibility(render(fixtures.unavailable), { ...fixtures.unavailable, unavailable: true });
  for (const path of fixtures.ready.textFields) {
    const injected = render({ inputs: injectedInputs(fixtures.ready.inputs, path) });
    const document = assertWellFormedXml(injected.svg);
    for (const node of document.nodes) {
      assert.ok(!["script", "foreignObject", "image"].includes(node.name), `unescaped input at ${path}`);
      for (const attribute of Object.keys(node.attrs)) assert.doesNotMatch(attribute, /^on/iu, `event handler at ${path}`);
    }
  }
}
