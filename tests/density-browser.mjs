/** Synthetic direct-image SVG qualification. This does not claim GitHub/Camo transport coverage. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as svg from "../packages/svg/dist/index.js";
import { densityAtlas, densityDays } from "../packages/svg/tests/density.fixture.mjs";
import { stripSceneMotion } from "../packages/svg/tests/scene-harness.mjs";
import { decodePng, pixelDifference } from "./motion-probes/capture.mjs";

const require = createRequire(path.resolve(process.env.PLAYWRIGHT_PREFIX ?? ".", "driver.cjs"));
const { chromium } = require("playwright");
assert.equal(require("playwright/package.json").version, "1.57.0", "use the existing pinned external driver");
const out = process.env.DENSITY_QA_OUTPUT;
assert.ok(out && path.isAbsolute(out), "DENSITY_QA_OUTPUT must name a fresh absolute directory");
await mkdir(out);
const digest = value => createHash("sha256").update(value).digest("hex");
const sourceFiles = {};
for (const file of ["packages/svg/src/index.ts", "packages/svg/src/density.ts", "packages/svg/src/density-motion.ts",
  "packages/svg/src/motion/compiler.ts", "packages/svg/src/motion/css.ts", "packages/svg/src/motion/smil.ts",
  "packages/svg/tests/density.fixture.mjs", "tests/density-browser.mjs", "package-lock.json"])
  sourceFiles[file] = digest(await readFile(file));
const report = {
  kind: "contribution-density-browser-qualification", scope: "synthetic layout and CSS/SMIL in direct img/picture, not GitHub/Camo",
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceWorkingTreeDirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
  observedAt: new Date().toISOString(), node: process.version, playwright: require("playwright/package.json").version,
  sourceFiles, browser: null, browserExecutable: process.env.DENSITY_CHROMIUM_EXECUTABLE ?? chromium.executablePath(),
  expectedBrowserVersion: process.env.DENSITY_EXPECTED_BROWSER_VERSION ?? "143.0.7499.4",
  layouts: [], images: [], playback: [], pageErrors: [], complete: false,
  frameTimes: [0, 1500, 6000, 46000], maximumLateMs: 1500,
  firstFrameBoundary: "first load-relative observation; exact base geometry is qualified by structural stripping",
};
const render = (kind, days, options, dataState) => kind === "atlas"
  ? svg.renderAtlasCard(densityAtlas({ activity: days, ...(dataState ? { dataState } : {}) }), options)
  : svg.renderActivityCard({ days, source: "synthetic-demo", ...(dataState ? { dataState } : {}) }, options);
const frame = body => {
  const [, width, height] = body.match(/viewBox="0 0 (\d+) (\d+)"/u) ?? [];
  assert.ok(width && height); return { width: Number(width), height: Number(height) };
};
const dataUrl = body => `data:image/svg+xml;base64,${Buffer.from(body).toString("base64")}`;
const checkpoint = () => writeFile(path.join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
let browser;
try {
  browser = await chromium.launch({ executablePath: report.browserExecutable, headless: true });
  report.browser = browser.version();
  assert.equal(report.browser, report.expectedBrowserVersion);
  const page = await browser.newPage();
  page.on("pageerror", error => report.pageErrors.push(error.message));
  await page.route("**/*", route => route.abort());
  for (const kind of ["atlas", "activity"]) for (const width of [480, 860]) for (const theme of ["ember", "aurora", "midnight", "paper"]) {
    for (const [scenario, days] of [["annual", densityDays()], ["two-columns", densityDays(10)], ["special", densityDays(365, () => 999999)], ["empty", []]]) {
      const body = render(kind, days, { width, theme, motion: "none" });
      const size = frame(body);
      await page.setViewportSize(size);
      await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${body}`);
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => {
        const root = document.querySelector("svg");
        const texts = [...root.querySelectorAll("text")].map(node => {
          const b = node.getBBox(); return { text: node.textContent, x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height };
        });
        const cells = [...root.querySelectorAll("[data-density-band]")].map(node => {
          const b = node.getBBox(); return { band: node.getAttribute("data-density-band"), x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height };
        });
        return { texts, cells };
      });
      const overflow = [...geometry.texts, ...geometry.cells].filter(box => box.x < -1 || box.y < -1 || box.right > size.width + 1 || box.bottom > size.height + 1);
      const collisions = [];
      for (let i = 0; i < geometry.texts.length; i++) for (let j = i + 1; j < geometry.texts.length; j++) {
        const a = geometry.texts[i], b = geometry.texts[j];
        if (Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1)
          collisions.push([a.text, b.text]);
      }
      const entry = { kind, width, theme, scenario, size, svgSha256: digest(body), bytes: Buffer.byteLength(body), overflow, collisions };
      report.layouts.push(entry);
      if (scenario === "annual" && ["ember", "paper"].includes(theme) || overflow.length || collisions.length) {
        const stem = `${kind}-${width}-${theme}-${scenario}`;
        const png = await page.screenshot({ path: path.join(out, `${stem}.png`) });
        await writeFile(path.join(out, `${stem}.svg`), body);
        report.images.push({ file: `${stem}.png`, sha256: digest(png), svg: `${stem}.svg`, svgSha256: digest(body) });
      }
    }
  }
  await page.close();
  await checkpoint();
  assert.equal(report.layouts.length, 64);
  assert.equal(report.layouts.filter(item => item.overflow.length || item.collisions.length).length, 0, "layout overflow or text collision; inspect report and counterexample images");

  for (const kind of ["atlas", "activity"]) for (const width of [480, 860]) {
    const rows = [];
    for (const [backend, mode] of [["css", "ambient"], ["smil", "ambient"], ["smil", "none"], ["smil", "stale"], ["css", "reduced"], ["smil", "reduced"]]) {
      const options = { width, theme: "ember", motionBackend: backend, motion: mode === "none" ? "none" : "ambient" };
      const body = render(kind, densityDays(), options, mode === "stale" ? "stale" : undefined);
      const still = render(kind, densityDays(), { ...options, motion: "none" }, mode === "stale" ? "stale" : undefined);
      assert.equal(stripSceneMotion(body), still, "motion stripping must preserve exact none geometry");
      const size = frame(body), stem = `${kind}-${width}-${backend}-${mode}`;
      const directory = path.join(out, stem); await mkdir(directory);
      await writeFile(path.join(directory, "source.svg"), body); await writeFile(path.join(directory, "none.svg"), still);
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: mode === "reduced" ? "reduce" : "no-preference" });
      const itemPage = await context.newPage();
      itemPage.on("pageerror", error => report.pageErrors.push(error.message));
      await itemPage.route("**/*", route => route.abort());
      await itemPage.setContent(`<style>html,body{margin:0}img{display:block}</style>${mode === "reduced" ? '<picture><source media="(prefers-reduced-motion: reduce)">' : ""}<img id="card" alt="Synthetic contribution density">${mode === "reduced" ? "</picture>" : ""}`);
      const entry = { kind, width, backend, mode, stem, svgSha256: digest(body), stillSha256: digest(still), frames: [], comparisons: [] };
      report.playback.push(entry); rows.push({ context, page: itemPage, entry, directory, body, still, images: [] });
    }
    await Promise.all(rows.map(row => row.page.evaluate(({ body, still, reduced }) => new Promise((resolve, reject) => {
      const image = document.querySelector("#card");
      image.onload = () => { window.densityLoadedAt = performance.now(); resolve(); };
      image.onerror = () => reject(new Error("SVG failed to decode"));
      if (reduced) document.querySelector("source").srcset = still;
      image.src = body;
    }), { body: dataUrl(row.body), still: dataUrl(row.still), reduced: row.entry.mode === "reduced" })));
    for (const requestedMs of report.frameTimes) await Promise.all(rows.map(async row => {
      await row.page.waitForFunction(target => performance.now() - window.densityLoadedAt >= target, requestedMs, { timeout: 50000 });
      const beforeMs = await row.page.evaluate(() => performance.now() - window.densityLoadedAt);
      const png = await row.page.locator("#card").screenshot({ path: path.join(row.directory, `${requestedMs}.png`), animations: "allow" });
      const afterMs = await row.page.evaluate(() => performance.now() - window.densityLoadedAt);
      row.entry.frames.push({ file: `${row.entry.stem}/${requestedMs}.png`, requestedMs, beforeMs, afterMs, sha256: digest(png) });
      row.images.push(decodePng(png));
      assert.ok(afterMs - requestedMs < report.maximumLateMs, `${row.entry.stem} captured too late`);
    }));
    const control = rows.find(row => row.entry.mode === "none");
    for (const row of rows) {
      row.entry.comparisons = row.images.slice(1).map(image => pixelDifference(row.images[0], image));
      if (row.entry.mode === "ambient") {
        assert.ok(row.entry.comparisons.some(diff => diff.changedPixels >= 16 && diff.totalChannelDelta >= 1000), `${row.entry.stem} did not visibly move`);
        row.entry.finalStillDifference = pixelDifference(control.images.at(-1), row.images.at(-1));
        assert.equal(row.entry.finalStillDifference.changedPixels, 0, `${row.entry.stem} did not stop at the base state`);
      } else assert.ok(row.entry.comparisons.every(diff => diff.changedPixels === 0), `${row.entry.stem} static control moved`);
      if (row.entry.mode === "reduced") {
        const selected = await row.page.locator("#card").evaluate(image => image.currentSrc);
        assert.equal(digest(Buffer.from(selected.split(",")[1], "base64")), row.entry.stillSha256);
        assert.equal(pixelDifference(control.images[0], row.images[0]).changedPixels, 0);
      }
      await row.context.close();
    }
    await checkpoint();
  }
  assert.equal(report.pageErrors.length, 0);
  report.complete = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await checkpoint();
  await browser?.close();
}
