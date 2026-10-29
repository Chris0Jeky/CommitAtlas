import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { demoContributions, demoProfile, demoProjects } from "@commit-atlas/github";
import { assembleStaticPortfolio, generateStaticFromSnapshot, parseStaticConfig } from "../dist/index.js";
import * as protocol from "../dist/publication-protocol.js";
import { planPublicationShadow } from "../dist/publication-shadow.js";
import { encodePublicationJournal, decodePublicationJournal } from "../dist/publication-codec.js";

const A = { sha256: "a".repeat(64), bytes: 10 };
const B = { sha256: "b".repeat(64), bytes: 20 };
const C = { sha256: "c".repeat(64), bytes: 30 };
const named = (name, version) => ({ name, ...version });
const observed = (target, name, version) => version
  ? { target, name, kind: "file", ...version } : { target, name, kind: "missing" };
const declaration = targets => ({ transactionId: "shadow-test", createdAt: "2026-10-26T12:00:00.000Z", targets });
const target = (previous, next, outputDir = "assets/dark") => ({ outputDir, previous, next });
const plan = (input, observations) => planPublicationShadow(input, observations);

// Wrong action derivation, partial results and ownership inferred from next bytes must fail here.
test("shadow derives create/replace/remove from current state and explicit ownership", () => {
  const input = declaration([target(
    [named("atlas.svg", A), named("profile.svg", A), named("rhythm.svg", A), named("manifest.json", A)],
    [named("projects.json", B), named("atlas.svg", A), named("manifest.json", B)],
  )]);
  const observations = [observed(0, "atlas.svg", A), observed(0, "profile.svg", A),
    observed(0, "rhythm.svg"), observed(0, "projects.json"), observed(0, "manifest.json", A)];
  const result = plan(input, observations);
  assert.equal(result.kind, "planned");
  assert.deepEqual(result.journal.targets, [{ outputDir: "assets/dark", operations: [
    { name: "atlas.svg", action: "replace", previous: A, next: A },
    { name: "profile.svg", action: "remove", previous: A },
    { name: "projects.json", action: "create", next: B },
    { name: "manifest.json", action: "replace", previous: A, next: B },
  ] }]);
  assert.deepEqual(decodePublicationJournal(encodePublicationJournal(result.journal)), result.journal);
  assert.deepEqual(protocol.planPublicationRecovery(result.journal, "preparing", observations.filter(o => o.name !== "rhythm.svg")).steps, []);
});

test("matching next bytes without prior ownership block the whole multi-theme journal", () => {
  const input = declaration([
    target([], [named("atlas.svg", B), named("manifest.json", B)]),
    target([], [named("atlas.svg", B), named("manifest.json", B)], "assets/light"),
  ]);
  const result = plan(input, [observed(0, "atlas.svg"), observed(0, "manifest.json"),
    observed(1, "atlas.svg", B), observed(1, "manifest.json")]);
  assert.deepEqual(result, { kind: "blocked", conflicts: [
    { target: 1, name: "atlas.svg", reason: "unowned-file" },
  ] });
  assert.equal(Object.hasOwn(result, "journal"), false);
});

test("every existing unowned artifact including the manifest returns conflicts rather than a partial journal", () => {
  const result = plan(declaration([target([], [named("atlas.svg", B), named("manifest.json", B)])]),
    [observed(0, "atlas.svg", B), observed(0, "manifest.json", B)]);
  assert.deepEqual(result, { kind: "blocked", conflicts: [
    { target: 0, name: "atlas.svg", reason: "unowned-file" },
    { target: 0, name: "manifest.json", reason: "unowned-file" },
  ] });
});

test("drift and substituted entry kinds block all themes without a partial plan", () => {
  const input = declaration([target([named("atlas.svg", A)], [named("atlas.svg", B), named("manifest.json", B)]),
    target([named("profile.svg", A)], [named("manifest.json", B)], "assets/light")]);
  assert.deepEqual(plan(input, [observed(0, "atlas.svg", C), observed(0, "manifest.json"),
    { target: 1, name: "profile.svg", kind: "other" }, observed(1, "manifest.json")]), {
    kind: "blocked", conflicts: [
      { target: 0, name: "atlas.svg", reason: "ownership-drift" },
      { target: 1, name: "profile.svg", reason: "unsafe-entry" },
    ],
  });
});

