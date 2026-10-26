/**
 * Test-only slice-3 comparison with v1. No I/O, ownership authentication or mutation authority.
 * Prior ownership versions must come from a separately validated ownership source. Matching
 * next bytes alone never supplies that claim. A future writer must revalidate every path.
 */
import {
  validatePublicationJournal, validatePublicationObservation,
  type PublicationFileVersion, type PublicationJournal, type PublicationOperation,
} from "./publication-protocol.js";
import { encodePublicationJournal } from "./publication-codec.js";

export interface ShadowArtifact extends PublicationFileVersion { readonly name: string }
export interface ShadowTarget {
  readonly outputDir: string;
  readonly previous: readonly ShadowArtifact[];
  readonly next: readonly ShadowArtifact[];
}
export interface ShadowDeclaration {
  readonly transactionId: string;
  readonly createdAt: string;
  readonly targets: readonly ShadowTarget[];
}
export interface ShadowConflict {
  readonly target: number;
  readonly name: string;
  readonly reason: "unowned-file" | "ownership-drift" | "unsafe-entry";
}
export type PublicationShadowResult =
  | { readonly kind: "planned"; readonly journal: PublicationJournal }
  | { readonly kind: "blocked"; readonly conflicts: readonly ShadowConflict[] };

/**
 * Compare declared next bytes against one complete observation snapshot. Missing retired files
 * need no removal; byte-identical selected files remain replacements in the existing vocabulary.
 * Any conflict blocks the whole publication. This never returns a partial usable journal.
 */
export function planPublicationShadow(declaration: unknown, observations: unknown): PublicationShadowResult {
  const fields = dataFields(declaration, ["transactionId", "createdAt", "targets"]);
  const targets = dataEntries(fields.targets, 1, 4, "targets").map(entry => {
    const target = dataFields(entry, ["outputDir", "previous", "next"]);
    const previous = inventory(target.previous, 0);
    const next = inventory(target.next, 1);
    if (!next.has("manifest.json")) throw new Error("publication shadow requires a next manifest.json");
    const names = [...new Set([...previous.keys(), ...next.keys()])].sort();
    const operations = names.filter(name => name !== "manifest.json").concat("manifest.json").map(name => ({
      name, action: previous.has(name) ? next.has(name) ? "replace" : "remove" : "create",
      ...(previous.has(name) ? { previous: previous.get(name) } : {}),
      ...(next.has(name) ? { next: next.get(name) } : {}),
    }));
    return { outputDir: target.outputDir, operations };
  });
  // Validate every declared version, including retired absent files, before interpreting evidence.
  const candidate = validatePublicationJournal({ version: 1, generator: "CommitAtlas",
    transactionId: fields.transactionId, createdAt: fields.createdAt, targets });
  for (const target of candidate.targets) {
    safeOutput(target.outputDir);
    // A target directory cannot also be an artifact destination of another target.
    for (const operation of target.operations) {
      const file = `${target.outputDir}/${operation.name}`.toLowerCase();
      if (candidate.targets.some(other => {
        const output = other.outputDir.toLowerCase();
        return output === file || output.startsWith(`${file}/`);
      })) throw new Error("publication shadow artifact overlaps an output directory");
    }
  }
  const count = candidate.targets.reduce((total, target) => total + target.operations.length, 0);
  const seen = new Map<string, ReturnType<typeof validatePublicationObservation>>();
  for (const entry of dataEntries(observations, count, count, "observations")) {
    const observation = validatePublicationObservation(entry);
    const key = `${observation.target}:${observation.name}`;
    if (seen.has(key)) throw new Error("publication shadow observation repeats a destination");
    seen.set(key, observation);
  }
  // Validate exact coverage across all themes before returning even a blocked result.
  for (const [target, value] of candidate.targets.entries()) for (const operation of value.operations) {
    if (!seen.has(`${target}:${operation.name}`)) throw new Error("publication shadow observations do not cover the complete transaction");
  }
  const conflicts: ShadowConflict[] = [];
  const plannedTargets = candidate.targets.map((target, index) => ({
    outputDir: target.outputDir,
    operations: target.operations.flatMap((operation): PublicationOperation[] => {
      const observation = seen.get(`${index}:${operation.name}`)!;
      const conflict = (reason: ShadowConflict["reason"]) => {
        conflicts.push({ target: index, name: operation.name, reason });
        return [];
      };
      if (observation.kind === "other") return conflict("unsafe-entry");
      if (observation.kind === "missing") {
        return operation.next ? [{ name: operation.name, action: "create", next: operation.next }] : [];
      }
      if (!operation.previous) return conflict("unowned-file");
      if (operation.previous.bytes !== observation.bytes || operation.previous.sha256 !== observation.sha256) {
        return conflict("ownership-drift");
      }
      return [operation];
    }),
  }));
  if (conflicts.length) return { kind: "blocked", conflicts };
  const journal = validatePublicationJournal({ ...candidate, targets: plannedTargets });
  // Include the actual wire limit, independently of operation/name/payload bounds.
  encodePublicationJournal(journal);
  return { kind: "planned", journal };
}

function inventory(value: unknown, minimum: number): Map<string, PublicationFileVersion> {
  const entries = new Map<string, PublicationFileVersion>();
  for (const entry of dataEntries(value, minimum, 96, "inventory")) {
    const artifact = dataFields(entry, ["name", "sha256", "bytes"]);
    if (typeof artifact.name !== "string") throw new Error("publication shadow artifact name is invalid");
    if (entries.has(artifact.name)) throw new Error("publication shadow inventory repeats an artifact");
    // The journal validator checks versions/names before any evidence is interpreted.
    entries.set(artifact.name, { sha256: artifact.sha256, bytes: artifact.bytes } as PublicationFileVersion);
  }
  return entries;
}

function dataEntries(value: unknown, minimum: number, maximum: number, label: string): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new Error(`publication shadow ${label} has an invalid entry count`);
  }
  const entries: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !("value" in descriptor)) throw new Error(`publication shadow ${label} requires dense data entries`);
    entries.push(descriptor.value);
  }
  return entries;
}

function dataFields(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("publication shadow record must be an object");
  const fields: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.includes(key)) throw new Error("publication shadow record contains an unknown field");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) throw new Error("publication shadow record requires data fields, not accessors");
    fields[key] = descriptor.value;
  }
  return fields;
}

/** Mirror the control store's platform-safe lexical admission; no filesystem identity claim. */
function safeOutput(output: string): void {
  const lower = output.toLowerCase();
  if (lower === ".commitatlas" || lower.startsWith(".commitatlas/") || ".commitatlas".startsWith(`${lower}/`)) {
    throw new Error("publication shadow output overlaps the control root");
  }
  if (output.split("/").some(segment => /[\\:<>"|?*]/.test(segment) || /[. ]$/.test(segment) ||
    Array.from(segment).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) {
    throw new Error("publication shadow output path is unsafe");
  }
}
