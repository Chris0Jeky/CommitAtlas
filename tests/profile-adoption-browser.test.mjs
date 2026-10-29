import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  validateTarget, validateManifestPair, validateAssetUrl, inspectSvg, validateImageState,
  validateFrameTiming, evaluatePlayback, validateRefreshRun, validateSnapshotRefresh, validateProfileHead,
  validateAdoptionSource, observeSelectedResponse,
} from "./profile-adoption-browser.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const target = { version: 1, profileCommit: "a".repeat(40), refreshRunId: "40800000001" };
const body = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 770"><title>Evidence coverage</title><desc>Observed public evidence.</desc><text>PARTIAL · CURRENT CI UNVERIFIED</text></svg>';
const artifact = { path: "assets/commitatlas/scene-evidence-coverage.still.svg", bytes: Buffer.byteLength(body), sha256: digest(body) };
const url = `https://github.com/Chris0Jeky/Chris0Jeky/raw/main/${artifact.path}?v=${artifact.sha256.slice(0, 16)}`;
const viewport = { width: 1280, height: 1200 };
const state = { sameNode: true, connected: true, visible: true, currentSrc: url, canonical: url,
  naturalWidth: 720, naturalHeight: 770, x: 40, y: 80, width: 720, height: 770,
  scrollX: 0, scrollY: 1500,
  article: { x: 40, width: 900, paddingLeft: 0, paddingRight: 0, borderLeft: 0, borderRight: 0, contentWidth: 900 } };
const source = { width: 720, height: 770 };
const expectedWidth = 720;
const image = (red = 0) => ({ width: 8, height: 8, rgba: Buffer.from(Array.from({ length: 64 }, () => [red, 0, 0, 255]).flat()) });

function manifest(overrides = {}) {
  return { version: 1, generator: "CommitAtlas", user: "Chris0Jeky", source: "github-public-profile",
    generatedAt: "2026-10-29T05:23:00.000Z", window: { from: "2025-10-30", to: "2026-10-29", days: 365 },
    artifacts: [{ path: "scene-evidence-coverage.still.svg", bytes: artifact.bytes, sha256: artifact.sha256 }], ...overrides };
}

test("requires a reviewable immutable target rather than silently following main", () => {
  assert.deepEqual(validateTarget(target), target);
  for (const profileCommit of [null, "main", "a".repeat(39), "a".repeat(40) + "\n", "../main"]) {
    assert.throws(() => validateTarget({ ...target, profileCommit }), /commit/i);
  }
  for (const refreshRunId of [null, "", "latest", "0", "1/../2", 40800000001]) {
    assert.throws(() => validateTarget({ ...target, refreshRunId }), /run/i);
  }
  assert.throws(() => validateTarget({ ...target, profileUrl: "https://example.com" }), /field/i);
});

test("paired manifests bind paths, hashes and one exact generated snapshot", () => {
  const paired = validateManifestPair(manifest(), manifest());
  assert.equal(paired.artifacts.get(artifact.path).sha256, artifact.sha256);
  assert.equal(paired.artifacts.get("assets/commitatlas/light/scene-evidence-coverage.still.svg").sha256, artifact.sha256);
  for (const changed of [
    manifest({ generatedAt: "2026-10-29T05:24:00.000Z" }),
    manifest({ window: { from: "2025-10-29", to: "2026-10-29", days: 366 } }),
    manifest({ user: "someone-else" }),
    manifest({ artifacts: [{ path: "../outside.svg", bytes: 1, sha256: "a".repeat(64) }] }),
    manifest({ artifacts: [{ path: "atlas.svg", bytes: 1, sha256: "a".repeat(64) + "\n" }] }),
    manifest({ artifacts: [manifest().artifacts[0], manifest().artifacts[0]] }),
  ]) assert.throws(() => validateManifestPair(manifest(), changed), /snapshot|identity|path|hash|duplicate/i);
});