test("missing previously owned selected files are creates while missing retired files are omitted", () => {
  const result = plan(declaration([target([named("atlas.svg", A), named("profile.svg", A)],
    [named("atlas.svg", B), named("manifest.json", B)])]),
  [observed(0, "atlas.svg"), observed(0, "profile.svg"), observed(0, "manifest.json")]);
  assert.equal(result.kind, "planned");
  assert.deepEqual(result.journal.targets[0].operations, [
    { name: "atlas.svg", action: "create", next: B }, { name: "manifest.json", action: "create", next: B },
  ]);
});

test("shadow declarations and observations reject incomplete, duplicated and accessor-backed inventories", () => {
  const input = declaration([target([], [named("atlas.svg", B), named("manifest.json", B)])]);
  const good = [observed(0, "atlas.svg"), observed(0, "manifest.json")];
  for (const observations of [[], good.slice(0, 1), [good[0], good[0]],
    [...good, observed(0, "profile.svg")], [good[0], observed(1, "manifest.json")], Array(2)]) {
    assert.throws(() => plan(input, observations), /observation|complete|data entries/);
  }
  let accessed = 0;
  const accessor = [good[0], good[1]];
  Object.defineProperty(accessor, 1, { get() { accessed++; return good[1]; } });
  assert.throws(() => plan(input, accessor), /data entries|accessor/);
  const inherited = Object.create(input);
  assert.throws(() => plan(inherited, good));
  for (const key of ["previous", "next"]) {
    const bad = structuredClone(input);
    bad.targets[0][key] = Array(1);
    assert.throws(() => plan(bad, good), /data entries|holes/);
    const duplicate = structuredClone(input);
    duplicate.targets[0][key] = [named("atlas.svg", A), named("atlas.svg", A)];
    assert.throws(() => plan(duplicate, good), /repeat|duplicate/);
  }
  const bad = structuredClone(input);
  Object.defineProperty(bad.targets[0].next[0], "sha256", { get() { accessed++; return B.sha256; } });
  assert.throws(() => plan(bad, good), /data fields|accessor/);
  const obs = structuredClone(good);
  Object.defineProperty(obs[0], "kind", { get() { accessed++; return "missing"; } });
  assert.throws(() => plan(input, obs), /data fields|accessor/);
  assert.equal(accessed, 0);
});

test("shadow rejects inherited/hidden/symbol fields at each record boundary", () => {
  const seed = declaration([target([], [named("atlas.svg", B), named("manifest.json", B)])]);
  const observations = [observed(0, "atlas.svg"), observed(0, "manifest.json")];
  for (const location of ["declaration", "target", "artifact", "observation"]) {
    for (const field of ["hidden", Symbol("unknown")]) {
      const input = structuredClone(seed), obs = structuredClone(observations);
      const record = location === "declaration" ? input : location === "target" ? input.targets[0]
        : location === "artifact" ? input.targets[0].next[0] : obs[0];
      Object.defineProperty(record, field, { value: true });
      assert.throws(() => plan(input, obs), /unknown field/);
    }
  }
  for (const location of ["target", "artifact", "observation"]) {
    const input = structuredClone(seed), obs = structuredClone(observations);
    if (location === "target") input.targets[0] = Object.create(input.targets[0]);
    if (location === "artifact") input.targets[0].next[0] = Object.create(input.targets[0].next[0]);
    if (location === "observation") obs[0] = Object.create(obs[0]);
    assert.throws(() => plan(input, obs));
  }
});

test("shadow input array methods cannot hide conflicts or invent an empty plan", () => {
  const input = declaration([target([], [named("atlas.svg", B), named("manifest.json", B)])]);
  input.targets.map = () => [];
  input.targets[0].next.map = () => [];
  const observations = [observed(0, "atlas.svg", B), observed(0, "manifest.json")];
  observations[Symbol.iterator] = function* () { yield observed(0, "atlas.svg"); yield observed(0, "manifest.json"); };
  assert.deepEqual(plan(input, observations), { kind: "blocked", conflicts: [
    { target: 0, name: "atlas.svg", reason: "unowned-file" },
  ] });
});

