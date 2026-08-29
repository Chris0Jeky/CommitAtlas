import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildPageUrl, classifyMotion, frameTimes, parseAssetBase, parseCaptureOptions, parseHostLabel } from "./motion-probes/capture.mjs";
import {
  buildGithubCapturePlan,
  githubCommit,
  githubPageUrl,
  parseGithubCaptureOptions,
  selectorForAlt,
  validateCompletedReport,
  validatePinnedPage,
  validateTargetMetadata,
} from "./motion-probes/capture-github.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures", "motion-probes");
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
    "--browser", "browser.exe", "--out", "C:/temp/motion",
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
  assert.throws(() => parseCaptureOptions(["--browser", "browser.exe", "--out", "C:/temp/motion", "--asset-base"]), /asset-base/);
  assert.throws(() => parseCaptureOptions(["--browser", "browser.exe", "--out", "C:/temp/motion", "--host-label"]), /host-label/);
});

test("direct capture video mode is bounded to the supplied Playwright API", () => {
  const options = parseCaptureOptions([
    "--playwright-engine", "firefox", "--playwright-cli", "C:/playwright/cli.js",
    "--record-video", "--out", "C:/temp/motion",
  ]);
  assert.equal(options.recordVideo, true);
  assert.throws(
    () => parseCaptureOptions(["--browser", "browser.exe", "--record-video", "--out", "C:/temp/motion"]),
    /record-video requires/,
  );
});

test("GitHub capture options require a fresh absolute output path and unique supported engines", () => {
  const options = parseGithubCaptureOptions([
    "--playwright-cli", "C:/playwright/cli.js",
    "--playwright-engine", "chromium,webkit",
    "--out", "C:/temp/github-motion",
  ]);
  assert.deepEqual(options.selectedEngines, ["chromium", "webkit"]);
  assert.equal(options.outputDirectory, "C:/temp/github-motion");
  assert.throws(() => parseGithubCaptureOptions([
    "--playwright-cli", "C:/playwright/cli.js", "--playwright-engine", "chromium", "--out", "relative",
  ]), /absolute/);
  assert.throws(() => parseGithubCaptureOptions([
    "--playwright-cli", "C:/playwright/cli.js", "--playwright-engine", "webkit,webkit", "--out", "C:/temp/out",
  ]), /unique/);
  assert.throws(() => parseGithubCaptureOptions([
    "--playwright-cli", "C:/playwright/playwright.cmd", "--playwright-engine", "chromium", "--out", "C:/temp/out",
  ]), /cli\.js/);
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
  const rawUrl = `https://github.com/Chris0Jeky/commitatlas-motion-probes/raw/${githubCommit}/tests/fixtures/motion-probes/css-enter.svg`;
  assert.doesNotThrow(() => validateTargetMetadata(rawRow, {
    src: rawUrl, currentSrc: rawUrl, canonical: rawUrl, sources: [],
    naturalWidth: 360, naturalHeight: 120,
  }));
  assert.doesNotThrow(() => validateTargetMetadata(camoRow, {
    src: "https://camo.githubusercontent.com/hash", currentSrc: "https://camo.githubusercontent.com/hash",
    canonical: "https://commit-atlas.commit-atlas.workers.dev/api/v1/probes/motion/css-enter.svg",
    sources: [], naturalWidth: 360, naturalHeight: 120,
  }));
  assert.throws(() => validateTargetMetadata(rawRow, {
    src: rawUrl, currentSrc: rawUrl.replace(githubCommit, "main"), canonical: rawUrl, sources: [],
    naturalWidth: 360, naturalHeight: 120,
  }), /full raw commit pin/);

  const reducedRow = plan.find((row) => row.kind === "reduced-motion-control" && row.host === "github-raw-relative");
  const reducedUrl = rawUrl.replace("css-enter.svg", "reduced-motion-control.svg");
  assert.doesNotThrow(() => validateTargetMetadata(reducedRow, {
    src: rawUrl.replace("css-enter.svg", "css-breathe.svg"),
    currentSrc: reducedUrl,
    canonical: reducedUrl,
    sources: [
      { media: "(prefers-reduced-motion: reduce)", srcset: reducedUrl, canonicalSrcset: null },
      { media: "(prefers-color-scheme: dark)", srcset: rawUrl.replace("css-enter.svg", "css-breathe.svg"), canonicalSrcset: null },
    ],
    naturalWidth: 360, naturalHeight: 120,
  }, { currentSrc: reducedUrl }));
});

test("frozen from-state is reserved for the opacity-from control", () => {
  const transparentControl = { width: 1, height: 1, rgba: Buffer.from([0, 0, 0, 255]) };
  const differences = [{ changedPixels: 0, totalChannelDelta: 0 }];
  assert.equal(classifyMotion("css-from-state-control", [transparentControl], differences), "frozen at from-state");
  assert.equal(classifyMotion("css-enter", [transparentControl], differences), "frozen at frame zero");
});

test("completed GitHub output requires every frame, measured verdict, and recorded video", () => {
  const selectedEngines = ["chromium"];
  const rows = buildGithubCapturePlan().map((row) => ({
    ...row,
    engine: "chromium",
    version: "1.0",
    page: githubPageUrl,
    commit: githubCommit,
    currentSrc: "https://example.test/current",
    canonical: "https://example.test/canonical",
    responseObservation: { chain: [{ status: 200 }] },
    frames: frameTimes.map((targetTimeMs) => ({
      targetTimeMs, actualTimeMs: targetTimeMs, completedTimeMs: targetTimeMs + 1,
      path: `${targetTimeMs}.png`, sha256: "b".repeat(64),
    })),
    verdict: row.kind === "positive-control" ? "animates" : "frozen at frame zero",
    video: { measuredVisibleDurationMs: 5_000, sha256: "a".repeat(64) },
  }));
  assert.doesNotThrow(() => validateCompletedReport({ selectedEngines, rows }));
  rows[0] = { ...rows[0], video: { ...rows[0].video, measuredVisibleDurationMs: 2_999 } };
  assert.throws(() => validateCompletedReport({ selectedEngines, rows }), /at least three seconds/);
});
