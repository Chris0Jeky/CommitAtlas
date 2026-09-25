import { readFileSync, statSync } from "node:fs";
import type { PulseCardData } from "@/packages/svg/src/index";
import { z } from "zod";

/**
 * Consumer for reviewed Pulseboard public-pulse capsules (`pulseboard.public-pulse/1`).
 *
 * The producer is the Pulseboard desk exporter (`observatory/public/desk-bridge.mjs`,
 * `makePublicPulse`, contract in `observatory/docs/DESK_BRIDGES.md`): a selected, expiring
 * export of externally probed project ids with per-probe states, sampled successful/total
 * checks, and fixed limitations. It intentionally carries no usage counts, session ids,
 * releases, budgets, imports, Lens findings, private tasks, tokens, or URLs, and the strict
 * schemas below reject all of those shapes outright.
 *
 * Three boundaries enforce expiry independently: {@link assertPulseCapsuleLive} (cache
 * stores), {@link PulseCapsuleCache#get} (cache reads), and {@link toPulseCardData} plus
 * `renderPulseCard` (rendering an expired capsule yields an expired panel, never probe
 * data presented as live). Demo capsules keep their synthetic marking end to end.
 *
 * Input is manual and local-only: {@link readPulseCapsuleFile} reads a file path. There
 * is deliberately no remote URL fetcher and no token parameter anywhere in this module.
 * The capsule is unsigned and operator-reviewed, never a verified availability guarantee.
 */

/** Exact capsule contract id emitted by the Pulseboard desk exporter. */
export const PULSE_CAPSULE_SCHEMA = "pulseboard.public-pulse/1" as const;

/** Mirrors the producer import bound: anything larger is rejected before parsing. */
export const PULSE_CAPSULE_MAX_BYTES = 262_144 as const;

/** The producer exports at most 16 selected projects; the consumer refuses more. */
export const PULSE_MAX_PROJECTS = 16 as const;

/** Producer project identity: lowercase alphanumerics and dashes, bounded to 64 chars. */
export const PULSE_PROJECT_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

/** Millisecond-epoch bound matching the producer timestamp guard. */
const MAX_TIMESTAMP_MS = 8_640_000_000_000_000;

/**
 * The three fixed limitation sentences the producer always exports, in order.
 * A capsule with different limitations is not a `pulseboard.public-pulse/1` capsule.
 */
export const PULSE_LIMITATIONS = [
  "Synthetic checks, not time-weighted uptime.",
  "Expiry must be enforced by a future consumer.",
  "Operator-reviewed file; not signed or published automatically.",
] as const;

export type PulseCapsuleErrorCode =
  | "malformed"
  | "oversized"
  | "invalid"
  | "future"
  | "expired"
  | "unmapped";

export class PulseCapsuleError extends Error {
  readonly code: PulseCapsuleErrorCode;

  constructor(code: PulseCapsuleErrorCode, message: string) {
    super(message);
    this.name = "PulseCapsuleError";
    this.code = code;
  }
}

const TimestampSchema = z.number().int().min(0).max(MAX_TIMESTAMP_MS).refine(
  Number.isSafeInteger,
  { message: "timestamp must be a safe integer" },
);

const SampledChecksSchema = z.object({
  good: z.number().int().min(0),
  total: z.number().int().min(0),
}).strict().superRefine((value, context) => {
  if (value.good > value.total) {
    context.addIssue({
      code: "custom",
      path: ["good"],
      message: "successful checks cannot exceed total checks",
    });
  }
});

const ProbeSchema = z.object({
  state: z.enum(["up", "down", "unknown", "stale"]),
  checked: TimestampSchema,
}).strict();

const PulseProjectSchema = z.object({
  id: z.string().regex(PULSE_PROJECT_ID_PATTERN, { message: "invalid public project identity" }),
  probe: ProbeSchema,
  sampledChecks: SampledChecksSchema,
}).strict();

const WindowSchema = z.object({
  start: TimestampSchema,
  end: TimestampSchema,
}).strict();

const LimitationsSchema = z.tuple([
  z.literal(PULSE_LIMITATIONS[0]),
  z.literal(PULSE_LIMITATIONS[1]),
  z.literal(PULSE_LIMITATIONS[2]),
]);

