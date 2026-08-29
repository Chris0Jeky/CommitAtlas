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
import { pathToFileURL } from "node:url";
import {
  classifyMotion,
  decodePng,
  frameTimes,
  motionPixelThreshold,
  pixelDifference,
  probes,
  sha256,
  sha256File,
} from "./capture.mjs";

export const githubCommit = "039a0370b1a52fb6135e4414e04a11bff7ba21d0";
export const githubPageUrl = `https://github.com/Chris0Jeky/commitatlas-motion-probes/blob/${githubCommit}/README.md`;
export const verdicts = ["animates", "frozen at frame zero", "frozen at from-state", "not tested"];

const engines = ["chromium", "firefox", "webkit"];
const embeds = ["img", "picture"];
const videoViewport = { width: 720, height: 480 };
const minimumVideoDurationMs = 3_000;
const responseWaitMs = 15_000;

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

export function buildGithubCapturePlan() {
  const rows = [];
  for (const [host, definition] of Object.entries(hosts)) {
    for (const probe of probes) {
      for (const embed of embeds) {
        const alt = definition.alt(probe, embed);
        rows.push({ kind: "probe", host, probe, embed, media: "no-preference", alt, selector: selectorForAlt(alt) });
      }
    }
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
  rows.push({
    kind: "positive-control",
    host: "known-positive-control",
    probe: "positive-control",
    embed: "img",
    media: "no-preference",
    alt: "positive control animation",
    selector: selectorForAlt("positive control animation"),
  });
  return rows;
}

export function parseGithubCaptureOptions(argv) {
  const values = new Map();
  const allowed = new Set(["--playwright-cli", "--playwright-engine", "--out"]);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(name) || value === undefined || value.startsWith("--")) {
      throw new Error("Usage: node tests/motion-probes/capture-github.mjs --playwright-cli <cli.js> --playwright-engine <chromium[,firefox,webkit]> --out <new-absolute-directory>");
    }
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
  return { playwrightCli, outputDirectory, selectedEngines };
}

export function validatePinnedPage(url) {
  assert.equal(url, githubPageUrl, "GitHub navigation must finish at the exact pinned README URL");
  assert.ok(url.includes(githubCommit), "GitHub README URL must retain the full commit pin");
}

function firstUrl(srcset) {
  return srcset.trim().split(/\s+/u)[0];
}

function assertRawUrl(url) {
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "github.com", "relative probe currentSrc must remain on github.com");
  assert.ok(parsed.pathname.includes(`/Chris0Jeky/commitatlas-motion-probes/raw/${githubCommit}/`), "relative probe URL must contain the full raw commit pin");
}

function assertCamoUrl(url) {
  assert.equal(new URL(url).hostname, "camo.githubusercontent.com", "absolute README probe must be Camo-delivered");
}

