import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { renderPulseCard } from "@/packages/svg/src/index";
import {
  assertPulseCapsuleLive,
  isPulseCapsuleLive,
  PULSE_CAPSULE_MAX_BYTES,
  PULSE_CAPSULE_SCHEMA,
  PULSE_LIMITATIONS,
  PulseCapsuleCache,
  PulseCapsuleError,
  parsePulseCapsule,
  readPulseCapsuleFile,
  requirePulseMapping,
  resolvePulseProjects,
  toPulseCardData,
  type PulseCapsule,
  type PulseCapsuleErrorCode,
} from "./pulse-capsule";

const T0 = Date.parse("2026-09-10T12:00:00.000Z");
const MINUTE = 60_000;
const mapping = { "atlas-web": "Atlas Web", "atlas-api": "Atlas API" };

function throwsPulseError(fn: () => unknown, code: PulseCapsuleErrorCode): void {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof PulseCapsuleError, `expected PulseCapsuleError, got ${String(error)}`);
    assert.equal(error.code, code);
    return;
  }
  assert.fail(`expected PulseCapsuleError with code ${code}`);
}

function capsuleJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
      {
        id: "atlas-api",
        probe: { state: "stale", checked: T0 - 29 * MINUTE },
        sampledChecks: { good: 3, total: 5 },
      },
    ],
    limitations: [...PULSE_LIMITATIONS],
    ...overrides,
  };
}

function liveCapsule(nowMs: number = T0 + MINUTE): PulseCapsule {
  return parsePulseCapsule(JSON.stringify(capsuleJson()), nowMs);
}

test("accepts a valid live capsule with the full allowlisted shape", () => {
  const capsule = liveCapsule();
  assert.equal(capsule.schema, PULSE_CAPSULE_SCHEMA);
  assert.equal(capsule.sourceMode, "live");
  assert.equal(capsule.projects.length, 2);
  assert.equal(capsule.projects[0]?.sampledChecks.good, 11);
  assert.equal(capsule.projects[0]?.sampledChecks.total, 12);
  assert.deepEqual(capsule.limitations, [...PULSE_LIMITATIONS]);
  assert.ok(isPulseCapsuleLive(capsule, T0 + MINUTE));
});

test("accepts parsed objects as well as JSON text", () => {
  const capsule = parsePulseCapsule(capsuleJson(), T0 + MINUTE);
  assert.equal(capsule.projects[1]?.probe.state, "stale");
});

test("rejects malformed capsules", () => {
  assert.throws(() => parsePulseCapsule("{oops", T0), /not valid JSON/);
  assert.throws(() => parsePulseCapsule("[1,2]", T0), /must be a JSON object/);
  assert.throws(() => parsePulseCapsule(null, T0), /must be a JSON object/);
  assert.throws(() => parsePulseCapsule(42, T0), /must be a JSON object/);
  assert.throws(() => parsePulseCapsule(capsuleJson({ schema: "pulseboard.other/9" }), T0), /invalid/i);
  assert.throws(() => parsePulseCapsule(capsuleJson({ sourceMode: "synthetic" }), T0), /invalid/i);
  throwsPulseError(() => parsePulseCapsule(capsuleJson({ projects: [] }), T0), "invalid");
  assert.throws(() => parsePulseCapsule(capsuleJson({
    projects: [{ id: "ok-id", probe: { state: "healthy", checked: T0 }, sampledChecks: { good: 1, total: 2 } }],
  }), T0), /invalid/i);
});

test("rejects oversized capsules before parsing", () => {
  const padding = "x".repeat(PULSE_CAPSULE_MAX_BYTES);
  assert.throws(
    () => parsePulseCapsule(JSON.stringify(capsuleJson({ padding })), T0),
    /exceeds the 256 KiB/,
  );
});

test("rejects duplicate project ids", () => {
  const projects = capsuleJson().projects as Record<string, unknown>[];
  assert.throws(
    () => parsePulseCapsule(capsuleJson({ projects: [projects[0], projects[0]] }), T0),
    /duplicate project ids/,
  );
});

test("rejects incoherent bounds: window order, window after generation, expiry order", () => {
  assert.throws(
    () => parsePulseCapsule(capsuleJson({ window: { start: T0, end: T0 - MINUTE } }), T0),
    /starts after it ends/,
  );
  assert.throws(
    () => parsePulseCapsule(capsuleJson({ window: { start: T0 - MINUTE, end: T0 + MINUTE } }), T0),
    /ends after generation/,
  );
  assert.throws(
    () => parsePulseCapsule(capsuleJson({ expiresAt: T0 }), T0),
    /expiry must be after generation/,
  );
});