const PulseCapsuleSchema = z.object({
  schema: z.literal(PULSE_CAPSULE_SCHEMA),
  sourceMode: z.enum(["demo", "live"]),
  generatedAt: TimestampSchema,
  expiresAt: TimestampSchema,
  window: WindowSchema,
  projects: z.array(PulseProjectSchema).min(1).max(PULSE_MAX_PROJECTS),
  limitations: LimitationsSchema,
}).strict().superRefine((value, context) => {
  const ids = value.projects.map((project) => project.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["projects"], message: "duplicate project ids" });
  }
  if (value.window.start > value.window.end) {
    context.addIssue({ code: "custom", path: ["window"], message: "observed window starts after it ends" });
  }
  if (value.window.end > value.generatedAt) {
    context.addIssue({
      code: "custom",
      path: ["window"],
      message: "observed window ends after generation",
    });
  }
  if (value.expiresAt <= value.generatedAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "expiry must be after generation" });
  }
});

export type PulseCapsule = z.infer<typeof PulseCapsuleSchema>;

/** Operator-configured Pulseboard project id → CommitAtlas catalogue display name. */
export type PulseProjectMapping = Readonly<Record<string, string>>;

export interface ResolvedPulseProject {
  readonly id: string;
  /** Catalogue display name, or null when the id has no configured mapping. */
  readonly displayName: string | null;
  readonly mapped: boolean;
  readonly state: PulseCapsule["projects"][number]["probe"]["state"];
  readonly checked: number;
  readonly sampledGood: number;
  readonly sampledTotal: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSafeNow(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > MAX_TIMESTAMP_MS) {
    throw new PulseCapsuleError("invalid", "reference time must be a safe millisecond timestamp");
  }
}

function summarizeIssues(error: z.ZodError): string {
  const summary = error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  return summary.length > 500 ? `${summary.slice(0, 497)}…` : summary;
}

/**
 * Parse and strictly validate a capsule from a JSON string or an already-decoded value.
 * Shape violations (including any excluded field) throw `invalid`; timestamps dated after
 * `nowMs` throw `future`. Expiry is intentionally NOT checked here — it is enforced at
 * the rendering and cache boundaries, where "now" is meaningful.
 */
export function parsePulseCapsule(input: unknown, nowMs: number = Date.now()): PulseCapsule {
  assertSafeNow(nowMs);
  let candidate: unknown = input;
  if (typeof candidate === "string") {
    if (new TextEncoder().encode(candidate).length > PULSE_CAPSULE_MAX_BYTES) {
      throw new PulseCapsuleError("oversized", "capsule exceeds the 256 KiB input bound");
    }
    try {
      candidate = JSON.parse(candidate);
    } catch {
      throw new PulseCapsuleError("malformed", "capsule is not valid JSON");
    }
  }
  if (!isRecord(candidate)) {
    throw new PulseCapsuleError("malformed", "capsule must be a JSON object");
  }
  const parsed = PulseCapsuleSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PulseCapsuleError("invalid", `capsule violates ${PULSE_CAPSULE_SCHEMA}: ${summarizeIssues(parsed.error)}`);
  }
  const capsule = parsed.data;
  if (capsule.generatedAt > nowMs) {
    throw new PulseCapsuleError("future", "capsule generation time is in the future");
  }
  for (const project of capsule.projects) {
    if (project.probe.checked > nowMs) {
      throw new PulseCapsuleError("future", `probe check time for ${project.id} is in the future`);
    }
  }
  return capsule;
}

/** True while `nowMs` is strictly before the capsule expiry. */
export function isPulseCapsuleLive(capsule: PulseCapsule, nowMs: number): boolean {
  assertSafeNow(nowMs);
  return nowMs < capsule.expiresAt;
}

/** Throw `expired` unless `nowMs` is strictly before the capsule expiry. */
export function assertPulseCapsuleLive(capsule: PulseCapsule, nowMs: number): void {
  if (!isPulseCapsuleLive(capsule, nowMs)) {
    throw new PulseCapsuleError("expired", "capsule has expired; probe states are not live evidence");
  }
}

/**
 * Resolve selected project ids against the explicit operator mapping. Ids without a
 * mapping resolve with `mapped: false` and a null display name — the renderer lists them
 * as unmapped projects rather than dropping them silently.
 */
export function resolvePulseProjects(
  capsule: PulseCapsule,
  mapping: PulseProjectMapping,
): readonly ResolvedPulseProject[] {
  return capsule.projects.map((project) => {
    const displayName = mapping[project.id];
    return {
      id: project.id,
      displayName: typeof displayName === "string" && displayName.trim() ? displayName : null,
      mapped: typeof displayName === "string" && Boolean(displayName.trim()),
      state: project.probe.state,
      checked: project.probe.checked,
      sampledGood: project.sampledChecks.good,
      sampledTotal: project.sampledChecks.total,
    };
  });
}