test("selected image URLs require the exact artifact, owner and content fingerprint", () => {
  assert.equal(validateAssetUrl(url, artifact, target.profileCommit), url);
  for (const valid of [
    url.replace("/raw/main/", "/raw/refs/heads/main/"),
    url.replace("https://github.com/", "https://raw.githubusercontent.com/").replace("/raw/main/", "/main/"),
    url.replace("/raw/main/", `/raw/${target.profileCommit}/`),
  ]) assert.equal(validateAssetUrl(valid, artifact, target.profileCommit), valid);
  for (const bad of [
    url.replace("Chris0Jeky/Chris0Jeky/", "someone/else/"),
    url.replace("scene-evidence-coverage.still.svg", "scene-evidence-coverage.svg"),
    url.replace("assets/commitatlas/", "assets/commitatlas/light/"),
    url.replace(/\?v=.*/, ""), url + "&v=other", url + "&raw=true", url + "#other",
    url.replace(artifact.sha256.slice(0, 16), "f".repeat(16)),
    url.replace("https:", "http:"), url.replace("github.com", "example.com"),
  ]) assert.throws(() => validateAssetUrl(bad, artifact, target.profileCommit), /URL|source|fingerprint|artifact/i, bad);
});

test("a matching short URL version cannot conceal stale or altered SVG bytes", () => {
  const inspected = inspectSvg(Buffer.from(body), artifact, true);
  assert.equal(inspected.hasMotion, false);
  assert.deepEqual(inspected.signals, ["PARTIAL · CURRENT CI UNVERIFIED"]);
  assert.throws(() => inspectSvg(Buffer.from(body.replace("public", "secret")), artifact, true), /hash|bytes/i);
  const animated = body.replace("</svg>", '<animate attributeName="opacity" values="1;0;1" dur="5s"/></svg>');
  assert.throws(() => inspectSvg(Buffer.from(animated), { ...artifact, bytes: Buffer.byteLength(animated), sha256: digest(animated) }, true), /still|motion/i);
});

test("unavailable sources remain explicit static evidence rather than a motion failure", () => {
  const unavailable = body.replace("Evidence coverage", "evidence-coverage: unavailable").replace("PARTIAL · CURRENT CI UNVERIFIED", "UNAVAILABLE");
  const inspected = inspectSvg(Buffer.from(unavailable), { ...artifact, bytes: Buffer.byteLength(unavailable), sha256: digest(unavailable) }, false);
  assert.equal(inspected.unavailable, true);
  assert.equal(inspected.hasMotion, false);
  assert.equal(evaluatePlayback([image(), image()], inspected, false).verdict, "static-source");
});

test("final adoption requires the named Beacon and three observed project bodies", () => {
  const beacon = '<svg viewBox="0 0 860 576"><title>Cristian (Chris) Tcaci</title><desc>Public snapshot.</desc>' +
    '<text>Cristian (Chris) Tcaci</text><g id="fixture-body0"><text>Local Asset Studio</text></g>' +
    '<g id="fixture-body1"><text>NavSentinel</text></g><g id="fixture-body2"><text>Alibi</text></g>' +
    '<text>PARTIAL PROJECT BOARD</text><animateTransform attributeName="transform" type="translate" values="0;10" dur="7s"/></svg>';
  const read = value => inspectSvg(Buffer.from(value), { bytes: Buffer.byteLength(value), sha256: digest(value) }, false);
  assert.doesNotThrow(() => validateAdoptionSource("beacon", read(beacon), "ambient"));
  for (const invalid of [
    beacon.replaceAll("Cristian (Chris) Tcaci", "Someone else"),
    beacon.replace("Local Asset Studio", "Unknown project"),
    beacon.replace('id="fixture-body2"', 'id="fixture-unmatched"'),
    beacon.replace(/<animateTransform[^>]*\/>/, ""),
  ]) assert.throws(() => validateAdoptionSource("beacon", read(invalid), "ambient"), /Beacon|beacon|motion/i);
  const unavailable = read('<svg viewBox="0 0 860 190"><title>identity-beacon: unavailable</title><desc>Unavailable.</desc><text>UNAVAILABLE</text></svg>');
  assert.throws(() => validateAdoptionSource("beacon", unavailable, "ambient"), /unavailable/i);
});