test("rejects sampled fractions that exceed their denominator", () => {
  const bad = capsuleJson();
  (bad.projects as Record<string, unknown>[])[0] = {
    id: "atlas-web",
    probe: { state: "up", checked: T0 - MINUTE },
    sampledChecks: { good: 13, total: 12 },
  };
  assert.throws(() => parsePulseCapsule(bad, T0), /cannot exceed total checks/);
});

test("rejects future-dated capsules and probe checks", () => {
  assert.throws(
    () => parsePulseCapsule(capsuleJson({ generatedAt: T0 + 2 * MINUTE }), T0 + MINUTE),
    /in the future/,
  );
  const bad = capsuleJson();
  (bad.projects as Record<string, unknown>[])[0] = {
    id: "atlas-web",
    probe: { state: "up", checked: T0 + 5 * MINUTE },
    sampledChecks: { good: 1, total: 2 },
  };
  assert.throws(() => parsePulseCapsule(bad, T0 + MINUTE), /check time.*in the future/);
});

test("rejects altered or reordered limitations", () => {
  assert.throws(
    () => parsePulseCapsule(capsuleJson({ limitations: ["other", "words", "here"] }), T0),
    /invalid/i,
  );
  assert.throws(
    () => parsePulseCapsule(capsuleJson({ limitations: [...PULSE_LIMITATIONS].reverse() }), T0),
    /invalid/i,
  );
});

test("excluded fields never survive: strict parse plus metadata inspection", () => {
  const hostile = {
    ...capsuleJson(),
    usageCounts: { pageViews: 10 },
    sessions: ["abc"],
    releases: [{ tag: "v9" }],
    budgets: { tokens: 5 },
    lensFindings: [{ id: "x" }],
    privateTasks: ["secret"],
    token: "tok-123",
    homepageUrl: "https://example.invalid",
    projects: [{
      ...(capsuleJson().projects as Record<string, unknown>[])[0],
      url: "https://example.invalid/repo",
      release: "v9",
    }],
  };
  throwsPulseError(() => parsePulseCapsule(hostile, T0 + MINUTE), "invalid");

  const capsule = liveCapsule();
  assert.deepEqual(Object.keys(capsule).sort(), [
    "expiresAt", "generatedAt", "limitations", "projects", "schema", "sourceMode", "window",
  ]);
  assert.deepEqual(Object.keys(capsule.projects[0] ?? {}).sort(), ["id", "probe", "sampledChecks"]);
  const serialized = JSON.stringify(capsule);
  assert.doesNotMatch(serialized, /usage|sessions|releases|budgets|lens|findings|tasks|token|https?:/i);

  const cardData = toPulseCardData(capsule, mapping, T0 + MINUTE);
  assert.doesNotMatch(JSON.stringify(cardData), /usage|sessions|releases|budgets|lens|findings|tasks|token|https?:/i);
});

test("unmapped ids resolve distinctly and fail closed on demand", () => {
  const capsule = parsePulseCapsule(capsuleJson({
    projects: [
      {
        id: "atlas-web",
        probe: { state: "up", checked: T0 - MINUTE },
        sampledChecks: { good: 2, total: 2 },
      },
      {
        id: "ghost-desk",
        probe: { state: "unknown", checked: T0 - MINUTE },
        sampledChecks: { good: 0, total: 0 },
      },
    ],
  }), T0 + MINUTE);
  const resolved = resolvePulseProjects(capsule, mapping);
  assert.equal(resolved[0]?.mapped, true);
  assert.equal(resolved[0]?.displayName, "Atlas Web");
  assert.equal(resolved[1]?.mapped, false);
  assert.equal(resolved[1]?.displayName, null);
  assert.throws(() => requirePulseMapping(resolved), /no catalogue mapping for ghost-desk/);
  assert.doesNotThrow(() => requirePulseMapping([resolved[0]!]));

  const card = renderPulseCard(toPulseCardData(capsule, mapping, T0 + MINUTE));
  assert.match(card, /Unmapped project/);
  assert.match(card, /ghost-desk/);
  assert.match(card, /1 UNMAPPED/);
  assert.match(card, /0\/0 sampled/);
  assert.match(card, /no samples observed/);
});

test("expiry is enforced at cache and render boundaries", () => {
  const capsule = liveCapsule();
  const cache = new PulseCapsuleCache();
  cache.store(capsule, T0 + MINUTE);
  assert.equal(cache.get(T0 + MINUTE), capsule);
  assert.equal(cache.ttlMs(T0 + MINUTE), capsule.expiresAt - (T0 + MINUTE));
  assert.equal(cache.get(capsule.expiresAt), null);
  assert.equal(cache.ttlMs(capsule.expiresAt), 0);
  assert.equal(cache.get(capsule.expiresAt + 1), null);
  assert.throws(() => cache.store(capsule, capsule.expiresAt), /expired/);
  assert.throws(() => assertPulseCapsuleLive(capsule, capsule.expiresAt), /expired/);

  const expiredCard = renderPulseCard(toPulseCardData(capsule, mapping, capsule.expiresAt));
  assert.match(expiredCard, /Pulse capsule expired/);
  assert.match(expiredCard, /not live evidence/);
  assert.doesNotMatch(expiredCard, /11\/12 sampled/);
});

