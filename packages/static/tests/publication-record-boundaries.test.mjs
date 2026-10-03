import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicationJournal, planPublicationRecoveryFromStatus } from "../dist/publication-protocol.js";

const version = { sha256: "a".repeat(64), bytes: 7 };
const journal = () => ({
  version: 1, generator: "CommitAtlas", transactionId: "tx-codec",
  createdAt: "2026-10-03T00:00:00.000Z",
  targets: [{ outputDir: "assets/commitatlas", operations: [{ name: "atlas.svg", action: "create", next: version }] }],
});
const status = phase => ({ version: 1, generator: "CommitAtlas", transactionId: "tx-codec", phase });


test("journal validation rejects holes and accessors before a false empty recovery plan", () => {
  for (const sparse of [{ ...journal(), targets: new Array(1) },
    { ...journal(), targets: [{ outputDir: "assets/commitatlas", operations: new Array(1) }] }]) {
    assert.throws(() => validatePublicationJournal(sparse), /publication/);
    assert.throws(() => planPublicationRecoveryFromStatus(sparse, status("committed"), []), /publication/);
  }
  for (const field of ["targets", "operations"]) {
    const input = journal();
    const list = field === "targets" ? input.targets : input.targets[0].operations;
    const original = list[0];
    let called = false;
    Object.defineProperty(list, "0", { get() { called = true; return original; } });
    assert.throws(() => validatePublicationJournal(input), /publication/);
    assert.equal(called, false, "array accessors must not be evaluated");
  }
});

test("journal copying never invokes caller-supplied array methods or species", () => {
  for (const field of ["targets", "operations"]) {
    for (const override of ["map", "map-getter", "iterator", "species"]) {
      const input = journal();
      const original = field === "targets" ? input.targets : input.targets[0].operations;
      let called = false;
      let list = original;
      if (override === "map") list.map = () => { called = true; return []; };
      else if (override === "map-getter") Object.defineProperty(list, "map", { get() { called = true; return () => []; } });
      else if (override === "iterator") list[Symbol.iterator] = function* () { called = true; };
      else {
        class CallerArray extends Array {
          static get [Symbol.species]() { called = true; return Array; }
        }
        list = new CallerArray(...original);
      }
      if (field === "targets") input.targets = list;
      else input.targets[0].operations = list;
      const parsed = validatePublicationJournal(input);
      assert.equal(parsed.targets.length, 1, `${field}/${override} must retain the destination`);
      assert.equal(parsed.targets[0].operations.length, 1, `${field}/${override} must retain the operation`);
      assert.equal(Object.getPrototypeOf(parsed.targets), Array.prototype);
      assert.equal(Object.getPrototypeOf(parsed.targets[0].operations), Array.prototype);
      const observations = [{ target: 0, name: "atlas.svg", kind: "missing" }];
      assert.deepEqual(planPublicationRecoveryFromStatus(input, status("committed"), observations).steps,
        [{ target: 0, name: "atlas.svg", action: "install-next" }]);
      assert.equal(called, false, `${field}/${override} must not be invoked`);
    }
  }
});
