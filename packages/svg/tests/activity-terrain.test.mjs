import assert from "node:assert/strict";
import test from "node:test";
import * as svg from "../dist/index.js";
import { assertSceneContract, assertWellFormedXml } from "./scene-harness.mjs";

const FROM = "2026-01-04";
const TO = "2026-01-17";

function day(date, count) {
  return { date, count };
}

function project(releaseState, publishedAt, tag) {
  return {
    repo: "scene-demo/terrain", name: "Terrain", description: null,
    sourceUrl: "https://github.com/scene-demo/terrain", websiteUrl: null,
    lifecycle: "active", primaryLanguage: null, stars: 0, forks: 0, openIssuesAndPullRequests: 0,
    pushedAt: null, license: null,
    ci: { state: "passing", label: "passing", workflow: "ci.yml", url: null, checkedAt: null, headSha: null },
    releaseState,
    release: releaseState === "published" ? {
      tag, name: "Release", url: "https://github.com/scene-demo/terrain/releases/tag/v1", publishedAt, download: null,
    } : null,
  };
}

function inputs(overrides = {}) {
  const days = overrides.days ?? [day("2026-01-04", 3), day("2026-01-10", 1), day("2026-01-11", 0)];
  return {
    snapshot: {
      version: 1,
      freshness: { generatedAt: "2026-01-17T00:00:00.000Z", source: "synthetic-demo", mode: "demo" },
      profile: { login: "scene-demo" },
      contributions: { days, freshness: { generatedAt: "2026-01-17T00:00:00.000Z", source: "synthetic-demo", mode: "demo" } },
      metrics: { window: { from: FROM, to: TO }, streak: { current: 4 } },
      projects: {
        projects: [
          project("published", "2026-01-11T12:00:00.000Z", "v-in"),
          project("published", "2025-12-01T00:00:00.000Z", "v-out"),
          project("unavailable", null, null),
        ],
      },
      ...overrides.snapshot,
    },
  };
}

function scene() {
  const definition = svg.getScene("activity-terrain");
  assert.ok(definition, "activity-terrain scene is registered");
  return definition;
}

function render(value = inputs(), overrides = {}) {
  return svg.renderSceneDefinition(scene(), value, {
    theme: "aurora", pack: "survey", motion: "none", backend: "smil", layout: "wide",
    instanceNamespace: "slotA", seed: "", ...overrides,
  });
}

test("activity-terrain is a survey map over Sunday-column weeks", () => {
  const definition = scene();
  assert.equal(definition.family, "map");
  assert.equal(definition.budget, "map");
  assert.deepEqual(definition.supportedPacks, ["survey"]);
  assert.deepEqual(definition.supportedMotion, ["none", "subtle", "ambient"]);
  const model = definition.buildModel(inputs());
  assert.deepEqual(model.weeks, [4, 0]);
  assert.equal(model.total, 4);
  assert.equal(model.peak, 4);
  assert.equal(model.quiet, 1);
  assert.equal(model.streak, 4);
  assert.deepEqual(model.peaks, [{ index: 1, label: "v-in" }]);
  assert.equal(model.blocked, 1);
});

test("activity-terrain passes the shared scene contract", () => {
  const ready = inputs();
  const changed = inputs();
  changed.snapshot.contributions.days[0].count = 8;
  assertSceneContract(scene(), {
    ready: {
      inputs: ready,
      textFields: ["snapshot.projects.projects.0.release.tag"],
      readings: ["TOTAL 4", "PEAK WEEK 4", "QUIET RUN 1", "CURRENT STREAK 4", "RELEASE SIGNAL BLOCKED 1"],
      encodings: ["Weekly elevation", "Release peaks", "flat basin", "survey line"],
    },
    changed: { inputs: changed },
    unavailable: { inputs: inputs({ snapshot: { freshness: { generatedAt: "2026-01-17T00:00:00.000Z", source: "synthetic-demo", mode: "unavailable" } } }) },
  });
});

test("a zero calendar is a labelled flat basin, and release signals stay distinct", () => {
  const zero = render(inputs({
    days: [day("2026-01-04", 0), day("2026-01-05", 0), day("2026-01-11", 0)],
    snapshot: { projects: { projects: [] } },
  }));
  assert.match(zero.svg, /NO OBSERVED ACTIVITY IN WINDOW/);
  assert.doesNotMatch(zero.svg, /r="3"/);
  for (const color of svg.themes.aurora.density) assert.doesNotMatch(zero.svg, new RegExp(color, "i"));

  const marked = render();
  assert.match(marked.svg, /v-in/);
  assert.doesNotMatch(marked.svg, /v-out/);
  assert.match(marked.svg, /RELEASE SIGNAL BLOCKED 1/);
});

test("wide and compact layouts keep the theme density ramp on every ground", () => {
  for (const theme of Object.keys(svg.themes)) {
    for (const layout of ["wide", "compact"]) {
      const result = render(inputs(), { theme, layout, motion: "ambient", backend: "smil" });
      const document = assertWellFormedXml(result.svg);
      assert.equal(Number(document.root.attrs.viewBox.split(" ")[2]), layout === "compact" ? 480 : 720);
      const strokes = [...result.svg.matchAll(/stroke="(#[0-9a-f]{6})"/giu)].map((match) => match[1].toLowerCase());
      for (const color of svg.themes[theme].density) assert.ok(strokes.includes(color.toLowerCase()), `${theme} ${layout} misses ${color}`);
    }
  }
});
