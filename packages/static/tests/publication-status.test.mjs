import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLICATION_PHASES,
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
    null, undefined, true, 0, "committed", [], {},
    { ...status(), extra: true },
    status({ version: 2 }),
    status({ generator: "Other" }),
    status({ transactionId: "bad/id" }),
    status({ phase: "finished" }),
  ]) {
    assert.throws(() => validatePublicationStatus(invalid), /publication status/);
  }
  for (const key of Object.keys(status())) {
    const incomplete = status();
    delete incomplete[key];
    assert.throws(() => validatePublicationStatus(incomplete), /publication status/);
  }
});

test("status uses the journal's exact bounded transaction identity", () => {
  for (const transactionId of ["a", "A9-transaction", "a".repeat(64)]) {
    assert.equal(validatePublicationStatus(status({ transactionId })).transactionId, transactionId);
    assert.doesNotThrow(() => planPublicationRecoveryFromStatus(
      journal(transactionId), status({ transactionId }), previousObservations(),
    ));
  }
  for (const transactionId of ["", "a".repeat(65), "-a", "a_b", "a\n", "a\r", "a\u2028", "a\u2029", "../a", 1, null]) {
    assert.throws(() => validatePublicationStatus(status({ transactionId })), /transactionId/);
    assert.throws(() => planPublicationRecoveryFromStatus(
      journal(transactionId), status({ transactionId }), previousObservations(),
    ), /publication journal transactionId/);
  }
});

test("validation returns a detached status without mutating its input", () => {
  const input = Object.freeze(status());
  const parsed = validatePublicationStatus(input);
  assert.deepEqual(parsed, input);
  assert.notEqual(parsed, input);
  parsed.phase = "complete";
  assert.equal(input.phase, "committed");
});

test("status-bound recovery rejects a different transaction before planning", () => {
  const observations = {
    [Symbol.iterator]() { throw new Error("observations must not be inspected"); },
  };
  for (const transactionId of ["tx-other", "TX-status-boundary"]) {
    assert.throws(
      () => planPublicationRecoveryFromStatus(journal(), status({ transactionId }), observations),
      /does not match the publication journal/,
    );
  }
});

test("matching durable status preserves recovery and manifest order in every phase", () => {
  for (const phase of PUBLICATION_PHASES) {
    const expected = planPublicationRecovery(journal(), phase, previousObservations());
    const actual = planPublicationRecoveryFromStatus(journal(), status({ phase }), previousObservations());
    assert.deepEqual(actual, expected, phase);
  }
  assert.deepEqual(
    planPublicationRecoveryFromStatus(journal(), status(), previousObservations()).steps,
    [
      { target: 0, name: "atlas.svg", action: "install-next" },
      { target: 0, name: "manifest.json", action: "install-next" },
    ],
  );
});

test("status-bound planning retains journal and observation validation", () => {
  assert.throws(() => planPublicationRecoveryFromStatus(
    { ...journal(), targets: [] }, status(), previousObservations(),
  ), /publication journal/);
  assert.throws(() => planPublicationRecoveryFromStatus(journal(), status(), []), /complete transaction/);
  assert.throws(() => planPublicationRecoveryFromStatus(
    journal(), status(), previousObservations().map((entry) => ({ ...entry, sha256: "c".repeat(64) })),
  ), /drifted/);
});
