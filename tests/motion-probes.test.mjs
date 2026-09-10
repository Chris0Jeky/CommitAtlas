import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildPageUrl,
  capture,
  classifyMotion,
  compatibilityEvidenceStatus,
  createFreshOutputDirectory,
  frameTimes,
  inspectWebmBuffer,
  parseAssetBase,
  parseCaptureOptions,
  parseHostLabel,
  reducedMotionControlSelected,
  validateHostedAssetResponse,
} from "./motion-probes/capture.mjs";
import {
  buildGithubCapturePlan,
  captureGithub,
  githubCommit,
  githubPageUrl,
  parseGithubCaptureOptions,
  positiveControlUrl,
  resolveCanonical,
  selectorForAlt,
  validateCompletedReport,
  validateCaptureTargetClip,
  validatePinnedPage,
  validateResponseChain,
  validateTargetMetadata,
} from "./motion-probes/capture-github.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures", "motion-probes");
const evidenceDirectory = path.join(fixtureDirectory, "evidence");
const testOutputDirectory = path.resolve(testDirectory, ".test-output");
const testBrowser = path.resolve(testDirectory, ".test-tools", "browser.exe");
const testPlaywrightCli = path.resolve(testDirectory, ".test-tools", "playwright", "cli.js");
const syntheticDimensions = {
  naturalWidth: 360, naturalHeight: 120, renderedWidth: 360, renderedHeight: 120,
};
const sha256Pattern = /^[a-f0-9]{64}$/u;
const readEvidence = async (name) => JSON.parse(await readFile(path.join(evidenceDirectory, name), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const verdictCounts = (rows) => Object.fromEntries(
  [...new Set(rows.map((row) => row.verdict))]
    .sort()
    .map((verdict) => [verdict, rows.filter((row) => row.verdict === verdict).length]),
);
const probes = {
  "css-enter.svg": ["@keyframes enter", "animation: enter", "READABLE AT ZERO"],
  "css-breathe.svg": ["@keyframes breathe", "animation: breathe", "72"],
  "css-plot.svg": ["@keyframes plot", "stroke-dashoffset", "TRACE PRESENT AT ZERO"],
  "css-from-state-control.svg": ["@keyframes reveal", "both", "STATIC BASELINE IS READABLE"],
  "smil-transform.svg": ["animateTransform", "COMPASS IS PRESENT AT ZERO"],
  "smil-plot.svg": ["<animate", "stroke-dashoffset", "TRACE PRESENT AT ZERO"],
  "smil-animate-motion.svg": ["animateMotion", "ROUTE IS PRESENT AT ZERO"],
  "css-offset-path.svg": ["offset-path", "offset-distance", "ROUTE IS PRESENT AT ZERO"],
  "reduced-motion-control.svg": ["REDUCED MOTION", "STATIC SOURCE SELECTED"],
};

test("motion probes remain synthetic, single-effect fixtures with a readable frame zero", async () => {
  for (const [file, expectations] of Object.entries(probes)) {
    const svg = await readFile(path.join(fixtureDirectory, file), "utf8");
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<title id="title">/);
    assert.match(svg, /<desc id="desc">/);
    for (const expected of expectations) assert.ok(svg.includes(expected), `${file} must include ${expected}`);
  }
});

test("fixture index supports both image embedding paths and declares the reduced-motion source", async () => {
  const index = await readFile(path.join(fixtureDirectory, "index.html"), "utf8");
  assert.match(index, /embed === "img"/);
  assert.match(index, /<picture>/);
  assert.match(index, /prefers-color-scheme: dark/);
  assert.match(index, /prefers-reduced-motion: reduce/);
});

test("capture options accept an explicit HTTPS asset base and bounded host label", () => {
  const assetBase = "https://motion.example.test/probes/";
  const options = parseCaptureOptions([
    "--browser", testBrowser, "--out", path.join(testOutputDirectory, "motion"),
    "--asset-base", assetBase, "--host-label", "worker-direct",
  ]);
  assert.equal(options.assetBase, assetBase);
  assert.equal(options.hostLabel, "worker-direct");
  assert.equal(parseAssetBase(undefined), null);
  assert.equal(parseHostLabel(undefined), "local-direct");
});

test("capture page URL carries the asset base as an encoded query value", () => {
  const assetBase = "https://motion.example.test/probes/";
  const page = buildPageUrl("http://127.0.0.1:4321/", "picture", "css-enter", assetBase);
  assert.equal(new URL(page).searchParams.get("assetBase"), assetBase);
  assert.match(page, /assetBase=https%3A%2F%2Fmotion\.example\.test%2Fprobes%2F/);
});

test("capture options reject non-bare asset bases and unbounded labels", () => {
  for (const value of [
    "http://motion.example.test/probes/",
    "https://user:pass@motion.example.test/probes/",
    "https://motion.example.test/probes/?token=private",
    "https://motion.example.test/probes/#fragment",
    "https://motion.example.test/probes",
  ]) {
    assert.throws(() => parseAssetBase(value), /asset-base/);
  }
  assert.throws(() => parseHostLabel(""), /host-label/);
  assert.throws(() => parseHostLabel("x".repeat(65)), /host-label/);
  assert.throws(() => parseHostLabel("worker/direct"), /host-label/);
  assert.throws(() => parseCaptureOptions(["--browser", testBrowser, "--out", path.join(testOutputDirectory, "motion"), "--asset-base"]), /asset-base/);
  assert.throws(() => parseCaptureOptions(["--browser", testBrowser, "--out", path.join(testOutputDirectory, "motion"), "--host-label"]), /host-label/);
});

test("direct capture parser rejects unknown, missing, duplicate, relative, and repeated selections", () => {
  const base = ["--browser", testBrowser, "--out", path.join(testOutputDirectory, "direct")];
  assert.throws(() => parseCaptureOptions([...base, "--unknown", "value"]), /unknown option/);
  assert.throws(() => parseCaptureOptions([...base, "--probe"]), /requires a value/);
  assert.throws(() => parseCaptureOptions([...base, "--out", path.join(testOutputDirectory, "again")]), /only once/);
  assert.throws(() => parseCaptureOptions(["--browser", testBrowser, "--out", "relative"]), /Usage/);
  assert.throws(() => parseCaptureOptions([...base, "--probe", "css-enter,css-enter"]), /unique/);
  assert.throws(() => parseCaptureOptions([...base, "--record-video", "--record-video"]), /only once/);
});

test("fresh output preflight rejects an existing absolute directory", async () => {
  await assert.rejects(createFreshOutputDirectory(testDirectory), /refusing to reuse/);
  await assert.rejects(capture(parseCaptureOptions([
    "--browser", testBrowser, "--out", testDirectory,
  ])), /refusing to reuse/);
  await assert.rejects(captureGithub(parseGithubCaptureOptions([
    "--playwright-cli", testPlaywrightCli, "--playwright-engine", "chromium", "--out", testDirectory,
  ])), /refusing to reuse/);
});

test("direct capture video mode is bounded to the supplied Playwright API", () => {
  const options = parseCaptureOptions([
    "--playwright-engine", "firefox", "--playwright-cli", testPlaywrightCli,
    "--record-video", "--out", path.join(testOutputDirectory, "motion"),
  ]);
  assert.equal(options.recordVideo, true);
  assert.throws(
    () => parseCaptureOptions(["--browser", testBrowser, "--record-video", "--out", path.join(testOutputDirectory, "motion")]),
    /record-video requires/,
  );
});

test("hosted direct capture validates status, MIME, fixture hash, and bounded dimensions", async () => {
  const fixture = await readFile(path.join(fixtureDirectory, "css-enter.svg"));
  const response = () => new Response(fixture, { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8" } });
  const observation = await validateHostedAssetResponse("css-enter", response(), fixture);
  assert.deepEqual([observation.width, observation.height], [360, 120]);
  assert.match(observation.bodySha256, sha256Pattern);
  await assert.rejects(
    validateHostedAssetResponse("css-enter", new Response("unavailable", { status: 503 }), fixture),
    /return 200/,
  );
  await assert.rejects(
    validateHostedAssetResponse("css-enter", new Response(fixture, { status: 200, headers: { "content-type": "text/html" } }), fixture),
    /image\/svg\+xml/,
  );
  await assert.rejects(
    validateHostedAssetResponse("css-enter", new Response(fixture.subarray(0, -1), { status: 200, headers: { "content-type": "image/svg+xml" } }), fixture),
    /fixture SHA-256/,
  );
});

test("compatibility eligibility requires an exact browser version and a completed run", () => {
  assert.deepEqual(compatibilityEvidenceStatus("143.0.7499.4"), {
    eligible: true, browserVersion: "143.0.7499.4",
  });
  assert.equal(compatibilityEvidenceStatus(null).eligible, false);
  assert.match(compatibilityEvidenceStatus(null).reason, /not compatibility evidence/);
  assert.deepEqual(compatibilityEvidenceStatus("143.0.7499.4", false), {
    eligible: false,
    browserVersion: "143.0.7499.4",
    reason: "capture run is incomplete; a partial report is a structural observation, not compatibility evidence",
  });
  assert.equal(compatibilityEvidenceStatus(null, false).eligible, false);
});

test("a partial direct report stays ineligible until the whole matrix completes", async () => {
  const source = await readFile(path.join(testDirectory, "motion-probes", "capture.mjs"), "utf8");
  assert.match(source, /status: "partial",/u, "the in-progress report must declare its partial status");
  assert.match(
    source,
    /compatibilityEvidence: compatibilityEvidenceStatus\(browserVersion, false\)/u,
    "rows written before completion must never carry eligible evidence",
  );
  assert.match(source, /report\.status = "complete";/u);
  assert.match(source, /report\.compatibilityEvidence = compatibilityEvidenceStatus\(browserVersion, true\);/u);
  const completion = source.indexOf('report.status = "complete";');
  const completedWrite = source.indexOf('writeFile(path.join(outputDirectory, "report.json")');
  const lastPartialWrite = source.lastIndexOf('writeFile(path.join(outputDirectory, "report.partial.json")');
  assert.ok(completion > 0);
  assert.ok(completedWrite > 0, "the completed report write must still be locatable");
  assert.ok(lastPartialWrite > 0, "the partial report write must still be locatable");
  assert.ok(
    completion < completedWrite,
    "report.json must only be written after the run is marked complete",
  );
  assert.ok(
    completion > lastPartialWrite,
    "every partial write must happen while the report is still marked partial",
  );
});

test("frame-zero reference is verified from the selected source, not a fixture colour", async () => {
  const base = "http://127.0.0.1:5000/";
  assert.equal(reducedMotionControlSelected(`${base}reduced-motion-control.svg`), true);
  assert.equal(reducedMotionControlSelected(`${base}probes/reduced-motion-control.svg`), true);
  assert.equal(reducedMotionControlSelected(`${base}smil-transform.svg`), false);
  assert.equal(reducedMotionControlSelected(`${base}not-reduced-motion-control.svg`), false);
  assert.equal(reducedMotionControlSelected("reduced-motion-control.svg"), false);
  assert.equal(reducedMotionControlSelected(""), false);
  assert.equal(reducedMotionControlSelected(null), false);

  // The colour count alone cannot carry the claim: probe fixtures paint the control's own #ffd166.
  const collidingFixtures = ["smil-transform", "smil-animate-motion", "css-offset-path"];
  for (const probe of collidingFixtures) {
    const fixture = await readFile(path.join(fixtureDirectory, `${probe}.svg`), "utf8");
    assert.match(fixture, /#ffd166/iu, `${probe} shares the reduced-motion control colour`);
  }
  const source = await readFile(path.join(testDirectory, "motion-probes", "capture.mjs"), "utf8");
  assert.doesNotMatch(source, /frameZeroReferenceVerified: reducedMotionControlPixels > 0/u);
  assert.match(source, /frameZeroReferenceVerified: reducedMotionControlVerified/u);
  assert.match(source, /reducedMotionControlSelected\(selectedSource\)/u);
});

test("direct video timing passes the Node anchor into the browser evaluation", async () => {
  const source = await readFile(path.join(testDirectory, "motion-probes", "capture.mjs"), "utf8");
  assert.doesNotMatch(source, /evaluate\(\(\) => performance\.now\(\) - startedAt\)/u);
  assert.match(source, /evaluate\(\(anchor\) => performance\.now\(\) - anchor, startedAt\)/u);
});

test("recorded video metadata verifies WebM identity without claiming parsed duration", () => {
  const metadata = inspectWebmBuffer(Buffer.from("1a45dfa300010203", "hex"));
  assert.equal(metadata.magicHex, "1a45dfa3");
  assert.equal(metadata.fileSizeBytes, 8);
  assert.equal(metadata.actualDurationVerified, false);
  assert.match(metadata.durationBoundary, /not parsed/);
  assert.throws(() => inspectWebmBuffer(Buffer.from("00010203", "hex")), /not a WebM/);
});

test("GitHub capture options require a fresh absolute output path and unique supported engines", () => {
  const options = parseGithubCaptureOptions([
    "--playwright-cli", testPlaywrightCli,
    "--playwright-engine", "chromium,webkit",
    "--out", path.join(testOutputDirectory, "github-motion"),
  ]);
  assert.deepEqual(options.selectedEngines, ["chromium", "webkit"]);
  assert.equal(options.outputDirectory, path.join(testOutputDirectory, "github-motion"));
  assert.equal(buildGithubCapturePlan(options.planFilters).length, 35);
  assert.throws(() => parseGithubCaptureOptions([
    "--playwright-cli", testPlaywrightCli, "--playwright-engine", "chromium", "--out", "relative",
  ]), /absolute/);
  assert.throws(() => parseGithubCaptureOptions([
    "--playwright-cli", testPlaywrightCli, "--playwright-engine", "webkit,webkit", "--out", path.join(testOutputDirectory, "out"),
  ]), /unique/);
  assert.throws(() => parseGithubCaptureOptions([
    "--playwright-cli", path.join(path.dirname(testPlaywrightCli), "playwright.cmd"), "--playwright-engine", "chromium", "--out", path.join(testOutputDirectory, "out"),
  ]), /cli\.js/);
  assert.throws(() => parseGithubCaptureOptions([
    "--playwright-cli", testPlaywrightCli, "--playwright-engine", "chromium", "--out", path.join(testOutputDirectory, "out"), "--host", "unknown",
  ]), /--host/);
});

test("GitHub diagnostic filters are bounded and controls are explicit", () => {
  const base = [
    "--playwright-cli", testPlaywrightCli, "--playwright-engine", "chromium", "--out", path.join(testOutputDirectory, "out"),
    "--host", "worker-camo", "--probe", "css-enter", "--embed", "picture",
  ];
  const diagnostic = parseGithubCaptureOptions(base);
  assert.equal(diagnostic.diagnostic, true);
  assert.deepEqual(buildGithubCapturePlan(diagnostic.planFilters).map((row) => row.kind), ["probe"]);
  const withControls = parseGithubCaptureOptions([...base, "--include-positive-control", "--include-reduced-controls"]);
  assert.deepEqual(buildGithubCapturePlan(withControls.planFilters).map((row) => row.kind), [
    "probe", "reduced-motion-control", "positive-control",
  ]);
});

test("GitHub capture plan covers each probe, host, embed, reduced source, and positive control", () => {
  const plan = buildGithubCapturePlan();
  assert.equal(plan.filter((row) => row.kind === "probe").length, 32);
  assert.equal(plan.filter((row) => row.kind === "reduced-motion-control").length, 2);
  assert.equal(plan.filter((row) => row.kind === "positive-control").length, 1);
  assert.equal(new Set(plan.map((row) => `${row.host}:${row.selector}:${row.media}`)).size, plan.length);
  assert.equal(selectorForAlt("worker-picture-css-enter"), 'img[alt="worker-picture-css-enter"]');
  assert.throws(() => selectorForAlt('unsafe"]'), /selector vocabulary/);
  validatePinnedPage(githubPageUrl);
  assert.throws(() => validatePinnedPage(githubPageUrl.replace(githubCommit, "main")), /exact pinned/);
});

test("GitHub target validation distinguishes pinned raw delivery and Camo canonical delivery", () => {
  const plan = buildGithubCapturePlan();
  const rawRow = plan.find((row) => row.host === "github-raw-relative" && row.probe === "css-enter" && row.embed === "img");
  const camoRow = plan.find((row) => row.host === "worker-camo" && row.probe === "css-enter" && row.embed === "img");
  const positiveRow = plan.find((row) => row.kind === "positive-control");
  const rawUrl = `https://github.com/Chris0Jeky/commitatlas-motion-probes/raw/${githubCommit}/tests/fixtures/motion-probes/css-enter.svg`;
  const resolvedRaw = resolveCanonical(rawRow, {
    currentSrc: rawUrl,
    selectedSourceCanonical: null,
    imageCanonical: null,
    anchorHref: githubPageUrl,
  });
  assert.equal(resolvedRaw.canonical, rawUrl, "raw canonical must ignore the surrounding README link");
  assert.doesNotThrow(() => validateTargetMetadata(rawRow, {
    src: rawUrl, currentSrc: rawUrl, canonical: rawUrl, sources: [],
    ...syntheticDimensions,
  }));
  assert.doesNotThrow(() => validateTargetMetadata(camoRow, {
    src: "https://camo.githubusercontent.com/hash", currentSrc: "https://camo.githubusercontent.com/hash",
    canonical: "https://commit-atlas.commit-atlas.workers.dev/api/v1/probes/motion/css-enter.svg",
    sources: [], ...syntheticDimensions,
  }));
  assert.throws(() => validateTargetMetadata(rawRow, {
    src: rawUrl, currentSrc: rawUrl.replace(githubCommit, "main"), canonical: rawUrl, sources: [],
    ...syntheticDimensions,
  }), /full raw commit pin/);
  const wrongProbeUrl = rawUrl.replace("css-enter.svg", "css-breathe.svg");
  assert.throws(() => validateTargetMetadata(rawRow, {
    src: wrongProbeUrl, currentSrc: wrongProbeUrl, canonical: wrongProbeUrl, sources: [],
    ...syntheticDimensions,
  }), /must select css-enter\.svg/);
  assert.throws(() => validateTargetMetadata(camoRow, {
    src: "https://camo.githubusercontent.com/hash", currentSrc: "https://camo.githubusercontent.com/hash",
    canonical: "https://commit-atlas.commit-atlas.workers.dev/api/v1/probes/motion/css-breathe.svg",
    sources: [], ...syntheticDimensions,
  }), /must select css-enter\.svg/);
  assert.doesNotThrow(() => validateTargetMetadata(positiveRow, {
    src: "https://camo.githubusercontent.com/control", currentSrc: "https://camo.githubusercontent.com/control",
    canonical: positiveControlUrl, sources: [], naturalWidth: 435, naturalHeight: 50,
  }));
  assert.throws(() => validateTargetMetadata(positiveRow, {
    src: "https://camo.githubusercontent.com/control", currentSrc: "https://camo.githubusercontent.com/control",
    canonical: positiveControlUrl.replace("duration=2500", "duration=5000"), sources: [], naturalWidth: 435, naturalHeight: 50,
  }), /exact configured/);

  const reducedRow = plan.find((row) => row.kind === "reduced-motion-control" && row.host === "github-raw-relative");
  const reducedUrl = rawUrl.replace("css-enter.svg", "reduced-motion-control.svg");
  const rootRelativeReduced = `/Chris0Jeky/commitatlas-motion-probes/raw/${githubCommit}/tests/fixtures/motion-probes/reduced-motion-control.svg`;
  const rootRelativeBreathe = rootRelativeReduced.replace("reduced-motion-control.svg", "css-breathe.svg");
  const rawSources = [
    { media: "(prefers-reduced-motion: reduce)", matches: true, srcset: rootRelativeReduced, canonicalSrcset: null },
    { media: "(prefers-color-scheme: dark)", matches: true, srcset: rootRelativeBreathe, canonicalSrcset: null },
  ];
  assert.doesNotThrow(() => validateTargetMetadata(reducedRow, {
    src: rawUrl.replace("css-enter.svg", "css-breathe.svg"),
    currentSrc: reducedUrl,
    canonical: reducedUrl,
    sources: rawSources,
    ...syntheticDimensions,
  }, { currentSrc: reducedUrl }));
  assert.equal(rawSources[0].srcset, rootRelativeReduced, "validation must retain the literal root-relative source value");

  assert.doesNotThrow(() => validateResponseChain(rawRow, rawUrl, [
    { url: rawUrl, status: 302 },
    {
      url: `https://raw.githubusercontent.com/Chris0Jeky/commitatlas-motion-probes/${githubCommit}/tests/fixtures/motion-probes/css-enter.svg`,
      status: 200,
      headersArray: [{ name: "content-type", value: "image/svg+xml" }],
      bodySha256: "c".repeat(64),
      bodyError: null,
    },
  ]));
  assert.throws(() => validateResponseChain(rawRow, rawUrl, [
    { url: rawUrl, status: 302 },
    {
      url: `https://raw.githubusercontent.com/Chris0Jeky/commitatlas-motion-probes/${githubCommit}/tests/fixtures/motion-probes/css-enter.svg`,
      status: 200,
      headersArray: [{ name: "content-type", value: "image/svg+xml" }],
      bodySha256: "c".repeat(64),
      bodyError: null,
    },
  ], "d".repeat(64)), /match the pinned synthetic fixture/);
  assert.throws(() => validateResponseChain(rawRow, rawUrl, [{ url: rawUrl, status: 200 }]), /redirect chain/);

  assert.doesNotThrow(() => validateTargetMetadata(rawRow, {
    src: rawUrl, currentSrc: rawUrl, canonical: rawUrl, sources: [],
    naturalWidth: 400, naturalHeight: 133, renderedWidth: 400, renderedHeight: 133.328125,
  }));
  assert.throws(() => validateTargetMetadata(rawRow, {
    src: rawUrl, currentSrc: rawUrl, canonical: rawUrl, sources: [],
    naturalWidth: 400, naturalHeight: 120, renderedWidth: 400, renderedHeight: 120,
  }), /3:1 aspect/);
  assert.throws(() => validateTargetMetadata(rawRow, {
    src: rawUrl, currentSrc: rawUrl, canonical: rawUrl, sources: [],
    naturalWidth: 1_200, naturalHeight: 400, renderedWidth: 400, renderedHeight: 133.328125,
  }), /positive and bounded/);
});

test("frozen from-state is reserved for the opacity-from control", () => {
  const transparentControl = { width: 1, height: 1, rgba: Buffer.from([0, 0, 0, 255]) };
  const differences = [{ changedPixels: 0, totalChannelDelta: 0 }];
  assert.equal(classifyMotion("css-from-state-control", [transparentControl], differences), "frozen at from-state");
  assert.equal(classifyMotion("css-enter", [transparentControl], differences), "no motion detected");
  assert.equal(
    classifyMotion("css-enter", [transparentControl], differences, { frameZeroReferenceVerified: true }),
    "frozen at frame zero",
  );
});

test("completed GitHub output requires every frame, measured verdict, and recorded video", () => {
  const selectedEngines = ["chromium"];
  const plan = buildGithubCapturePlan({
    hosts: ["github-raw-relative"], probes: ["css-enter"], embeds: ["img"],
    includeReducedControls: false, includePositiveControl: false,
  });
  const currentSrc = `https://github.com/Chris0Jeky/commitatlas-motion-probes/raw/${githubCommit}/tests/fixtures/motion-probes/css-enter.svg`;
  const responseChain = [
    { url: currentSrc, status: 302 },
    {
      url: `https://raw.githubusercontent.com/Chris0Jeky/commitatlas-motion-probes/${githubCommit}/tests/fixtures/motion-probes/css-enter.svg`,
      status: 200,
      headersArray: [{ name: "content-type", value: "image/svg+xml; charset=utf-8" }],
      bodySha256: "c".repeat(64),
      bodyError: null,
    },
  ];
  const discoveries = plan.map((row) => ({
    ...row,
    engine: "chromium", version: "1.0", media: row.media, selector: row.selector,
    currentSrc, canonical: currentSrc, expectedBodySha256: "c".repeat(64),
    responseObservation: { chain: responseChain },
  }));
  const rows = plan.map((row) => ({
    ...row,
    engine: "chromium",
    version: "1.0",
    page: githubPageUrl,
    commit: githubCommit,
    currentSrc,
    canonical: "https://example.test/canonical",
    requestGate: {
      targetUrl: currentSrc, interceptionCount: 1,
      loadTimestampMs: 100, loadToFirstFrameMs: 1, loadToFirstFrameCompleteMs: 2,
    },
    responseObservation: { chain: responseChain },
    frames: frameTimes.map((targetTimeMs) => ({
      targetTimeMs, actualTimeMs: targetTimeMs, completedTimeMs: targetTimeMs + 1,
      path: `${targetTimeMs}.png`, sha256: "b".repeat(64),
    })),
    verdict: row.kind === "positive-control" ? "animates" : "frozen at frame zero",
    video: {
      measuredVisibleDurationMs: 5_000,
      sha256: "a".repeat(64),
      fileSizeBytes: 8,
      magicHex: "1a45dfa3",
      actualDurationVerified: false,
      durationBoundary: "measuredVisibleDurationMs is browser performance time; WebM container duration is not parsed",
    },
  }));
  assert.doesNotThrow(() => validateCompletedReport({ selectedEngines, plan, discoveries, rows }));
  rows[0] = { ...rows[0], video: { ...rows[0].video, measuredVisibleDurationMs: 2_999 } };
  assert.throws(() => validateCompletedReport({ selectedEngines, plan, discoveries, rows }), /at least three seconds/);
});

test("direct Worker recording ledger pins all 51 synthetic WebMs", async () => {
  const ledger = await readEvidence("2026-08-29-worker-recordings.json");
  const versions = {
    chromium: "143.0.7499.4",
    firefox: "144.0.2",
    webkit: "26.0",
  };
  const expectedReportHashes = [
    "e4022d47bc41ddc46da412abd2451d2beb5d5fccf71d89e823e34bff25b688a9",
    "a3cd06cf9f104f249ac64c4b85501ba987a40cc9b8bb0c8e5efa8fe42908e6ab",
    "f2d7b2202c5fe941c849814696035c9622f3329d7944a513589d8e4dd471cbd7",
    "f19f62f7e3f50d418425af7d795c648017a1c837ef7de999e79ecdbfafa974a3",
    "9196d39274e8ff2d849e7bc99b3fd1e9bbec1e583227765c21f4ea29b017188a",
    "4ede16374670ce2b684f678e6fa8155fbc6af7809b66e770d9d44d06469266e9",
  ];

  assert.equal(ledger.status, "complete-direct-worker-recording-ledger");
  assert.doesNotMatch(JSON.stringify(ledger), /C:[\\/]+Users[\\/]/ui);
  assert.equal(ledger.rowCount, 51);
  assert.equal(ledger.rows.length, 51);
  assert.equal(ledger.rows.filter((row) => row.media === "no-preference").length, 48);
  assert.equal(ledger.rows.filter((row) => row.media === "reduce").length, 3);
  assert.equal(ledger.reports.length, 6);
  assert.deepEqual(ledger.reports.map((report) => report.sha256), expectedReportHashes);
  assert.equal(new Set(ledger.reports.map((report) => report.relativeArtifact)).size, 6);
  assert.equal(new Set(ledger.rows.map((row) => row.relativeArtifact)).size, 51);
  assert.equal(new Set(ledger.rows.map((row) => row.sha256)).size, 51);
  const identities = new Set(ledger.rows.map((row) => [
    row.engine, row.probe, row.embed, row.media,
  ].join("|")));
  const normalProbes = [
    "css-enter", "css-breathe", "css-plot", "css-from-state-control",
    "smil-transform", "smil-plot", "smil-animate-motion", "css-offset-path",
  ];
  const expectedIdentities = Object.keys(versions).flatMap((engine) => [
    ...normalProbes.flatMap((probe) => ["img", "picture"].map(
      (embed) => [engine, probe, embed, "no-preference"].join("|"),
    )),
    [engine, "css-breathe", "picture", "reduce"].join("|"),
  ]).sort();
  assert.equal(identities.size, 51);
  assert.deepEqual([...identities].sort(), expectedIdentities);

  for (const row of ledger.rows) {
    assert.equal(row.version, versions[row.engine]);
    assert.ok(["img", "picture"].includes(row.embed));
    assert.ok(["no-preference", "reduce"].includes(row.media));
    assert.ok(["animates", "frozen at frame zero", "frozen at from-state"].includes(row.verdict));
    assert.ok(row.measuredVisibleDurationMs > 3_000);
    assert.equal(row.magicHex, "1a45dfa3");
    assert.ok(row.fileSizeBytes > 0);
    assert.match(row.sha256, sha256Pattern);
    assert.equal(path.isAbsolute(row.relativeArtifact), false);
    assert.doesNotMatch(row.relativeArtifact, /^[A-Za-z]:/u);
  }

  for (const aggregate of ledger.engineAggregates) {
    const engineRows = ledger.rows.filter((row) => row.engine === aggregate.engine);
    const lines = engineRows.map((row) => [
      row.engine, row.version, row.probe, row.embed, row.media, row.relativeArtifact, row.sha256,
    ].join("\t") + "\n").sort().join("");
    assert.equal(aggregate.version, versions[aggregate.engine]);
    assert.equal(aggregate.rowCount, 17);
    assert.deepEqual(aggregate.verdictCounts, { animates: 14, "frozen at frame zero": 3 });
    assert.equal(aggregate.recordingAggregateSha256, sha256(lines));
  }
});

test("legacy direct Worker pixel ledger retains complete identities, thresholds, controls, and fixture hashes", async () => {
  const ledger = await readEvidence("2026-08-29-worker-direct.json");
  assert.deepEqual(ledger.runner.framesMs, frameTimes);
  assert.deepEqual(ledger.runner.motionThreshold, { changedPixels: 16, totalChannelDelta: 1_000 });
  assert.equal(ledger.pixelMatrix.rowCount, 48);
  assert.equal(ledger.pixelMatrix.results.length, 48);
  assert.equal(ledger.pixelMatrix.reducedMotion.rowCount, 3);
  assert.equal(ledger.pixelMatrix.reducedMotion.results.length, 3);

  const normalProbes = [
    "css-enter", "css-breathe", "css-plot", "css-from-state-control",
    "smil-transform", "smil-plot", "smil-animate-motion", "css-offset-path",
  ];
  const engines = Object.values(ledger.runner.browsers);
  const expectedNormal = engines.flatMap((engine) => normalProbes.flatMap((probe) => (
    ["img", "picture"].map((embed) => `${engine}|${probe}|${embed}`)
  ))).sort();
  assert.deepEqual(
    ledger.pixelMatrix.results.map((row) => `${row.engine}|${row.probe}|${row.embed}`).sort(),
    expectedNormal,
  );
  for (const row of [...ledger.pixelMatrix.results, ...ledger.pixelMatrix.reducedMotion.results]) {
    assert.equal(row.pairs.length, 4);
    for (const pair of row.pairs) {
      assert.equal(pair.length, 2);
      assert.ok(pair.every((value) => Number.isInteger(value) && value >= 0));
    }
  }
  assert.deepEqual(
    ledger.pixelMatrix.reducedMotion.results.map((row) => [row.engine, row.probe, row.embed]),
    engines.map((engine) => [engine, "smil-transform", "picture"]),
  );
  assert.ok(ledger.pixelMatrix.reducedMotion.results.every((row) => row.reducedMotionControlPixels > 0));

  assert.equal(ledger.httpResponses.length, 9);
  assert.deepEqual(
    ledger.httpResponses.map((response) => response.probe).sort(),
    [...normalProbes, "reduced-motion-control"].sort(),
  );
  for (const response of ledger.httpResponses) {
    assert.equal(response.status, 200);
    assert.match(response.contentType, /^image\/svg\+xml(?:;|$)/u);
    const fixture = await readFile(path.join(fixtureDirectory, `${response.probe}.svg`));
    assert.equal(response.etag, `W/"${sha256(fixture)}"`);
  }
  assert.equal(ledger.rawReports.length, 6);
  for (const report of ledger.rawReports) {
    assert.match(report.reportJsonSha256, sha256Pattern);
    assert.match(report.reportPartialJsonSha256, sha256Pattern);
    assert.match(report.pngAggregate.rootSha256, sha256Pattern);
  }
});

test("hosted diagnostic ledger keeps WebKit explicitly outside the evidence", async () => {
  const ledger = await readEvidence("2026-08-29-github-hosted-diagnostic.json");
  const expectedPin = "039a0370b1a52fb6135e4414e04a11bff7ba21d0";
  assert.equal(ledger.status, "partial");
  assert.doesNotMatch(JSON.stringify(ledger), /C:[\\/]+Users[\\/]/ui);
  assert.equal(ledger.scratchCommit, expectedPin);
  assert.equal(ledger.page, `https://github.com/Chris0Jeky/commitatlas-motion-probes/blob/${expectedPin}/README.md`);
  assert.deepEqual(ledger.frameTimesMs, [0, 250, 500, 2_000, 5_000]);
  assert.deepEqual(ledger.selectedEngines, ["chromium", "firefox", "webkit"]);
  assert.deepEqual(ledger.browserVersions, { chromium: "143.0.7499.4", firefox: "144.0.2" });
  assert.equal(ledger.plan.length, 7);
  assert.equal(ledger.rows.length, 14);
  assert.equal(ledger.rawPartialReport.completedRowCount, 14);
  assert.equal(
    ledger.rawPartialReport.sha256,
    "a39ee42176336c3bee1104d22d156a4006133193501cd88c940b61761b134247",
  );
  assert.equal(new Set(ledger.rows.map((row) => row.identity)).size, 14);
  assert.equal(new Set(ledger.rows.map((row) => row.video.relativeArtifact)).size, 14);
  assert.equal(new Set(ledger.rows.map((row) => row.video.sha256)).size, 14);
  const expectedIdentitySuffixes = [
    "github-raw-relative|css-enter|img|no-preference",
    "github-raw-relative|css-enter|picture|no-preference",
    "github-raw-relative|css-breathe|picture|reduce",
    "worker-camo|css-enter|img|no-preference",
    "worker-camo|css-enter|picture|no-preference",
    "worker-camo|css-breathe|picture|reduce",
    "known-positive-control|positive-control|img|no-preference",
  ];
  assert.deepEqual(
    ledger.rows.map((row) => row.identity).sort(),
    ["chromium", "firefox"].flatMap(
      (engine) => expectedIdentitySuffixes.map((suffix) => `${engine}|${suffix}`),
    ).sort(),
  );

  for (const engine of ["chromium", "firefox"]) {
    assert.deepEqual(
      verdictCounts(ledger.rows.filter((row) => row.engine === engine)),
      { animates: 5, "frozen at frame zero": 2 },
    );
  }

  for (const row of ledger.rows) {
    assert.ok(["chromium", "firefox"].includes(row.engine));
    assert.equal(row.version, ledger.browserVersions[row.engine]);
    assert.ok(["animates", "frozen at frame zero", "frozen at from-state"].includes(row.verdict));
    assert.doesNotThrow(() => new URL(row.currentSource));
    assert.doesNotThrow(() => new URL(row.canonicalSource));
    assert.equal(row.finalResponse.status, 200);
    assert.match(row.finalResponse.contentType, /^image\/svg\+xml(?:;|$)/u);
    assert.match(row.finalResponse.bodySha256, sha256Pattern);
    assert.equal(row.requestGate.interceptionCount, 1);
    for (const timing of [
      row.requestGate.loadTimestampMs,
      row.requestGate.loadToFirstFrameMs,
      row.requestGate.loadToFirstFrameCompleteMs,
    ]) assert.ok(Number.isFinite(timing) && timing >= 0);
    assert.deepEqual(row.frames.map((frame) => frame.targetTimeMs), [0, 250, 500, 2_000, 5_000]);
    assert.equal(row.frames.length, 5);
    for (const frame of row.frames) assert.match(frame.sha256, sha256Pattern);
    assert.equal(row.differences.length, 4);
    assert.ok(row.video.measuredVisibleDurationMs > 3_000);
    assert.equal(row.video.magicHex, "1a45dfa3");
    assert.ok(row.video.fileSizeBytes > 0);
    assert.match(row.video.sha256, sha256Pattern);
    assert.equal(path.isAbsolute(row.video.relativeArtifact), false);
  }

  const aggregateLines = ledger.rows.map((row) => [
    row.identity,
    row.finalResponse.bodySha256,
    ...row.frames.map((frame) => frame.sha256),
    row.video.sha256,
  ].join("\t") + "\n").sort().join("");
  assert.equal(ledger.artifactAggregateSha256, sha256(aggregateLines));
  assert.equal(ledger.failure.engine, "webkit");
  assert.equal(ledger.failure.version, "26.0");
  assert.equal(ledger.failure.status, "not-tested");
  assert.equal(ledger.failure.phase, "discovery");
  assert.deepEqual(ledger.failure.expectedNaturalDimensions, [360, 120]);
  assert.deepEqual(ledger.failure.actualNaturalDimensions, [400, 133]);
  assert.equal(ledger.failure.trackingIssue, "#180");
  assert.match(ledger.failure.message, /must decode the synthetic 360x120 fixture/u);
  assert.equal(ledger.rows.some((row) => row.engine === "webkit"), false);
});

test("GitHub capture fails closed when its timed DOM target is replaced", () => {
  assert.doesNotThrow(() => validateCaptureTargetClip('img[alt="css-enter"]', {
    sameTarget: true, width: 400, height: 133.328125,
  }));
  assert.throws(() => validateCaptureTargetClip('img[alt="css-enter"]', {
    sameTarget: false, width: 400, height: 133.328125,
  }), /same DOM node/u);
  assert.throws(() => validateCaptureTargetClip('img[alt="css-enter"]', {
    sameTarget: true, width: 0, height: 133.328125,
  }), /positive dimensions/u);
});

test("WebKit metadata observation separates pinned body identity from presentation sizing", async () => {
  const observation = await readEvidence("2026-08-30-webkit-metadata.json");
  const expectedHash = sha256(await readFile(path.join(fixtureDirectory, "css-enter.svg")));
  assert.equal(observation.scope, "metadata-only WebKit observation; no screenshots, recordings, or animation verdict");
  assert.deepEqual(observation.browser, { engine: "webkit", version: "26.0", playwright: "1.57.0" });
  assert.ok(observation.source.literal.includes(observation.scratchCommit));
  assert.ok(observation.source.current.includes(observation.scratchCommit));
  assert.ok(observation.source.final.includes(observation.scratchCommit));
  assert.equal(observation.response.redirectStatus, 302);
  assert.equal(observation.response.finalStatus, 200);
  assert.match(observation.response.finalContentType, /^image\/svg\+xml(?:;|$)/u);
  assert.equal(observation.response.finalBodySha256, expectedHash);
  assert.equal(observation.response.fixtureBodySha256, expectedHash);
  assert.equal(observation.response.workerBodySha256, expectedHash);
  assert.deepEqual(observation.dimensions.natural, { width: 400, height: 133 });
  assert.deepEqual(observation.dimensions.rendered, { width: 400, height: 133.328125 });
  assert.match(observation.rawObservationSha256, sha256Pattern);

  const attempt = await readEvidence("2026-08-30-webkit-diagnostic-attempt.json");
  assert.equal(attempt.status, "failed-closed-during-discovery");
  assert.equal(attempt.commitAtlasHead, "6578f1d96b289a23a3694d26b7db4957fe72e44e");
  assert.equal(attempt.plannedRows, 7);
  assert.equal(attempt.completedDiscoveries, 0);
  assert.equal(attempt.completedRows, 0);
  assert.equal(attempt.animationEvidence, "none");
  assert.match(attempt.partialReportSha256, sha256Pattern);
  assert.match(attempt.disposition, /do not rerun/);

  const captureAttempts = await readEvidence("2026-08-30-webkit-capture-attempts.json");
  assert.equal(captureAttempts.scope, "bounded WebKit seven-row capture attempts after exact discovery; no completed rows or animation verdict");
  assert.deepEqual(captureAttempts.browser, { engine: "webkit", version: "26.0", playwright: "1.57.0" });
  assert.equal(captureAttempts.plannedRows, 7);
  assert.equal(captureAttempts.exactDiscovery.status, "complete");
  assert.equal(captureAttempts.exactDiscovery.completedDiscoveries, 7);
  assert.deepEqual(captureAttempts.exactDiscovery.naturalDimensions, { width: 400, height: 133 });
  assert.deepEqual(captureAttempts.exactDiscovery.renderedDimensions, { width: 400, height: 133.328125 });
  assert.equal(captureAttempts.attempts.length, 3);
  for (const captureAttempt of captureAttempts.attempts) {
    assert.equal(captureAttempt.completedDiscoveries, 7);
    assert.equal(captureAttempt.completedRows, 0);
    assert.match(captureAttempt.partialReportSha256, sha256Pattern);
  }
  assert.equal(captureAttempts.animationEvidence, "none");
  assert.match(captureAttempts.unverifiedHead, /^[a-f0-9]{40}$/u);
  assert.match(captureAttempts.unverifiedSafety, /fail-closed timed DOM-node identity/u);
  assert.match(captureAttempts.disposition, /three-attempt ceiling/);
});
