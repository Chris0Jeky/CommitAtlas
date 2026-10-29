import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as staticApi from "../dist/index.js";
import * as names from "../dist/scene-config.js";
import * as svg from "../../svg/dist/index.js";
import { demoProjects } from "../../github/dist/index.js";
import { exampleScene, sceneInputs } from "../../svg/tests/scene.fixture.mjs";

const raw = {
  version: 1, user: "scene-demo", days: 7, theme: "ember", motion: "ambient",
  outputDir: "assets/commitatlas", cards: ["profile"], reducedMotion: true,
  scenes: ["identity-beacon", "evidence-coverage", "activity-terrain"],
  identity: { name: "Synthetic owner", tagline: "Public signals", focus: ["Atlas"] },
  projects: [{ repo: "scene-demo/atlas", label: "Atlas", lifecycle: "active" }],
  themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
};
const lensFixture = JSON.parse(await readFile(new URL("../../../research-contracts/lens-projection/v1/showcase.fixture.json", import.meta.url), "utf8"));
const hash = value => createHash("sha256").update(value).digest("hex");
const config = (overrides = {}) => staticApi.parseStaticConfig({ ...raw, ...overrides });
function snapshot() {
  const value = sceneInputs().snapshot;
  value.projects = demoProjects("scene-demo", ["atlas"], new Map([["atlas", "active"]]), new Map(), new Date(value.freshness.generatedAt));
  return value;
}
async function temporary(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-scene-stills-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function paths(result, suffix) {
  return [result, ...result.variants].flatMap(target => raw.scenes.map(id =>
    `${path.relative(result.root, target.outputDir).replaceAll("\\", "/")}/scene-${id}${suffix}`,
  ).sort());
}

test("scene still names have a bounded namespace disjoint from ordinary scene ids", () => {
  assert.equal(typeof names.sceneStillArtifactName, "function");
  assert.equal(typeof names.isSceneStillArtifactName, "function");
  for (const id of ["a", "evidence-coverage", "a-still", "a".repeat(48)]) {
    const ordinary = names.sceneArtifactName(id), still = names.sceneStillArtifactName(id);
    assert.equal(still, `scene-${id}.still.svg`);
    assert.equal(names.isSceneArtifactName(ordinary), true);
    assert.equal(names.isSceneStillArtifactName(ordinary), false);
    assert.equal(names.isSceneArtifactName(still), false);
    assert.equal(names.isSceneStillArtifactName(still), true);
    assert.ok(still.length <= 64);
  }
  for (const id of ["", "9", "A", "a--b", "a_", "a-", "a".repeat(49), "../a", "a.still", "a\n", "a\r", "a\u2028"]) {
    assert.throws(() => names.sceneStillArtifactName(id), /scene id/);
    assert.equal(names.isSceneStillArtifactName(`scene-${id}.still.svg`), false);
  }
  for (const name of ["atlas.still.svg", "scene-a..still.svg", "scene-a.still.svg.bak", "scene-a.still.svg\n", null]) {
    assert.equal(names.isSceneStillArtifactName(name), false);
  }
});

for (const id of ["identity-beacon", "evidence-coverage", "activity-terrain", "chronograph", "lifecycle-map", "nebula", "signature"]) {
  test(`${id} companions equal none controls across themes, layouts and supported motion`, () => {
    const input = snapshot();
    // The unchanged C0 fixture retains its real timestamp; only the test snapshot clock moves.
    if (id === "signature") input.freshness.generatedAt = lensFixture.generatedAt;
    const lens = id === "signature" ? svg.createLensProjectionContext(lensFixture, input) : undefined;
    const before = JSON.stringify(input);
    for (const theme of ["ember", "paper"]) for (const layout of ["wide", "compact"]) {
      for (const motion of svg.getScene(id).supportedMotion) {
        const selected = config({ scenes: [id], theme, layout, motion, themes: [] });
        const rendered = staticApi.renderStaticArtifacts(input, selected, lens);
        const ordinary = staticApi.renderStaticArtifacts(input, { ...selected, reducedMotion: false }, lens);
        const control = staticApi.renderStaticArtifacts(input, { ...selected, motion: "none", reducedMotion: false }, lens);
        assert.deepEqual(Object.keys(rendered).sort(), ["profile.svg", `scene-${id}.still.svg`, `scene-${id}.svg`]);
        assert.equal(rendered[`scene-${id}.still.svg`], control[`scene-${id}.svg`]);
        assert.equal(rendered[`scene-${id}.svg`], ordinary[`scene-${id}.svg`]);
        assert.equal(rendered["profile.svg"], ordinary["profile.svg"]);
        assert.doesNotMatch(rendered[`scene-${id}.still.svg`], /<style\b|<animate|<set\b|@keyframes/);
      }
    }
    assert.equal(JSON.stringify(input), before, "companions must not mutate the shared snapshot");
  });
}

test("paired scene companions share snapshot metadata and each manifest hashes the actual bytes", async () => temporary(async root => {
  const result = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config() });
  assert.equal(typeof staticApi.generatedSceneStillPaths, "function");
  assert.deepEqual(staticApi.generatedScenePaths(result), paths(result, ".svg"));
  assert.deepEqual(staticApi.generatedSceneStillPaths(result), paths(result, ".still.svg"));
  const names = ["profile.svg", ...raw.scenes.flatMap(id => [`scene-${id}.svg`, `scene-${id}.still.svg`])].sort();
  for (const target of [result, ...result.variants]) {
    assert.equal(target.written, true);
    assert.deepEqual(target.manifest.artifacts.map(artifact => artifact.path), names);
    assert.equal(target.manifest.generatedAt, result.manifest.generatedAt);
    assert.deepEqual(target.manifest.window, result.manifest.window);
    assert.deepEqual(JSON.parse(await readFile(path.join(target.outputDir, "manifest.json"), "utf8")), target.manifest);
    for (const artifact of target.manifest.artifacts) {
      const bytes = await readFile(path.join(target.outputDir, artifact.path));
      assert.equal(bytes.byteLength, artifact.bytes);
      assert.equal(hash(bytes), artifact.sha256);
    }
  }
  for (const id of raw.scenes) {
    const file = `scene-${id}.still.svg`;
    assert.notEqual(result.manifest.artifacts.find(a => a.path === file).sha256, result.variants[0].manifest.artifacts.find(a => a.path === file).sha256);
  }
}));

