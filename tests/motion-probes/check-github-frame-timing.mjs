/** Optional local-browser timing regression; no GitHub requests or motion verdicts. */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as capture from "./capture-github.mjs";

assert.equal(typeof capture.captureTimedFrame, "function", "capture must separate screenshot completion from file I/O");
const playwrightCli = process.argv[2];
assert.ok(playwrightCli && path.isAbsolute(playwrightCli) && path.basename(playwrightCli) === "cli.js", "pass the pinned Playwright cli.js path");
const imported = await import(pathToFileURL(path.join(path.dirname(playwrightCli), "index.js")).href);
const playwright = imported.default ?? imported;
const browser = await playwright.chromium.launch(process.argv[3] ? { executablePath: process.argv[3] } : {});
const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "commitatlas-frame-timing-"));
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 480 } });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120"><rect width="360" height="120" fill="gold"/></svg>';
  await page.setContent(`<react-app class="loaded" style="display:block"><img alt="css-enter" width="400" src="data:image/svg+xml,${encodeURIComponent(svg)}"></react-app>`);
  const selector = 'img[alt="css-enter"]';
  const locator = await capture.prepareGithubTarget(page, selector);
  await locator.evaluate((image) => { image.__commitAtlasCaptureTarget = true; });
  const screenshotPage = {
    screenshot: (options) => {
      assert.equal(Object.hasOwn(options, "path"), false, "capture bytes must return before file writing");
      return page.screenshot(options);
    },
  };
  const row = { probe: "css-enter", selector };
  const loadedAt = await page.evaluate(() => performance.now() - 250);
  const delayedWrite = await capture.captureTimedFrame({
    page: screenshotPage, locator, row, loadedAt, targetTimeMs: 250,
    file: path.join(outputDirectory, "delayed-write.png"), relativePath: "delayed-write.png",
    writeImage: async (file, bytes) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await writeFile(file, bytes);
    },
  });
  assert.ok(delayedWrite.completedTimeMs <= 440, "post-screenshot observation must retain the 440 ms limit");
  assert.ok(delayedWrite.fileWriteDurationMs >= 240, "the filesystem delay must be measured separately");
  assert.ok(await page.evaluate((anchor) => performance.now() - anchor, loadedAt) > 440, "file completion must occur after the unchanged motion window");
  let lateFrame;
  await assert.rejects(capture.captureTimedFrame({
    page: screenshotPage, locator, row,
    loadedAt: await page.evaluate(() => performance.now() - 500), targetTimeMs: 250,
    file: path.join(outputDirectory, "late.png"), relativePath: "late.png",
  }), (error) => {
    lateFrame = error.frameObservation;
    return /440 ms observation window/u.test(error.message);
  });
  assert.equal(lateFrame.failurePhase, "frame-deadline");
  assert.equal(lateFrame.deadline.missed, true);
  assert.equal(lateFrame.fileSaved, true, "a rejected late capture remains available as diagnostic evidence");
  assert.ok(lateFrame.completedTimeMs > 440);
  let replacedFrame;
  await assert.rejects(capture.captureTimedFrame({
    page: {
      screenshot: async (options) => {
        const bytes = await screenshotPage.screenshot(options);
        await locator.evaluate((image) => image.replaceWith(image.cloneNode(true)));
        return bytes;
      },
    },
    locator, row, loadedAt: await page.evaluate(() => performance.now()), targetTimeMs: 0,
    file: path.join(outputDirectory, "replaced.png"), relativePath: "replaced.png",
  }), (error) => {
    replacedFrame = error.frameObservation;
    return /same DOM node/u.test(error.message);
  });
  assert.equal(replacedFrame.failurePhase, "after-screenshot-node-check");
  assert.equal(replacedFrame.fileSaved, false);
  assert.ok(Number.isFinite(replacedFrame.completedTimeMs));
  process.stdout.write(`${JSON.stringify({ browser: browser.version(), delayedWrite, lateFrame, replacedFrame })}\n`);
} finally {
  await browser.close();
}