test("shadow preserves config target order and canonical payload/manifest ordering under input permutation", () => {
  const original = declaration([target([named("profile.svg", A), named("manifest.json", A)],
    [named("manifest.json", B), named("rhythm.svg", B), named("atlas.svg", B)]),
  target([], [named("manifest.json", B)], "assets/light")]);
  const observations = [observed(0, "profile.svg", A), observed(0, "manifest.json", A),
    observed(0, "atlas.svg"), observed(0, "rhythm.svg"), observed(1, "manifest.json")];
  const first = plan(original, observations);
  const permuted = structuredClone(original);
  permuted.targets[0].previous.reverse();
  permuted.targets[0].next.reverse();
  assert.deepEqual(plan(permuted, [...observations].reverse()), first);
  assert.deepEqual(first.journal.targets.map(t => t.operations.map(o => o.name)), [
    ["atlas.svg", "profile.svg", "rhythm.svg", "manifest.json"], ["manifest.json"],
  ]);
  const reordered = declaration([...original.targets].reverse());
  const swapped = observations.map(o => ({ ...o, target: 1 - o.target }));
  assert.deepEqual(plan(reordered, swapped).journal.targets, [...first.journal.targets].reverse());
});

test("shadow enforces platform-safe output roots, case collisions and complete next manifests", () => {
  for (const outputDir of ["../escape", "C:/escape", ".commitatlas", ".COMMITATLAS/child", "assets/CON.json",
    "assets/foo.", "assets/foo ", "assets\\dark", "assets/file:stream", "assets/a?b", "assets/line\nfeed"]) {
    assert.throws(() => plan(declaration([target([], [named("manifest.json", B)], outputDir)]), [observed(0, "manifest.json")]), /unsafe|control|overlap/, outputDir);
  }
  assert.throws(() => plan(declaration([target([], [named("manifest.json", B)], "assets/Dark"),
    target([], [named("manifest.json", B)], "assets/dark")]), []), /unique|collid/);
  assert.throws(() => plan(declaration([target([], [named("atlas.svg", B)])]), [observed(0, "atlas.svg")]), /manifest/);
  assert.throws(() => plan(declaration([target([], [named("manifest.json", B)]),
    target([], [named("manifest.json", B)], "assets/dark/manifest.json")]), []), /overlap|collid/);
});

test("shadow retains detached results for frozen/null-prototype input and revalidation refuses post-plan drift", () => {
  const input = declaration([target([named("atlas.svg", A)], [named("atlas.svg", B), named("manifest.json", B)])]);
  const observations = [observed(0, "atlas.svg", A), observed(0, "manifest.json")];
  const expected = plan(input, observations);
  const detached = structuredClone(expected);
  input.targets[0].previous[0].sha256 = C.sha256;
  observations[0].sha256 = C.sha256;
  assert.deepEqual(expected, detached);
  assert.throws(() => protocol.planPublicationRecoveryFromStatus(expected.journal,
    { version: 1, generator: "CommitAtlas", transactionId: "shadow-test", phase: "preparing" }, observations), /drifted/);
  assert.throws(() => protocol.planPublicationRecovery(expected.journal, "preparing",
    [observed(0, "atlas.svg"), observed(0, "manifest.json")]), /drifted/);
  const frozen = Object.freeze(Object.assign(Object.create(null), declaration([target([], [named("manifest.json", B)])])));
  assert.equal(plan(frozen, [observed(0, "manifest.json")]).kind, "planned");
});

