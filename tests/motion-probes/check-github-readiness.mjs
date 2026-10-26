/** Optional real-browser regression; uses supplied ephemeral Playwright, never a GitHub page. */
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as capture from "./capture-github.mjs";

assert.equal(typeof capture.prepareGithubTarget, "function", "capture must wait for GitHub's hydrated target");
const playwrightCli = process.argv[2];
const executablePath = process.argv[3];
assert.ok(playwrightCli && path.isAbsolute(playwrightCli) && path.basename(playwrightCli) === "cli.js", "pass the pinned Playwright cli.js path");
const imported = await import(pathToFileURL(path.join(path.dirname(playwrightCli), "index.js")).href);
const playwright = imported.default ?? imported;
const browser = await playwright.chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 480 } });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120"><rect width="360" height="120" fill="gold"/></svg>`;
  const source = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  await page.setContent(`<react-app style="display:block"><div style="height:900px"></div><img id="server-node" alt="css-enter" width="400" src="${source}"></react-app>`);
  const selector = 'img[alt="css-enter"]';
  await page.locator(selector).evaluate((image) => image.decode());
  assert.equal(await page.evaluate(capture.githubTargetIsReady, selector), false, "positive geometry alone must not admit the server-rendered node");
  const preparation = capture.prepareGithubTarget(page, selector);
  await page.evaluate(() => {
    setTimeout(() => {
      const old = document.querySelector('img[alt="css-enter"]');
      const replacement = old.cloneNode(true);
      replacement.id = "hydrated-node";
      old.replaceWith(replacement);
      document.querySelector("react-app").classList.add("loaded");
    }, 100);
  });
  const locator = await preparation;
  assert.equal(await locator.getAttribute("id"), "hydrated-node", "preparation must resolve the replacement after hydration");
  await locator.evaluate((image) => { image.__commitAtlasCaptureTarget = true; });
  const clip = await locator.evaluate(capture.readCaptureTargetClip);
  capture.validateCaptureTargetClip(selector, clip);
  await locator.evaluate((image) => { image.parentElement.style.display = "none"; });
  assert.equal(await page.evaluate(capture.githubTargetIsReady, selector), false, "a hidden hydrated ancestor must remain unready");
  await locator.evaluate((image) => { image.parentElement.style.display = "block"; });
  await locator.evaluate((image) => image.replaceWith(image.cloneNode(true)));
  const replacementClip = await locator.evaluate(capture.readCaptureTargetClip);
  assert.equal(replacementClip.sameTarget, false, "a replacement must not inherit the timed-node marker");
  assert.throws(() => capture.validateCaptureTargetClip(selector, replacementClip), /same DOM node/);
  let releaseImage;
  const imageGate = new Promise((resolve) => { releaseImage = resolve; });
  await page.route("https://fixture.example.test/probe.svg", async (route) => {
    await imageGate;
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg });
  });
  try {
    await page.setContent('<react-app class="loaded" style="display:block"><img alt="css-enter" width="400" src="https://fixture.example.test/probe.svg"></react-app>', { waitUntil: "domcontentloaded" });
    const gated = await capture.prepareGithubTarget(page, selector);
    assert.equal(await gated.evaluate((image) => image.complete), false, "readiness must not await the gated image or window load");
    releaseImage();
    await gated.evaluate((image) => image.decode());
  } finally {
    releaseImage();
  }
  process.stdout.write(`${JSON.stringify({ browser: browser.version(), assertions: "hydration replacement, instant viewport scroll, hidden ancestor rejection, timed-node replacement rejection, readiness with gated image", clip })}\n`);
} finally {
  await browser.close();
}