test("scene companion dry-run reports the complete paired paths without writing or deleting", async () => temporary(async root => {
  const selected = config();
  const empty = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: selected, dryRun: true });
  assert.deepEqual(await readdir(root), []);
  assert.deepEqual(staticApi.generatedSceneStillPaths(empty), paths(empty, ".still.svg"));
  assert.ok([empty, ...empty.variants].every(target => !target.written));
  const first = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: selected });
  const before = await Promise.all([first, ...first.variants].map(target => readFile(path.join(target.outputDir, "manifest.json"), "utf8")));
  const disabled = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: { ...selected, reducedMotion: false }, dryRun: true });
  assert.deepEqual(staticApi.generatedSceneStillPaths(disabled), []);
  for (const [i, target] of [first, ...first.variants].entries()) {
    assert.equal(await readFile(path.join(target.outputDir, "manifest.json"), "utf8"), before[i]);
    assert.ok((await readFile(path.join(target.outputDir, "scene-identity-beacon.still.svg"))).byteLength > 0);
  }
}));

test("inactive scene companions leave existing inventories and scene path semantics unchanged", async () => temporary(async root => {
  for (const overrides of [{ reducedMotion: false }, { reducedMotion: undefined }]) {
    const selected = config(overrides);
    const result = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: selected, dryRun: true });
    assert.deepEqual(staticApi.generatedScenePaths(result), paths(result, ".svg"));
    assert.deepEqual(staticApi.generatedSceneStillPaths(result), []);
    assert.equal(result.manifest.artifacts.length, 4);
  }
  const without = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config({ scenes: [] }), dryRun: true });
  assert.deepEqual(without.manifest.artifacts.map(a => a.path), ["profile.svg"]);
  assert.deepEqual(staticApi.generatedSceneStillPaths(without), []);
  assert.deepEqual(staticApi.generatedScenePaths(without), []);
}));

