import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as staticApi from "../dist/index.js";
import * as svg from "../../svg/dist/index.js";
import { sceneInputs } from "../../svg/tests/scene.fixture.mjs";

const snapshot = sceneInputs().snapshot;
const raw = {
  version: 1, user: "scene-demo", theme: "ember", days: 7, motion: "none",
  outputDir: "assets/commitatlas",
  projects: [{ repo: "scene-demo/atlas", label: "Atlas", lifecycle: "active" }],
};
const injected = '<&"\'>Synthetic';
const fixture = {
  id: "static-example", family: "scene", budget: "scene",
  supportedPacks: ["survey"], supportedMotion: ["none", "subtle", "ambient", "cinematic"],
  buildModel({ snapshot: input, identity }) {
    return { label: identity ? [identity.name, identity.tagline ?? "", ...identity.focus].join(" | ") : "Synthetic scene", total: input.metrics.total };
  },
  accessibility(model) { return { title: model.label, description: `Synthetic fixture: ${model.total} observed contributions.` }; },
  render(model, context) {
    const a = this.accessibility(model);
    const width = context.layout === "compact" ? 480 : 720;
    const theme = svg.themes[context.theme];
    return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${svg.escapeXml(a.title)}" viewBox="0 0 ${width} 120"><title>${svg.escapeXml(a.title)}</title><desc>${svg.escapeXml(a.description)}</desc><rect width="${width}" height="120" fill="${theme.background}"/><text x="24" y="40" fill="${theme.text}">${svg.escapeXml(model.label)}</text><text x="24" y="80" fill="${theme.text}">${model.total}</text></svg>`;
  },
};
svg.registerScene(fixture);
function config(changes = {}) { return staticApi.parseStaticConfig({ ...raw, ...changes }); }
async function temporary(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-scenes-"));
  try { return await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function hash(value) { return createHash("sha256").update(value).digest("hex"); }

test("legacy configs retain their original artifact list with scenes disabled", () => {
  const parsed = config();
  assert.deepEqual(parsed.scenes, []);
  assert.equal(parsed.scenePack, "survey");
  assert.equal(parsed.identity, undefined);
  assert.deepEqual(Object.keys(staticApi.renderStaticArtifacts(snapshot, parsed)).sort(), [
    "activity.svg", "atlas.svg", "breakdown.svg", "cadence.svg", "languages.svg",
    "profile.svg", "projects.svg", "releases.svg", "rhythm.svg", "streak.svg",
  ]);
});

test("scene configuration rejects unknown/duplicate ids and unsupported presentation", () => {
  assert.deepEqual(config({ scenes: [fixture.id] }).scenes, [fixture.id]);
  for (const scenes of [["missing"], [fixture.id, fixture.id], ["../outside"], [""], [1]]) {
    assert.throws(() => config({ scenes }), /scene|invalid|option/i);
  }
  assert.throws(() => config({ scenes: [fixture.id], scenePack: "orbital" }), /pack/i);
  assert.throws(() => config({ scenePack: "unknown" }), /pack|option/i);
});

test("identity config is bounded, detached and frozen, including each focus entry", () => {
  assert.equal(typeof svg.createIdentityConfig, "function");
  const input = { name: injected, tagline: "Synthetic only", focus: ["Tests"] };
  const identity = svg.createIdentityConfig(input);
  input.focus.push("Changed");
  input.name = "Changed";
  assert.equal(identity.name, injected);
  assert.deepEqual(identity.focus, ["Tests"]);
  assert.ok(Object.isFrozen(identity) && Object.isFrozen(identity.focus));
  assert.deepEqual(svg.createIdentityConfig({ name: "Name" }).focus, []);
  for (const invalid of [null, [], {}, { name: "" }, { name: "n".repeat(41) },
    { name: "Name", tagline: "t".repeat(81) }, { name: "Name", focus: ["f".repeat(25)] },
    { name: "Name", focus: ["a", "b", "c", "d"] }, { name: "Name", focus: [null] },
    { name: "Name", extra: true }, { name: "Name", focus: new Array(1) }]) {
    assert.throws(() => svg.createIdentityConfig(invalid), /identity|focus|name|tagline/i);
  }
  let called = false;
  assert.throws(() => svg.createIdentityConfig({ get name() { called = true; return "Name"; } }), /accessor/i);
  assert.equal(called, false);
});

test("invalid identity config fails even when no scene is selected", () => {
  assert.throws(() => config({ identity: { name: "x".repeat(41) } }), /identity|name/i);
  assert.throws(() => config({ identity: { name: "Name", unknown: true } }), /identity|field/i);
});

test("registered scenes receive validated identity and escape it under both layouts", () => {
  for (const layout of ["wide", "compact"]) {
    const artifacts = staticApi.renderStaticArtifacts(snapshot, config({
      cards: ["profile"], scenes: [fixture.id], layout,
      identity: { name: injected, tagline: injected, focus: [injected] },
    }));
    const content = artifacts[`scene-${fixture.id}.svg`];
    assert.equal(typeof content, "string");
    assert.match(content, new RegExp(`viewBox="0 0 ${layout === "compact" ? 480 : 720} 120"`));
    assert.ok(content.includes(svg.escapeXml(injected)));
    assert.doesNotMatch(content, /UNAVAILABLE|<script|<image|<foreignObject/i);
    assert.deepEqual(Object.keys(artifacts).sort(), ["profile.svg", `scene-${fixture.id}.svg`]);
  }
});

test("paired scenes share generation metadata and have hashed theme-specific bytes", async () => temporary(async root => {
  const result = await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({
    cards: ["profile"], scenes: [fixture.id],
    themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
  }) });
  for (const target of [result, ...result.variants]) {
    const artifact = target.manifest.artifacts.find(a => a.path === `scene-${fixture.id}.svg`);
    assert.ok(artifact);
    const bytes = await readFile(path.join(target.outputDir, artifact.path));
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(hash(bytes), artifact.sha256);
    assert.equal(target.manifest.generatedAt, result.manifest.generatedAt);
    assert.deepEqual(target.manifest.window, result.manifest.window);
  }
  assert.notEqual(result.manifest.artifacts[1].sha256, result.variants[0].manifest.artifacts[1].sha256);
  assert.equal(typeof staticApi.generatedScenePaths, "function");
  assert.deepEqual(staticApi.generatedScenePaths(result), [
    `assets/commitatlas/scene-${fixture.id}.svg`, `assets/commitatlas/light/scene-${fixture.id}.svg`,
  ]);
}));

