import assert from "node:assert/strict";
import test from "node:test";
import { renderPulseCard, type PulseRenderOptions } from "@/packages/svg/src/index";
import { parsePulseCapsule, PULSE_LIMITATIONS, PulseCapsuleCache, toPulseCardData } from "./pulse-capsule";

const NOW = Date.parse("2026-09-10T12:00:00.000Z");
const EXPIRES = NOW + 60_000;
function capsule() {
  return parsePulseCapsule({
    schema: "pulseboard.public-pulse/1", sourceMode: "live",
    generatedAt: NOW, expiresAt: EXPIRES, window: { start: NOW - 86_400_000, end: NOW },
    projects: [{ id: "atlas", probe: { state: "up", checked: NOW }, sampledChecks: { good: 7, total: 9 } }],
    limitations: [...PULSE_LIMITATIONS],
  }, NOW);
}
function data() { return toPulseCardData(capsule(), { atlas: "Atlas" }, NOW); }

function assertNoLiveRows(svg: string): void {
  assert.doesNotMatch(svg, /7\/9 sampled|Atlas \(atlas\): Up/);
}

test("a previously adapted live card expires at the render boundary, including equality", () => {
  const live = data();
  assert.match(renderPulseCard(live, { nowMs: EXPIRES - 1 }), /7\/9 sampled/);
  for (const nowMs of [EXPIRES, EXPIRES + 1]) {
    const svg = renderPulseCard(live, { nowMs });
    assert.match(svg, /Pulse capsule expired/);
    assertNoLiveRows(svg);
  }
});

test("missing or invalid rendering clocks fail closed without using wall-clock time", () => {
  const options = [undefined, {}, ...[NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER].map(nowMs => ({ nowMs }))];
  for (const option of options) {
    const svg = renderPulseCard(data(), option as PulseRenderOptions);
    assert.match(svg, /Pulse capsule unavailable/);
    assertNoLiveRows(svg);
  }
});

test("invalid or future capsule time bounds cannot render live probe observations", () => {
  const live = data();
  for (const expiresAt of ["", "nonsense", "2026-02-30T12:00:00.000Z", live.generatedAt]) {
    const svg = renderPulseCard({ ...live, expiresAt }, { nowMs: NOW });
    assert.match(svg, /Pulse capsule unavailable/);
    assertNoLiveRows(svg);
  }
  assertNoLiveRows(renderPulseCard(live, { nowMs: NOW - 1 }));
});

test("an expired or unavailable pulse panel fits inside its frame", () => {
  for (const options of [{ nowMs: EXPIRES }, {}]) {
    const svg = renderPulseCard(data(), options as PulseRenderOptions);
    const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)?.[1]);
    assert.ok(height >= 138, `the y=122 explanation must fit above the panel's height-16 bottom: ${height}`);
  }
});

test("the pulse cache owns its input, including nested probes and expiry", () => {
  const input = capsule();
  const expected = structuredClone(input);
  const cache = new PulseCapsuleCache();
  cache.store(input, NOW);
  input.expiresAt += 86_400_000;
  input.projects[0]!.probe.state = "down";
  input.projects[0]!.sampledChecks.good = 0;
  assert.deepEqual(cache.get(NOW), expected);
  assert.equal(cache.ttlMs(NOW), 60_000);
  assert.equal(cache.get(EXPIRES), null);
});

test("mutating a cache read cannot rewrite observations or extend the expiry", () => {
  const cache = new PulseCapsuleCache();
  cache.store(capsule(), NOW);
  const read = cache.get(NOW)!;
  read.expiresAt += 86_400_000;
  read.projects[0]!.probe.state = "down";
  assert.deepEqual(cache.get(NOW), capsule());
  assert.equal(cache.get(EXPIRES), null);
});

test("cache stores validate runtime capsule inputs rather than trusting a TypeScript cast", () => {
  const input = capsule();
  input.projects[0]!.sampledChecks.good = 100;
  const cache = new PulseCapsuleCache();
  assert.throws(() => cache.store(input, NOW), /successful checks cannot exceed/);
  assert.equal(cache.get(NOW), null);
});

test("probe observations cannot postdate capsule generation even when consumed later", () => {
  const input = capsule();
  input.projects[0]!.probe.checked = NOW + 30_000;
  for (const nowMs of [NOW + 30_000, NOW + 45_000]) {
    assert.throws(() => parsePulseCapsule(input, nowMs), /check time.*after.*generation/);
    const cache = new PulseCapsuleCache();
    assert.throws(() => cache.store(input, nowMs), /check time.*after.*generation/);
    assert.equal(cache.get(nowMs), null);
  }
  input.projects[0]!.probe.checked = NOW;
  assert.doesNotThrow(() => parsePulseCapsule(input, NOW + 45_000));
});
