/** Optional synthetic presentation QA; external pinned Playwright, no production dependency. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.resolve(process.env.PLAYWRIGHT_PREFIX ?? ".", "driver.cjs"));
const { chromium } = require("playwright");
assert.equal(require("playwright/package.json").version, "1.57.0", "use the pinned external driver");
const out = process.env.APPEARANCE_QA_OUTPUT;
assert.ok(out && path.isAbsolute(out), "APPEARANCE_QA_OUTPUT must be an absolute directory");
await mkdir(out, { recursive: false });
const port = Number(process.env.STUDIO_QA_PORT ?? 3471);
assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
const production = process.env.APPEARANCE_QA_MODE === "production";
const origin = production ? "https://commit-atlas.commit-atlas.workers.dev" : "https://studio.example.test";
const backend = `http://127.0.0.1:${port}`;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceFiles = {};
for (const file of ["app/gallery/page.tsx", "app/globals.css", "lib/gallery.ts", "tests/appearance-browser.mjs"]) {
  sourceFiles[file] = digest(await readFile(file));
}
const report = {
  kind: "gallery-synthetic-presentation", source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceWorkingTreeDirty: Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim()),
  sourceFiles, origin, mode: production ? "production-synthetic" : "built-worker-synthetic-https-proxy",
  observedAt: new Date().toISOString(), driver: require("playwright/package.json").version,
  browser: null, layouts: [], navigation: [], screenshots: {}, pageErrors: [], complete: false,
  scope: "Gallery layout, theme, keyboard and reduced-motion chrome; not timed SVG playback or GitHub/Camo qualification",
};
const browserExecutable = process.env.CHROME_BIN ?? chromium.executablePath();
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
report.browser = browser.version();
report.browserExecutable = browserExecutable;
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", error => report.pageErrors.push(error.message));
const screenshot = async (name, locator = page, options = {}) => {
  const bytes = await locator.screenshot({ path: path.join(out, name), ...options });
  report.screenshots[name] = { sha256: digest(bytes), bytes: bytes.length };
};
try {
  if (process.env.EXPECTED_BROWSER_VERSION) assert.equal(report.browser, process.env.EXPECTED_BROWSER_VERSION, "selected browser must match the qualification pin");
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { await route.abort(); return; }
    if (url.pathname.startsWith("/api/v1/") && url.pathname !== "/api/v1/health") {
      assert.equal(url.searchParams.get("demo"), "true", "appearance QA must never request live GitHub data");
    }
    const response = await route.fetch({ url: production ? url.href : `${backend}${url.pathname}${url.search}`, timeout: 30_000 });
    await route.fulfill({ response });
  });
  await page.goto(`${origin}/gallery`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  const tileSelector = "[data-gallery-id]";
  const count = await page.locator(tileSelector).count();
  assert.ok(count >= 17, "registered outputs must remain visible");
  assert.equal(await page.locator('[data-marker="synthetic-demo"]').count(), count);
  const svgBaseline = await page.locator(`${tileSelector} svg`).evaluateAll(elements => elements.map(element => element.outerHTML));
  assert.equal(svgBaseline.length, count);
  const families = page.locator('main nav a[href^="#gallery-"]');
  assert.equal(await families.count(), 5, "all five families have a visible navigation link");

  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const theme of ["Fieldline", "Limestone"]) {
      await page.getByRole("radio", { name: theme, exact: true }).check();
      await page.waitForFunction(expected => document.documentElement.getAttribute("data-chassis") === expected, theme.toLowerCase());
      await page.evaluate(() => document.fonts.ready);
      const measurements = await page.locator(tileSelector).evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        const svg = element.querySelector("svg");
        const art = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const link = element.querySelector("a");
        const action = link.getBoundingClientRect();
        const actionCopy = link.cloneNode(true);
        actionCopy.querySelectorAll('[aria-hidden="true"]').forEach(child => child.remove());
        return { id: element.getAttribute("data-gallery-id"), family: element.getAttribute("data-gallery-family"),
          width: rect.width, overflow: element.scrollWidth > element.clientWidth + 1,
          art: { width: art.width, height: art.height, nativeWidth: viewBox.width, nativeHeight: viewBox.height },
          action: { text: actionCopy.textContent.trim(), href: link.getAttribute("href"), width: action.width, height: action.height } };
      }));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}/${theme}: document overflow`);
      for (const item of measurements) {
        assert.equal(item.overflow, false, `${width}/${theme}/${item.id}: tile overflow`);
        assert.ok(item.art.width >= Math.min(260, item.width - 44), `${width}/${theme}/${item.id}: artwork is too small`);
        assert.ok(item.art.height > 0 && item.art.nativeWidth > 0 && item.art.nativeHeight > 0);
        assert.ok(Math.abs(item.art.height - item.art.width * item.art.nativeHeight / item.art.nativeWidth) < 2,
          `${width}/${theme}/${item.id}: distorted artwork`);
        if (width === 390) assert.ok(item.action.height >= 44, `${item.id}: mobile action target is below 44px`);
        const expected = item.action.href.startsWith("/studio?") ? "Customize in Studio"
          : item.action.href === "/studio" ? "Explore Studio" : "Read research note";
        assert.equal(item.action.text, expected, `${item.id}: destination label must describe its link`);
      }
      assert.deepEqual(await page.locator(`${tileSelector} svg`).evaluateAll(elements => elements.map(element => element.outerHTML)),
        svgBaseline, "chassis theme must not rewrite or animate SVG specimens");
      report.layouts.push({ width, theme, measurements });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await screenshot(`gallery-${width}-${theme.toLowerCase()}.png`);
      if (width === 1440 || width === 390) await screenshot(`gallery-${width}-${theme.toLowerCase()}-full.png`, page, { fullPage: true });
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("radio", { name: "Fieldline", exact: true }).check();
  for (let index = 0; index < await families.count(); index++) {
    const link = families.nth(index);
    const href = await link.getAttribute("href");
    await link.press("Enter");
    assert.equal(new URL(page.url()).hash, href);
    await page.waitForFunction(selector => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect && rect.top >= -1 && rect.bottom <= innerHeight;
    }, href);
    const entry = { href, text: (await link.innerText()).trim(), headingInViewport: true };
    if (index === 0) {
      await page.keyboard.press("Tab");
      entry.nextTabFamily = await page.evaluate(() => document.activeElement?.closest("[data-gallery-family]")?.getAttribute("data-gallery-family"));
      assert.equal(entry.nextTabFamily, "instrument", "Tab after a family anchor resumes inside that family");
    }
    report.navigation.push(entry);
  }
  const action = page.locator('[data-gallery-id="atlas"] a');
  await action.focus();
  assert.equal(await action.evaluate(element => document.activeElement === element), true);
  const focus = await action.evaluate(element => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor };
  });
  assert.notEqual(focus.outlineStyle, "none");
  assert.ok(parseFloat(focus.outlineWidth) >= 2, "Gallery action needs a visible keyboard focus ring");
  report.keyboardFocus = focus;
  await screenshot("gallery-keyboard-focus.png", page.locator('[data-gallery-id="atlas"]'));

  await page.emulateMedia({ reducedMotion: "reduce" });
  const target = page.locator('[data-gallery-id="atlas"]');
  const before = await target.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
  await target.hover();
  const reduced = await target.evaluate(element => {
    const style = getComputedStyle(element);
    return { transform: style.transform, animationName: style.animationName,
      transitionDuration: style.transitionDuration, top: element.getBoundingClientRect().top + window.scrollY };
  });
  assert.equal(reduced.transform, "none", "reduced motion removes plate displacement");
  assert.equal(reduced.animationName, "none", "reduced motion keeps the specimen plate still");
  assert.ok(Math.abs(reduced.top - before) < 1, "hover does not displace a reduced-motion plate");
  report.reducedMotion = reduced;
  await screenshot("gallery-reduced-motion.png", target);

  // Follow one actual catalogue action and verify its destination has applied the selection.
  await action.press("Enter");
  await page.waitForURL(`${origin}/studio?card=atlas`);
  await page.getByRole("checkbox", { name: "Atlas", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('input[type="checkbox"][value="atlas"]')?.checked
    || [...document.querySelectorAll('input[type="checkbox"]')].some(element => element.checked && element.closest("label")?.textContent.trim() === "Atlas"));
  assert.equal(await page.getByRole("checkbox", { name: "Atlas", exact: true }).isChecked(), true);
  assert.equal(await page.getByRole("checkbox", { name: "Projects", exact: true }).isChecked(), false, "targeted navigation replaces the default card pair");
  report.destination = { url: page.url(), selected: "Atlas" };
  assert.deepEqual(report.pageErrors, []);
  report.complete = true;
  await writeFile(path.join(out, "receipt.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ complete: report.complete, source: report.source, browser: report.browser,
    layouts: report.layouts.length, tilesPerLayout: count, screenshots: Object.keys(report.screenshots).length,
    keyboardFocus: report.keyboardFocus, reducedMotion: report.reducedMotion, destination: report.destination }, null, 2));
} catch (error) {
  report.error = { message: String(error), stack: error.stack };
  await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(path.join(out, "failure.json"), `${JSON.stringify(report, null, 2)}\n`);
  throw error;
} finally { await browser.close(); }