export function validateTargetMetadata(row, metadata, reducedControl = null) {
  assert.ok(metadata.src, `${row.selector} must retain a source`);
  assert.ok(metadata.currentSrc, `${row.selector} must resolve currentSrc`);
  assert.ok(metadata.canonical, `${row.selector} must expose a canonical source`);
  assert.ok(metadata.naturalWidth > 0 && metadata.naturalHeight > 0, `${row.selector} must decode non-zero image dimensions`);
  if (row.kind !== "positive-control") {
    assert.deepEqual([metadata.naturalWidth, metadata.naturalHeight], [360, 120], `${row.selector} must decode the synthetic 360x120 fixture`);
  }

  if (row.host === "github-raw-relative") {
    assertRawUrl(metadata.currentSrc);
    assertRawUrl(metadata.canonical);
  } else if (row.host === "worker-camo") {
    assertCamoUrl(metadata.currentSrc);
    const canonical = new URL(metadata.canonical);
    assert.equal(canonical.hostname, "commit-atlas.commit-atlas.workers.dev", "Camo canonical source must be the synthetic Worker");
    assert.ok(canonical.pathname.startsWith("/api/v1/probes/motion/"), "Camo canonical source must remain in the fixed probe route");
  } else {
    assertCamoUrl(metadata.currentSrc);
    assert.equal(new URL(metadata.canonical).hostname, "readme-typing-svg.demolab.com", "positive control must retain its public canonical service");
  }

  if (row.embed === "picture") {
    assert.ok(metadata.sources.length >= 2, `${row.selector} must retain picture sources`);
    assert.ok(metadata.sources.some((source) => source.media === "(prefers-reduced-motion: reduce)"), `${row.selector} must retain its reduced-motion source`);
    assert.ok(metadata.sources.some((source) => source.media === "(prefers-color-scheme: dark)"), `${row.selector} must retain its dark-scheme source`);
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
  const expectedRows = buildGithubCapturePlan().length * report.selectedEngines.length;
  assert.equal(report.rows.length, expectedRows, "complete report must contain every planned row for every selected engine");
  const identities = new Set();
  for (const row of report.rows) {
    assert.ok(report.selectedEngines.includes(row.engine), `report row has unselected engine ${row.engine}`);
    const identity = `${row.engine}\0${row.selector}\0${row.media}`;
    assert.ok(!identities.has(identity), `report contains duplicate row ${identity}`);
    identities.add(identity);
    assert.equal(row.page, githubPageUrl, `${identity} must retain the pinned page`);
    assert.equal(row.commit, githubCommit, `${identity} must retain the full commit pin`);
    assert.ok(row.version, `${identity} must identify the browser version`);
    assert.ok(row.currentSrc && row.canonical, `${identity} must retain resolved and canonical sources`);
    assert.ok(row.responseObservation.chain.length > 0, `${identity} must retain its browser-observed response chain`);
    assert.deepEqual(row.frames.map((frame) => frame.targetTimeMs), frameTimes, `${identity} must retain every target frame`);
    for (const frame of row.frames) {
      assert.ok(frame.path, `${identity} frame must retain its relative path`);
      assert.match(frame.sha256, /^[a-f0-9]{64}$/u, `${identity} frame must have a SHA-256`);
      assert.ok(Number.isFinite(frame.actualTimeMs) && Number.isFinite(frame.completedTimeMs), `${identity} frame must retain actual offsets`);
    }
    assert.ok(verdicts.includes(row.verdict) && row.verdict !== "not tested", `${identity} must have a measured verdict`);
    assert.ok(row.video.measuredVisibleDurationMs >= minimumVideoDurationMs, `${identity} video must cover at least three seconds`);
    assert.match(row.video.sha256, /^[a-f0-9]{64}$/u, `${identity} video must have a SHA-256`);
  }
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
      canonical: selectedSource?.canonicalSrcset
        ?? image.getAttribute("data-canonical-src")
        ?? image.closest("a")?.href
        ?? image.currentSrc,
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

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

function relativeFile(outputDirectory, file) {
  return path.relative(outputDirectory, file).replaceAll("\\", "/");
}

async function captureRow(browser, engine, browserVersion, row, outputDirectory) {
  const directory = path.join(outputDirectory, engine, `${row.host}--${row.embed}--${row.probe}--${row.media}`);
  await mkdir(directory, { recursive: true });
  const context = await browser.newContext({
    viewport: videoViewport,
    colorScheme: "dark",
    reducedMotion: row.media === "reduce" ? "reduce" : "no-preference",
    serviceWorkers: "block",
    recordVideo: { dir: directory, size: videoViewport },
  });
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
    await locator.evaluate((image) => image.decode());

    let reducedControl = null;
    if (row.controlSelector) {
      const control = page.locator(row.controlSelector);
      assert.equal(await control.count(), 1, `${row.controlSelector} must match exactly one standalone reduced-motion control`);
      await control.evaluate((image) => image.decode());
      reducedControl = await targetMetadata(control);
    }
    const metadata = await targetMetadata(locator);
    if (row.kind === "reduced-motion-control" && !metadata.selectedSourceCanonical) {
      metadata.canonical = reducedControl.canonical;
    }
    validateTargetMetadata(row, metadata, reducedControl);
    const responses = await responseChain(responseByUrl, metadata.currentSrc);

    const startedAt = await page.evaluate(() => performance.now());
    const frames = [];
    for (const targetTimeMs of frameTimes) {
      const beforeWait = await page.evaluate(() => performance.now());
      await page.waitForTimeout(Math.max(0, targetTimeMs - (beforeWait - startedAt)));
      const actualTimeMs = await page.evaluate(() => performance.now() - startedAt);
      const file = path.join(directory, `${targetTimeMs}.png`);
      await locator.screenshot({ path: file, animations: "allow" });
      const completedTimeMs = await page.evaluate(() => performance.now() - startedAt);
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
    const measuredVisibleDurationMs = await page.evaluate(() => performance.now() - startedAt);
    assert.ok(measuredVisibleDurationMs >= minimumVideoDurationMs, `continuous video must observe at least ${minimumVideoDurationMs} ms`);
    const images = await Promise.all(frames.map(async (frame) => decodePng(await readFile(path.join(outputDirectory, frame.path)))));
    const differences = images.slice(1).map((image, index) => ({
      fromTargetMs: frames[index].targetTimeMs,
      toTargetMs: frames[index + 1].targetTimeMs,
      fromActualMs: frames[index].actualTimeMs,
      toActualMs: frames[index + 1].actualTimeMs,
      ...pixelDifference(images[index], image),
    }));
    const verdict = classifyMotion(row.probe, images, differences);
    if (row.kind === "positive-control") assert.equal(verdict, "animates", "known public positive control must animate");
    if (row.kind === "reduced-motion-control") assert.equal(verdict, "frozen at frame zero", "reduced-motion static source must remain frozen");
    assert.ok(verdicts.includes(verdict), `unexpected verdict ${verdict}`);
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
      differences,
      verdict,
      video: { measuredVisibleDurationMs: Math.round(measuredVisibleDurationMs * 10) / 10 },
    };
  } finally {
    await context.close();
  }

  const generatedVideo = await videoHandle.path();
  const videoFile = path.join(directory, "motion.webm");
  await rename(generatedVideo, videoFile);
  result.video.path = relativeFile(outputDirectory, videoFile);
  result.video.sha256 = await sha256File(videoFile);
  return result;
}

export async function captureGithub(options) {
  await access(options.playwrightCli);
  const playwrightModule = await import(pathToFileURL(path.join(path.dirname(options.playwrightCli), "index.js")).href);
  const playwright = playwrightModule.default ?? playwrightModule;
  await mkdir(options.outputDirectory);
  const partialFile = path.join(options.outputDirectory, "report.partial.json");
  const report = {
    status: "partial",
    protocol: "fresh recorded context per row; decoded element PNGs compared as RGBA at absolute deadlines",
    page: githubPageUrl,
    commit: githubCommit,
    frameTimesMs: frameTimes,
    minimumVideoDurationMs,
    motionPixelThreshold,
    selectedEngines: options.selectedEngines,
    rows: [],
  };
  await writeJsonAtomic(partialFile, report);
  try {
    for (const engine of options.selectedEngines) {
      const browser = await playwright[engine].launch();
      try {
        const browserVersion = browser.version();
        for (const row of buildGithubCapturePlan()) {
          report.rows.push(await captureRow(browser, engine, browserVersion, row, options.outputDirectory));
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