test("dry-run lists scene paths and leaves the repository untouched", async () => temporary(async root => {
  const result = await staticApi.generateStaticFromSnapshot({ root, snapshot, dryRun: true,
    config: config({ cards: ["profile"], scenes: [fixture.id] }) });
  assert.equal(result.written, false);
  assert.ok(result.manifest.artifacts.some(a => a.path === `scene-${fixture.id}.svg`));
  assert.deepEqual(await readdir(root), []);
}));

test("stale cleanup removes only owned canonical scene artifacts", async () => temporary(async root => {
  const cfg = config({ cards: ["profile"], scenes: [fixture.id] });
  const first = await staticApi.generateStaticFromSnapshot({ root, snapshot, config: cfg });
  const callerFile = path.join(first.outputDir, "scene-caller.svg");
  await writeFile(callerFile, "caller owned");
  await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({ cards: ["profile"] }) });
  await assert.rejects(readFile(path.join(first.outputDir, `scene-${fixture.id}.svg`)), { code: "ENOENT" });
  assert.equal(await readFile(callerFile, "utf8"), "caller owned");
}));

test("malformed prior scene ownership and traversal entries never authorize cleanup", async () => temporary(async root => {
  const first = await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({ cards: ["profile"] }) });
  const callerFile = path.join(first.outputDir, "scene-caller.svg");
  await writeFile(callerFile, "caller owned");
  await writeFile(path.join(first.outputDir, "manifest.json"), JSON.stringify({
    ...first.manifest, artifacts: [{ path: "scene-caller.svg" }, { path: "../outside.svg", bytes: 1, sha256: "a".repeat(64) }],
  }));
  await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({ cards: ["profile"] }) });
  assert.equal(await readFile(callerFile, "utf8"), "caller owned");
}));