test("shadow applies the existing bounded union and scene-byte budgets without truncation", () => {
  const previous = Array.from({ length: 32 }, (_, i) => [named(`scene-old-${i}.svg`, A), named(`scene-old-${i}.still.svg`, A)]).flat();
  const next = Array.from({ length: 32 }, (_, i) => [named(`scene-new-${i}.svg`, { ...B, bytes: 120 * 1024 }), named(`scene-new-${i}.still.svg`, { ...B, bytes: 120 * 1024 })]).flat();
  next.push(named("manifest.json", B));
  const targets = Array.from({ length: 4 }, (_, i) => target(previous, next, `assets/theme-${i}`));
  const observations = targets.flatMap((_, i) => [...previous.map(p => observed(i, p.name, p)), ...next.map(n => observed(i, n.name))]);
  const result = plan(declaration(targets), observations);
  assert.equal(result.kind, "planned");
  assert.equal(result.journal.targets[3].operations.length, 129);
  assert.ok(encodePublicationJournal(result.journal).byteLength < 256 * 1024);
  const maximum = [...Array.from({ length: 95 }, (_, i) => named(`card-${i}.svg`, B)), named("manifest.json", B)];
  const bounded = plan(declaration([target([], maximum)]), maximum.map(a => observed(0, a.name)));
  assert.equal(bounded.journal.targets[0].operations.length, 96);
  const tooMany = declaration([target([], Array.from({ length: 97 }, (_, i) => named(i === 96 ? "manifest.json" : `card-${i}.svg`, B)))]);
  assert.throws(() => plan(tooMany, []), /count|limit/);
  const union = declaration([target(Array.from({ length: 80 }, (_, i) => named(`old-${i}.svg`, A)),
    [...Array.from({ length: 80 }, (_, i) => named(`new-${i}.svg`, B)), named("manifest.json", B)])]);
  assert.throws(() => plan(union, []), /operation count/);
  const tooLarge = declaration([target([], [named("scene-nebula.svg", { ...B, bytes: 120 * 1024 + 1 }), named("manifest.json", B)])]);
  assert.throws(() => plan(tooLarge, []), /byte length/);
});

const NOW = new Date("2026-08-20T12:00:00.000Z");
function snapshot(name = "The Octocat") {
  return assembleStaticPortfolio({ ...demoProfile("octocat", NOW), name }, demoContributions("octocat", 365, NOW),
    demoProjects("octocat", ["atlas"], new Map([["atlas", "active"]]), new Map([["atlas", "ci.yml"]]), NOW));
}
function config(extra = {}) {
  return parseStaticConfig({ version: 1, user: "octocat", outputDir: "assets/dark", cards: ["atlas", "profile"],
    theme: "midnight", motion: "none", projects: [{ repo: "octocat/atlas", label: "Atlas", lifecycle: "active", workflow: "ci.yml" }], ...extra });
}
function version(bytes) { return { bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") }; }
function nextInventory(manifest) {
  return [...manifest.artifacts.map(a => ({ name: a.path, bytes: a.bytes, sha256: a.sha256 })),
    named("manifest.json", version(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)))];
}
async function inventory(root, outputDir) {
  const bytes = await fs.readFile(path.join(root, outputDir, "manifest.json"));
  const manifest = JSON.parse(bytes.toString());
  return [...manifest.artifacts.map(a => ({ name: a.path, bytes: a.bytes, sha256: a.sha256 })),
    named("manifest.json", version(bytes))];
}
async function observe(root, input) {
  const observations = [];
  for (const [index, t] of input.targets.entries()) for (const name of new Set([...t.previous, ...t.next].map(a => a.name))) {
    const file = path.join(root, t.outputDir, name);
    let stat;
    try { stat = await fs.lstat(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
    observations.push(!stat ? observed(index, name) : stat.isFile() && stat.nlink === 1
      ? observed(index, name, version(await fs.readFile(file))) : { target: index, name, kind: "other" });
  }
  return observations;
}

test("real v1 two-theme transitions agree with shadow intent and preserve foreign siblings", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "commitatlas-shadow-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const themes = [{ theme: "paper", outputDir: "assets/light" }];
  const first = config({ themes });
  await generateStaticFromSnapshot({ root, config: first, snapshot: snapshot() });
  for (const output of ["assets/dark", "assets/light"]) await fs.writeFile(path.join(root, output, "notes.md"), "caller notes\n");
  const previous = await Promise.all(["assets/dark", "assets/light"].map(output => inventory(root, output)));
  const second = config({ cards: ["atlas", "rhythm"], themes });
  const dry = await generateStaticFromSnapshot({ root, config: second, snapshot: snapshot("Changed profile"), dryRun: true });
  const input = declaration([dry, ...dry.variants].map((r, i) => target(previous[i], nextInventory(r.manifest), i === 0 ? "assets/dark" : "assets/light")));
  const before = await observe(root, input);
  const shadow = plan(input, before);
  assert.equal(shadow.kind, "planned");
  assert.deepEqual(shadow.journal.targets.map(t => t.operations.map(o => [o.name, o.action])), [
    [["atlas.svg", "replace"], ["profile.svg", "remove"], ["rhythm.svg", "create"], ["manifest.json", "replace"]],
    [["atlas.svg", "replace"], ["profile.svg", "remove"], ["rhythm.svg", "create"], ["manifest.json", "replace"]],
  ]);
  assert.deepEqual(await observe(root, input), before);
  await assert.rejects(fs.lstat(path.join(root, ".commitatlas")), { code: "ENOENT" });
  await generateStaticFromSnapshot({ root, config: second, snapshot: snapshot("Changed profile") });
  const after = await observe(root, input);
  assert.deepEqual(protocol.planPublicationRecovery(shadow.journal, "committed", after).steps, []);
  for (const output of ["assets/dark", "assets/light"]) assert.equal(await fs.readFile(path.join(root, output, "notes.md"), "utf8"), "caller notes\n");
  const retry = declaration(input.targets.map(t => target(t.next, t.next, t.outputDir)));
  const retryObservations = after.filter(o => o.name !== "profile.svg");
  const retryPlan = plan(retry, retryObservations);
  assert.equal(retryPlan.kind, "planned");
  assert.deepEqual(plan(retry, retryObservations), retryPlan);
  assert.deepEqual(protocol.planPublicationRecovery(retryPlan.journal, "committed", retryObservations).steps, []);
});

test("real selected caller files remain v1-compatible but explicitly block shadow ownership", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "commitatlas-shadow-owner-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const selected = config({ cards: ["atlas"] });
  const dry = await generateStaticFromSnapshot({ root, config: selected, snapshot: snapshot(), dryRun: true });
  await fs.mkdir(path.join(root, "assets/dark"), { recursive: true });
  await fs.writeFile(path.join(root, "assets/dark/atlas.svg"), "caller-owned content");
  const input = declaration([target([], nextInventory(dry.manifest))]);
  assert.deepEqual(plan(input, await observe(root, input)), { kind: "blocked", conflicts: [
    { target: 0, name: "atlas.svg", reason: "unowned-file" },
  ] });
  await generateStaticFromSnapshot({ root, config: selected, snapshot: snapshot() });
  assert.notEqual(await fs.readFile(path.join(root, "assets/dark/atlas.svg"), "utf8"), "caller-owned content");
});


test("real dry-run fresh single-theme planning creates no outputs or control records", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "commitatlas-shadow-fresh-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const selected = config({ cards: ["atlas"] });
  const dry = await generateStaticFromSnapshot({ root, config: selected, snapshot: snapshot(), dryRun: true });
  const input = declaration([target([], nextInventory(dry.manifest))]);
  const result = plan(input, await observe(root, input));
  assert.equal(result.kind, "planned");
  assert.deepEqual(result.journal.targets[0].operations.map(o => [o.name, o.action]), [
    ["atlas.svg", "create"], ["manifest.json", "create"],
  ]);
  assert.deepEqual(await fs.readdir(root), []);
  const api = await import("../dist/index.js");
  assert.equal(api.planPublicationShadow, undefined);
});

