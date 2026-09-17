/**
 * Local, direct-SVG motion measurement for issue #113.
 *
 * It intentionally does not emulate GitHub's Camo proxy or sanitizer. Serve the fixture directory
 * locally, render every probe as <img> and <picture>, capture independent browser frames, and
 * compare decoded RGBA pixels. A changed PNG byte stream is not evidence; a changed pixel is.
 *
 * Example:
 *   node tests/motion-probes/capture.mjs --browser "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --out C:\\temp\\commitatlas-motion
 *   node tests/motion-probes/capture.mjs --browser "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --asset-base https://example.invalid/probes/ --host-label worker-direct --out C:\\temp\\commitatlas-motion
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const probes = [
  "css-enter", "css-breathe", "css-plot", "css-from-state-control",
  "smil-transform", "smil-plot", "smil-animate-motion", "css-offset-path",
];
const embeds = ["img", "picture"];
const playwrightEngines = ["chromium", "firefox", "webkit"];
const directVerdicts = new Set([
  "animates",
  "frozen at frame zero",
  "frozen at from-state",
  "no motion detected",
]);
// A 250 ms frame sits inside the shipped CSS-enter effect (60 ms delay + 380 ms duration).
export const frameTimes = [0, 250, 500, 2_000, 5_000];
export const motionPixelThreshold = { changedPixels: 16, totalChannelDelta: 1_000 };
const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "motion-probes");
const maxHostLabelLength = 64;

export function parseAssetBase(value) {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length === 0) throw new Error("--asset-base must be a non-empty absolute HTTPS base URL");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("--asset-base must be a non-empty absolute HTTPS base URL");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.pathname.endsWith("/")) {
    throw new Error("--asset-base must be a bare HTTPS base URL ending in /, without credentials, query, or fragment");
  }
  return value;
}

export function parseHostLabel(value) {
  if (value === undefined) return "local-direct";
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value) || value.length > maxHostLabelLength) {
    throw new Error(`--host-label must be 1-${maxHostLabelLength} ASCII letters, numbers, ., _, or -`);
  }
  return value;
}

export function buildPageUrl(origin, embed, probe, assetBase) {
  const page = new URL(`${embed}/${probe}`, origin);
  if (assetBase) page.searchParams.set("assetBase", assetBase);
  return page.href;
}

export function parseCaptureOptions(argv) {
  const argumentsMap = new Map();
  const valueOptions = new Set([
    "--browser", "--playwright-engine", "--playwright-cli", "--out",
    "--probe", "--embed", "--asset-base", "--host-label",
  ]);
  const flagOptions = new Set(["--reduced-motion", "--record-video"]);
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (flagOptions.has(name)) {
      if (argumentsMap.has(name)) throw new Error(`${name} may be supplied only once`);
      argumentsMap.set(name, true);
      continue;
    }
    const value = argv[index + 1];
    if (!valueOptions.has(name)) throw new Error(`unknown option: ${name}`);
    if (argumentsMap.has(name)) throw new Error(`${name} may be supplied only once`);
    if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a value`);
    argumentsMap.set(name, value);
    index += 1;
  }
  const browser = argumentsMap.get("--browser");
  const playwrightEngine = argumentsMap.get("--playwright-engine");
  const playwrightCli = argumentsMap.get("--playwright-cli");
  const reducedMotion = argumentsMap.has("--reduced-motion");
  const recordVideo = argumentsMap.has("--record-video");
  const outputDirectory = argumentsMap.get("--out");
  if ((!browser && !playwrightEngine) || !outputDirectory || !path.isAbsolute(outputDirectory) || (browser && playwrightEngine)) {
    throw new Error("Usage: node tests/motion-probes/capture.mjs (--browser <chromium-exe> | --playwright-engine <chromium|firefox|webkit>) --out <absolute-output-directory>");
  }
  const parseSelection = (name, allowed) => {
    const selected = argumentsMap.has(name) ? argumentsMap.get(name).split(",").filter(Boolean) : allowed;
    if (!selected.length || !selected.every((value) => allowed.includes(value)) || new Set(selected).size !== selected.length) {
      throw new Error(`${name} must contain unique comma-separated values from: ${allowed.join(", ")}`);
    }
    return selected;
  };
  const selectedProbes = parseSelection("--probe", probes);
  const selectedEmbeds = parseSelection("--embed", embeds);
  if (playwrightCli && !playwrightEngine) {
    throw new Error("--playwright-cli requires --playwright-engine");
  }
  if (reducedMotion && (!playwrightEngine || !playwrightCli)) {
    throw new Error("--reduced-motion requires --playwright-engine and --playwright-cli so no dependency is installed");
  }
  if (recordVideo && (!playwrightEngine || !playwrightCli)) {
    throw new Error("--record-video requires --playwright-engine and --playwright-cli so one continuous Playwright context can be recorded");
  }
  if (playwrightEngine && !playwrightEngines.includes(playwrightEngine)) {
    throw new Error("--playwright-engine must be chromium, firefox, or webkit");
  }
  if (playwrightCli && path.basename(playwrightCli).toLowerCase() !== "cli.js") {
    throw new Error("--playwright-cli must be the Playwright package's cli.js, not a Windows .cmd launcher");
  }
  const assetBaseArgument = argumentsMap.get("--asset-base");
  const hostLabelArgument = argumentsMap.get("--host-label");
  if (argumentsMap.has("--asset-base") && assetBaseArgument === undefined) {
    throw new Error("--asset-base must be a non-empty absolute HTTPS base URL");
  }
  if (argumentsMap.has("--host-label") && hostLabelArgument === undefined) {
    throw new Error(`--host-label must be 1-${maxHostLabelLength} ASCII letters, numbers, ., _, or -`);
  }
  const assetBase = parseAssetBase(assetBaseArgument);
  if (assetBase && (!playwrightEngine || !playwrightCli)) {
    throw new Error("--asset-base requires --playwright-engine and --playwright-cli so the browser response can be bound to the report");
  }
  return {
    browser,
    playwrightEngine,
    playwrightCli,
    reducedMotion,
    recordVideo,
    outputDirectory,
    selectedProbes,
    selectedEmbeds,
    assetBase,
    hostLabel: parseHostLabel(hostLabelArgument),
  };
}

export async function createFreshOutputDirectory(outputDirectory) {
  if (!path.isAbsolute(outputDirectory)) throw new Error("--out must be an absolute path to a new directory");
  try {
    await mkdir(outputDirectory);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("--out must name a new directory; refusing to reuse existing output");
    throw error;
  }
}

export function compatibilityEvidenceStatus(browserVersion, complete = false) {
  if (!complete) {
    return {
      eligible: false,
      browserVersion: browserVersion ?? null,
      reason: "capture run is incomplete; a partial report is a structural observation, not compatibility evidence",
    };
  }
  return browserVersion
    ? { eligible: true, browserVersion }
    : {
        eligible: false,
        browserVersion: null,
        reason: "exact browser version unavailable; report is a structural observation, not compatibility evidence",
      };
}

// A plain <img> row can never select the reduced-motion source, and several probe fixtures paint
// the control's own #ffd166. The frame-zero reference is therefore verified from the source the
// browser actually selected, never from a colour count alone.
export function reducedMotionControlSelected(selectedSource) {
  if (typeof selectedSource !== "string" || selectedSource.length === 0) return false;
  let parsed;
  try {
    parsed = new URL(selectedSource);
  } catch {
    return false;
  }
  return parsed.pathname.endsWith("/reduced-motion-control.svg");
}

export function directReducedMotionEvidence(reducedMotion, selectedSource, reducedMotionControlPixels) {
  if (reducedMotion && (typeof selectedSource !== "string" || selectedSource.length === 0)) {
    throw new Error("reduced-motion direct capture must retain the browser-selected currentSrc");
  }
  return {
    reducedMotionControlPixels,
    reducedMotionControlVerified: Boolean(
      reducedMotion
      && reducedMotionControlSelected(selectedSource)
      && reducedMotionControlPixels > 0
    ),
  };
}

export function validateCompletedDirectReport(report) {
  assert.ok(Array.isArray(report.selectedProbes) && report.selectedProbes.length > 0, "complete direct report must declare selected probes");
  assert.ok(Array.isArray(report.selectedEmbeds) && report.selectedEmbeds.length > 0, "complete direct report must declare selected embeds");
  const expectedIdentities = new Set(report.selectedProbes.flatMap((probe) => (
    report.selectedEmbeds.map((embed) => `${probe}\0${embed}`)
  )));
  assert.equal(
    report.rows.length,
    expectedIdentities.size,
    "complete direct report must contain every selected probe/embed row",
  );
  const identities = new Set();
  for (const row of report.rows) {
    const identity = `${row.probe}\0${row.embed}`;
    assert.ok(!identities.has(identity), `duplicate direct capture row ${identity}`);
    assert.ok(expectedIdentities.has(identity), `unselected direct capture row ${identity}`);
    identities.add(identity);
    assert.ok(row.engine, `${identity} must retain the browser engine`);
    assert.deepEqual(
      row.captures.map((capture) => capture.targetTimeMs ?? capture.timeMs),
      frameTimes,
      `${identity} must retain every target frame`,
    );
    assert.equal(
      row.differences.length,
      frameTimes.length - 1,
      `${identity} must retain every adjacent frame comparison`,
    );
    assert.ok(directVerdicts.has(row.verdict), `${identity} must retain a measured verdict`);
    if (report.reducedMotion) {
      assert.ok(row.selectedSource, `${identity} reduced-motion row must retain currentSrc`);
    }
    if (report.recordVideo) {
      assert.ok(row.video?.path, `${identity} recorded row must retain its video path`);
      assert.match(row.video?.sha256 ?? "", /^[a-f0-9]{64}$/u, `${identity} recorded row must retain its video SHA-256`);
    }
    if (report.assetBase) {
      const expectedAsset = expectedHostedAssetName(row.probe, row.embed, report.reducedMotion);
      const expectedUrl = new URL(`${expectedAsset}.svg`, report.assetBase).href;
      const preflight = report.hostedAssetObservations?.find((observation) => observation.probe === expectedAsset);
      const observation = row.browserHostedAssetObservation;
      assert.ok(preflight, `${identity} must retain the hosted asset preflight`);
      assert.ok(observation, `${identity} must retain a browser-bound hosted asset observation`);
      assert.equal(row.selectedSource, expectedUrl, `${identity} currentSrc must match the browser-bound hosted asset URL`);
      assert.equal(observation.asset, expectedAsset, `${identity} browser observation must identify the selected hosted asset`);
      assert.equal(observation.url, expectedUrl, `${identity} browser observation must retain the selected hosted URL`);
      assert.equal(observation.status, 200, `${identity} browser-observed hosted asset must return 200`);
      assert.match(observation.contentType ?? "", /^image\/svg\+xml(?:;|$)/iu, `${identity} browser-observed hosted asset must be SVG`);
      assert.match(observation.bodySha256 ?? "", /^[a-f0-9]{64}$/u, `${identity} browser observation must retain a SHA-256`);
      assert.equal(
        observation.bodySha256,
        preflight.bodySha256,
        `${identity} browser-observed body must match the preflight fixture SHA-256`,
      );
      assert.equal(
        observation.interceptionCount,
        report.recordVideo ? 1 : frameTimes.length,
        `${identity} browser observation must bind every rendered request`,
      );
    }
  }
  assert.deepEqual(identities, expectedIdentities, "complete direct report must match its selected probe/embed matrix exactly");
}

function svgDimensions(body) {
  const root = body.match(/^<svg\b[^>]*>/u)?.[0] ?? "";
  const width = Number(root.match(/\bwidth="([0-9]+)"/u)?.[1]);
  const height = Number(root.match(/\bheight="([0-9]+)"/u)?.[1]);
  return { width, height };
}

export async function validateHostedAssetResponse(probe, response, expectedBody) {
  if (!response.ok || response.status !== 200) throw new Error(`${probe} hosted asset must return 200`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^image\/svg\+xml(?:;|$)/iu.test(contentType)) throw new Error(`${probe} hosted asset must be image/svg+xml`);
  const body = Buffer.from(await response.arrayBuffer());
  const expectedHash = sha256(expectedBody);
  if (sha256(body) !== expectedHash) throw new Error(`${probe} hosted asset body must match the synthetic fixture SHA-256`);
  const dimensions = svgDimensions(body.toString("utf8"));
  if (dimensions.width !== 360 || dimensions.height !== 120) throw new Error(`${probe} hosted asset must declare bounded 360x120 dimensions`);
  return { probe, status: response.status, contentType, bodySha256: expectedHash, ...dimensions };
}

export async function validateHostedAssets(assetBase, selectedProbes, reducedMotion, fetchImpl = fetch) {
  if (!assetBase) return [];
  const assetNames = [...new Set([...selectedProbes, ...(reducedMotion ? ["reduced-motion-control"] : [])])];
  const observations = [];
  for (const probe of assetNames) {
    const expectedBody = await readFile(path.join(fixtureDirectory, `${probe}.svg`));
    const response = await fetchImpl(new URL(`${probe}.svg`, assetBase), { redirect: "error" });
    observations.push(await validateHostedAssetResponse(probe, response, expectedBody));
  }
  return observations;
}

export function expectedHostedAssetName(probe, embed, reducedMotion) {
  return reducedMotion && embed === "picture" ? "reduced-motion-control" : probe;
}

export async function fulfillValidatedHostedAssetRoute(route, options) {
  const { asset, targetUrl, expectedBodySha256 } = options;
  const response = await route.fetch({ maxRedirects: 0 });
  const responseUrl = response.url();
  const status = response.status();
  const contentType = (await response.headerValue("content-type")) ?? "";
  const body = Buffer.from(await response.body());
  if (responseUrl !== targetUrl) throw new Error(`${asset} browser response URL must match the selected hosted asset URL`);
  if (status !== 200) throw new Error(`${asset} browser-observed hosted asset must return 200`);
  if (!/^image\/svg\+xml(?:;|$)/iu.test(contentType)) throw new Error(`${asset} browser-observed hosted asset must be image/svg+xml`);
  const bodySha256 = sha256(body);
  if (bodySha256 !== expectedBodySha256) {
    throw new Error(`${asset} browser-rendered body must match the synthetic fixture SHA-256`);
  }
  await route.fulfill({ response, body });
  return { asset, url: responseUrl, status, contentType, bodySha256 };
}

export function summarizeBrowserHostedAssetObservations(observations) {
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new Error("hosted capture must retain at least one browser response observation");
  }
  const [first, ...remaining] = observations;
  for (const observation of remaining) {
    assert.deepEqual(observation, first, "every rendered request in a row must use the same response identity");
  }
  return { ...first, interceptionCount: observations.length };
}

async function createHostedAssetRequestGate(context, options) {
  let interceptionCount = 0;
  let observation = null;
  let failure = null;
  await context.route(options.targetUrl, async (route) => {
    interceptionCount += 1;
    if (interceptionCount > 1) {
      failure ??= new Error(`${options.asset} hosted asset request was intercepted more than once in one browser context`);
      await route.abort().catch(() => {});
      return;
    }
    try {
      observation = await fulfillValidatedHostedAssetRoute(route, options);
    } catch (error) {
      failure = error;
      await route.abort().catch(() => {});
    }
  });
  return {
    throwFailure() {
      if (failure) throw failure;
    },
    assertComplete() {
      if (failure) throw failure;
      if (interceptionCount !== 1 || !observation) {
        throw new Error(`${options.asset} hosted asset request was not observed exactly once by the browser`);
      }
      return observation;
    },
  };
}

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

export async function writePartialDirectReport(file, report, error) {
  const partialReport = error === undefined
    ? report
    : { ...report, failure: error instanceof Error ? error.message : String(error) };
  await writeJsonAtomic(file, partialReport);
}

export async function capture(options) {
  const { browser, playwrightEngine, playwrightCli, reducedMotion, recordVideo, outputDirectory, selectedProbes, selectedEmbeds, assetBase, hostLabel } = options;
  await createFreshOutputDirectory(outputDirectory);
  const hostedAssetObservations = await validateHostedAssets(assetBase, selectedProbes, reducedMotion);
  const hostedAssetsByName = new Map(hostedAssetObservations.map((observation) => [observation.probe, observation]));
  if (playwrightCli) await access(playwrightCli);
  const playwrightModule = playwrightCli && (reducedMotion || recordVideo || assetBase)
    ? await import(pathToFileURL(path.join(path.dirname(playwrightCli), "index.js")).href)
    : null;
  const playwright = playwrightModule?.default ?? playwrightModule;
  const recordedBrowser = recordVideo ? await playwright[playwrightEngine].launch() : null;

  const server = createServer(async (request, response) => {
  const requestPath = new URL(request.url ?? "/", "http://localhost").pathname;
  const relative = requestPath === "/" || /^\/(?:img|picture)\/[^/]+$/.test(requestPath)
    ? "index.html"
    : requestPath.replace(/^\/+/, "");
  const candidate = path.resolve(fixtureDirectory, relative);
  if (!candidate.startsWith(`${fixtureDirectory}${path.sep}`) && candidate !== path.join(fixtureDirectory, "index.html")) {
    response.writeHead(400).end("invalid fixture path");
    return;
  }
  try {
    const body = await readFile(candidate);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": candidate.endsWith(".svg") ? "image/svg+xml; charset=utf-8" : "text/html; charset=utf-8",
    }).end(body);
  } catch {
    response.writeHead(404).end("missing fixture");
  }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not bind a TCP port");
  const origin = `http://127.0.0.1:${address.port}/`;

  const browserVersion = recordedBrowser?.version() ?? null;
  const partialFile = path.join(outputDirectory, "report.partial.json");
  const report = {
    status: "partial",
    protocol: recordVideo
      ? "one continuous recorded Playwright context per row; screenshots decoded to RGBA and compared pixel-for-pixel"
      : "independent browser screenshots decoded to RGBA and compared pixel-for-pixel",
    browser: browser ?? `Playwright ${playwrightEngine}`,
    browserVersion,
    compatibilityEvidence: compatibilityEvidenceStatus(browserVersion, false),
    origin,
    frameTimesMs: frameTimes,
    motionPixelThreshold,
    reducedMotion,
    recordVideo,
    selectedProbes: [...selectedProbes],
    selectedEmbeds: [...selectedEmbeds],
    assetBase,
    hostedAssetObservations,
    hostLabel,
    rows: [],
  };
  try {
  await writePartialDirectReport(partialFile, report);
  for (const probe of selectedProbes) {
    for (const embed of selectedEmbeds) {
      const directory = path.join(outputDirectory, `${probe}--${embed}`);
      const browserProfile = path.join(outputDirectory, "chrome-profile", `${probe}--${embed}`);
      await mkdir(directory, { recursive: true });
      const captures = [];
      let video = null;
      let selectedSource = null;
      const browserHostedAssetObservations = [];
      const expectedHostedAsset = assetBase
        ? expectedHostedAssetName(probe, embed, reducedMotion)
        : null;
      const hostedAssetPreflight = expectedHostedAsset
        ? hostedAssetsByName.get(expectedHostedAsset)
        : null;
      if (expectedHostedAsset && !hostedAssetPreflight) {
        throw new Error(`${expectedHostedAsset} hosted asset preflight is missing`);
      }
      const hostedTargetUrl = expectedHostedAsset ? new URL(`${expectedHostedAsset}.svg`, assetBase).href : null;
      const hostedGateOptions = hostedTargetUrl
        ? { asset: expectedHostedAsset, targetUrl: hostedTargetUrl, expectedBodySha256: hostedAssetPreflight.bodySha256 }
        : null;
      if (recordVideo) {
        const page = buildPageUrl(origin, embed, probe, assetBase);
        const context = await recordedBrowser.newContext({
          viewport: { width: 720, height: 240 },
          reducedMotion: reducedMotion ? "reduce" : "no-preference",
          serviceWorkers: "block",
          recordVideo: { dir: directory, size: { width: 720, height: 240 } },
        });
        const hostedGate = hostedGateOptions
          ? await createHostedAssetRequestGate(context, hostedGateOptions)
          : null;
        const browserPage = await context.newPage();
        const videoHandle = browserPage.video();
        try {
          try {
            await browserPage.goto(page, { waitUntil: "domcontentloaded" });
          } catch (error) {
            hostedGate?.throwFailure();
            throw error;
          }
          const image = browserPage.locator("img");
          if (await image.count() !== 1) throw new Error(`${probe}/${embed} must render exactly one image`);
          try {
            await image.evaluate((element) => element.decode());
          } catch (error) {
            hostedGate?.throwFailure();
            throw error;
          }
          selectedSource = await image.evaluate((element) => element.currentSrc);
          if (hostedTargetUrl && selectedSource !== hostedTargetUrl) {
            throw new Error(`${probe}/${embed} currentSrc must match the browser-bound hosted asset URL`);
          }
          if (hostedGate) browserHostedAssetObservations.push(hostedGate.assertComplete());
          const startedAt = await browserPage.evaluate(() => performance.now());
          for (const targetTimeMs of frameTimes) {
            const beforeWait = await browserPage.evaluate(() => performance.now());
            await browserPage.waitForTimeout(Math.max(0, targetTimeMs - (beforeWait - startedAt)));
            const actualTimeMs = await browserPage.evaluate((anchor) => performance.now() - anchor, startedAt);
            const file = path.join(directory, `${targetTimeMs}.png`);
            await browserPage.screenshot({ path: file, animations: "allow" });
            const completedTimeMs = await browserPage.evaluate((anchor) => performance.now() - anchor, startedAt);
            if (probe === "css-enter" && targetTimeMs === 250 && completedTimeMs > 440) {
              throw new Error(`css-enter 250 ms capture missed its 440 ms observation window (${completedTimeMs.toFixed(1)} ms at completion)`);
            }
            captures.push({
              timeMs: targetTimeMs,
              targetTimeMs,
              actualTimeMs: Math.round(actualTimeMs * 10) / 10,
              completedTimeMs: Math.round(completedTimeMs * 10) / 10,
              file: path.relative(outputDirectory, file).replaceAll("\\", "/"),
              sha256: await sha256File(file),
            });
          }
          const measuredVisibleDurationMs = await browserPage.evaluate((anchor) => performance.now() - anchor, startedAt);
          if (measuredVisibleDurationMs < 3_000) throw new Error(`recorded row was visible for only ${measuredVisibleDurationMs.toFixed(1)} ms`);
          video = { measuredVisibleDurationMs: Math.round(measuredVisibleDurationMs * 10) / 10 };
        } finally {
          await context.close();
        }
        const videoFile = path.join(directory, "motion.webm");
        await rename(await videoHandle.path(), videoFile);
        video.path = path.relative(outputDirectory, videoFile).replaceAll("\\", "/");
        Object.assign(video, await inspectWebmFile(videoFile));
      } else for (const timeMs of frameTimes) {
        const file = path.join(directory, `${timeMs}.png`);
        const page = buildPageUrl(origin, embed, probe, assetBase);
        if (playwrightEngine) {
          const playwrightArgs = [
            "screenshot", "--browser", playwrightEngine,
            "--viewport-size", "720,240", "--wait-for-timeout", String(timeMs), page, file,
          ];
          if (playwright) {
            const instance = await playwright[playwrightEngine].launch();
            const context = await instance.newContext({
              viewport: { width: 720, height: 240 },
              reducedMotion: reducedMotion ? "reduce" : "no-preference",
              serviceWorkers: "block",
            });
            try {
              const hostedGate = hostedGateOptions
                ? await createHostedAssetRequestGate(context, hostedGateOptions)
                : null;
              const browserPage = await context.newPage();
              try {
                await browserPage.goto(page);
              } catch (error) {
                hostedGate?.throwFailure();
                throw error;
              }
              const image = browserPage.locator("img");
              if (await image.count() !== 1) throw new Error(`${probe}/${embed} must render exactly one image`);
              try {
                await image.evaluate((element) => element.decode());
              } catch (error) {
                hostedGate?.throwFailure();
                throw error;
              }
              const frameSelectedSource = await image.evaluate((element) => element.currentSrc);
              if (hostedTargetUrl && frameSelectedSource !== hostedTargetUrl) {
                throw new Error(`${probe}/${embed} currentSrc must match the browser-bound hosted asset URL`);
              }
              if (timeMs === frameTimes[0]) selectedSource = frameSelectedSource;
              if (hostedGate) browserHostedAssetObservations.push(hostedGate.assertComplete());
              await browserPage.waitForTimeout(timeMs);
              await browserPage.screenshot({ path: file });
            } finally {
              await instance.close();
            }
          } else if (playwrightCli) {
            await run(process.execPath, [playwrightCli, ...playwrightArgs]);
          } else {
            const command = ["npx", "--no-install", "playwright", ...playwrightArgs].join(" ");
            await run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command]);
          }
        } else {
          const virtualTime = timeMs > 0 ? [`--virtual-time-budget=${timeMs}`] : [];
          await run(browser, [
            "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
            `--user-data-dir=${browserProfile}`, "--window-size=720,240",
            "--run-all-compositor-stages-before-draw", ...virtualTime,
            `--screenshot=${file}`, page,
          ]);
        }
        captures.push({ timeMs, file: path.relative(outputDirectory, file).replaceAll("\\", "/") });
      }
      const images = await Promise.all(captures.map(async ({ file }) => decodePng(await readFile(path.join(outputDirectory, file)))));
      const differences = images.slice(1).map((image, index) => ({
        fromMs: frameTimes[index],
        toMs: frameTimes[index + 1],
        ...pixelDifference(images[index], image),
      }));
      const reducedMotionControlPixels = reducedMotion ? countPixel(images[0], [255, 209, 102, 255]) : null;
      const reducedMotionEvidence = directReducedMotionEvidence(
        reducedMotion,
        selectedSource,
        reducedMotionControlPixels,
      );
      const reducedMotionControlVerified = reducedMotionEvidence.reducedMotionControlVerified;
      const browserHostedAssetObservation = assetBase
        ? summarizeBrowserHostedAssetObservations(browserHostedAssetObservations)
        : null;
      report.rows.push({
        probe,
        host: hostLabel,
        assetBase,
        embed,
        engine: playwrightEngine ? `playwright-${playwrightEngine}` : "chromium-headless",
        captures,
        video,
        differences,
        selectedSource,
        browserHostedAssetObservation,
        reducedMotionControlPixels: reducedMotionEvidence.reducedMotionControlPixels,
        reducedMotionControlVerified,
        verdict: classifyMotion(probe, images, differences, {
          frameZeroReferenceVerified: reducedMotionControlVerified,
        }),
      });
      await writePartialDirectReport(partialFile, report);
    }
  }
  validateCompletedDirectReport(report);
  report.status = "complete";
  report.compatibilityEvidence = compatibilityEvidenceStatus(browserVersion, true);
  await writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    await writePartialDirectReport(partialFile, report, error);
    throw error;
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await recordedBrowser?.close();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await capture(parseCaptureOptions(process.argv.slice(2)));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe", windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`browser exited ${code}: ${stderr}`)));
  });
}

export function decodePng(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) throw new Error("not a PNG");
  let position = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  const parts = [];
  while (position < buffer.length) {
    const length = buffer.readUInt32BE(position);
    const type = buffer.subarray(position + 4, position + 8).toString("ascii");
    const value = buffer.subarray(position + 8, position + 8 + length);
    position += length + 12;
    if (type === "IHDR") {
      width = value.readUInt32BE(0);
      height = value.readUInt32BE(4);
      bitDepth = value[8];
      colorType = value[9];
      if (bitDepth !== 8 || ![2, 6].includes(colorType) || value[12] !== 0) throw new Error("unsupported PNG format");
    }
    if (type === "IDAT") parts.push(value);
    if (type === "IEND") break;
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const compressed = inflateSync(Buffer.concat(parts));
  const rgba = Buffer.alloc(width * height * 4);
  let source = 0;
  let prior = Buffer.alloc(stride);
  for (let row = 0; row < height; row += 1) {
    const filter = compressed[source++];
    const current = Buffer.from(compressed.subarray(source, source + stride));
    source += stride;
    unfilter(current, prior, filter, channels);
    for (let column = 0; column < width; column += 1) {
      const input = column * channels;
      const output = (row * width + column) * 4;
      rgba[output] = current[input];
      rgba[output + 1] = current[input + 1];
      rgba[output + 2] = current[input + 2];
      rgba[output + 3] = channels === 4 ? current[input + 3] : 255;
    }
    prior = current;
  }
  return { width, height, rgba };
}

function unfilter(current, prior, filter, channels) {
  for (let index = 0; index < current.length; index += 1) {
    const left = index >= channels ? current[index - channels] : 0;
    const up = prior[index];
    const upLeft = index >= channels ? prior[index - channels] : 0;
    if (filter === 1) current[index] = (current[index] + left) & 0xff;
    else if (filter === 2) current[index] = (current[index] + up) & 0xff;
    else if (filter === 3) current[index] = (current[index] + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) current[index] = (current[index] + paeth(left, up, upLeft)) & 0xff;
    else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
  }
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  return leftDistance <= upDistance && leftDistance <= upLeftDistance ? left : upDistance <= upLeftDistance ? up : upLeft;
}

export function pixelDifference(left, right) {
  if (left.width !== right.width || left.height !== right.height) throw new Error("capture dimensions differ");
  let changedPixels = 0;
  let totalChannelDelta = 0;
  for (let index = 0; index < left.rgba.length; index += 4) {
    const delta = Math.abs(left.rgba[index] - right.rgba[index]) + Math.abs(left.rgba[index + 1] - right.rgba[index + 1]) + Math.abs(left.rgba[index + 2] - right.rgba[index + 2]) + Math.abs(left.rgba[index + 3] - right.rgba[index + 3]);
    if (delta > 0) changedPixels += 1;
    totalChannelDelta += delta;
  }
  return { changedPixels, totalChannelDelta };
}

export function countPixel(image, expected) {
  let count = 0;
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (expected.every((value, channel) => image.rgba[index + channel] === value)) count += 1;
  }
  return count;
}

export function classifyMotion(probe, images, differences, { frameZeroReferenceVerified = false } = {}) {
  if (differences.some((difference) => (
    difference.changedPixels >= motionPixelThreshold.changedPixels
    && difference.totalChannelDelta >= motionPixelThreshold.totalChannelDelta
  ))) return "animates";
  if (probe === "css-from-state-control" && countPixel(images[0], [255, 122, 69, 255]) === 0) {
    return "frozen at from-state";
  }
  return frameZeroReferenceVerified ? "frozen at frame zero" : "no motion detected";
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function sha256File(file) {
  return sha256(await readFile(file));
}

export function inspectWebmBuffer(buffer) {
  const magicHex = buffer.subarray(0, 4).toString("hex");
  if (magicHex !== "1a45dfa3") throw new Error(`recorded video is not a WebM EBML container (${magicHex || "empty"})`);
  return {
    fileSizeBytes: buffer.length,
    magicHex,
    actualDurationVerified: false,
    durationBoundary: "measuredVisibleDurationMs is browser performance time from the harness anchor through final capture; WebM container duration is not parsed",
    sha256: sha256(buffer),
  };
}

export async function inspectWebmFile(file) {
  return inspectWebmBuffer(await readFile(file));
}