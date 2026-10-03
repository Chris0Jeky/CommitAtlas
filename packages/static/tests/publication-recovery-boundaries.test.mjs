import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLICATION_PHASES,
  assertPhaseAdvance,
  planPublicationRecoveryFromStatus,
  recoveryDirection,
} from "../dist/publication-protocol.js";

const PREVIOUS = Object.freeze({ sha256: "a".repeat(64), bytes: 11 });
const NEXT = Object.freeze({ sha256: "b".repeat(64), bytes: 13 });
function journal() {
  return {
    version: 1, generator: "CommitAtlas", transactionId: "tx-interruptions",
    createdAt: "2026-10-03T00:00:00.000Z",
    targets: ["assets/commitatlas", "assets/commitatlas/light"].map(outputDir => ({
      outputDir,
      operations: [
        { name: "new.svg", action: "create", next: NEXT },
        { name: "atlas.svg", action: "replace", previous: PREVIOUS, next: NEXT },
        { name: "unchanged.svg", action: "replace", previous: PREVIOUS, next: PREVIOUS },
        { name: "obsolete.json", action: "remove", previous: PREVIOUS },
        { name: "manifest.json", action: "replace", previous: PREVIOUS, next: NEXT },
      ],
    })),
  };
}
const operations = journal().targets.flatMap((target, index) =>
  target.operations.map(operation => ({ target: index, operation })));
function observation(target, operation, version) {
  return version
    ? { target, name: operation.name, kind: "file", ...version }
    : { target, name: operation.name, kind: "missing" };
}
function generation(next) {
  return operations.map(({ target, operation }) => observation(target, operation, next ? operation.next : operation.previous));
}
function status(phase) {
  return { version: 1, generator: "CommitAtlas", transactionId: "tx-interruptions", phase };
}
function plan(phase, observations) {
  return planPublicationRecoveryFromStatus(journal(), status(phase), observations);
}
function apply(observations, steps) {
  const result = observations.map(entry => ({ ...entry }));
  for (const step of steps) {
    const index = operations.findIndex(entry => entry.target === step.target && entry.operation.name === step.name);
    assert.ok(index >= 0, "recovery cannot target an unjournaled destination");
    const { target, operation } = operations[index];
    if (step.action === "install-next") result[index] = observation(target, operation, operation.next);
    else if (step.action === "restore-previous") result[index] = observation(target, operation, operation.previous);
    else if (step.action === "remove-next" || step.action === "remove-previous") result[index] = observation(target, operation);
    else assert.fail(`unexpected recovery action ${step.action}`);
  }
  return result;
}
function assertManifestLast(steps) {
  let sawManifest = false;
  for (const step of steps) {
    if (step.name === "manifest.json") sawManifest = true;
    else assert.equal(sawManifest, false, "payload must not follow any manifest");
  }
}

test("phase helpers reject invalid runtime values instead of inventing rollback or accepting a retry", () => {
  for (const invalid of [undefined, null, true, 0, {}, [], "", "unknown", "COMMITTED", "committed\n"]) {
    assert.throws(() => recoveryDirection(invalid), /invalid phase/);
    assert.throws(() => assertPhaseAdvance(invalid, invalid), /invalid phase/);
    assert.throws(() => assertPhaseAdvance(invalid, "prepared"), /invalid phase/);
    assert.throws(() => assertPhaseAdvance("prepared", invalid), /invalid phase/);
  }
  for (const [fromIndex, from] of PUBLICATION_PHASES.entries()) {
    assert.equal(recoveryDirection(from), fromIndex < 6 ? "rollback" : "roll-forward");
    for (const [toIndex, to] of PUBLICATION_PHASES.entries()) {
      if (toIndex === fromIndex || toIndex === fromIndex + 1) assert.doesNotThrow(() => assertPhaseAdvance(from, to));
      else assert.throws(() => assertPhaseAdvance(from, to), /cannot advance/);
    }
  }
});

test("identical previous and next bytes are already complete in both recovery directions", () => {
  for (const [index, phase] of PUBLICATION_PHASES.entries()) {
    const observations = generation(index >= 6);
    assert.deepEqual(plan(phase, observations).steps, [], phase);
  }
  const drifted = generation(true);
  drifted[2] = { ...drifted[2], sha256: "c".repeat(64) };
  assert.throws(() => plan("committed", drifted), /drifted/, "identical journal versions are not permission to ignore destination drift");
  drifted[2] = { target: 0, name: "unchanged.svg", kind: "missing" };
  assert.throws(() => plan("committed", drifted), /drifted/);
});

test("every mixed two-theme state converges after interruption at each recovery step", () => {
  // Eight changing destinations plus two byte-identical replacements.
  // Each bit independently selects the previous or next state of a changing destination.
  let startingStates = 0, interruptionPoints = 0;
  for (const [phaseIndex, phase] of PUBLICATION_PHASES.entries()) {
    const expected = generation(phaseIndex >= 6);
    for (let mask = 0; mask < 256; mask++) {
      let bit = 0;
      const mixed = operations.map(({ target, operation }) => {
        const next = operation.name === "unchanged.svg" ? false : Boolean(mask & (1 << bit++));
        return observation(target, operation, next ? operation.next : operation.previous);
      });
      const initial = plan(phase, mixed);
      assertManifestLast(initial.steps);
      for (let stop = 0; stop <= initial.steps.length; stop++) {
        const interrupted = apply(mixed, initial.steps.slice(0, stop));
        const resumed = plan(phase, interrupted);
        assertManifestLast(resumed.steps);
        const recovered = apply(interrupted, resumed.steps);
        assert.deepEqual(recovered, expected, `${phase} mask=${mask} stop=${stop}`);
        assert.deepEqual(plan(phase, recovered).steps, [], "recovery must terminate without another write");
        interruptionPoints++;
      }
      startingStates++;
    }
  }
  assert.equal(startingStates, 2304);
  assert.equal(interruptionPoints, 11520);
});

test("drift in any destination blocks the complete recovery plan in every phase", () => {
  for (const phase of PUBLICATION_PHASES) {
    for (let index = 0; index < operations.length; index++) {
      const observations = generation(false);
      observations[index] = { target: observations[index].target, name: observations[index].name, kind: "file", sha256: "c".repeat(64), bytes: 11 };
      assert.throws(() => plan(phase, observations), /drifted/);
    }
  }
});
