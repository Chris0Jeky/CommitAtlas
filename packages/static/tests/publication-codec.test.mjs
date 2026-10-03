import assert from "node:assert/strict";
import test from "node:test";
import { PUBLICATION_PHASES, planPublicationRecoveryFromStatus } from "../dist/publication-protocol.js";

const codec = await import("../dist/publication-codec.js").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const bytes = text => new TextEncoder().encode(text);
const text = input => new TextDecoder().decode(input);
const version = Object.freeze({ sha256: "a".repeat(64), bytes: 7 });
const journal = () => ({
  version: 1, generator: "CommitAtlas", transactionId: "tx-codec",
  createdAt: "2026-10-03T00:00:00.000Z",
  targets: [{ outputDir: "assets/commitatlas", operations: [
    { name: "atlas.svg", action: "create", next: version },
    { name: "manifest.json", action: "create", next: version },
  ] }],
});
const status = (phase = "prepared") => ({ version: 1, generator: "CommitAtlas", transactionId: "tx-codec", phase });

test("bounded publication codec exposes four explicit record operations", () => {
  for (const name of ["encodePublicationJournal", "decodePublicationJournal", "encodePublicationStatus", "decodePublicationStatus"]) {
    assert.equal(typeof codec[name], "function", `missing ${name}`);
  }
  assert.equal(codec.MAX_PUBLICATION_JOURNAL_BYTES, 64 * 1024);
  assert.equal(codec.MAX_PUBLICATION_STATUS_BYTES, 512);
});

test("canonical journal bytes round-trip, detach and normalize key insertion order", () => {
  const input = journal();
  const encoded = codec.encodePublicationJournal(input);
  assert.ok(encoded instanceof Uint8Array);
  assert.equal(text(encoded), JSON.stringify(input) + "\n");
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  reordered.targets = [{ operations: input.targets[0].operations.map(op => ({ next: { bytes: 7, sha256: version.sha256 }, action: op.action, name: op.name })), outputDir: "assets/commitatlas" }];
  assert.deepEqual(codec.encodePublicationJournal(reordered), encoded);
  const decoded = codec.decodePublicationJournal(encoded);
  assert.deepEqual(decoded, input);
  decoded.targets[0].operations[0].next.bytes = 8;
  assert.equal(input.targets[0].operations[0].next.bytes, 7);
  input.targets[0].outputDir = "changed";
  assert.equal(codec.decodePublicationJournal(encoded).targets[0].outputDir, "assets/commitatlas");
});

test("every encoded phase retains status-bound recovery direction and identity", () => {
  const decodedJournal = codec.decodePublicationJournal(codec.encodePublicationJournal(journal()));
  const observations = decodedJournal.targets[0].operations.map(op => ({ target: 0, name: op.name, kind: "missing" }));
  for (const [index, phase] of PUBLICATION_PHASES.entries()) {
    const encoded = codec.encodePublicationStatus(status(phase));
    assert.equal(text(encoded), JSON.stringify(status(phase)) + "\n");
    assert.deepEqual(codec.decodePublicationStatus(encoded), status(phase));
    assert.equal(planPublicationRecoveryFromStatus(decodedJournal, codec.decodePublicationStatus(encoded), observations).direction,
      index < 6 ? "rollback" : "roll-forward");
  }
  const different = codec.decodePublicationStatus(codec.encodePublicationStatus({ ...status(), transactionId: "other" }));
  assert.throws(() => planPublicationRecoveryFromStatus(decodedJournal, different, observations), /does not match/);
});

test("decoders reject non-byte, empty and oversized inputs before parsing", () => {
  for (const [decode, limit] of [
    [codec.decodePublicationJournal, codec.MAX_PUBLICATION_JOURNAL_BYTES],
    [codec.decodePublicationStatus, codec.MAX_PUBLICATION_STATUS_BYTES],
  ]) {
    for (const invalid of [null, undefined, "{}", [], new DataView(new ArrayBuffer(2)), new Uint16Array(2), new Uint8Array(0)]) {
      assert.throws(() => decode(invalid), /publication.*bytes/i);
    }
    assert.throws(() => decode(new Uint8Array(limit + 1)), /publication.*byte limit/i);
  }
});

