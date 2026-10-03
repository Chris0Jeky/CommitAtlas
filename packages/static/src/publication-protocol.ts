/**
 * Pure state and recovery planning for the proposed crash-recoverable publication protocol.
 *
 * This module deliberately performs no filesystem I/O. It gives the later storage adapter one
 * bounded vocabulary for durable phases, observations, and recovery steps, making failure
 * injection deterministic before the v2 writer is allowed to touch production destinations.
 */

export const PUBLICATION_PHASES = [
  "preparing",
  "prepared",
  "backed-up",
  "installing",
  "installed",
  "committing",
  "committed",
  "cleaning",
  "complete",
] as const;

export type PublicationPhase = typeof PUBLICATION_PHASES[number];
export type PublicationAction = "create" | "replace" | "remove";
export type RecoveryDirection = "rollback" | "roll-forward";
export type ObservedOperationState = "previous" | "next" | "conflict";

export interface PublicationFileVersion {
  readonly sha256: string;
  readonly bytes: number;
}

export interface PublicationOperation {
  readonly name: string;
  readonly action: PublicationAction;
  readonly previous?: PublicationFileVersion;
  readonly next?: PublicationFileVersion;
}

export interface PublicationTarget {
  readonly outputDir: string;
  readonly operations: readonly PublicationOperation[];
}

export interface PublicationJournal {
  readonly version: 1;
  readonly generator: "CommitAtlas";
  readonly transactionId: string;
  readonly createdAt: string;
  readonly targets: readonly PublicationTarget[];
}

export interface PublicationStatus {
  readonly version: 1;
  readonly generator: "CommitAtlas";
  readonly transactionId: string;
  readonly phase: PublicationPhase;
}

export interface PublicationObservation {
  readonly target: number;
  readonly name: string;
  readonly kind: "missing" | "file" | "other";
  readonly sha256?: string;
  readonly bytes?: number;
}

export type RecoveryStep =
  | { readonly target: number; readonly name: string; readonly action: "install-next" }
  | { readonly target: number; readonly name: string; readonly action: "restore-previous" }
  | { readonly target: number; readonly name: string; readonly action: "remove-next" }
  | { readonly target: number; readonly name: string; readonly action: "remove-previous" };

export interface RecoveryPlan {
  readonly transactionId: string;
  readonly phase: PublicationPhase;
  readonly direction: RecoveryDirection;
  readonly steps: readonly RecoveryStep[];
}

const PHASE_INDEX = new Map<PublicationPhase, number>(
  PUBLICATION_PHASES.map((phase, index) => [phase, index]),
);
const COMMITTED_INDEX = PHASE_INDEX.get("committed")!;
const SHA256 = /^[a-f0-9]{64}$/;
const TRANSACTION_ID = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/;
const ARTIFACT_NAME = /^[a-z0-9][a-z0-9-]*\.(?:svg|json|md)$/;

export function assertPublicationPhase(value: unknown): PublicationPhase {
  if (typeof value !== "string" || !PHASE_INDEX.has(value as PublicationPhase)) {
    throw new Error("publication status has an invalid phase");
  }
  return value as PublicationPhase;
}

/** Status writes may be retried, but may never skip or move backwards. */
export function assertPhaseAdvance(from: PublicationPhase, to: PublicationPhase): void {
  const fromIndex = PHASE_INDEX.get(assertPublicationPhase(from))!;
  const toIndex = PHASE_INDEX.get(assertPublicationPhase(to))!;
  if (toIndex === fromIndex || toIndex === fromIndex + 1) return;
  throw new Error(`publication phase cannot advance from ${from} to ${to}`);
}

export function recoveryDirection(phase: PublicationPhase): RecoveryDirection {
  return PHASE_INDEX.get(assertPublicationPhase(phase))! >= COMMITTED_INDEX ? "roll-forward" : "rollback";
}