test("ordinary ids ending in still and the longest legal id keep distinct reported companions", async () => temporary(async root => {
  const ids = ["twin", "twin-still", "a".repeat(48)];
  for (const id of ids) svg.registerScene(exampleScene({ id }));
  const result = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config({ scenes: ids, themes: [] }), dryRun: true });
  assert.deepEqual(staticApi.generatedScenePaths(result), ids.map(id => `assets/commitatlas/scene-${id}.svg`).sort((a, b) => a.localeCompare(b)));
  assert.deepEqual(staticApi.generatedSceneStillPaths(result), ids.map(id => `assets/commitatlas/scene-${id}.still.svg`).sort((a, b) => a.localeCompare(b)));
  assert.equal(result.manifest.artifacts.length, 7);
  assert.throws(() => staticApi.generatedSceneStillPaths({ ...result, outputDir: path.dirname(root) }), /escaped/);
  assert.throws(() => staticApi.generatedSceneStillPaths({ ...result, variants: [result] }), /duplicate/);
}));

for (const mode of ["stale", "unavailable"]) test(`scene companions preserve ${mode} disclosures without motion`, () => {
  const input = snapshot();
  input.freshness.mode = mode;
  input.projects.freshness.mode = mode;
  const selected = config();
  const rendered = staticApi.renderStaticArtifacts(input, selected);
  const control = staticApi.renderStaticArtifacts(input, { ...selected, reducedMotion: false, motion: "none" });
  for (const id of raw.scenes) {
    assert.equal(rendered[`scene-${id}.still.svg`], control[`scene-${id}.svg`]);
    assert.doesNotMatch(rendered[`scene-${id}.still.svg`], /<style\b|<animate|<set\b/);
  }
  assert.match(rendered["scene-identity-beacon.still.svg"], /UNAVAILABLE/);
});

test("turning companions off removes owned twins in every theme and preserves unowned names", async () => temporary(async root => {
  const first = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config() });
  for (const target of [first, ...first.variants]) await writeFile(path.join(target.outputDir, "scene-caller.still.svg"), "caller-owned still");
  const second = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config({ reducedMotion: false }) });
  assert.deepEqual(staticApi.generatedScenePaths(second), staticApi.generatedScenePaths(first));
  for (const target of [second, ...second.variants]) {
    for (const id of raw.scenes) await assert.rejects(readFile(path.join(target.outputDir, `scene-${id}.still.svg`)), { code: "ENOENT" });
    assert.equal(await readFile(path.join(target.outputDir, "scene-caller.still.svg"), "utf8"), "caller-owned still");
  }
}));

test("changed companion in a later theme blocks all publication and cleanup", async () => temporary(async root => {
  const first = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config() });
  const changed = path.join(first.variants[0].outputDir, "scene-identity-beacon.still.svg");
  await writeFile(changed, "caller changed this still");
  const before = await Promise.all([first, ...first.variants].map(target => readFile(path.join(target.outputDir, "manifest.json"), "utf8")));
  await assert.rejects(staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config({ reducedMotion: false }) }), /stale artifact scene-identity-beacon\.still\.svg no longer matches/);
  for (const [i, target] of [first, ...first.variants].entries()) {
    assert.equal(await readFile(path.join(target.outputDir, "manifest.json"), "utf8"), before[i]);
    assert.ok((await readFile(path.join(target.outputDir, "scene-evidence-coverage.still.svg"))).byteLength > 0);
  }
  assert.equal(await readFile(changed, "utf8"), "caller changed this still");
}));

