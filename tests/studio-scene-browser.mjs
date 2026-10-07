/** Optional synthetic browser QA. A pinned Playwright driver is supplied outside npm run check. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const require = createRequire(path.resolve(process.env.PLAYWRIGHT_PREFIX ?? ".", "driver.cjs"));
const { chromium } = require("playwright");
const production = process.env.STUDIO_QA_MODE === "production";
const origin = production ? "https://commit-atlas.commit-atlas.workers.dev" : "https://studio.example.test";
const backend = "http://127.0.0.1:3471";
const out = path.resolve(process.env.STUDIO_QA_OUTPUT ?? ".studio-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], requests = [], scenarios = [], layoutMeasurements = [];
let fault = "none", releaseDelayed;
let delayed = Promise.resolve();
page.on("pageerror", error => errors.push(error.message));
try {
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { await route.abort(); return; }
    if (url.pathname.startsWith("/api/v1/")) assert.equal(url.searchParams.get("demo"), "true", "QA must never request live GitHub evidence");
    const response = await route.fetch({ url: production ? url.href : `${backend}${url.pathname}${url.search}`, timeout: 30_000 });
    if (url.pathname.startsWith("/api/v1/scenes/")) {
      requests.push(`${url.pathname}${url.search}`);
      if (fault === "broken") {
        const body = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 200"><broken></svg>';
        const metadata = { version: 1, scene: "evidence-coverage", bytes: Buffer.byteLength(body), animatedElements: 0, loopingGroups: 0, unavailable: false };
        await route.fulfill({ status: 200, contentType: "image/svg+xml", body, headers: { "X-CommitAtlas-Scene-Metadata": JSON.stringify(metadata) } }); return;
      }
      if (fault === "html") { await route.fulfill({ status: 200, contentType: "text/html", body: "<html>not an image</html>" }); return; }
      if (fault === "delay" && url.searchParams.get("motion") === "ambient") await delayed;
    }
    try { await route.fulfill({ response }); } catch (error) {
      if (!/closed|handled|interception|invalid/i.test(String(error))) throw error;
    }
  });
  await page.goto(`${origin}/studio`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForFunction(() => [...document.querySelectorAll("input")].some(element => Object.keys(element).some(key => key.startsWith("__reactProps"))));
  await page.getByLabel("Evidence coverage", { exact: true }).check();
  await page.getByLabel("Ambient", { exact: false }).check();
  await page.locator('button[type="submit"]').click();
  const scene = page.locator('[data-scene-preview="evidence-coverage"]');
  const allTools = page.locator("fieldset.preview-tools");
  const markdown = page.getByRole("textbox", { name: "Generated README Markdown" });
  const loaded = () => scene.getByText("Image loaded. Compiler counters", { exact: false }).waitFor({ timeout: 30_000 });
  const assertLayout = async () => {
    const boxes = await page.locator("[data-scene-preview]").evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      const gallery = element.parentElement;
      const style = getComputedStyle(gallery);
      const available = gallery.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const image = element.querySelector("img");
      const imageRect = image?.getBoundingClientRect();
      return { id: element.getAttribute("data-scene-preview"), width: rect.width, available,
        imageWidth: imageRect?.width ?? 0, imageHeight: imageRect?.height ?? 0,
        overflow: element.scrollWidth > element.clientWidth + 1 };
    }));
    for (const box of boxes) {
      assert.ok(box.width >= box.available - 2, `scene ${box.id} is not full-width: ${JSON.stringify(box)}`);
      assert.ok(box.imageWidth >= Math.min(160, box.available - 64) && box.imageHeight >= 60, `scene ${box.id} is unreadably small`);
      assert.equal(box.overflow, false, `scene ${box.id} contents overflow`);
    }
    layoutMeasurements.push({ viewport: page.viewportSize(), boxes });
  };
  const copiedScene = async () => (await markdown.inputValue()).includes("/scenes/evidence-coverage.svg");
  await loaded(); assert.equal(await copiedScene(), true);
  assert.match(await scene.locator("img").getAttribute("src"), /^blob:/);
  assert.doesNotMatch(await scene.locator("dl").innerText(), /Unavailable/);
  scenarios.push("one validated response supplies the decoded Blob and compiler counters");
  await allTools.getByRole("button", { name: "Reduced-motion view", exact: true }).click();
  await scene.getByText("Still twin loaded.", { exact: false }).waitFor();
  assert.equal(await copiedScene(), false);
  await allTools.getByRole("button", { name: "Profile view", exact: true }).click();
  await loaded(); assert.equal(await copiedScene(), true);
  await allTools.getByRole("button", { name: "Frame zero", exact: true }).click();
  await scene.getByText("Still twin loaded.", { exact: false }).waitFor();
  assert.equal(await copiedScene(), false);
  await allTools.getByRole("button", { name: "Replay", exact: true }).click();
  await loaded(); assert.equal(await copiedScene(), true);
  scenarios.push("profile, reduced-motion, frame-zero and replay are reversible without stale copy approval");

  fault = "delay";
  delayed = new Promise(resolve => { releaseDelayed = resolve; });
  const beforeDelay = requests.length;
  await allTools.getByRole("button", { name: "Replay", exact: true }).click();
  await page.waitForTimeout(150);
  await allTools.getByRole("button", { name: "Reduced-motion view", exact: true }).click();
  await scene.getByText("Still twin loaded.", { exact: false }).waitFor();
  releaseDelayed(); fault = "none";
  await page.waitForTimeout(150);
  assert.equal(await copiedScene(), false); assert.ok(requests.length > beforeDelay);
  scenarios.push("late profile fetch cannot authorize a still-twin preview");

  for (const mode of ["broken", "html"]) {
    fault = mode;
    await allTools.getByRole("button", { name: "Replay", exact: true }).click();
    await scene.getByText("UNAVAILABLE. The scene image could not be validated and loaded.", { exact: true }).waitFor();
    assert.equal(await copiedScene(), false);
    assert.match(await scene.locator("dl").innerText(), /Unavailable/);
    await scene.screenshot({ path: path.join(out, `scene-${mode}-rejected.png`) });
  }
  scenarios.push("malformed SVG image decode and HTML-200 responses cannot authorize copying");
  fault = "none";
  await page.getByLabel("Orbital", { exact: false }).check();
  const beforeUnsupported = requests.length;
  await page.locator('button[type="submit"]').click();
  await scene.getByText("This scene does not support the orbital pack.", { exact: false }).waitFor();
  assert.equal(requests.length, beforeUnsupported); assert.equal(await copiedScene(), false);
  scenarios.push("unsupported packs do not fetch or silently substitute survey");
  await page.getByLabel("Survey", { exact: false }).check();
  await page.getByLabel("Activity terrain", { exact: true }).check();
  await page.getByLabel("Lifecycle map", { exact: true }).check();
  await page.locator('button[type="submit"]').click();
  for (const id of ["evidence-coverage", "activity-terrain", "lifecycle-map"]) {
    await page.locator(`[data-scene-preview="${id}"]`).getByText("Image loaded. Compiler counters", { exact: false }).waitFor({ timeout: 30_000 });
    assert.ok((await markdown.inputValue()).includes(`/scenes/${id}.svg`));
  }
  const terrain = page.locator('[data-scene-preview="activity-terrain"] img');
  const terrainSource = await terrain.getAttribute("src");
  await scene.getByRole("button", { name: "Reduced-motion view", exact: true }).click();
  await scene.getByText("Still twin loaded.", { exact: false }).waitFor();
  assert.equal(await copiedScene(), false);
  assert.equal(await terrain.getAttribute("src"), terrainSource);
  assert.ok((await markdown.inputValue()).includes("/scenes/activity-terrain.svg"));
  await scene.getByRole("button", { name: "Profile view", exact: true }).click();
  await loaded(); assert.equal(await copiedScene(), true);
  scenarios.push("all three scenes are selectable and per-image controls leave other images untouched");
  const targets = page.locator(".preview-tools button, .scene-image-tools button");
  const expectedControls = await targets.count();
  await targets.evaluateAll(elements => elements.forEach((element, index) => element.setAttribute("data-qa-focus", String(index))));
  const visited = new Set();
  await page.locator("#studio-handle").focus();
  let tabPresses = 0;
  for (; tabPresses < 200 && visited.size < expectedControls; tabPresses++) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate(() => document.activeElement?.getAttribute("data-qa-focus"));
    if (id !== null) visited.add(id);
  }
  assert.equal(visited.size, expectedControls);
  scenarios.push(`all ${expectedControls} enabled scene tool buttons reached by Tab (${tabPresses} presses from handle)`);
  await assertLayout();
  await scene.screenshot({ path: path.join(out, "scene-loaded.png") });
  await page.screenshot({ path: path.join(out, "studio-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertLayout();
  await page.screenshot({ path: path.join(out, "studio-mobile.png"), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, "mobile Studio has horizontal overflow");
  assert.deepEqual(errors, []);
  const receipt = { source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    browser: browser.version(), driver: require("playwright/package.json").version,
    origin, mode: production ? "production-synthetic" : "built-worker-synthetic-https-proxy",
    observedAt: new Date().toISOString(), scenarios, requests, pageErrors: errors, layoutMeasurements,
    keyboard: { expectedControls, reachedControls: visited.size, tabPresses },
    timedMotionOrCamoQualification: false };
  await writeFile(path.join(out, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(path.join(out, "failure.json"), JSON.stringify({ error: String(error), errors, scenarios, requests }, null, 2));
  throw error;
} finally { releaseDelayed?.(); await browser.close(); }
