import assert from "node:assert/strict";
import test from "node:test";
import { PUBLICATION_PHASES, planPublicationRecovery, planPublicationRecoveryFromStatus } from "../dist/publication-protocol.js";

const next = Object.freeze({ sha256: "a".repeat(64), bytes: 7 });
const journal = () => ({
  version: 1, generator: "CommitAtlas", transactionId: "tx-observation",
  createdAt: "2026-10-04T00:00:00.000Z",
  targets: [{ outputDir: "assets/dark", operations: [{ name: "atlas.svg", action: "create", next }] }],
});
const status = phase => ({ version: 1, generator: "CommitAtlas", transactionId: "tx-observation", phase });
const missing = () => ({ target: 0, name: "atlas.svg", kind: "missing" });
const installed = () => ({ target: 0, name: "atlas.svg", kind: "file", ...next });
const required = [{ target: 0, name: "atlas.svg", action: "install-next" }];
const plan = observations => planPublicationRecoveryFromStatus(journal(), status("committed"), observations);

test("observation iterators cannot replace missing indexed evidence with a false completed generation", () => {
  for (const override of ["iterator", "iterator-getter", "map", "species"]) {
    let called = false;
    let input = [missing()];
    if (override === "iterator") input[Symbol.iterator] = function* () { called = true; yield installed(); };
    else if (override === "iterator-getter") Object.defineProperty(input, Symbol.iterator, {
      get() { called = true; return function* () { yield installed(); }; },
    });
    else if (override === "map") input.map = () => { called = true; return [installed()]; };
    else {
      class CallerArray extends Array {
        static get [Symbol.species]() { called = true; return Array; }
      }
      input = new CallerArray(missing());
    }
    assert.deepEqual(plan(input).steps, required, override);
    assert.equal(called, false, `${override} must not be invoked`);
  }
});

test("non-array and incorrectly sized observations fail before consuming an iterator", () => {
  for (const input of [{}, new Set([installed()]), [], [missing(), installed()]]) {
    let called = false;
    input[Symbol.iterator] = function* () { called = true; yield installed(); };
    assert.throws(() => plan(input), /publication observations/);
    assert.equal(called, false);
  }
});

test("holes, inherited entries and observation-array accessors are never evidence", () => {
  for (const mode of ["hole", "inherited", "accessor"]) {
    let called = false;
    const input = new Array(1);
    if (mode === "inherited") Object.setPrototypeOf(input, Object.assign(Object.create(Array.prototype), { 0: installed() }));
    if (mode === "accessor") Object.defineProperty(input, "0", { get() { called = true; return installed(); } });
    assert.throws(() => plan(input), /publication observations/);
    assert.equal(called, false);
  }
});

test("observation records reject accessors without invoking them", () => {
  for (const key of ["target", "name", "kind", "sha256", "bytes"]) {
    const input = installed();
    const original = input[key];
    let called = false;
    Object.defineProperty(input, key, { get() { called = true; return original; } });
    assert.throws(() => plan([input]), /publication observation/);
    assert.equal(called, false, key);
  }
});

test("observation records require own closed identity and version fields", () => {
  const inherited = Object.create(installed());
  const symbol = { ...installed(), [Symbol("unexpected")]: true };
  for (const input of [null, [], inherited, symbol, { ...installed(), extra: true },
    ...[undefined, -1, 0.5, "0", NaN, Infinity].map(target => ({ ...installed(), target })),
    ...[undefined, {}, "", "../atlas.svg"].map(name => ({ ...installed(), name })),
    ...[undefined, "directory", "FILE", null].map(kind => ({ ...installed(), kind })),
    ...[undefined, "", "A".repeat(64), "g".repeat(64)].map(sha256 => ({ ...installed(), sha256 })),
    ...[undefined, -1, 0.5, "7", NaN, Infinity].map(bytes => ({ ...installed(), bytes })),
  ]) assert.throws(() => plan([input]), /publication observation/);
});

test("missing observations cannot carry contradictory file-version evidence", () => {
  for (const extra of [{ sha256: next.sha256 }, { bytes: 0 }, next]) {
    for (const phase of PUBLICATION_PHASES) {
      assert.throws(() => planPublicationRecovery(journal(), phase, [{ ...missing(), ...extra }]), /publication observation/);
    }
  }
  assert.deepEqual(plan([{ ...missing(), sha256: undefined, bytes: undefined }]).steps, required);
});

test("null-prototype and frozen data records retain recovery directions and idempotence", () => {
  const input = Object.freeze([Object.freeze(Object.assign(Object.create(null), missing()))]);
  for (const phase of PUBLICATION_PHASES) {
    const result = planPublicationRecoveryFromStatus(journal(), status(phase), input);
    assert.deepEqual(result.steps, ["committed", "cleaning", "complete"].includes(phase) ? required : []);
  }
  assert.deepEqual(plan([Object.freeze(installed())]).steps, []);
  assert.equal(input[0].kind, "missing");
});

test("drift and unexpected observations still reject the complete plan", () => {
  for (const input of [{ ...installed(), sha256: "b".repeat(64) }, { ...missing(), kind: "other" },
    { ...installed(), target: 1 }, { ...installed(), name: "other.svg" },
  ]) assert.throws(() => plan([input]), /publication/);
});

test("status identity is checked before observation descriptors or iteration", () => {
  let called = false;
  const input = new Proxy([installed()], { get() { called = true; throw new Error("read too early"); } });
  assert.throws(() => planPublicationRecoveryFromStatus(journal(), { ...status("committed"), transactionId: "wrong" }, input), /does not match/);
  assert.equal(called, false);
});