test("programmatic scene selection is checked before either theme is written", async () => temporary(async root => {
  await assert.rejects(staticApi.generateStaticFromSnapshot({ root, snapshot,
    config: { ...config({ cards: ["profile"] }), scenes: ["../outside"] } }), /scene/i);
  assert.deepEqual(await readdir(root), []);
}));

test("plain or cloned unvalidated identity never bypasses the scene adapter", () => {
  const context = { theme: "ember", pack: "survey", motion: "none", backend: "css", layout: "wide", instanceNamespace: "rawIdentity", seed: "" };
  const result = svg.renderSceneDefinition(fixture, { snapshot, identity: { name: "Raw", focus: [] } }, context);
  assert.equal(result.unavailable, true);
  const identity = svg.createIdentityConfig({ name: "Validated" });
  assert.equal(svg.renderSceneDefinition(fixture, { snapshot, identity }, context).unavailable, false);
  assert.equal(svg.renderSceneDefinition(fixture, { snapshot, identity: structuredClone(identity) }, context).unavailable, true);
});

test("a later-theme scene render failure preserves all previous visible bytes", async () => temporary(async root => {
  const previous = await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({ cards: ["profile"] }) });
  const before = await readFile(path.join(previous.outputDir, "profile.svg"), "utf8");
  const manifest = await readFile(path.join(previous.outputDir, "manifest.json"), "utf8");
  const broken = { ...fixture, id: "static-fails-paper", render(model, context) {
    if (context.theme === "paper") throw new Error("synthetic later-theme failure");
    return fixture.render.call(this, model, context);
  } };
  svg.registerScene(broken);
  await assert.rejects(staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({
    cards: ["profile"], scenes: [broken.id], themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
  }) }), /synthetic later-theme failure/);
  assert.equal(await readFile(path.join(previous.outputDir, "profile.svg"), "utf8"), before);
  assert.equal(await readFile(path.join(previous.outputDir, "manifest.json"), "utf8"), manifest);
  assert.deepEqual((await readdir(previous.outputDir)).sort(), ["manifest.json", "profile.svg"]);
}));

test("retired canonical scene ids can be cleaned using their prior integrity-bearing entry", async () => temporary(async root => {
  const previous = await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({ cards: ["profile"] }) });
  const body = "previously generated synthetic scene";
  await writeFile(path.join(previous.outputDir, "scene-retired.svg"), body);
  await writeFile(path.join(previous.outputDir, "manifest.json"), JSON.stringify({
    ...previous.manifest, artifacts: [...previous.manifest.artifacts, { path: "scene-retired.svg", bytes: Buffer.byteLength(body), sha256: hash(body) }],
  }));
  assert.equal(svg.getScene("retired"), undefined);
  await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({ cards: ["profile"] }) });
  await assert.rejects(readFile(path.join(previous.outputDir, "scene-retired.svg")), { code: "ENOENT" });
}));

test("aggregate Action paths are empty for legacy results and reject escaped or duplicate targets", async () => temporary(async root => {
  const legacy = await staticApi.generateStaticFromSnapshot({ root, snapshot, dryRun: true, config: config({ cards: ["profile"] }) });
  assert.deepEqual(staticApi.generatedScenePaths(legacy), []);
  const result = await staticApi.generateStaticFromSnapshot({ root, snapshot, dryRun: true,
    config: config({ cards: ["profile"], scenes: [fixture.id] }) });
  assert.throws(() => staticApi.generatedScenePaths({ ...result, outputDir: path.dirname(root) }), /escaped/);
  assert.throws(() => staticApi.generatedScenePaths({ ...result, variants: [result] }), /duplicate/);
}));

test("scene options reject sparse or duplicated programmatic ids and do not call element accessors", () => {
  for (const scenes of [new Array(1), [fixture.id, fixture.id], null, ["static-example\n"]]) {
    assert.throws(() => staticApi.renderStaticArtifacts(snapshot, { ...config(), scenes }), /scene/);
  }
  let called = false;
  const scenes = [];
  Object.defineProperty(scenes, "0", { get() { called = true; return fixture.id; } });
  assert.throws(() => staticApi.renderStaticArtifacts(snapshot, { ...config(), scenes }), /scene/);
  assert.equal(called, false);
});
