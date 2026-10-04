import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPhaseAdvance,
  assertPublicationPhase,
  classifyObservation,
  planPublicationRecovery,
  recoveryDirection,
  validatePublicationJournal,
} from "../dist/publication-protocol.js";

const PREVIOUS = Object.freeze({ sha256: "a".repeat(64), bytes: 11 });
const NEXT = Object.freeze({ sha256: "b".repeat(64), bytes: 13 });

function journal() {
  return {
    version: 1,
    generator: "CommitAtlas",
    transactionId: "tx-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    targets: [
      {
        outputDir: "assets/commitatlas",
        operations: [
          { name: "atlas.svg", action: "replace", previous: PREVIOUS, next: NEXT },
          { name: "obsolete.json", action: "remove", previous: PREVIOUS },
        ],
      },
      {
        outputDir: "assets/commitatlas/light",
        operations: [
          { name: "atlas.svg", action: "create", next: NEXT },
        ],
      },
    ],
  };
}

function previousObservations() {
  return [
    { target: 0, name: "atlas.svg", kind: "file", ...PREVIOUS },
    { target: 0, name: "obsolete.json", kind: "file", ...PREVIOUS },
    { target: 1, name: "atlas.svg", kind: "missing" },
  ];
}

function nextObservations() {
  return [
    { target: 0, name: "atlas.svg", kind: "file", ...NEXT },
    { target: 0, name: "obsolete.json", kind: "missing" },
    { target: 1, name: "atlas.svg", kind: "file", ...NEXT },
  ];
}

test("accepts only known phases and adjacent monotonic transitions", () => {
  assert.equal(assertPublicationPhase("prepared"), "prepared");
  assert.throws(() => assertPublicationPhase("published"), /invalid phase/);
  assert.doesNotThrow(() => assertPhaseAdvance("prepared", "prepared"));
  assert.doesNotThrow(() => assertPhaseAdvance("prepared", "backed-up"));
  assert.throws(() => assertPhaseAdvance("prepared", "installing"), /cannot advance/);
  assert.throws(() => assertPhaseAdvance("prepared", "preparing"), /cannot advance/);
  assert.equal(recoveryDirection("committing"), "rollback");
  assert.equal(recoveryDirection("committed"), "roll-forward");
});

test("rejects unknown fields at every durable journal boundary", () => {
  const cases = [
    { ...journal(), extra: true },
    { ...journal(), targets: [{ ...journal().targets[0], extra: true }] },
    {
      ...journal(),
      targets: [{
        ...journal().targets[0],
        operations: [{ ...journal().targets[0].operations[0], extra: true }],
      }],
    },
    {
      ...journal(),
      targets: [{
        ...journal().targets[0],
        operations: [{
          ...journal().targets[0].operations[0],
          previous: { ...PREVIOUS, extra: true },
        }],
      }],
    },
  ];

  for (const value of cases) {
    assert.throws(() => validatePublicationJournal(value), /unknown field/);
  }
});

test("validates bounded journal identities, targets, operations, and versions", () => {
  assert.deepEqual(validatePublicationJournal(journal()), journal());
  assert.throws(
    () => validatePublicationJournal({ ...journal(), transactionId: "../escape" }),
    /transactionId/,
  );
  assert.throws(
    () => validatePublicationJournal({
      ...journal(),
      targets: [journal().targets[0], { ...journal().targets[0], outputDir: "ASSETS/COMMITATLAS" }],
    }),
    /outputDir values must be unique/,
  );
  assert.throws(
    () => validatePublicationJournal({
      ...journal(),
      targets: [{ ...journal().targets[0], outputDir: "../outside" }],
    }),
    /unsafe outputDir/,
  );
  assert.throws(
    () => validatePublicationJournal({
      ...journal(),
      targets: [{
        ...journal().targets[0],
        operations: [{ name: "atlas.svg", action: "create", previous: PREVIOUS, next: NEXT }],
      }],
    }),
    /create operations require next bytes and no previous bytes/,
  );
});

test("classifies create, replace, and remove observations without guessing", () => {
  const create = { name: "atlas.svg", action: "create", next: NEXT };
  const replace = { name: "atlas.svg", action: "replace", previous: PREVIOUS, next: NEXT };
  const remove = { name: "atlas.svg", action: "remove", previous: PREVIOUS };

  assert.equal(classifyObservation(create, { target: 0, name: "atlas.svg", kind: "missing" }), "previous");
  assert.equal(classifyObservation(create, { target: 0, name: "atlas.svg", kind: "file", ...NEXT }), "next");
  assert.equal(classifyObservation(replace, { target: 0, name: "atlas.svg", kind: "file", ...PREVIOUS }), "previous");
  assert.equal(classifyObservation(replace, { target: 0, name: "atlas.svg", kind: "file", ...NEXT }), "next");
  assert.equal(classifyObservation(remove, { target: 0, name: "atlas.svg", kind: "file", ...PREVIOUS }), "previous");
  assert.equal(classifyObservation(remove, { target: 0, name: "atlas.svg", kind: "missing" }), "next");
  assert.equal(
    classifyObservation(replace, { target: 0, name: "atlas.svg", kind: "file", sha256: "c".repeat(64), bytes: 9 }),
    "conflict",
  );
});

test("rolls an interrupted two-theme publication back in reverse operation order", () => {
  const plan = planPublicationRecovery(journal(), "installing", nextObservations());
  assert.equal(plan.direction, "rollback");
  assert.deepEqual(plan.steps, [
    { target: 1, name: "atlas.svg", action: "remove-next" },
    { target: 0, name: "obsolete.json", action: "restore-previous" },
    { target: 0, name: "atlas.svg", action: "restore-previous" },
  ]);
});

test("rolls a committed two-theme publication forward in journal order", () => {
  const plan = planPublicationRecovery(journal(), "committed", previousObservations());
  assert.equal(plan.direction, "roll-forward");
  assert.deepEqual(plan.steps, [
    { target: 0, name: "atlas.svg", action: "install-next" },
    { target: 0, name: "obsolete.json", action: "remove-previous" },
    { target: 1, name: "atlas.svg", action: "install-next" },
  ]);
});

test("recovery planning is idempotent once the selected generation is present", () => {
  assert.deepEqual(planPublicationRecovery(journal(), "installing", previousObservations()).steps, []);
  assert.deepEqual(planPublicationRecovery(journal(), "complete", nextObservations()).steps, []);
});

test("fails closed for incomplete, duplicate, unexpected, or drifted observations", () => {
  assert.throws(
    () => planPublicationRecovery(journal(), "installing", previousObservations().slice(1)),
    /complete transaction|missing/,
  );
  assert.throws(
    () => planPublicationRecovery(journal(), "installing", [
      // Keep cardinality valid so this specifically exercises duplicate identity rejection.
      ...previousObservations().slice(0, 2),
      previousObservations()[0],
    ]),
    /repeats/,
  );
  assert.throws(
    () => planPublicationRecovery(journal(), "installing", [
      ...previousObservations().slice(0, 2),
      { target: 9, name: "atlas.svg", kind: "missing" },
    ]),
    /missing|unexpected/,
  );
  assert.throws(
    () => planPublicationRecovery(journal(), "installing", [
      { target: 0, name: "atlas.svg", kind: "file", sha256: "c".repeat(64), bytes: 11 },
      ...previousObservations().slice(1),
    ]),
    /drifted/,
  );
});
