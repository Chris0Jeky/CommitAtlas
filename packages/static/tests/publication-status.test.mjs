import assert from "node:assert/strict";
import test from "node:test";
import {
  planPublicationRecovery,
  planPublicationRecoveryFromStatus,
  validatePublicationStatus,
} from "../dist/publication-protocol.js";

const PREVIOUS = Object.freeze({ sha256: "a".repeat(64), bytes: 11 });
const NEXT = Object.freeze({ sha256: "b".repeat(64), bytes: 13 });

function journal(transactionId = "tx-status-boundary") {
  return {
    version: 1,
    generator: "CommitAtlas",
    transactionId,
    createdAt: "2026-10-01T00:00:00.000Z",
    targets: [{
      outputDir: "assets/commitatlas",
      operations: [
        { name: "atlas.svg", action: "replace", previous: PREVIOUS, next: NEXT },
        { name: "manifest.json", action: "replace", previous: PREVIOUS, next: NEXT },
      ],
    }],
  };
}

function status(overrides = {}) {
  return {
    version: 1,
    generator: "CommitAtlas",
    transactionId: "tx-status-boundary",
    phase: "committed",
    ...overrides,
  };
}

function previousObservations() {
  return [
    { target: 0, name: "atlas.svg", kind: "file", ...PREVIOUS },
    { target: 0, name: "manifest.json", kind: "file", ...PREVIOUS },
  ];
}

test("publication status accepts only the strict durable identity", () => {
  assert.deepEqual(validatePublicationStatus(status()), status());

  for (const invalid of [
    { ...status(), extra: true },
    status({ version: 2 }),
    status({ generator: "Other" }),
    status({ transactionId: "bad/id" }),
    status({ phase: "finished" }),
  ]) {
    assert.throws(() => validatePublicationStatus(invalid), /publication status/);
  }
});

test("status-bound recovery rejects a different transaction before planning", () => {
  assert.throws(
    () => planPublicationRecoveryFromStatus(
      journal(),
      status({ transactionId: "tx-other" }),
      previousObservations(),
    ),
    /does not match the publication journal/,
  );
});

test("matching durable status plans exactly the same recovery as its validated phase", () => {
  const expected = planPublicationRecovery(journal(), "committed", previousObservations());
  const actual = planPublicationRecoveryFromStatus(journal(), status(), previousObservations());

  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.steps, [
    { target: 0, name: "atlas.svg", action: "install-next" },
    { target: 0, name: "manifest.json", action: "install-next" },
  ]);
});
