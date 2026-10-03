import assert from "node:assert/strict";
import test from "node:test";
import { STATIC_CARD_NAMES } from "../dist/config.js";
import { isSceneArtifactName, MAX_STATIC_SCENES } from "../dist/scene-config.js";
import { SCENE_MOTION_BUDGET } from "../../svg/dist/index.js";
import { encodePublicationJournal, decodePublicationJournal, MAX_PUBLICATION_JOURNAL_BYTES } from "../dist/publication-codec.js";
import { PUBLICATION_PHASES, planPublicationRecovery, validatePublicationJournal } from "../dist/publication-protocol.js";

const before = { sha256: "a".repeat(64), bytes: 96 * 1024 };
const after = { sha256: "b".repeat(64), bytes: 96 * 1024 };
const fixedNames = [...STATIC_CARD_NAMES.map(name => `${name}.svg`), "atlas-compact.svg", "atlas-wide.svg", "projects.json", "projects.md", "delivery.json"];
const replace = (name, previous = before, next = after) => ({ name, action: "replace", previous, next });
const journal = (operations, targets = 1) => ({
  version: 1, generator: "CommitAtlas", transactionId: "tx-scene-capacity",
  createdAt: "2026-10-04T00:00:00.000Z",
  targets: Array.from({ length: targets }, (_, i) => ({ outputDir: `assets/theme-${i}`, operations })),
});
const inventory = () => [
  ...fixedNames.map(name => replace(name)),
  ...Array.from({ length: MAX_STATIC_SCENES }, (_, i) => ({ name: `scene-retired-${i}.svg`, action: "remove", previous: before })),
  ...Array.from({ length: MAX_STATIC_SCENES }, (_, i) => ({ name: `scene-next-${i}.svg`, action: "create", next: after })),
  replace("manifest.json"),
];
function observations(record, next) {
  return record.targets.flatMap((target, i) => target.operations.map(op => {
    const version = next ? op.next : op.previous;
    return { target: i, name: op.name, ...(version ? { kind: "file", ...version } : { kind: "missing" }) };
  }));
}

test("recovery records cover full fixed output plus old and new scene inventories", () => {
  const operations = inventory();
  assert.equal(operations.length, 81, "review capacity whenever the static inventory changes");
  const record = journal(operations, 4);
  const encoded = encodePublicationJournal(record);
  assert.deepEqual(decodePublicationJournal(encoded), record);
  for (const [index, phase] of PUBLICATION_PHASES.entries()) {
    const forward = index >= 6;
    const plan = planPublicationRecovery(record, phase, observations(record, !forward));
    assert.equal(plan.steps.length, operations.length * 4);
    assert.ok(plan.steps.slice(-4).every(step => step.name === "manifest.json"));
    assert.ok(plan.steps.slice(0, -4).every(step => step.name !== "manifest.json"));
    assert.deepEqual(planPublicationRecovery(record, phase, observations(record, forward)).steps, []);
  }
});

test("canonical scenes retain the engine 120 KiB ceiling in both recorded generations", () => {
  const large = { ...after, bytes: SCENE_MOTION_BUDGET.bytes };
  const record = journal([replace("scene-evidence-coverage.svg", large, large)]);
  assert.deepEqual(decodePublicationJournal(encodePublicationJournal(record)), record);
  for (const bytes of [96 * 1024 + 1, SCENE_MOTION_BUDGET.bytes]) {
    assert.doesNotThrow(() => validatePublicationJournal(journal([replace("scene-large.svg", { ...before, bytes }, { ...after, bytes })])));
  }
  for (const field of ["previous", "next"]) {
    const op = replace("scene-large.svg"); op[field] = { ...after, bytes: SCENE_MOTION_BUDGET.bytes + 1 };
    assert.throws(() => validatePublicationJournal(journal([op])), /byte length/);
  }
});

test("larger scene capacity never expands fixed-card or malformed scene-name limits", () => {
  for (const name of ["atlas.svg", "manifest.json", "projects.json", "projects.md", "scene-9.svg", "scene-bad--id.svg", `scene-${"a".repeat(49)}.svg`]) {
    assert.throws(() => validatePublicationJournal(journal([replace(name, before, { ...after, bytes: 96 * 1024 + 1 })])), /byte length/, name);
  }
});

test("artifact names and operation counts remain bounded before serialization", () => {
  assert.doesNotThrow(() => validatePublicationJournal(journal([replace(`${"a".repeat(60)}.svg`)])));
  assert.throws(() => validatePublicationJournal(journal([replace(`${"a".repeat(61)}.svg`)])), /artifact name/);
  const bounded = Array.from({ length: 96 }, (_, i) => replace(`artifact-${i}.svg`));
  assert.doesNotThrow(() => validatePublicationJournal(journal(bounded)));
  assert.throws(() => validatePublicationJournal(journal([...bounded, replace("overflow.svg")])), /operation count/);
});

test("largest bounded four-target records fit a 128 KiB canonical control record", () => {
  assert.equal(MAX_PUBLICATION_JOURNAL_BYTES, 128 * 1024);
  const ops = Array.from({ length: 96 }, (_, i) => replace(`${String(i).padStart(60, "a")}.svg`));
  const record = journal(ops, 4);
  record.transactionId = "t".repeat(64);
  // Six-byte JSON escapes exercise maximum per-code-unit expansion under the existing path schema.
  record.targets.forEach((target, i) => { target.outputDir = '\u0001'.repeat(239) + i; });
  const encoded = encodePublicationJournal(record);
  assert.ok(encoded.length > 64 * 1024 && encoded.length < MAX_PUBLICATION_JOURNAL_BYTES);
  assert.deepEqual(decodePublicationJournal(encoded), record);
  const oversized = new Uint8Array(MAX_PUBLICATION_JOURNAL_BYTES + 1).fill(0xff);
  Object.defineProperty(oversized, "byteLength", { value: 1 });
  assert.throws(() => decodePublicationJournal(oversized), /byte limit/, "intrinsic byte limit still precedes decoding");
});

test("small existing records retain their canonical wire representation", () => {
  const record = journal([replace("atlas.svg")]);
  const bytes = encodePublicationJournal(record);
  assert.equal(new TextDecoder().decode(bytes), JSON.stringify(record) + "\n");
  assert.deepEqual(decodePublicationJournal(bytes), record);
});


test("recovery scene-name eligibility matches the static naming contract", () => {
  for (const id of ["a", "evidence-coverage", "a-0", "a".repeat(48), "a".repeat(49), "9", "a--b", "a_", "a-", "A", "../a"]) {
    const name = `scene-${id}.svg`;
    const record = journal([replace(name, before, { ...after, bytes: SCENE_MOTION_BUDGET.bytes })]);
    if (isSceneArtifactName(name)) assert.doesNotThrow(() => validatePublicationJournal(record), name);
    else assert.throws(() => validatePublicationJournal(record), /artifact name|byte length/, name);
  }
});