export function validatePublicationJournal(value: unknown): PublicationJournal {
  if (!isRecord(value)) throw new Error("publication journal must be an object");
  assertKnownKeys(value, ["version", "generator", "transactionId", "createdAt", "targets"], "publication journal");
  if (value.version !== 1 || value.generator !== "CommitAtlas") {
    throw new Error("publication journal identity is invalid");
  }
  if (typeof value.transactionId !== "string" || !TRANSACTION_ID.test(value.transactionId)) {
    throw new Error("publication journal transactionId is invalid");
  }
  if (typeof value.createdAt !== "string" || !isIsoTimestamp(value.createdAt)) {
    throw new Error("publication journal createdAt is invalid");
  }
  if (!Array.isArray(value.targets) || value.targets.length < 1 || value.targets.length > 4) {
    throw new Error("publication journal must contain between one and four targets");
  }

  const outputDirs = new Set<string>();
  const targets = value.targets.map((target, targetIndex) => {
    if (!isRecord(target)) throw new Error(`publication target ${targetIndex} must be an object`);
    assertKnownKeys(target, ["outputDir", "operations"], `publication target ${targetIndex}`);
    if (typeof target.outputDir !== "string" || !isSafeRelativePath(target.outputDir)) {
      throw new Error(`publication target ${targetIndex} has an unsafe outputDir`);
    }
    const outputKey = target.outputDir.toLowerCase();
    if (outputDirs.has(outputKey)) throw new Error("publication target outputDir values must be unique");
    outputDirs.add(outputKey);
    if (!Array.isArray(target.operations) || target.operations.length < 1 || target.operations.length > 32) {
      throw new Error(`publication target ${targetIndex} has an invalid operation count`);
    }
    const names = new Set<string>();
    const operations = target.operations.map((operation, operationIndex) => {
      const parsed = validateOperation(operation, targetIndex, operationIndex);
      if (names.has(parsed.name)) throw new Error(`publication target ${targetIndex} repeats ${parsed.name}`);
      names.add(parsed.name);
      return parsed;
    });
    return { outputDir: target.outputDir, operations } satisfies PublicationTarget;
  });

  return {
    version: 1,
    generator: "CommitAtlas",
    transactionId: value.transactionId,
    createdAt: value.createdAt,
    targets,
  };
}

/** Parse the bounded durable phase record without retaining caller-owned objects. */
export function validatePublicationStatus(value: unknown): PublicationStatus {
  if (!isRecord(value)) throw new Error("publication status must be an object");
  assertKnownKeys(value, ["version", "generator", "transactionId", "phase"], "publication status");
  if (value.version !== 1 || value.generator !== "CommitAtlas") {
    throw new Error("publication status identity is invalid");
  }
  if (typeof value.transactionId !== "string" || !TRANSACTION_ID.test(value.transactionId)) {
    throw new Error("publication status transactionId is invalid");
  }
  return {
    version: 1,
    generator: "CommitAtlas",
    transactionId: value.transactionId,
    phase: assertPublicationPhase(value.phase),
  };
}

/** Durable recovery must bind its phase to the same transaction before inspecting destinations. */
export function planPublicationRecoveryFromStatus(
  journalValue: unknown,
  statusValue: unknown,
  observations: readonly PublicationObservation[],
): RecoveryPlan {
  const journal = validatePublicationJournal(journalValue);
  const status = validatePublicationStatus(statusValue);
  if (status.transactionId !== journal.transactionId) {
    throw new Error("publication status transactionId does not match the publication journal");
  }
  return planPublicationRecovery(journal, status.phase, observations);
}

export function classifyObservation(
  operation: PublicationOperation,
  observation: PublicationObservation,
): ObservedOperationState {
  if (observation.name !== operation.name || observation.kind === "other") return "conflict";
  if (observation.kind === "file" && !observedVersionIsValid(observation)) return "conflict";

  if (operation.action === "create") {
    if (observation.kind === "missing") return "previous";
    return sameVersion(observation, operation.next) ? "next" : "conflict";
  }
  if (operation.action === "replace") {
    if (observation.kind === "missing") return "conflict";
    if (sameVersion(observation, operation.previous)) return "previous";
    return sameVersion(observation, operation.next) ? "next" : "conflict";
  }

  if (observation.kind === "missing") return "next";
  return sameVersion(observation, operation.previous) ? "previous" : "conflict";
}

/**
 * Plans one whole-transaction recovery direction. Any missing, duplicate, unexpected, or drifted
 * observation aborts planning before a recovery step can be returned.
 * Durable-storage callers must use planPublicationRecoveryFromStatus to verify phase provenance.
 */
