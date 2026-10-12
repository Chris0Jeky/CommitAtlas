import assert from "node:assert/strict";
import test from "node:test";
import * as svg from "../dist/index.js";
import { sceneContext, sceneInputs } from "./scene.fixture.mjs";

const CUT_OFF = Date.parse("2026-01-07T00:00:00Z");
const stamp = offset => new Date(CUT_OFF + offset).toISOString();
function inputs(offset, synthetic = true) {
  const value = sceneInputs();
  if (!synthetic) {
    value.snapshot.freshness = { generatedAt: stamp(0), source: "github-graphql", mode: "live" };
    value.snapshot.contributions.freshness = { ...value.snapshot.freshness };
  }
  value.snapshot.projects = {
    version: 1, owner: "scene-demo",
    projects: [{ repo: "scene-demo/alpha", primaryLanguage: "TypeScript", releaseState: "published", release: { tag: "v1", publishedAt: stamp(offset) } }],
    freshness: { generatedAt: stamp(offset), source: synthetic ? "synthetic-demo" : "github-rest", mode: synthetic ? "demo" : "live" },
  };
  return value;
}
function check(value, expectedMarks, unavailable = false) {
  for (const backend of ["css", "smil"]) {
    for (const motion of ["none", "ambient"]) {
      const output = svg.renderSceneDefinition(svg.getScene("nebula"), value, { ...sceneContext, backend, motion });
      assert.equal(output.unavailable, unavailable, "only coherent contributions remain available");
      assert.equal((output.svg.match(/r="5\.5"/gu) ?? []).length, expectedMarks);
      assert.equal((output.svg.match(/r="1\.6"/gu) ?? []).length, unavailable ? 0 : value.snapshot.contributions.days.length);
      if (unavailable) assert.equal(output.counters.animatedElements, 0);
    }
  }
}
for (const synthetic of [true, false]) {
  for (const offset of [60_001, 3_600_000, 366 * 86_400_000]) {
    test(`nebula rejects ${offset}ms forward project skew, synthetic=${synthetic}`, () => check(inputs(offset, synthetic), 0));
  }
  for (const offset of [0, 1_500, 60_000]) {
    test(`nebula accepts ${offset}ms bounded component skew, synthetic=${synthetic}`, () => check(inputs(offset, synthetic), 1));
  }
}
for (const olderPart of ["root", "contribution"]) {
  test(`a newer sibling clock cannot hide excessive skew from the ${olderPart} clock`, () => {
    const value = inputs(60_001);
    if (olderPart === "root") value.snapshot.contributions.freshness.generatedAt = stamp(60_001);
    else value.snapshot.freshness.generatedAt = stamp(60_001);
    check(value, 0, olderPart === "root");
  });
}
for (const offset of [-72 * 3_600_000, -72 * 3_600_000 - 1]) {
  test(`nebula preserves the existing ${offset}ms old-board boundary`, () => check(inputs(offset), offset === -72 * 3_600_000 ? 1 : 0));
}
