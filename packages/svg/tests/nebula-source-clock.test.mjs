import assert from "node:assert/strict";
import test from "node:test";
import * as svg from "../dist/index.js";
import { sceneContext, sceneInputs } from "./scene.fixture.mjs";

const ROOT = Date.parse("2026-01-07T00:00:00Z");
const stamp = offset => new Date(ROOT + offset).toISOString();
for (const synthetic of [true, false]) {
  for (const [offset, unavailable] of [
    [-72 * 3_600_000 - 1, true], [-72 * 3_600_000, false], [-1, false],
    [0, false], [1_500, false], [60_000, false], [60_001, true],
    [86_400_000, true], [366 * 86_400_000, true],
  ]) {
    test(`nebula contribution/root skew ${offset}ms, synthetic=${synthetic}`, () => {
      const value = sceneInputs();
      value.snapshot.freshness = { generatedAt: stamp(0), source: synthetic ? "synthetic-demo" : "github-graphql", mode: synthetic ? "demo" : "live" };
      value.snapshot.contributions.freshness = { ...value.snapshot.freshness, generatedAt: stamp(offset) };
      for (const backend of ["css", "smil"]) {
        for (const motion of ["none", "ambient"]) {
          const output = svg.renderSceneDefinition(svg.getScene("nebula"), value, { ...sceneContext, backend, motion });
          assert.equal(output.unavailable, unavailable);
          if (unavailable) {
            assert.equal(output.counters.animatedElements, 0);
            assert.doesNotMatch(output.svg, /<circle\b|<animate|<style/u);
          } else {
            assert.equal((output.svg.match(/r="1\.6"/gu) ?? []).length, value.snapshot.contributions.days.length);
            assert.match(output.svg, /seeded from the 2026-01-07 snapshot/u);
          }
        }
      }
    });
  }
}
