import assert from "node:assert/strict";
import test from "node:test";
import {
  PULSE_CAPSULE_MAX_BYTES,
  PULSE_CAPSULE_SCHEMA,
  PULSE_LIMITATIONS,
  PulseCapsuleError,
  parsePulseCapsule,
} from "./pulse-capsule";

const T0 = Date.parse("2026-09-10T12:00:00.000Z");
const MINUTE = 60_000;

function capsuleObject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: PULSE_CAPSULE_SCHEMA,
    sourceMode: "live",
    generatedAt: T0,
    expiresAt: T0 + 30 * MINUTE,
    window: { start: T0 - 7 * 86_400_000, end: T0 },
    projects: [
      {
        id: "atlas-web",
        probe: { state: "up", checked: T0 - MINUTE },
        sampledChecks: { good: 11, total: 12 },
      },
    ],
    limitations: [...PULSE_LIMITATIONS],
    ...overrides,
  };
}

test("already-decoded objects over the byte bound throw oversized before parsing", () => {
  const hugeObject = capsuleObject({ padding: "x".repeat(PULSE_CAPSULE_MAX_BYTES) });
  assert.ok(
    new TextEncoder().encode(JSON.stringify(hugeObject)).length > PULSE_CAPSULE_MAX_BYTES,
  );
  try {
    parsePulseCapsule(hugeObject, T0 + MINUTE);
  } catch (error) {
    assert.ok(error instanceof PulseCapsuleError, `expected PulseCapsuleError, got ${String(error)}`);
    assert.equal(error.code, "oversized");
    assert.match(error.message, /exceeds the 256 KiB input bound/);
    return;
  }
  assert.fail("expected PulseCapsuleError with code oversized");
});

test("small already-decoded objects still parse", () => {
  const capsule = parsePulseCapsule(capsuleObject(), T0 + MINUTE);
  assert.equal(capsule.schema, PULSE_CAPSULE_SCHEMA);
  assert.equal(capsule.projects.length, 1);
});
