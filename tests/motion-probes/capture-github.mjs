/**
 * Pinned GitHub README motion measurement for issue #113.
 *
 * The README contains both repository-relative SVGs (GitHub raw delivery) and absolute Worker SVGs
 * (GitHub Camo delivery). Every measured row gets a fresh browser context, five element screenshots,
 * and one continuous WebM. Raw reports are operational evidence and must remain untracked.
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  classifyMotion,
  createFreshOutputDirectory,
  decodePng,
  frameTimes,
  inspectWebmFile,
  motionPixelThreshold,
  pixelDifference,
  probes,
  sha256,
  sha256File,
} from "./capture.mjs";

export const githubCommit = "039a0370b1a52fb6135e4414e04a11bff7ba21d0";
export const githubPageUrl = `https://github.com/Chris0Jeky/commitatlas-motion-probes/blob/${githubCommit}/README.md`;
export const positiveControlUrl = "https://readme-typing-svg.demolab.com?font=Fira+Code&size=20&duration=2500&pause=500&color=22C55E&width=435&lines=CommitAtlas%20motion%20probe%20control";
export const verdicts = ["animates", "frozen at frame zero", "frozen at from-state", "no motion detected", "not tested"];

const engines = ["chromium", "firefox", "webkit"];
const embeds = ["img", "picture"];
const videoViewport = { width: 720, height: 480 };
const minimumVideoDurationMs = 3_000;
const responseWaitMs = 15_000;
const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "motion-probes");
const fixtureHashes = new Map();

const hosts = {
  "github-raw-relative": {
    controlAlt: "reduced-motion-control",
    alt(probe, embed) {
      return embed === "img" ? probe : `raw-picture-${probe}`;
    },
  },
  "worker-camo": {
    controlAlt: "worker-reduced-motion-control",
    alt(probe, embed) {
      return embed === "img" ? `worker-${probe}` : `worker-picture-${probe}`;
    },
  },
};

export function selectorForAlt(alt) {
  if (typeof alt !== "string" || !/^[A-Za-z0-9 -]+$/.test(alt)) throw new Error("image alt is outside the bounded selector vocabulary");
  return `img[alt=${JSON.stringify(alt)}]`;
}

export function buildGithubCapturePlan(filters = {}) {
  const selectedHosts = filters.hosts ?? Object.keys(hosts);
  const selectedProbes = filters.probes ?? probes;
  const selectedEmbeds = filters.embeds ?? embeds;
  const includeReducedControls = filters.includeReducedControls ?? true;
  const includePositiveControl = filters.includePositiveControl ?? true;
  const rows = [];
  for (const [host, definition] of Object.entries(hosts)) {
    if (!selectedHosts.includes(host)) continue;
    for (const probe of selectedProbes) {
      for (const embed of selectedEmbeds) {
        const alt = definition.alt(probe, embed);
        rows.push({ kind: "probe", host, probe, embed, media: "no-preference", alt, selector: selectorForAlt(alt) });
      }
    }
    if (includeReducedControls) {
      const probe = "css-breathe";
      const alt = definition.alt(probe, "picture");
      rows.push({
        kind: "reduced-motion-control",
        host,
        probe,
        embed: "picture",
        media: "reduce",
        alt,
        selector: selectorForAlt(alt),
        controlAlt: definition.controlAlt,
        controlSelector: selectorForAlt(definition.controlAlt),
      });
    }
  }
  if (includePositiveControl) {
    rows.push({
      kind: "positive-control",
      host: "known-positive-control",
      probe: "positive-control",
      embed: "img",
      media: "no-preference",
      alt: "positive control animation",
      selector: selectorForAlt("positive control animation"),
    });
  }
  return rows;
}

export function parseGithubCaptureOptions(argv) {
  const values = new Map();
  const valueOptions = new Set(["--playwright-cli", "--playwright-engine", "--out", "--host", "--probe", "--embed"]);
  const flagOptions = new Set(["--include-positive-control", "--include-reduced-controls"]);
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (flagOptions.has(name)) {
      if (values.has(name)) throw new Error(`${name} may be supplied only once`);
      values.set(name, true);
      continue;
    }
    const value = argv[index + 1];
    if (!valueOptions.has(name) || value === undefined || value.startsWith("--") || values.has(name)) {
      throw new Error("Usage: node tests/motion-probes/capture-github.mjs --playwright-cli <cli.js> --playwright-engine <chromium[,firefox,webkit]> --out <new-absolute-directory> [--host <github-raw-relative|worker-camo>] [--probe <probe>] [--embed <img|picture>] [--include-positive-control] [--include-reduced-controls]");
    }
    index += 1;
    values.set(name, value);
  }
  const playwrightCli = values.get("--playwright-cli");
  const outputDirectory = values.get("--out");
  const selectedEngines = values.get("--playwright-engine")?.split(",").filter(Boolean);
  if (!playwrightCli || path.basename(playwrightCli).toLowerCase() !== "cli.js") {
    throw new Error("--playwright-cli must name the Playwright package's cli.js");
  }
  if (!outputDirectory || !path.isAbsolute(outputDirectory)) throw new Error("--out must be an absolute path to a new directory");
  if (!selectedEngines?.length || !selectedEngines.every((engine) => engines.includes(engine)) || new Set(selectedEngines).size !== selectedEngines.length) {
    throw new Error("--playwright-engine must contain unique comma-separated chromium, firefox, or webkit values");
  }
  const parseSelection = (name, allowed) => {
    const selected = values.get(name)?.split(",").filter(Boolean);
    if (selected && (!selected.length || !selected.every((value) => allowed.includes(value)) || new Set(selected).size !== selected.length)) {
      throw new Error(`${name} must contain unique comma-separated values from: ${allowed.join(", ")}`);
    }
    return selected;
  };
  const selectedHosts = parseSelection("--host", Object.keys(hosts));
  const selectedProbes = parseSelection("--probe", probes);
  const selectedEmbeds = parseSelection("--embed", embeds);
  const diagnostic = Boolean(selectedHosts || selectedProbes || selectedEmbeds);
  const planFilters = {
    hosts: selectedHosts,
    probes: selectedProbes,
    embeds: selectedEmbeds,
    includePositiveControl: diagnostic ? values.has("--include-positive-control") : true,
    includeReducedControls: diagnostic ? values.has("--include-reduced-controls") : true,
  };
  return { playwrightCli, outputDirectory, selectedEngines, planFilters, diagnostic };
}

export function validatePinnedPage(url) {
  assert.equal(url, githubPageUrl, "GitHub navigation must finish at the exact pinned README URL");
  assert.ok(url.includes(githubCommit), "GitHub README URL must retain the full commit pin");
}

export function resolveCanonical(row, metadata, reducedControl = null) {
  if (row.host === "github-raw-relative") return { ...metadata, canonical: metadata.currentSrc };
  if (row.kind === "positive-control") {
    return { ...metadata, canonical: metadata.selectedSourceCanonical ?? metadata.imageCanonical ?? metadata.anchorHref ?? metadata.currentSrc };
  }
  if (row.kind === "reduced-motion-control") {
    return { ...metadata, canonical: metadata.selectedSourceCanonical ?? reducedControl?.canonical ?? metadata.imageCanonical ?? metadata.currentSrc };
  }
  return {
    ...metadata,
    canonical: metadata.selectedSourceCanonical ?? metadata.imageCanonical ?? metadata.currentSrc,
  };
}

function firstUrl(srcset) {
  return srcset.trim().split(/\s+/u)[0];
}

function assertRawUrl(url) {
  const parsed = new URL(url, githubPageUrl);
  assert.equal(parsed.hostname, "github.com", "relative probe currentSrc must remain on github.com");
  assert.ok(parsed.pathname.includes(`/Chris0Jeky/commitatlas-motion-probes/raw/${githubCommit}/`), "relative probe URL must contain the full raw commit pin");
}

function assertCamoUrl(url) {
  assert.equal(new URL(url).hostname, "camo.githubusercontent.com", "absolute README probe must be Camo-delivered");
}

function expectedAssetName(row) {
  return row.kind === "reduced-motion-control" ? "reduced-motion-control.svg" : `${row.probe}.svg`;
}

function assertExactAsset(url, row, label) {
  const parsed = new URL(url, githubPageUrl);
  assert.ok(parsed.pathname.endsWith(`/${expectedAssetName(row)}`), `${row.selector} ${label} must select ${expectedAssetName(row)}`);
}

export function validateTargetMetadata(row, metadata, reducedControl = null) {
  assert.ok(metadata.src, `${row.selector} must retain a source`);
  assert.ok(metadata.currentSrc, `${row.selector} must resolve currentSrc`);
  assert.ok(metadata.canonical, `${row.selector} must expose a canonical source`);
  assert.ok(metadata.naturalWidth > 0 && metadata.naturalHeight > 0, `${row.selector} must decode non-zero image dimensions`);
  if (row.kind !== "positive-control") {
    for (const [name, value, limit] of [
      ["natural width", metadata.naturalWidth, videoViewport.width],
      ["natural height", metadata.naturalHeight, videoViewport.height],
      ["rendered width", metadata.renderedWidth, videoViewport.width],
      ["rendered height", metadata.renderedHeight, videoViewport.height],
    ]) assert.ok(
      Number.isFinite(value) && value > 0 && value <= limit,
      `${row.selector} ${name} must be positive and bounded (observed ${value}, limit ${limit})`,
    );
    assert.ok(Math.abs(metadata.naturalWidth - metadata.naturalHeight * 3) <= 1, `${row.selector} natural dimensions must retain the declared 3:1 aspect within one decoded pixel`);
    assert.ok(Math.abs(metadata.renderedWidth - metadata.renderedHeight * 3) <= 1, `${row.selector} rendered dimensions must retain the declared 3:1 aspect within one rendered pixel`);
  }

  if (row.host === "github-raw-relative") {
    assertRawUrl(metadata.currentSrc);
    assertRawUrl(metadata.canonical);
    assertExactAsset(metadata.currentSrc, row, "currentSrc");
    assertExactAsset(metadata.canonical, row, "canonical source");
  } else if (row.host === "worker-camo") {
    assertCamoUrl(metadata.currentSrc);
    const canonical = new URL(metadata.canonical);
    assert.equal(canonical.hostname, "commit-atlas.commit-atlas.workers.dev", "Camo canonical source must be the synthetic Worker");
    assert.ok(canonical.pathname.startsWith("/api/v1/probes/motion/"), "Camo canonical source must remain in the fixed probe route");
    assertExactAsset(metadata.canonical, row, "canonical source");
  } else {
    assertCamoUrl(metadata.currentSrc);
    assert.equal(new URL(metadata.canonical).href, new URL(positiveControlUrl).href, "positive control must retain its exact configured canonical URL");
  }

  if (row.embed === "picture") {
    assert.ok(metadata.sources.length >= 2, `${row.selector} must retain picture sources`);
    assert.ok(metadata.sources.some((source) => source.media === "(prefers-reduced-motion: reduce)"), `${row.selector} must retain its reduced-motion source`);
    assert.ok(metadata.sources.some((source) => source.media === "(prefers-color-scheme: dark)"), `${row.selector} must retain its dark-scheme source`);
    const selectedSource = metadata.sources.find((source) => source.matches);
    assert.ok(selectedSource, `${row.selector} must identify the selected picture source`);
    for (const source of metadata.sources) {
      const effective = firstUrl(source.srcset);
      if (row.host === "github-raw-relative") {
        assertRawUrl(effective);
        assert.equal(source.canonicalSrcset, null, "relative GitHub source must not invent Camo canonical metadata");
      } else {
        assertCamoUrl(effective);
        assert.ok(source.canonicalSrcset, "Camo picture source must retain GitHub's canonical metadata");
        const canonical = new URL(firstUrl(source.canonicalSrcset));
        assert.equal(canonical.hostname, "commit-atlas.commit-atlas.workers.dev", "Camo picture source canonical must remain on the synthetic Worker");
        assert.ok(canonical.pathname.startsWith("/api/v1/probes/motion/"), "Camo picture source canonical must remain in the fixed probe route");
      }
    }
    assertExactAsset(
      row.host === "github-raw-relative" ? firstUrl(selectedSource.srcset) : firstUrl(selectedSource.canonicalSrcset),
      row,
      "selected picture source",
    );
  } else {
    assert.equal(metadata.sources.length, 0, `${row.selector} must be a plain image embed`);
  }

  if (row.kind === "reduced-motion-control") {
    assert.ok(reducedControl, "reduced-motion row requires its standalone control metadata");
    assert.equal(metadata.currentSrc, reducedControl.currentSrc, "reduced-motion picture must select the same static asset as the host's standalone control");
    assert.ok(metadata.canonical.endsWith("/reduced-motion-control.svg"), "reduced-motion canonical source must select the static control");
  }
}

export function validateCompletedReport(report) {
  const expectedPlan = report.plan ?? buildGithubCapturePlan();
  const expectedRows = expectedPlan.length * report.selectedEngines.length;
  assert.equal(report.rows.length, expectedRows, "complete report must contain every planned row for every selected engine");
  const expectedIdentities = new Set(report.selectedEngines.flatMap((engine) => (
    expectedPlan.map((row) => `${engine}\0${row.selector}\0${row.media}`)
  )));
  const discoveryIdentities = new Set(report.discoveries.map((discovery) => (
    `${discovery.engine}\0${discovery.selector}\0${discovery.media}`
  )));
  assert.equal(report.discoveries.length, expectedIdentities.size, "complete report must retain one discovery per planned engine/media/selector");
  assert.deepEqual(discoveryIdentities, expectedIdentities, "complete report discoveries must match the declared plan exactly");
  for (const discovery of report.discoveries) {
    assert.ok(discovery.version, `${discovery.engine}/${discovery.selector} discovery must identify the browser version`);
    assert.ok(discovery.currentSrc && discovery.canonical, `${discovery.engine}/${discovery.selector} discovery must retain exact source identity`);
    validateResponseChain(
      discovery,
      discovery.currentSrc,
      discovery.responseObservation.chain,
      discovery.expectedBodySha256,
    );
  }
  const identities = new Set();
  for (const row of report.rows) {
    assert.ok(report.selectedEngines.includes(row.engine), `report row has unselected engine ${row.engine}`);
    const identity = `${row.engine}\0${row.selector}\0${row.media}`;
    assert.ok(!identities.has(identity), `report contains duplicate row ${identity}`);
    assert.ok(expectedIdentities.has(identity), `report contains unplanned row ${identity}`);
    identities.add(identity);
    assert.equal(row.page, githubPageUrl, `${identity} must retain the pinned page`);
    assert.equal(row.commit, githubCommit, `${identity} must retain the full commit pin`);
    assert.ok(row.version, `${identity} must identify the browser version`);
    assert.ok(row.currentSrc && row.canonical, `${identity} must retain resolved and canonical sources`);
    assert.equal(row.requestGate.interceptionCount, 1, `${identity} must intercept its exact target request once`);
    assert.equal(row.requestGate.targetUrl, row.currentSrc, `${identity} request gate must use discovered currentSrc`);
    assert.ok(Number.isFinite(row.requestGate.loadTimestampMs), `${identity} must retain the browser load timestamp`);
    assert.ok(Number.isFinite(row.requestGate.loadToFirstFrameMs), `${identity} must record image-load-to-first-frame timing`);
    validateResponseChain(row, row.currentSrc, row.responseObservation.chain);
    assert.deepEqual(row.frames.map((frame) => frame.targetTimeMs), frameTimes, `${identity} must retain every target frame`);
    for (const frame of row.frames) {
      assert.ok(frame.path, `${identity} frame must retain its relative path`);
      assert.match(frame.sha256, /^[a-f0-9]{64}$/u, `${identity} frame must have a SHA-256`);
      assert.ok(Number.isFinite(frame.actualTimeMs) && Number.isFinite(frame.completedTimeMs), `${identity} frame must retain actual offsets`);
    }
    assert.ok(verdicts.includes(row.verdict) && row.verdict !== "not tested", `${identity} must have a measured verdict`);
    assert.ok(row.video.measuredVisibleDurationMs >= minimumVideoDurationMs, `${identity} video must cover at least three seconds`);
    assert.match(row.video.sha256, /^[a-f0-9]{64}$/u, `${identity} video must have a SHA-256`);
    assert.ok(row.video.fileSizeBytes > 4, `${identity} video must retain a non-empty container size`);
    assert.equal(row.video.magicHex, "1a45dfa3", `${identity} video must retain WebM EBML magic`);
    assert.equal(row.video.actualDurationVerified, false, `${identity} must not misstate browser time as parsed media duration`);
    assert.match(row.video.durationBoundary, /WebM container duration is not parsed/u, `${identity} must state the video-duration verification boundary`);
  }
  assert.deepEqual(identities, expectedIdentities, "complete report must match its declared plan exactly");
}

async function targetMetadata(locator) {
  return locator.evaluate((image) => {
    const picture = image.closest("picture");
    const sources = [...(picture?.querySelectorAll("source") ?? [])].map((source) => ({
      media: source.getAttribute("media") ?? "",
      matches: source.media ? matchMedia(source.media).matches : true,
      srcset: source.srcset,
      canonicalSrcset: source.getAttribute("data-canonical-src") ?? source.getAttribute("data-canonical-srcset"),
    }));
    const selectedSource = sources.find((source) => source.matches);
    return {
      src: image.getAttribute("src"),
      currentSrc: image.currentSrc,
      selectedSourceCanonical: selectedSource?.canonicalSrcset ?? null,
      imageCanonical: image.getAttribute("data-canonical-src"),
      anchorHref: image.closest("a")?.href ?? null,
      sources,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: image.getBoundingClientRect().width,
      renderedHeight: image.getBoundingClientRect().height,
    };
  });
}

async function waitForResponse(responseByUrl, url) {
  const deadline = Date.now() + responseWaitMs;
  while (!responseByUrl.has(url) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
  const response = responseByUrl.get(url);
  if (!response) throw new Error(`did not observe image response for ${url}`);
  const failure = await response.finished();
  if (failure) throw new Error(`image response failed for ${url}: ${failure}`);
  return response;
}

async function responseMetadata(response) {
  let bodySha256 = null;
  let bodyError = null;
  try {
    bodySha256 = sha256(await response.body());
  } catch (error) {
    bodyError = error instanceof Error ? error.message : String(error);
  }
  return {
    url: response.url(),
    status: response.status(),
    statusText: response.statusText(),
    headersArray: await response.headersArray(),
    bodySha256,
    bodyError,
    redirectedFrom: response.request().redirectedFrom()?.url() ?? null,
    redirectedTo: response.request().redirectedTo()?.url() ?? null,
  };
}

async function responseChain(responseByUrl, currentSrc) {
  const chain = [];
  let response = await waitForResponse(responseByUrl, currentSrc);
  const seen = new Set();
  while (response && !seen.has(response.url())) {
    seen.add(response.url());
    chain.push(await responseMetadata(response));
    const redirectedTo = response.request().redirectedTo();
    response = redirectedTo ? await waitForResponse(responseByUrl, redirectedTo.url()) : null;
  }
  return chain;
}

export function validateResponseChain(row, currentSrc, chain, expectedBodySha256 = null) {
  assert.ok(chain.length > 0, `${row.selector} must retain an image response`);
  assert.equal(chain[0].url, currentSrc, `${row.selector} response chain must start at currentSrc`);
  if (row.host === "github-raw-relative") {
    assert.ok(chain.length >= 2, `${row.selector} must retain the GitHub raw redirect chain`);
    assert.ok(chain[0].status >= 300 && chain[0].status < 400, `${row.selector} raw entry response must redirect`);
    assert.equal(new URL(chain.at(-1).url).hostname, "raw.githubusercontent.com", `${row.selector} raw redirect must finish on raw.githubusercontent.com`);
    assert.ok(new URL(chain.at(-1).url).pathname.includes(`/${githubCommit}/`), `${row.selector} raw redirect must retain the full commit pin`);
    assertExactAsset(chain.at(-1).url, row, "final response");
  }
  const finalResponse = chain.at(-1);
  assert.equal(finalResponse.status, 200, `${row.selector} final image response must be 200`);
  const contentType = finalResponse.headersArray.find((header) => header.name.toLowerCase() === "content-type")?.value;
  assert.match(contentType ?? "", /^image\/svg\+xml(?:;|$)/iu, `${row.selector} final response must be SVG`);
  assert.match(finalResponse.bodySha256 ?? "", /^[a-f0-9]{64}$/u, `${row.selector} final SVG body must have a SHA-256`);
  assert.equal(finalResponse.bodyError, null, `${row.selector} final SVG body hashing must succeed`);
  if (expectedBodySha256) assert.equal(finalResponse.bodySha256, expectedBodySha256, `${row.selector} final SVG body must match the pinned synthetic fixture`);
}

async function expectedBodySha256(row) {
  if (row.kind === "positive-control") return null;
  const asset = expectedAssetName(row);
  if (!fixtureHashes.has(asset)) fixtureHashes.set(asset, sha256(await readFile(path.join(fixtureDirectory, asset))));
  return fixtureHashes.get(asset);
}

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

function relativeFile(outputDirectory, file) {
  return path.relative(outputDirectory, file).replaceAll("\\", "/");
}

function discoveryIdentity(row) {
  return `${row.media}\0${row.selector}`;
}

async function withTimeout(promise, timeoutMs, label) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function readRowMetadata(page, row, locator) {
  let reducedControl = null;
  if (row.controlSelector) {
    const control = page.locator(row.controlSelector);
    assert.equal(await control.count(), 1, `${row.controlSelector} must match exactly one standalone reduced-motion control`);
    await control.evaluate((image) => image.decode());
    reducedControl = resolveCanonical(
      { ...row, kind: "standalone-control", embed: "img" },
      await targetMetadata(control),
    );
  }
  const metadata = resolveCanonical(row, await targetMetadata(locator), reducedControl);
  validateTargetMetadata(row, metadata, reducedControl);
  return { metadata, reducedControl };
}

async function discoverTargets(browser, engine, browserVersion, plan) {
  const discoveries = [];
  for (const media of new Set(plan.map((row) => row.media))) {
    const context = await browser.newContext({
      viewport: videoViewport,
      colorScheme: "dark",
      reducedMotion: media === "reduce" ? "reduce" : "no-preference",
      serviceWorkers: "block",
    });
    try {
      const page = await context.newPage();
      const responseByUrl = new Map();
      page.on("response", (response) => {
        if (response.request().resourceType() === "image") responseByUrl.set(response.url(), response);
      });
      await page.goto(githubPageUrl, { waitUntil: "domcontentloaded" });
      validatePinnedPage(page.url());
      for (const row of plan.filter((candidate) => candidate.media === media)) {
        const locator = page.locator(row.selector);
        assert.equal(await locator.count(), 1, `${row.selector} must match exactly one image during discovery`);
        await locator.scrollIntoViewIfNeeded();
        await locator.evaluate((image) => image.decode());
        const { metadata } = await readRowMetadata(page, row, locator);
        const responses = await responseChain(responseByUrl, metadata.currentSrc);
        const expectedHash = await expectedBodySha256(row);
        validateResponseChain(row, metadata.currentSrc, responses, expectedHash);
        discoveries.push({
          engine,
          version: browserVersion,
          kind: row.kind,
          host: row.host,
          probe: row.probe,
          embed: row.embed,
          media,
          selector: row.selector,
          currentSrc: metadata.currentSrc,
          canonical: metadata.canonical,
          sources: metadata.sources,
          dimensions: {
            natural: { width: metadata.naturalWidth, height: metadata.naturalHeight },
            rendered: { width: metadata.renderedWidth, height: metadata.renderedHeight },
          },
          expectedBodySha256: expectedHash,
          responseObservation: {
            kind: "discovery-time Playwright browser-observed headersArray and body hash",
            chain: responses,
          },
        });
      }
    } finally {
      await context.close();
    }
  }
  return discoveries;
}

async function createRequestGate(context, targetUrl) {
  let interceptionCount = 0;
  let releaseGate;
  let reportFirstInterception;
  const released = new Promise((resolve) => { releaseGate = resolve; });
  const firstInterception = new Promise((resolve) => { reportFirstInterception = resolve; });
  await context.route((url) => url.href === targetUrl, async (route) => {
    interceptionCount += 1;
    reportFirstInterception();
    await released;
    await route.continue();
  });
  let didRelease = false;
  return {
    targetUrl,
    async waitForInterception() {
      await withTimeout(firstInterception, responseWaitMs, `request gate for ${targetUrl}`);
    },
    release() {
      if (!didRelease) {
        didRelease = true;
        releaseGate();
      }
    },
    count() {
      return interceptionCount;
    },
  };
}

async function captureRow(browser, engine, browserVersion, row, discovery, outputDirectory) {
  const directory = path.join(outputDirectory, engine, `${row.host}--${row.embed}--${row.probe}--${row.media}`);
  await mkdir(directory, { recursive: true });
  const context = await browser.newContext({
    viewport: videoViewport,
    colorScheme: "dark",
    reducedMotion: row.media === "reduce" ? "reduce" : "no-preference",
    serviceWorkers: "block",
    recordVideo: { dir: directory, size: videoViewport },
  });
  const gate = await createRequestGate(context, discovery.currentSrc);
  const page = await context.newPage();
  const videoHandle = page.video();
  const responseByUrl = new Map();
  page.on("response", (response) => {
    if (response.request().resourceType() === "image") responseByUrl.set(response.url(), response);
  });

  let result;
  try {
    await page.goto(githubPageUrl, { waitUntil: "domcontentloaded" });
    validatePinnedPage(page.url());
    const locator = page.locator(row.selector);
    assert.equal(await locator.count(), 1, `${row.selector} must match exactly one image`);
    await locator.scrollIntoViewIfNeeded();
    await locator.evaluate((image) => image.scrollIntoView({ block: "center", inline: "center" }));
    await gate.waitForInterception();
    assert.equal(gate.count(), 1, `${row.selector} target request gate must intercept exactly once before release`);
    const wasComplete = await locator.evaluate((image) => {
      if (image.complete) return true;
      image.__commitAtlasLoad = new Promise((resolve) => {
        image.addEventListener("load", () => resolve({ loadedAt: performance.now(), error: null }), { once: true });
        image.addEventListener("error", () => resolve({ loadedAt: performance.now(), error: "image load failed" }), { once: true });
      });
      return false;
    });
    assert.equal(wasComplete, false, `${row.selector} must remain unloaded while its exact request is gated`);
    const loadResultPromise = locator.evaluate((image) => image.__commitAtlasLoad);
    gate.release();
    const loadResult = await withTimeout(loadResultPromise, responseWaitMs, `${row.selector} image load`);
    assert.equal(loadResult.error, null, `${row.selector} must load successfully after gate release`);
    await locator.evaluate((image) => image.decode());

    const loadedAt = loadResult.loadedAt;
    const frames = [];
    for (const targetTimeMs of frameTimes) {
      const beforeWait = await page.evaluate(() => performance.now());
      await page.waitForTimeout(Math.max(0, targetTimeMs - (beforeWait - loadedAt)));
      const actualTimeMs = await page.evaluate((anchor) => performance.now() - anchor, loadedAt);
      const file = path.join(directory, `${targetTimeMs}.png`);
      await locator.screenshot({ path: file, animations: "allow" });
      const completedTimeMs = await page.evaluate((anchor) => performance.now() - anchor, loadedAt);
      if (row.probe === "css-enter" && targetTimeMs === 250 && completedTimeMs > 440) {
        throw new Error(`css-enter 250 ms capture missed its 440 ms observation window (${completedTimeMs.toFixed(1)} ms at completion)`);
      }
      frames.push({
        targetTimeMs,
        actualTimeMs: Math.round(actualTimeMs * 10) / 10,
        completedTimeMs: Math.round(completedTimeMs * 10) / 10,
        path: relativeFile(outputDirectory, file),
        sha256: await sha256File(file),
      });
    }
    const measuredVisibleDurationMs = await page.evaluate((anchor) => performance.now() - anchor, loadedAt);
    assert.ok(measuredVisibleDurationMs >= minimumVideoDurationMs, `continuous video must observe at least ${minimumVideoDurationMs} ms`);
    const images = await Promise.all(frames.map(async (frame) => decodePng(await readFile(path.join(outputDirectory, frame.path)))));
    const differences = images.slice(1).map((image, index) => ({
      fromTargetMs: frames[index].targetTimeMs,
      toTargetMs: frames[index + 1].targetTimeMs,
      fromActualMs: frames[index].actualTimeMs,
      toActualMs: frames[index + 1].actualTimeMs,
      ...pixelDifference(images[index], image),
    }));
    const verdict = classifyMotion(row.probe, images, differences, {
      frameZeroReferenceVerified: row.kind === "reduced-motion-control",
    });
    if (row.kind === "positive-control") assert.equal(verdict, "animates", "known public positive control must animate");
    if (row.kind === "reduced-motion-control") assert.equal(verdict, "frozen at frame zero", "reduced-motion static source must remain frozen");
    assert.ok(verdicts.includes(verdict), `unexpected verdict ${verdict}`);
    const { metadata } = await readRowMetadata(page, row, locator);
    assert.equal(metadata.currentSrc, discovery.currentSrc, `${row.selector} measured currentSrc must match engine/media discovery`);
    const responses = await responseChain(responseByUrl, metadata.currentSrc);
    validateResponseChain(row, metadata.currentSrc, responses, discovery.expectedBodySha256);
    assert.equal(gate.count(), 1, `${row.selector} target request gate must intercept exactly once`);
    result = {
      ...row,
      page: githubPageUrl,
      commit: githubCommit,
      engine,
      version: browserVersion,
      browserVersion,
      selector: row.selector,
      src: metadata.src,
      currentSrc: metadata.currentSrc,
      canonical: metadata.canonical,
      sources: metadata.sources,
      dimensions: {
        natural: { width: metadata.naturalWidth, height: metadata.naturalHeight },
        rendered: { width: metadata.renderedWidth, height: metadata.renderedHeight },
      },
      responseObservation: {
        kind: "Playwright browser-observed headersArray, not raw wire headers",
        chain: responses,
      },
      frames,
      requestGate: {
        targetUrl: gate.targetUrl,
        interceptionCount: gate.count(),
        loadTimestampMs: Math.round(loadedAt * 10) / 10,
        loadToFirstFrameMs: frames[0].actualTimeMs,
        loadToFirstFrameCompleteMs: frames[0].completedTimeMs,
      },
      differences,
      verdict,
      video: { measuredVisibleDurationMs: Math.round(measuredVisibleDurationMs * 10) / 10 },
    };
  } finally {
    gate.release();
    await context.close();
  }

  const generatedVideo = await videoHandle.path();
  const videoFile = path.join(directory, "motion.webm");
  await rename(generatedVideo, videoFile);
  result.video.path = relativeFile(outputDirectory, videoFile);
  Object.assign(result.video, await inspectWebmFile(videoFile));
  return result;
}

export async function captureGithub(options) {
  await createFreshOutputDirectory(options.outputDirectory);
  await access(options.playwrightCli);
  const playwrightModule = await import(pathToFileURL(path.join(path.dirname(options.playwrightCli), "index.js")).href);
  const playwright = playwrightModule.default ?? playwrightModule;
  const plan = buildGithubCapturePlan(options.planFilters);
  const partialFile = path.join(options.outputDirectory, "report.partial.json");
  const report = {
    status: "partial",
    protocol: "engine/media discovery followed by an exact request-gated fresh recorded context per row; decoded element PNGs compared as RGBA at image-load-relative deadlines",
    page: githubPageUrl,
    commit: githubCommit,
    frameTimesMs: frameTimes,
    minimumVideoDurationMs,
    motionPixelThreshold,
    selectedEngines: options.selectedEngines,
    diagnostic: options.diagnostic ?? false,
    plan,
    discoveries: [],
    rows: [],
  };
  await writeJsonAtomic(partialFile, report);
  try {
    for (const engine of options.selectedEngines) {
      const browser = await playwright[engine].launch();
      try {
        const browserVersion = browser.version();
        const discoveries = await discoverTargets(browser, engine, browserVersion, plan);
        report.discoveries.push(...discoveries);
        await writeJsonAtomic(partialFile, report);
        const discoveryMap = new Map(discoveries.map((discovery) => (
          [`${discovery.media}\0${discovery.selector}`, discovery]
        )));
        for (const row of plan) {
          const discovery = discoveryMap.get(discoveryIdentity(row));
          assert.ok(discovery, `missing ${engine} discovery for ${discoveryIdentity(row)}`);
          report.rows.push(await captureRow(browser, engine, browserVersion, row, discovery, options.outputDirectory));
          await writeJsonAtomic(partialFile, report);
        }
      } finally {
        await browser.close();
      }
    }
    validateCompletedReport(report);
    report.status = "complete";
    await writeJsonAtomic(path.join(options.outputDirectory, "report.json"), report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    report.failure = error instanceof Error ? error.message : String(error);
    await writeJsonAtomic(partialFile, report);
    throw error;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await captureGithub(parseGithubCaptureOptions(process.argv.slice(2)));
}
