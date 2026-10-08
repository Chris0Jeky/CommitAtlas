import assert from "node:assert/strict";
import test from "node:test";
import * as svg from "../../dist/index.js";
import { sceneXmlText } from "../../dist/scene-svg.js";
import { assertSceneContract, assertWellFormedXml, stripSceneMotion } from "../scene-harness.mjs";
import { sceneContext, sceneInputs } from "../scene.fixture.mjs";

const DATE = "2026-01-07";

function nebulaInputs() {
  const inputs = sceneInputs();
  inputs.snapshot.projects = {
    version: 1,
    owner: "scene-demo",
    projects: [
      { primaryLanguage: "TypeScript", releaseState: "published", release: { tag: "v0.1.0", publishedAt: "2026-01-07T00:00:00.000Z" } },
      { primaryLanguage: "Python", releaseState: "none", release: null },
    ],
    freshness: { generatedAt: "2026-01-07T00:00:00.000Z", source: "synthetic-demo", mode: "demo" },
  };
  return inputs;
}
function changedInputs() {
  const inputs = nebulaInputs();
  inputs.snapshot.contributions.days[0].count += 1;
  return inputs;
}
function unavailableInputs() {
  const inputs = nebulaInputs();
  inputs.snapshot.contributions.days = [];
  return inputs;
}
const definition = () => {
  const scene = svg.getScene("nebula");
  assert.ok(scene, "nebula scene is registered");
  return scene;
};
const render = (inputs = nebulaInputs(), overrides = {}) => svg.renderSceneDefinition(definition(), inputs, { ...sceneContext, ...overrides });
function textNodes(output) {
  const document = assertWellFormedXml(output);
  return document.nodes.filter(node => node.name === "text" || node.name === "title" || node.name === "desc").map(node => sceneXmlText(node));
}
function circles(output) {
  return [...output.matchAll(/<circle\b[^>]*\bcx="([^"]+)"\scy="([^"]+)"\sr="([^"]+)"\sfill="([^"]+)"/gu)].map(match => ({
    x: match[1], y: match[2], r: match[3], fill: match[4],
  }));
}
function assertNoForeignDigits(output) {
  for (const text of textNodes(output)) {
    const leftover = text.split(DATE).join("");
    assert.equal(/\d/u.test(leftover), false, `digit outside the snapshot date: ${text}`);
    if (/\d/u.test(text)) assert.ok(text.includes(DATE), text);
  }
}
function animatedHosts(output) {
  const document = assertWellFormedXml(output);
  const style = document.nodes.find(node => node.name === "style");
  const classes = new Set(style ? [...style.raw.matchAll(/\.([A-Za-z0-9_-]+)\{[^}]*animation-name\s*:/gu)].map(match => match[1]) : []);
  return document.nodes.filter(node => node.children.some(child => child.name === "animate" || child.name === "animateTransform" || child.name === "animateMotion") ||
    (node.attrs.class ?? "").split(/\s+/u).some(name => classes.has(name)));
}
function containsText(node) {
  return node.name === "text" || node.children.some(containsText);
}

test("nebula is a survey scene and not a hosted instrument", () => {
  const scene = definition();
  assert.equal(scene.family, "scene");
  assert.equal(scene.budget, "scene");
  assert.deepEqual(scene.supportedPacks, ["survey"]);
  assert.deepEqual(scene.supportedMotion, ["none", "ambient"]);
});

test("nebula passes the shared scene contracts", () => {
  assertSceneContract(definition(), {
    ready: {
      inputs: nebulaInputs(),
      textFields: ["snapshot.freshness.generatedAt"],
      readings: [DATE, "SCENE"],
      encodings: ["Star position", "language palette", "large mark", "Twinkle"],
    },
    changed: { inputs: changedInputs() },
    unavailable: { inputs: unavailableInputs() },
  });
});

test("the frame names the snapshot date and no other text node carries a digit", () => {
  const result = render();
  assert.match(result.svg, />SCENE</u);
  assert.match(result.svg, new RegExp(`seeded from the ${DATE} snapshot`, "u"));
  assertNoForeignDigits(result.svg);
  assert.equal(result.seed, render(undefined, { seed: "ff".repeat(32) }).seed);
  assert.equal(result.svg, render(undefined, { seed: "ab".repeat(32) }).svg);
});