test("live card shows denominators, never uptime language or CI states", () => {
  const card = renderPulseCard(toPulseCardData(liveCapsule(), mapping, T0 + MINUTE));
  assert.match(card, /role="img"/);
  assert.match(card, /<title>Public pulse<\/title>/);
  assert.match(card, /11\/12 sampled/);
  assert.match(card, /3\/5 sampled/);
  assert.match(card, /Stale/);
  assert.match(card, /SAMPLED CHECKS ARE NOT UPTIME/);
  assert.match(card, /CI SHOWN SEPARATELY/);
  assert.doesNotMatch(card, /passing|failing|pending/i);
  assert.doesNotMatch(card, /uptime (is|of|=|guarantee)/i);
  assert.doesNotMatch(card, /100%/);
  assert.doesNotMatch(card, /<a[\s>]/);
});

test("demo capsules preserve synthetic markings end to end", () => {
  const capsule = parsePulseCapsule(capsuleJson({ sourceMode: "demo" }), T0 + MINUTE);
  const card = renderPulseCard(toPulseCardData(capsule, mapping, T0 + MINUTE));
  assert.match(card, /SYNTHETIC DEMO/);
  assert.match(card, /<title>Synthetic demo: Public pulse<\/title>/);
  assert.match(card, /Synthetic demonstration data/);
});

test("expired demo capsules stay expired and stay marked", () => {
  const capsule = liveCapsule();
  const demo = { ...capsule, sourceMode: "demo" as const };
  const card = renderPulseCard(toPulseCardData(demo, mapping, capsule.expiresAt + 1));
  assert.match(card, /Pulse capsule expired/);
  assert.match(card, /SYNTHETIC DEMO/);
});

test("mapping display names are XML-escaped and motion stays frozen-safe", () => {
  const injection = `A&B <img src=x onerror="alert(1)">`;
  const capsule = parsePulseCapsule(capsuleJson({
    projects: [{
      id: "atlas-web",
      probe: { state: "down", checked: T0 - MINUTE },
      sampledChecks: { good: 0, total: 4 },
    }],
  }), T0 + MINUTE);
  const data = toPulseCardData(capsule, { "atlas-web": injection }, T0 + MINUTE);
  const card = renderPulseCard(data);
  assert.doesNotMatch(card, /<img src=x/);
  assert.match(card, /&lt;img src=x/);
  assert.match(card, /&amp;/);
  for (const character of card) {
    const codePoint = character.codePointAt(0) ?? 0;
    assert.ok(
      codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff),
      `forbidden XML 1.0 character U+${codePoint.toString(16).toUpperCase()}`,
    );
  }
  const animated = renderPulseCard(data, { motion: "subtle" });
  assert.match(animated, /@keyframes card-enter/);
  assert.match(animated, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(animated, /\bboth\b|backwards|from\{[^}]*opacity|from\{[^}]*scale/);
  const still = renderPulseCard(data);
  assert.doesNotMatch(still, /<style>|@keyframes|animation:/);
});

test("accessible description names every selected project with its fraction", () => {
  const card = renderPulseCard(toPulseCardData(liveCapsule(), mapping, T0 + MINUTE));
  assert.match(card, /<desc>[\s\S]*?Atlas Web[\s\S]*?11\/12 sampled checks[\s\S]*?Atlas API[\s\S]*?3\/5 sampled checks[\s\S]*?<\/desc>/);
});

test("manual file input reads local capsules and refuses remote or oversized files", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "pulse-capsule-"));
  try {
    const file = path.join(directory, "pulse.json");
    writeFileSync(file, JSON.stringify(capsuleJson()));
    const capsule = readPulseCapsuleFile(file, T0 + MINUTE);
    assert.equal(capsule.schema, PULSE_CAPSULE_SCHEMA);

    const missing = path.join(directory, "missing.json");
    assert.throws(() => readPulseCapsuleFile(missing, T0), /cannot be read/);
    const broken = path.join(directory, "broken.json");
    writeFileSync(broken, "{oops");
    assert.throws(() => readPulseCapsuleFile(broken, T0), /not valid JSON/);
    const big = path.join(directory, "big.json");
    writeFileSync(big, JSON.stringify(capsuleJson({ padding: "x".repeat(PULSE_CAPSULE_MAX_BYTES) })));
    assert.throws(() => readPulseCapsuleFile(big, T0), /exceeds the 256 KiB/);
    assert.throws(
      () => readPulseCapsuleFile("https://example.invalid/pulse.json", T0),
      /remote capsule URLs are not supported/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