test("fatal UTF-8 decoding refuses malformed bytes and never strips a BOM", () => {
  for (const decode of [codec.decodePublicationJournal, codec.decodePublicationStatus]) {
    for (const invalid of [[0xff], [0xc0, 0xaf], [0xe2, 0x82], [0xed, 0xa0, 0x80]]) {
      assert.throws(() => decode(Uint8Array.from(invalid)), /publication.*UTF-8/i);
    }
  }
  const encoded = codec.encodePublicationStatus(status());
  const bom = Uint8Array.from([0xef, 0xbb, 0xbf, ...encoded]);
  assert.throws(() => codec.decodePublicationStatus(bom), /publication.*JSON/i);
});

test("canonical decoders reject duplicate keys and noncanonical or trailing content", () => {
  const encoded = text(codec.encodePublicationStatus(status()));
  for (const value of [
    encoded.trimEnd(), encoded + "\n", " " + encoded,
    encoded.replace('"version":1', '"version":1,"version":1'),
    encoded.replace('"version":1', '"version":9,"version":1'),
    encoded.replace('"version":1', '"version":1.0'),
    encoded.replace('"CommitAtlas"', '"Commit\\u0041tlas"'),
    JSON.stringify(Object.fromEntries(Object.entries(status()).reverse())) + "\n",
    JSON.stringify(status(), null, 2) + "\n",
  ]) assert.throws(() => codec.decodePublicationStatus(bytes(value)), /publication.*canonical/i);
  for (const value of [encoded + "{}", encoded.slice(0, -3), "{", "NaN\n"]) {
    assert.throws(() => codec.decodePublicationStatus(bytes(value)), /publication.*JSON/i);
  }
  const source = text(codec.encodePublicationJournal(journal()));
  assert.throws(() => codec.decodePublicationJournal(bytes(source.replace('"bytes":7', '"bytes":9,"bytes":7'))), /canonical/);
});

test("schema validation remains mandatory for both encoders and decoders", () => {
  for (const invalid of [{ ...journal(), extra: true }, { ...journal(), targets: [] },
    { ...journal(), transactionId: "../bad" }, { ...journal(), targets: [{ outputDir: "../bad", operations: [] }] }]) {
    assert.throws(() => codec.encodePublicationJournal(invalid), /publication/);
    assert.throws(() => codec.decodePublicationJournal(bytes(JSON.stringify(invalid) + "\n")), /publication/);
  }
  for (const invalid of [{ ...status(), phase: "finished" }, { ...status(), generator: "Other" }, null, []]) {
    assert.throws(() => codec.encodePublicationStatus(invalid), /publication/);
    assert.throws(() => codec.decodePublicationStatus(bytes(JSON.stringify(invalid) + "\n")), /publication/);
  }
});

test("all bounded operations fit, while oversized journal names cannot escape the byte limit", () => {
  const maximum = { ...journal(), targets: Array.from({ length: 4 }, (_, i) => ({
    outputDir: `assets/theme-${i}`,
    operations: Array.from({ length: 32 }, (_, j) => ({ name: `scene-${j}.svg`, action: "replace", previous: version, next: version })),
  })) };
  const encoded = codec.encodePublicationJournal(maximum);
  assert.ok(encoded.byteLength < codec.MAX_PUBLICATION_JOURNAL_BYTES);
  assert.deepEqual(codec.decodePublicationJournal(encoded), maximum);
  maximum.targets[0].operations[0].name = "a".repeat(codec.MAX_PUBLICATION_JOURNAL_BYTES) + ".svg";
  assert.throws(() => codec.encodePublicationJournal(maximum), /publication.*byte limit/i);
});

test("sparse in-memory journals cannot be encoded into unreadable durable records", () => {
  for (const sparse of [{ ...journal(), targets: new Array(1) },
    { ...journal(), targets: [{ outputDir: "assets/commitatlas", operations: new Array(1) }] }]) {
    assert.throws(() => codec.encodePublicationJournal(sparse), /publication/);
  }
});

test("byte views use only their own range and buffers do not alias decoded records", () => {
  const encoded = codec.encodePublicationJournal(journal());
  const backing = new Uint8Array(encoded.length + 8).fill(0xff);
  backing.set(encoded, 4);
  const view = backing.subarray(4, backing.length - 4);
  assert.deepEqual(codec.decodePublicationJournal(view), journal());
  assert.deepEqual(codec.decodePublicationJournal(Buffer.from(view)), journal());
  const first = codec.encodePublicationStatus(status());
  first.fill(0);
  assert.deepEqual(codec.decodePublicationStatus(codec.encodePublicationStatus(status())), status());
});
