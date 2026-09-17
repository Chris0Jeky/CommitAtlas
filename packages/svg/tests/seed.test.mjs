import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalJson,
  seededRandom,
  stableHash,
} from "../dist/index.js";

test("canonicalJson sorts object keys recursively and preserves array order", () => {
  assert.equal(
    canonicalJson({ z: 3, nested: { beta: true, alpha: null }, list: [3, 2, 1], a: "first" }),
    '{"a":"first","list":[3,2,1],"nested":{"alpha":null,"beta":true},"z":3}',
  );
  assert.equal(
    canonicalJson({ b: 2, a: 1 }),
    canonicalJson({ a: 1, b: 2 }),
  );
  assert.equal(canonicalJson(-0), "0");
});

test("canonicalJson rejects values outside finite JSON data", () => {
  assert.throws(() => canonicalJson(undefined), /undefined/u);
  assert.throws(() => canonicalJson(() => undefined), /function/u);
  assert.throws(() => canonicalJson(Symbol("value")), /symbol/u);
  assert.throws(() => canonicalJson(1n), /bigint/u);
  assert.throws(() => canonicalJson({ value: Number.NaN }), /finite/u);
  assert.throws(() => canonicalJson({ value: Number.POSITIVE_INFINITY }), /finite/u);
  assert.throws(() => canonicalJson(new Date("2026-01-01T00:00:00Z")), /plain object/u);

  const sparse = [];
  sparse[1] = "present";
  assert.throws(() => canonicalJson(sparse), /sparse/u);

  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cyclic/u);
});

test("stableHash returns the standard lowercase SHA-256 digest", () => {
  assert.equal(
    stableHash("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.match(stableHash("CommitAtlas"), /^[a-f0-9]{64}$/u);
  assert.notEqual(stableHash("CommitAtlas"), stableHash("commitatlas"));
  assert.throws(() => stableHash(123), /string/u);
});

test("canonical models produce stable seeds independent of key insertion order", () => {
  const first = stableHash(canonicalJson({ scene: "atlas", model: { days: 365, theme: "paper" } }));
  const reordered = stableHash(canonicalJson({ model: { theme: "paper", days: 365 }, scene: "atlas" }));
  const changed = stableHash(canonicalJson({ scene: "atlas", model: { days: 366, theme: "paper" } }));

  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test("seededRandom is deterministic, bounded, and reasonably distributed", () => {
  const seed = stableHash(canonicalJson({ scene: "nebula", snapshot: "2026-09-17" }));
  const sameSeed = stableHash(canonicalJson({ snapshot: "2026-09-17", scene: "nebula" }));
  const changedSeed = stableHash(canonicalJson({ scene: "nebula", snapshot: "2026-09-18" }));
  const first = seededRandom(seed);
  const second = seededRandom(sameSeed);
  const changed = seededRandom(changedSeed);

  const firstSequence = Array.from({ length: 16 }, () => first());
  const secondSequence = Array.from({ length: 16 }, () => second());
  const changedSequence = Array.from({ length: 16 }, () => changed());
  assert.deepEqual(firstSequence, secondSequence);
  assert.notDeepEqual(firstSequence, changedSequence);

  const buckets = Array.from({ length: 16 }, () => 0);
  const sample = seededRandom(seed);
  for (let index = 0; index < 10_000; index += 1) {
    const value = sample();
    assert.ok(value >= 0 && value < 1, `draw ${index} escaped [0, 1): ${value}`);
    buckets[Math.floor(value * buckets.length)] += 1;
  }
  for (const count of buckets) {
    assert.ok(count >= 475 && count <= 775, `obvious 16-bucket bias: ${buckets.join(", ")}`);
  }

  assert.throws(() => seededRandom("not-a-sha256"), /64-character hexadecimal/u);
});

test("canonicalJson rejects object and array getters without executing them", () => {
  for (const value of [{}, []]) {
    let reads = 0;
    const key = Array.isArray(value) ? "0" : "value";
    Object.defineProperty(value, key, {
      enumerable: true,
      get() { reads += 1; return reads; },
    });
    assert.throws(() => canonicalJson(value), /accessor/u);
    assert.equal(reads, 0, "serialization must not evaluate a getter");
  }
});

test("canonicalJson rejects setter-only array entries as accessors", () => {
  const value = [];
  Object.defineProperty(value, "0", { set: () => { assert.fail("serialization must not call a setter"); }, enumerable: true });
  assert.throws(() => canonicalJson(value), /accessor/u);
});

test("canonicalJson preserves dense array data descriptors and repeated references", () => {
  const shared = { b: 2, a: 1 };
  const value = [shared, shared];
  Object.defineProperty(value, "0", { value: shared, enumerable: false });
  assert.equal(canonicalJson(value), '[{"a":1,"b":2},{"a":1,"b":2}]');
});
