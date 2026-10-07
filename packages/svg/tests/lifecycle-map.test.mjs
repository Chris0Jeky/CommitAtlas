import assert from "node:assert/strict";
import test from "node:test";
import * as svg from "../dist/index.js";
import { assertSceneContract, assertWellFormedXml } from "./scene-harness.mjs";

const STATIONS = ["planned", "active", "maintenance", "paused", "archived"];

function project(name, lifecycle, ci, releaseState) {
  return {
    repo: `scene-demo/${name}`, name, description: null,
    sourceUrl: `https://github.com/scene-demo/${name}`, websiteUrl: null,
    lifecycle, primaryLanguage: null, stars: 0, forks: 0, openIssuesAndPullRequests: 0,
    pushedAt: null, license: null,
    ci: { state: ci, label: ci, workflow: ci === "unconfigured" ? null : "ci.yml", url: null, checkedAt: null, headSha: null },
    releaseState,
    release: releaseState === "published" ? {
      tag: "v1", name: "Release", url: `https://github.com/scene-demo/${name}/releases/tag/v1`,
      publishedAt: "2026-01-02T00:00:00.000Z", download: null,
    } : null,
  };
}

function inputs(projects = [
  project("Alpha", "planned", "passing", "none"),
  project("Bravo", "active", "pending", "published"),
  project("Charlie", "maintained", "unavailable", "unavailable"),
  project("Delta", "paused", "unconfigured", "none"),
  project("Echo", "archived", "failing", "none"),
]) {
  return {
    snapshot: {
      version: 1,
      freshness: { generatedAt: "2026-01-17T00:00:00.000Z", source: "synthetic-demo", mode: "demo" },
      projects: { projects, freshness: { generatedAt: "2026-01-17T00:00:00.000Z", source: "synthetic-demo", mode: "demo" } },
    },
  };
}

function scene() {
  const definition = svg.getScene("lifecycle-map");
  assert.ok(definition, "lifecycle-map scene is registered");
  return definition;
}

function render(value = inputs(), overrides = {}) {
  return svg.renderSceneDefinition(scene(), value, {
    theme: "aurora", pack: "survey", motion: "none", backend: "smil", layout: "wide",
    instanceNamespace: "slotA", seed: "", ...overrides,
  });
}

test("lifecycle-map places each project once on the declared line", () => {
  const definition = scene();
  assert.equal(definition.family, "map");
  assert.equal(definition.budget, "map");
  const model = definition.buildModel(inputs());
  assert.deepEqual(model.stations, STATIONS);
  assert.deepEqual(model.markers.map(marker => marker.name), ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
  assert.deepEqual(model.markers.map(marker => marker.station), ["planned", "active", "maintenance", "paused", "archived"]);
  assert.deepEqual(model.markers.map(marker => marker.lamp), ["passing", "pending", "unavailable", "unconfigured", "failing"]);
  assert.equal(model.markers.filter(marker => marker.lamp === "pending").length, 1);
});

test("lifecycle-map passes the shared scene contract", () => {
  const ready = inputs();
  const changed = inputs();
  changed.snapshot.projects.projects[1].ci.state = "failing";
  assertSceneContract(scene(), {
    ready: {
      inputs: ready,
      textFields: ["snapshot.projects.projects.0.name"],
      readings: ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "LIFECYCLE · DECLARED"],
      encodings: ["declared station", "CI lamp", "dashed socket", "unlit"],
    },
    changed: { inputs: changed },
    unavailable: {
      inputs: {
        snapshot: {
          version: 1,
          freshness: { generatedAt: "2026-01-17T00:00:00.000Z", source: "synthetic-demo", mode: "unavailable" },
          projects: null,
        },
      },
    },
  });
});

test("unavailable CI stays unlit and unconfigured is a dashed socket", () => {
  const still = render();
  assert.match(still.svg, /CI UNAVAILABLE/);
  assert.match(still.svg, /stroke-dasharray="4 3"/);
  assert.doesNotMatch(still.svg, /<animate/);
  const moving = render(inputs(), { motion: "ambient", backend: "smil" });
  assert.equal(moving.counters.animatedElements, 6);
  assert.equal(moving.counters.loopingGroups, 2);
  assert.match(moving.svg, /CI UNAVAILABLE/);
});

test("both layouts keep every declared name on four themes", () => {
  for (const theme of Object.keys(svg.themes)) {
    for (const layout of ["wide", "compact"]) {
      const result = render(inputs(), { theme, layout });
      const document = assertWellFormedXml(result.svg);
      assert.equal(Number(document.root.attrs.viewBox.split(" ")[2]), layout === "compact" ? 480 : 720);
      for (const name of ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]) assert.match(result.svg, new RegExp(name));
    }
  }
});