test("real symlink substitution is an unsafe observation and preserves caller files", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "commitatlas-shadow-link-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const selected = config({ cards: ["atlas"] });
  const dry = await generateStaticFromSnapshot({ root, config: selected, snapshot: snapshot(), dryRun: true });
  await fs.mkdir(path.join(root, "assets/dark"), { recursive: true });
  const caller = path.join(root, "caller.txt");
  await fs.writeFile(caller, "caller-owned sentinel");
  const output = path.join(root, "assets/dark/atlas.svg");
  // Directory symlinks/junctions need no file-symlink privilege on Windows; either kind is unsafe.
  const linkTarget = process.platform === "win32" ? root : caller;
  await fs.symlink(linkTarget, output, process.platform === "win32" ? "junction" : "file");
  const input = declaration([target([], nextInventory(dry.manifest))]);
  assert.deepEqual(plan(input, await observe(root, input)), { kind: "blocked", conflicts: [
    { target: 0, name: "atlas.svg", reason: "unsafe-entry" },
  ] });
  assert.equal(await fs.readFile(caller, "utf8"), "caller-owned sentinel");
  assert.equal((await fs.lstat(output)).isSymbolicLink(), true);
  await assert.rejects(fs.lstat(path.join(root, ".commitatlas")), { code: "ENOENT" });
});