test("Atlas, Coverage and Terrain require their own public readings, dates and identity", () => {
  const snapshot = { generatedAt: "2026-10-29T05:23:00.000Z", window: { from: "2024-10-30", to: "2026-10-29", days: 730 } };
  const svg = (title, description, readings) => `<svg viewBox="0 0 720 770"><title>${title}</title><desc>${description}</desc>` +
    readings.map(text => `<text>${text}</text>`).join("") + '<animateTransform attributeName="transform" type="translate" values="0;10" dur="7s"/></svg>';
  const fixtures = {
    atlas: svg("Partial snapshot: CommitAtlas developer atlas",
      "Observed history 2024-10-30 to 2026-10-29: 83490 contributions. Displayed calendar 2025-10-30 to 2026-10-29, 365 observed days.",
      ["@Chris0Jeky", "OBSERVED HISTORY · 730D", "01 // CONTRIBUTION CALENDAR", "CURRENT STREAK", "LONGEST IN HISTORY", "Generated 2026-10-29T05:23:00.000Z · history-bounded"]),
    coverage: svg("Evidence coverage", "Bar length records coverage, not performance.",
      ["SCOPE / 07", "PUBLIC SNAPSHOT", "PUBLIC PROFILE VIEW", "730 OF 730 DAYS OBSERVED", "ACTIVITY MIX", "CI", "RELEASES", "LINE CHANGES", "PRIVATE ACTIVITY", "SNAPSHOT", "PARTIAL", "UNAVAILABLE", "NOT OBSERVED", "NOT REQUESTED"]),
    terrain: svg("Activity terrain", "UTC window 2024-10-30 to 2026-10-29. Source github-profile-html; captured 2026-10-29T05:23:00.000Z.",
      ["TERRAIN / 01", "PUBLIC SNAPSHOT", "TOTAL", "PEAK WEEK", "QUIET RUN", "CURRENT STREAK", "UTC 2024-10-30 TO 2026-10-29", "CAPTURED 2026-10-29T05:23:00.000Z", "SOURCE GITHUB-PROFILE-HTML / OBSERVED CALENDAR", "ACTIVITY COUNTS ARE NOT A QUALITY OR IMPACT SCORE"]),
  };
  const read = value => inspectSvg(Buffer.from(value), { bytes: Buffer.byteLength(value), sha256: digest(value) }, false);
  const unrelated = read(svg("Unrelated profile card", "Wrong source.", ["Wrong card"]));
  for (const [name, fixture] of Object.entries(fixtures)) {
    const inspected = read(fixture);
    assert.doesNotThrow(() => validateAdoptionSource(name, inspected, "ambient", snapshot));
    assert.doesNotThrow(() => validateAdoptionSource(name, { ...inspected, hasMotion: false }, "reduce", snapshot));
    assert.throws(() => validateAdoptionSource(name, unrelated, "ambient", snapshot), /identity|title|reading/i);
    for (const other of Object.keys(fixtures).filter(other => other !== name)) {
      assert.throws(() => validateAdoptionSource(name, read(fixtures[other]), "ambient", snapshot), /identity|title|reading/i);
    }
  }
  for (const [name, fixture] of [
    ["atlas", fixtures.atlas.replace("@Chris0Jeky", "@someone-else")],
    ["atlas", fixtures.atlas.replace("2025-10-30", "2026-01-01")],
    ["atlas", fixtures.atlas.replace("05:23:00.000Z", "05:22:00.000Z")],
    ["coverage", fixtures.coverage.replace("PRIVATE ACTIVITY", "UNKNOWN ROW")],
    ["coverage", fixtures.coverage.replace("730 OF 730", "730 OF 731")],
    ["terrain", fixtures.terrain.replaceAll("05:23:00.000Z", "05:22:00.000Z")],
    ["terrain", fixtures.terrain.replaceAll("2024-10-30", "2025-10-30")],
  ]) assert.throws(() => validateAdoptionSource(name, read(fixture), "ambient", snapshot), /reading|window|snapshot|capture|identity/i);
  assert.throws(() => validateAdoptionSource("coverage", { ...read(fixtures.coverage), hasMotion: false }, "ambient", snapshot), /motion/i);
  assert.doesNotThrow(() => validateAdoptionSource("terrain", { ...read(fixtures.terrain), hasMotion: false }, "ambient", snapshot));
});

test("geometry accepts the real tall Coverage image but rejects drift or replacement", () => {
  const checks = { artifact, profileCommit: target.profileCommit, source, viewport, expectedWidth };
  assert.doesNotThrow(() => validateImageState(state, checks));
  // ViewBox-only SVGs may decode with browser-default intrinsic dimensions. The
  // pinned README width and SVG aspect govern the actual profile display.
  assert.doesNotThrow(() => validateImageState({ ...state, naturalWidth: 300, naturalHeight: 150 }, checks));
  for (const bad of [
    { ...state, sameNode: false }, { ...state, connected: false }, { ...state, visible: false },
    { ...state, naturalWidth: 0 }, { ...state, naturalHeight: 0 },
    { ...state, x: -1 }, { ...state, height: 1500 },
    { ...state, width: 360, height: 385 },
    { ...state, currentSrc: url.replace(".still.svg", ".svg") },
  ]) assert.throws(() => validateImageState(bad, checks));
  assert.throws(() => validateImageState(state, { ...checks, expectedWidth: null }), /width/i);
  assert.throws(() => validateImageState({ ...state, x: state.x + 1 }, {
    ...checks, previous: state,
  }), /geometry|moved/i);
  assert.throws(() => validateImageState({ ...state, scrollY: state.scrollY + 1 }, {
    ...checks, previous: state,
  }), /scroll|moved/i);
});

