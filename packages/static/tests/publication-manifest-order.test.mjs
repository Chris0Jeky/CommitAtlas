import assert from "node:assert/strict";
import test from "node:test";
import { planPublicationRecovery } from "../dist/publication-protocol.js";

const PREVIOUS = Object.freeze({ sha256: "a".repeat(64), bytes: 11 });
const NEXT = Object.freeze({ sha256: "b".repeat(64), bytes: 13 });

function journal() {
  return {
    version: 1,
    generator: "CommitAtlas",
    transactionId: "tx-manifest-order",
    createdAt: "2026-10-01T00:00:00.000Z",
    targets: [
      {
        outputDir: "assets/commitatlas",
        operations: [
          { name: "atlas.svg", action: "replace", previous: PREVIOUS, next: NEXT },
          { name: "manifest.json", action: "replace", previous: PREVIOUS, next: NEXT },
        ],
      },
      {
        outputDir: "assets/commitatlas/light",
        operations: [
          { name: "atlas.svg", action: "replace", previous: PREVIOUS, next: NEXT },
          { name: "manifest.json", action: "replace", previous: PREVIOUS, next: NEXT },
        ],
      },
    ],
  };
}

function observations(version) {
  return journal().targets.flatMap((target, targetIndex) =>
    target.operations.map((operation) => ({
      target: targetIndex,
      name: operation.name,
      kind: "file",
      ...version,
    })),
  );
}

test("rollback restores every payload before restoring any manifest", () => {
  const plan = planPublicationRecovery(journal(), "committing", observations(NEXT));
  assert.equal(plan.direction, "rollback");
  assert.deepEqual(plan.steps, [
    { target: 1, name: "atlas.svg", action: "restore-previous" },
    { target: 0, name: "atlas.svg", action: "restore-previous" },
    { target: 1, name: "manifest.json", action: "restore-previous" },
    { target: 0, name: "manifest.json", action: "restore-previous" },
  ]);
});

test("roll-forward installs every payload before publishing any manifest", () => {
  const plan = planPublicationRecovery(journal(), "committed", observations(PREVIOUS));
  assert.equal(plan.direction, "roll-forward");
  assert.deepEqual(plan.steps, [
    { target: 0, name: "atlas.svg", action: "install-next" },
    { target: 1, name: "atlas.svg", action: "install-next" },
    { target: 0, name: "manifest.json", action: "install-next" },
    { target: 1, name: "manifest.json", action: "install-next" },
  ]);
});
