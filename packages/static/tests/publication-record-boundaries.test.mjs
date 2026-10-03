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