test("responsive README clamping uses observed content width and rejects arbitrary resizing", () => {
  const checks = { artifact, profileCommit: target.profileCommit, source: { width: 860, height: 380 }, viewport, expectedWidth: 860 };
  const clamped = { ...state, naturalWidth: 860, naturalHeight: 380, width: 846, height: 846 * 380 / 860,
    article: { ...state.article, width: 846, contentWidth: 846 } };
  assert.doesNotThrow(() => validateImageState(clamped, checks));
  const padded = { ...clamped, x: clamped.x + 12,
    article: { ...clamped.article, width: 870, paddingLeft: 10, paddingRight: 10, borderLeft: 2, borderRight: 2 } };
  assert.doesNotThrow(() => validateImageState(padded, checks));
  for (const width of [800, 860]) {
    assert.throws(() => validateImageState({ ...clamped, width, height: width * 380 / 860 }, checks), /width|article/i);
  }
  for (const article of [null,
    { ...clamped.article, contentWidth: 0 },
    { ...clamped.article, contentWidth: Number.NaN },
    { ...clamped.article, width: 1281, contentWidth: 1281 },
    { ...clamped.article, paddingRight: -1 },
    { ...padded.article, contentWidth: 870 },
  ]) assert.throws(() => validateImageState({ ...clamped, article }, checks), /article|content|width/i);
  assert.throws(() => validateImageState({ ...clamped, x: clamped.x - 2 }, checks), /article|content/i);
});

test("Camo metadata never substitutes for the final response's artifact hash", () => {
  assert.doesNotThrow(() => validateImageState({ ...state, currentSrc: "https://camo.githubusercontent.com/hash/public-path" }, {
    artifact, profileCommit: target.profileCommit, source, viewport, expectedWidth,
  }));
  assert.throws(() => validateImageState({ ...state, currentSrc: "https://camo.githubusercontent.com/hash/public-path", canonical: null }, {
    artifact, profileCommit: target.profileCommit, source, viewport, expectedWidth,
  }), /canonical|source/i);
  assert.throws(() => inspectSvg(Buffer.from(body + " "), artifact, true), /hash|bytes/i);
});

test("frame timing rejects missed observation windows and impossible timestamps", () => {
  assert.doesNotThrow(() => validateFrameTiming({ requestedMs: 2000, beforeMs: 2100, afterMs: 2150 }, 2000));
  for (const frame of [
    { requestedMs: 2000, beforeMs: 100, afterMs: 200 },
    { requestedMs: 2000, beforeMs: 2100, afterMs: 2050 },
    { requestedMs: 2000, beforeMs: 2100, afterMs: 3001 },
    { requestedMs: 2000, beforeMs: Number.NaN, afterMs: 2100 },
    { requestedMs: 6000, beforeMs: 6100, afterMs: 6150 },
  ]) assert.throws(() => validateFrameTiming(frame, 2000), /timing|late|interval/i);
});

test("motion verdicts come from decoded pixels with exact equality for still sources", () => {
  assert.equal(evaluatePlayback([image(), image(200)], { hasMotion: true }, false).verdict, "visible-motion");
  assert.throws(() => evaluatePlayback([image(), image()], { hasMotion: true }, false), /motion/i);
  assert.equal(evaluatePlayback([image(), image()], { hasMotion: false }, true).verdict, "static-reduced-source");
  assert.throws(() => evaluatePlayback([image(), image(1)], { hasMotion: false }, true), /still|static/i);
  assert.throws(() => evaluatePlayback([image()], { hasMotion: true }, false), /frames/i);
  assert.throws(() => evaluatePlayback([image(), image(200)], { hasMotion: true }, true), /still|reduced/i);
});