export function planPublicationRecovery(
  journalValue: unknown,
  phaseValue: unknown,
  observations: readonly PublicationObservation[],
): RecoveryPlan {
  const journal = validatePublicationJournal(journalValue);
  const phase = assertPublicationPhase(phaseValue);
  const direction = recoveryDirection(phase);
  const expected = flattenOperations(journal);
  const observed = new Map<string, PublicationObservation>();

  for (const observation of observations) {
    const key = operationKey(observation.target, observation.name);
    if (observed.has(key)) throw new Error(`publication observation repeats ${key}`);
    observed.set(key, observation);
  }
  if (observed.size !== expected.length) {
    throw new Error("publication observations do not cover the complete transaction");
  }

  const classified = expected.map(({ target, operation }) => {
    const key = operationKey(target, operation.name);
    const observation = observed.get(key);
    if (!observation) throw new Error(`publication observation is missing ${key}`);
    const state = classifyObservation(operation, observation);
    if (state === "conflict") throw new Error(`publication destination drifted at ${key}`);
    observed.delete(key);
    return { target, operation, state };
  });
  if (observed.size > 0) throw new Error("publication observations contain an unexpected destination");

  const payloads = classified.filter(({ operation }) => operation.name !== "manifest.json");
  const manifests = classified.filter(({ operation }) => operation.name === "manifest.json");
  const ordered = direction === "rollback"
    ? [...payloads].reverse().concat([...manifests].reverse())
    : payloads.concat(manifests);
  const steps = ordered.flatMap(({ target, operation, state }): RecoveryStep[] => {
    // The validated observation matches both generations when a replacement is byte-identical.
    // Classifying it as previous alone must not schedule an endless roll-forward rewrite.
    if (operation.action === "replace" && operation.previous!.sha256 === operation.next!.sha256 &&
      operation.previous!.bytes === operation.next!.bytes) return [];
    if (direction === "rollback") {
      if (state === "previous") return [];
      if (operation.action === "create") return [{ target, name: operation.name, action: "remove-next" }];
      return [{ target, name: operation.name, action: "restore-previous" }];
    }
    if (state === "next") return [];
    if (operation.action === "remove") return [{ target, name: operation.name, action: "remove-previous" }];
    return [{ target, name: operation.name, action: "install-next" }];
  });

  return { transactionId: journal.transactionId, phase, direction, steps };
}

function validateOperation(value: unknown, target: number, index: number): PublicationOperation {
  if (!isRecord(value)) throw new Error(`publication operation ${target}:${index} must be an object`);
  assertKnownKeys(value, ["name", "action", "previous", "next"], `publication operation ${target}:${index}`);
  if (typeof value.name !== "string" || !ARTIFACT_NAME.test(value.name)) {
    throw new Error(`publication operation ${target}:${index} has an unsafe artifact name`);
  }
  if (value.action !== "create" && value.action !== "replace" && value.action !== "remove") {
    throw new Error(`publication operation ${target}:${index} has an invalid action`);
  }
  const previous = value.previous === undefined ? undefined : validateVersion(value.previous, "previous");
  const next = value.next === undefined ? undefined : validateVersion(value.next, "next");
  if (value.action === "create" && (previous !== undefined || next === undefined)) {
    throw new Error("create operations require next bytes and no previous bytes");
  }
  if (value.action === "replace" && (previous === undefined || next === undefined)) {
    throw new Error("replace operations require previous and next bytes");
  }
  if (value.action === "remove" && (previous === undefined || next !== undefined)) {
    throw new Error("remove operations require previous bytes and no next bytes");
  }
  return {
    name: value.name,
    action: value.action,
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  };
}

function validateVersion(value: unknown, label: string): PublicationFileVersion {
  if (!isRecord(value)) throw new Error(`publication ${label} version must be an object`);
  assertKnownKeys(value, ["sha256", "bytes"], `publication ${label} version`);
  if (typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) {
    throw new Error(`publication ${label} digest is invalid`);
  }
  if (!Number.isSafeInteger(value.bytes) || (value.bytes as number) < 0 || (value.bytes as number) > 96 * 1024) {
    throw new Error(`publication ${label} byte length is invalid`);
  }
  return { sha256: value.sha256, bytes: value.bytes as number };
}

function flattenOperations(journal: PublicationJournal): { target: number; operation: PublicationOperation }[] {
  return journal.targets.flatMap((target, targetIndex) =>
    target.operations.map((operation) => ({ target: targetIndex, operation })),
  );
}

function operationKey(target: number, name: string): string {
  if (!Number.isSafeInteger(target) || target < 0) throw new Error("publication observation target is invalid");
  return `${target}:${name}`;
}

function observedVersionIsValid(observation: PublicationObservation): boolean {
  return typeof observation.sha256 === "string" && SHA256.test(observation.sha256) &&
    Number.isSafeInteger(observation.bytes) && (observation.bytes as number) >= 0;
}

function sameVersion(
  observation: PublicationObservation,
  expected: PublicationFileVersion | undefined,
): boolean {
  return expected !== undefined && observation.kind === "file" &&
    observation.sha256 === expected.sha256 && observation.bytes === expected.bytes;
}

function assertKnownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const known = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) throw new Error(`${label} contains unknown field ${key}`);
  }
}

function isSafeRelativePath(value: string): boolean {
  if (value.length < 1 || value.length > 240 || value.includes("\\") || value.includes(":")) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".." &&
    !segment.includes("\0"));
}

function isIsoTimestamp(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