/** Fail closed when any selected project has no configured catalogue mapping. */
export function requirePulseMapping(resolved: readonly ResolvedPulseProject[]): void {
  const unmapped = resolved.filter((project) => !project.mapped).map((project) => project.id);
  if (unmapped.length > 0) {
    throw new PulseCapsuleError("unmapped", `no catalogue mapping for ${unmapped.join(", ")}`);
  }
}

function toIsoTimestamp(valueMs: number): string {
  return new Date(valueMs).toISOString();
}

function toIsoDate(valueMs: number): string {
  return new Date(valueMs).toISOString().slice(0, 10);
}

/**
 * Adapt a parsed capsule to card data for `renderPulseCard`. Demo capsules map to the
 * shared `synthetic-demo` source so the marking is preserved; live capsules use the
 * dedicated `public-pulse` source. Expiry is enforced here: an expired capsule yields
 * `status: "expired"`, which renders as an expired panel rather than probe data.
 * CI health never enters this card, so probe samples cannot merge with CI into one score.
 */
export function toPulseCardData(
  capsule: PulseCapsule,
  mapping: PulseProjectMapping,
  nowMs: number = Date.now(),
): PulseCardData {
  assertSafeNow(nowMs);
  const live = isPulseCapsuleLive(capsule, nowMs);
  const resolved = resolvePulseProjects(capsule, mapping);
  const unmappedCount = resolved.filter((project) => !project.mapped).length;
  return {
    source: capsule.sourceMode === "demo" ? "synthetic-demo" : "public-pulse",
    status: live ? "live" : "expired",
    generatedAt: toIsoTimestamp(capsule.generatedAt),
    expiresAt: toIsoTimestamp(capsule.expiresAt),
    windowStart: toIsoDate(capsule.window.start),
    windowEnd: toIsoDate(capsule.window.end),
    projects: resolved.map((project) => ({
      id: project.id,
      displayName: project.displayName,
      state: project.state,
      checkedAt: toIsoTimestamp(project.checked),
      sampledGood: project.sampledGood,
      sampledTotal: project.sampledTotal,
    })),
    ...(unmappedCount > 0 ? { unmappedCount } : {}),
  };
}

/**
 * Minimal in-memory holder with expiry enforced on both sides: `store` refuses expired
 * capsules and `get` returns null once the held capsule expires. TTL is always the
 * remaining lifetime `expiresAt - nowMs`, never extended by reads.
 */
export class PulseCapsuleCache {
  private current: PulseCapsule | null = null;

  store(capsule: PulseCapsule, nowMs: number): void {
    assertSafeNow(nowMs);
    const owned = parsePulseCapsule(capsule, nowMs);
    assertPulseCapsuleLive(owned, nowMs);
    this.current = owned;
  }

  get(nowMs: number): PulseCapsule | null {
    assertSafeNow(nowMs);
    if (this.current === null || !isPulseCapsuleLive(this.current, nowMs)) {
      this.current = null;
      return null;
    }
    return structuredClone(this.current);
  }

  /** Remaining lifetime in milliseconds, or 0 when empty or expired. */
  ttlMs(nowMs: number): number {
    assertSafeNow(nowMs);
    if (this.current === null) return 0;
    return Math.max(0, this.current.expiresAt - nowMs);
  }

  clear(): void {
    this.current = null;
  }
}

/**
 * Manual local-file input for a capsule. Only filesystem paths are accepted: anything
 * shaped like a URL is rejected, and there is no fetcher and no token parameter —
 * retrieval stays an explicit operator step outside this module.
 */
export function readPulseCapsuleFile(filePath: string, nowMs: number = Date.now()): PulseCapsule {
  assertSafeNow(nowMs);
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new PulseCapsuleError("malformed", "capsule file path must be a non-empty string");
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(filePath)) {
    throw new PulseCapsuleError("malformed", "remote capsule URLs are not supported; provide a local file");
  }
  let size: number;
  try {
    size = statSync(filePath).size;
  } catch {
    throw new PulseCapsuleError("malformed", "capsule file cannot be read");
  }
  if (size > PULSE_CAPSULE_MAX_BYTES) {
    throw new PulseCapsuleError("oversized", "capsule file exceeds the 256 KiB input bound");
  }
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    throw new PulseCapsuleError("malformed", "capsule file cannot be read");
  }
  return parsePulseCapsule(text, nowMs);
}