test("refresh provenance and main drift remain explicit acceptance gates", () => {
  const run = { id: 40800000001, status: "completed", conclusion: "success", path: ".github/workflows/commitatlas.yml",
    head_branch: "main", head_sha: "b".repeat(40), repository: { full_name: "Chris0Jeky/Chris0Jeky" },
    run_started_at: "2026-10-29T05:22:50Z", updated_at: "2026-10-29T05:24:00Z" };
  const commit = { sha: target.profileCommit, parents: [{ sha: run.head_sha }] };
  const comparison = { status: "ahead", ahead_by: 1, behind_by: 0, total_commits: 1,
    merge_base_commit: { sha: run.head_sha }, commits: [commit] };
  const proof = validateRefreshRun(target, run, comparison);
  assert.equal(proof.relationship, "one-direct-refresh-commit");
  assert.equal(proof.targetCommit, target.profileCommit);
  assert.equal(proof.targetParent, run.head_sha);
  assert.equal(proof.runStartedAt, run.run_started_at);
  assert.equal(proof.updatedAt, run.updated_at);
  assert.doesNotThrow(() => validateSnapshotRefresh(manifest().generatedAt, proof));
  for (const bad of [{ ...run, conclusion: "failure" }, { ...run, path: ".github/workflows/commitatlas-preview.yml" },
    { ...run, id: 40800000002 }, { ...run, repository: { full_name: "someone/else" } }]) {
    assert.throws(() => validateRefreshRun(target, bad, comparison), /refresh/i);
  }
  for (const bad of [
    { ...comparison, status: "identical" }, { ...comparison, ahead_by: 2 }, { ...comparison, behind_by: 1 },
    { ...comparison, total_commits: undefined }, { ...comparison, commits: [] },
    { ...comparison, commits: [{ ...commit, sha: "c".repeat(40) }] },
    { ...comparison, commits: [{ ...commit, parents: [{ sha: "c".repeat(40) }] }] },
    { ...comparison, commits: [{ ...commit, parents: [commit.parents[0], { sha: "c".repeat(40) }] }] },
  ]) assert.throws(() => validateRefreshRun(target, run, bad), /compare|refresh|target|parent|commit/i);
  for (const bad of [{ ...run, run_started_at: undefined }, { ...run, updated_at: "2026-10-29T05:22:49Z" },
    { ...run, run_started_at: "2026-10-29 05:22:50" }]) {
    assert.throws(() => validateRefreshRun(target, bad, comparison), /time|interval|started|updated/i);
  }
  for (const stale of ["2026-10-29T05:22:49.999Z", "2026-10-29T05:24:00.001Z", "2026-10-28T05:23:00.000Z"]) {
    assert.throws(() => validateSnapshotRefresh(stale, proof), /snapshot|interval|refresh/i);
  }
  assert.doesNotThrow(() => validateProfileHead({ object: { sha: target.profileCommit } }, target));
  assert.throws(() => validateProfileHead({ object: { sha: "c".repeat(40) } }, target), /drift|commit/i);
});

test("wrong response bytes retain the received hash, safe headers and redirect chain", async () => {
  const finalUrl = url.replace("https://github.com/", "https://raw.githubusercontent.com/").replace("/raw/main/", "/main/");
  const wrong = Buffer.from(body.replace("public", "staled"));
  const response = (location, status, next, bytes) => ({
    url: () => location, status: () => status, finished: async () => null,
    headersArray: async () => [{ name: "Content-Type", value: "image/svg+xml" }, { name: "Set-Cookie", value: "must-not-be-recorded" }],
    headers: () => ({ "content-type": "image/svg+xml" }),
    request: () => ({ redirectedTo: () => next ? { url: () => next } : null }),
    body: async () => bytes,
  });
  const responses = new Map([[url, response(url, 302, finalUrl)], [finalUrl, response(finalUrl, 200, null, wrong)]]);
  const chain = [];
  assert.equal(wrong.length, artifact.bytes);
  await assert.rejects(observeSelectedResponse(responses, url, artifact, target.profileCommit, true, chain), /hash/i);
  assert.equal(chain.length, 2);
  assert.equal(chain[0].url, url);
  assert.equal(chain[1].url, finalUrl);
  assert.equal(chain[1].sha256, digest(wrong));
  assert.equal(chain[1].bytes, wrong.length);
  assert.deepEqual(chain[1].headers, [{ name: "Content-Type", value: "image/svg+xml" }]);
});
