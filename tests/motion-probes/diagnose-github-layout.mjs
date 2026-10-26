/** One metadata-only observation of #180's first rejected selector. Never captures motion. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createFreshOutputDirectory, sha256 } from "./capture.mjs";
import {
  buildGithubCapturePlan, githubCommit, githubPageUrl, resolveCanonical,
  responseChain, targetMetadata, validatePinnedPage, validateResponseChain,
} from "./capture-github.mjs";

export function parseLayoutDiagnosticOptions(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    assert.ok(["--playwright-cli", "--out"].includes(name) && value && !value.startsWith("--") && !values.has(name), "only --playwright-cli and --out are accepted once");
    values.set(name, value);
  }
  const playwrightCli = values.get("--playwright-cli");
  const outputDirectory = values.get("--out");
  assert.ok(playwrightCli && path.isAbsolute(playwrightCli) && path.basename(playwrightCli) === "cli.js", "--playwright-cli must name an absolute cli.js");
  assert.ok(outputDirectory && path.isAbsolute(outputDirectory), "--out must name a new absolute directory");
  return { playwrightCli, outputDirectory };
}

// This function runs in the browser. Keep it self-contained so native WebKit computes every value.
export function inspectTargetLayout(selector) {
  const rect = (element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  };
  const describe = (element) => {
    const style = getComputedStyle(element);
    return {
      tag: element.tagName,
      attributes: Object.fromEntries(["id", "class", "style", "hidden", "inert", "aria-hidden", "role", "data-target", "data-view-component"].map((name) => [name, element.getAttribute(name)])),
      rect: rect(element),
      clientRects: element.getClientRects().length,
      computed: Object.fromEntries(["display", "visibility", "contentVisibility", "contain", "opacity", "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight", "overflow", "position", "transform"].map((name) => [name, style[name]])),
    };
  };
  globalThis.__commitAtlasLayoutNodes ??= [];
  return {
    documentUrl: location.href,
    readyState: document.readyState,
    observedAtMs: performance.now(),
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
    matches: [...document.querySelectorAll(selector)].map((image) => {
      let nodeId = globalThis.__commitAtlasLayoutNodes.indexOf(image);
      if (nodeId < 0) nodeId = globalThis.__commitAtlasLayoutNodes.push(image) - 1;
      const ancestors = [];
      for (let ancestor = image.parentElement; ancestor && ancestors.length < 20; ancestor = ancestor.parentElement) ancestors.push(describe(ancestor));
      return {
        nodeId,
        connected: image.isConnected,
        complete: image.complete,
        natural: { width: image.naturalWidth, height: image.naturalHeight },
        sourceAttributes: Object.fromEntries(["src", "srcset", "sizes", "width", "height", "loading", "decoding", "data-canonical-src"].map((name) => [name, image.getAttribute(name)])),
        currentSrc: image.currentSrc,
        image: describe(image),
        ancestors,
      };
    }),
  };
}

export async function diagnoseGithubLayout(options) {
  await createFreshOutputDirectory(options.outputDirectory);
  const reportFile = path.join(options.outputDirectory, "metadata.json");
  const report = {
    kind: "webkit-selector-layout-metadata-only",
    scope: "one first-selector observation; no screenshots, recordings, request gates, capture rows or motion verdicts",
    observedAt: new Date().toISOString(),
    sourceCommit: process.env.GITHUB_SHA ?? null,
    page: githubPageUrl,
    scratchCommit: githubCommit,
    engine: "webkit",
    playwrightVersion: null,
    browserVersion: null,
    capturesPerformed: 0,
    observations: [],
  };
  const persist = () => writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  await persist();
  let browser;
  try {
    const packageDirectory = path.dirname(options.playwrightCli);
    const packageMetadata = JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8"));
    report.playwrightVersion = packageMetadata.version;
    assert.equal(packageMetadata.version, "1.57.0", "the diagnostic requires the existing 1.57.0 pin");
    const imported = await import(pathToFileURL(path.join(packageDirectory, "index.js")).href);
    const playwright = imported.default ?? imported;
    browser = await playwright.webkit.launch();
    report.browserVersion = browser.version();
    await persist();
    const context = await browser.newContext({ viewport: { width: 720, height: 480 }, colorScheme: "dark", reducedMotion: "no-preference", serviceWorkers: "block" });
    const page = await context.newPage();
    const responses = new Map();
    page.on("response", (response) => {
      if (response.request().resourceType() === "image") responses.set(response.url(), response);
    });
    await page.goto(githubPageUrl, { waitUntil: "domcontentloaded" });
    validatePinnedPage(page.url());
    const [row] = buildGithubCapturePlan({ hosts: ["github-raw-relative"], probes: ["css-enter"], embeds: ["img"], includeReducedControls: false, includePositiveControl: false });
    const observe = async (phase) => {
      report.observations.push({ phase, ...await page.evaluate(inspectTargetLayout, row.selector) });
      await persist();
    };
    await observe("domcontentloaded-before-scroll");
    const locator = page.locator(row.selector);
    assert.equal(await locator.count(), 1, "the exact harness selector must match one image");
    // These are the parked #186 discovery operations; no actionability wait or style mutation.
    await locator.evaluate((image) => image.scrollIntoView({ block: "center" }));
    await locator.evaluate((image) => image.decode());
    await observe("exact-parked-scroll-and-decode");
    const selected = resolveCanonical(row, await targetMetadata(locator));
    report.selected = selected;
    await persist();
    // A second metadata snapshot distinguishes transient hydration from a persistent hidden ancestor.
    try {
      await page.waitForFunction(() => document.readyState === "complete", null, { timeout: 15_000 });
    } catch (error) {
      report.documentCompleteWaitFailure = error instanceof Error ? error.message : String(error);
    }
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await observe("document-complete-and-two-animation-frames");
    report.settledSelected = resolveCanonical(row, await targetMetadata(page.locator(row.selector)));
    await persist();
    const chain = await responseChain(responses, selected.currentSrc);
    const fixture = await readFile(new URL("../fixtures/motion-probes/css-enter.svg", import.meta.url));
    const fixtureSha256 = sha256(fixture);
    report.responseObservation = { chain, fixtureSha256 };
    await persist();
    validateResponseChain(row, selected.currentSrc, chain);
    assert.equal(chain.at(-1).bodySha256, fixtureSha256, "the browser-selected raw body must match the pinned fixture");
    await persist();
    const workerUrl = "https://commit-atlas.commit-atlas.workers.dev/api/v1/probes/motion/css-enter.svg";
    const worker = await context.request.get(workerUrl, { timeout: 15_000 });
    report.workerComparison = { url: worker.url(), status: worker.status(), contentType: worker.headers()["content-type"], bodySha256: sha256(await worker.body()) };
    assert.equal(worker.url(), workerUrl, "Worker comparison must retain the exact probe URL");
    assert.equal(worker.status(), 200, "Worker comparison must return 200");
    assert.match(report.workerComparison.contentType ?? "", /^image\/svg\+xml(?:;|$)/iu);
    assert.equal(report.workerComparison.bodySha256, fixtureSha256, "Worker comparison must match the same fixture");
    report.status = "metadata-complete-no-animation-evidence";
    await persist();
  } catch (error) {
    report.status = "metadata-failed-no-animation-evidence";
    report.failure = error instanceof Error ? error.message : String(error);
    await persist();
    throw error;
  } finally {
    await browser?.close();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await diagnoseGithubLayout(parseLayoutDiagnosticOptions(process.argv.slice(2)));
}