test("star positions follow the model hash and ignore theme", () => {
  const aurora = render(undefined, { theme: "aurora" });
  const paper = render(undefined, { theme: "paper" });
  assert.equal(aurora.seed, paper.seed);
  assert.deepEqual(circles(aurora.svg).map(star => [star.x, star.y, star.r]), circles(paper.svg).map(star => [star.x, star.y, star.r]));
  assert.notEqual(aurora.svg, paper.svg);
  const moved = circles(render(changedInputs()).svg);
  assert.notDeepEqual(circles(aurora.svg).map(star => [star.x, star.y]), moved.map(star => [star.x, star.y]));
});

test("languages colour stars from the theme palette and published releases are the large marks", () => {
  const theme = svg.themes.aurora;
  const ink = language => theme.languagePalette[Number.parseInt(svg.stableHash(language).slice(0, 8), 16) % theme.languagePalette.length];
  const stars = circles(render().svg);
  const large = stars.filter(star => Number(star.r) > 4);
  const small = stars.filter(star => Number(star.r) < 3);
  assert.equal(large.length, 1);
  assert.equal(large[0].fill, ink("TypeScript"));
  assert.equal(small.length, nebulaInputs().snapshot.contributions.days.length);
  assert.ok(small.every(star => star.fill === ink("TypeScript") || star.fill === ink("Python")));
});

test("a full year stays whole inside the scene motion budget", () => {
  const inputs = nebulaInputs();
  const start = Date.parse("2015-01-01T00:00:00.000Z");
  inputs.snapshot.contributions.days = Array.from({ length: 366 }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    count: index % 5,
  }));
  const result = render(inputs, { motion: "ambient", backend: "smil" });
  assert.equal(result.unavailable, false);
  assert.equal((result.svg.match(/<circle\b/gu) ?? []).length, 367);
  assert.equal(result.counters.animatedElements, 1);
  assert.equal(result.counters.loopingGroups, 1);
  assert.ok(result.counters.bytes <= 120 * 1024);
  assert.ok(result.counters.animatedElements <= 96);
  assert.ok(result.counters.loopingGroups <= 6);
});

test("an over-budget star field fails the render instead of dropping stars", () => {
  const inputs = nebulaInputs();
  const start = Date.parse("2008-01-01T00:00:00.000Z");
  inputs.snapshot.contributions.days = Array.from({ length: 3500 }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    count: 1,
  }));
  assert.throws(() => render(inputs, { motion: "ambient" }), /byte budget/u);
});

test("zero contribution days render an unlit steady field", () => {
  const result = render(unavailableInputs(), { motion: "ambient", backend: "smil" });
  assert.equal(result.unavailable, true);
  assert.equal(result.counters.animatedElements, 0);
  assert.doesNotMatch(result.svg, /<animate|<style/u);
  assert.match(result.svg, />EMPTY FIELD</u);
  assert.match(result.svg, />UNAVAILABLE</u);
  assert.equal((result.svg.match(/<circle\b/gu) ?? []).length, 0);
  const description = textNodes(result.svg).join(" ");
  assert.match(description, /contribution history is unavailable/iu);
  assertNoForeignDigits(result.svg);
});

test("twinkle attaches only to decorative marks and frame zero keeps the same stars", () => {
  for (const backend of ["css", "smil"]) {
    const still = render(undefined, { backend });
    const moving = render(undefined, { backend, motion: "ambient" });
    assert.equal(stripSceneMotion(moving.svg), still.svg);
    assert.equal(still.counters.animatedElements, 0);
    assert.equal(moving.counters.animatedElements, 1);
    assert.doesNotMatch(still.svg, /<animate|<style/u);
    assert.equal(moving.reducedMotion === "not-needed", false);
    for (const host of animatedHosts(moving.svg)) {
      assert.equal(containsText(host), false, host.name);
      assert.equal(host.name, "g");
    }
    if (backend === "css") assert.match(moving.svg, /opacity:0\.35/u);
    assertNoForeignDigits(moving.svg);
  }
});

test("stale or missing contribution history is unavailable rather than a dark healthy field", () => {
  for (const mode of ["stale", "unavailable"]) {
    const inputs = nebulaInputs();
    inputs.snapshot.freshness.mode = mode;
    const result = render(inputs, { motion: "ambient" });
    assert.equal(result.unavailable, true);
    assert.equal(result.counters.animatedElements, 0);
    assert.doesNotMatch(result.svg, /<circle\b/u);
  }
});