test("retired canonical companions use integrity ownership while malformed and unclaimed files survive", async () => temporary(async root => {
  const selected = config({ scenes: [], themes: [] });
  const first = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: selected });
  const body = "previous scene still";
  const retiredBody = body.repeat(6_000);
  const inventory = ["scene-retired.still.svg", "scene-caller.still.svg", "scene-invalid..still.svg", "scene-missing-integrity.still.svg"];
  for (const name of inventory) await writeFile(path.join(first.outputDir, name), body);
  await writeFile(path.join(first.outputDir, inventory[0]), retiredBody);
  await writeFile(path.join(first.outputDir, "manifest.json"), JSON.stringify({ ...first.manifest, artifacts: [
    ...first.manifest.artifacts,
    { path: inventory[0], bytes: Buffer.byteLength(retiredBody), sha256: hash(retiredBody) },
    { path: "scene-invalid..still.svg", bytes: Buffer.byteLength(body), sha256: hash(body) },
    { path: "scene-missing-integrity.still.svg" },
    { path: "../scene-outside.still.svg", bytes: Buffer.byteLength(body), sha256: hash(body) },
  ] }));
  await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: selected });
  await assert.rejects(readFile(path.join(first.outputDir, inventory[0])), { code: "ENOENT" });
  for (const name of inventory.slice(1)) assert.equal(await readFile(path.join(first.outputDir, name), "utf8"), body);
}));

test("scene companions retain the engine byte budget and remain eligible for owned cleanup", async () => temporary(async root => {
  const fixture = exampleScene({ id: "large-still" });
  svg.registerScene({ ...fixture, render(model, context) {
    return fixture.render.call(this, model, context).replace("</svg>", `${" ".repeat(100 * 1024)}</svg>`);
  } });
  const first = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config({ scenes: [fixture.id] }) });
  for (const target of [first, ...first.variants]) {
    const artifact = target.manifest.artifacts.find(a => a.path === "scene-large-still.still.svg");
    assert.ok(artifact.bytes > 96 * 1024 && artifact.bytes <= svg.SCENE_MOTION_BUDGET.bytes);
    assert.equal(hash(await readFile(path.join(target.outputDir, artifact.path))), artifact.sha256);
  }
  await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config({ scenes: [] }) });
  for (const target of [first, ...first.variants]) {
    await assert.rejects(readFile(path.join(target.outputDir, "scene-large-still.still.svg")), { code: "ENOENT" });
    await assert.rejects(readFile(path.join(target.outputDir, "scene-large-still.svg")), { code: "ENOENT" });
  }
}));

test("a later-theme none render failure leaves both themes' previous files intact", async () => temporary(async root => {
  const first = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config() });
  const before = await Promise.all([first, ...first.variants].map(target => readFile(path.join(target.outputDir, "manifest.json"), "utf8")));
  const fixture = exampleScene({ id: "failing-still" });
  svg.registerScene({ ...fixture, render(model, context) {
    if (context.theme === "paper" && context.motion === "none") throw new Error("synthetic still render failure");
    return fixture.render.call(this, model, context);
  } });
  await assert.rejects(staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: config({ scenes: [fixture.id] }) }), /synthetic still render failure/);
  for (const [i, target] of [first, ...first.variants].entries()) {
    assert.equal(await readFile(path.join(target.outputDir, "manifest.json"), "utf8"), before[i]);
    await assert.rejects(readFile(path.join(target.outputDir, "scene-failing-still.svg")), { code: "ENOENT" });
  }
}));

test("a scene without none support rejects companions before publication but keeps its ordinary contract", async () => temporary(async root => {
  const fixture = exampleScene({ id: "ambient-only", supportedMotion: ["ambient"] });
  svg.registerScene(fixture);
  assert.throws(() => config({ scenes: [fixture.id] }), /none|reduced.motion|companion/i);
  const selected = config({ scenes: [fixture.id], reducedMotion: false });
  const first = await staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: selected });
  const before = await Promise.all([first, ...first.variants].map(target => readFile(path.join(target.outputDir, "manifest.json"), "utf8")));
  await assert.rejects(staticApi.generateStaticFromSnapshot({ root, snapshot: snapshot(), config: { ...selected, reducedMotion: true } }), /none|reduced.motion|companion/i);
  for (const [i, target] of [first, ...first.variants].entries()) {
    assert.equal(await readFile(path.join(target.outputDir, "manifest.json"), "utf8"), before[i]);
  }
}));
