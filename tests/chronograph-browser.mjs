/** Synthetic, local-browser evidence for #344. This is not GitHub raw/Camo qualification.
 * Supply Playwright externally with PLAYWRIGHT_PREFIX; CHRONOGRAPH_BROWSER_EXECUTABLE optionally
 * selects an existing Chromium executable. Otherwise use that driver's exact installed binary.
 * CHRONOGRAPH_QA_OUTPUT must name a fresh absolute directory.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as svg from '../packages/svg/dist/index.js';
import { demoProjects } from '../packages/github/dist/index.js';
import { calculateContributionMetrics } from '../packages/core/dist/index.js';
import { sceneInputs, sceneContext } from '../packages/svg/tests/scene.fixture.mjs';
import { createFreshOutputDirectory, decodePng, pixelDifference } from './motion-probes/capture.mjs';

const require = createRequire(path.resolve(process.env.PLAYWRIGHT_PREFIX ?? '.', 'driver.cjs'));
const { chromium } = require('playwright');
const playwrightVersion = require('playwright/package.json').version;
const browserExecutable = process.env.CHRONOGRAPH_BROWSER_EXECUTABLE ?? chromium.executablePath();
const out = process.env.CHRONOGRAPH_QA_OUTPUT;
assert.ok(out && path.isAbsolute(out), 'CHRONOGRAPH_QA_OUTPUT must be an absolute fresh directory');
await createFreshOutputDirectory(out);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = {};
for (const file of ['packages/svg/src/scenes/chronograph.ts', 'tests/chronograph-browser.mjs',
  'packages/svg/src/motion/profile.ts', 'packages/svg/src/motion/css.ts', 'packages/svg/src/motion/smil.ts']) {
  sourceFiles[file] = digest(await readFile(file));
}
const report = {
  kind: 'chronograph-synthetic-browser-evidence',
  scope: 'actual inline text geometry and direct SVG image playback; no GitHub transport or backend-default qualification',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceWorkingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().length > 0,
  sourceFiles, observedAt: new Date().toISOString(), playwrightVersion, browserExecutable,
  browserVersion: null, layout: [], playback: [], complete: false,
};

function fixture(glyph = '😀', angle = 210, near = true) {
  const value = sceneInputs();
  const now = new Date('2026-01-08T00:00:00Z');
  value.snapshot.freshness.generatedAt = now.toISOString();
  value.snapshot.contributions.freshness.generatedAt = now.toISOString();
  value.snapshot.contributions.days = value.snapshot.contributions.days.map(day => ({ ...day, count: 0, level: 0 }));
  value.snapshot.metrics = calculateContributionMetrics(value.snapshot.contributions.days,
    { commits: 0, issues: 0, pullRequests: 0, reviews: 0, days: 7, asOf: '2026-01-07' });
  const names = ['a', 'b', 'c', 'd', 'e', 'f'];
  value.snapshot.projects = demoProjects('scene-demo', names, new Map(names.map(name => [name, 'active'])), new Map(), now);
  const start = Date.parse('2026-01-01T00:00:00Z') + (angle + 90) / 360 * 7 * 86_400_000;
  for (const [index, project] of value.snapshot.projects.projects.entries()) {
    project.releaseState = 'published';
    project.release = { tag: glyph.repeat(39) + index, name: null,
      url: `${project.sourceUrl}/releases/tag/v1`, download: null,
      publishedAt: new Date(start + (near ? index % 2 * 60_000 : 0)).toISOString() };
  }
  return value;
}
function render(input, overrides = {}) {
  const result = svg.renderSceneDefinition(svg.getScene('chronograph'), input, { ...sceneContext, motion: 'none', ...overrides });
  assert.equal(result.unavailable, false, 'synthetic fixture must remain available');
  return result;
}

const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
report.browserVersion = browser.version();
const contexts = [];
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 480 }, deviceScaleFactor: 1 });
  for (const theme of Object.keys(svg.themes)) for (const layout of ['compact', 'wide']) {
    const width = layout === 'compact' ? 480 : 720;
    await page.setViewportSize({ width, height: 480 });
    for (const glyph of ['W', '界', '😀']) for (const near of [false, true]) {
      for (const angle of [-90, -60, -30, 0, 30, 60, 90, 120, 150, 180, 210, 240]) {
        const rendered = render(fixture(glyph, angle, near), { theme, layout });
        await page.setContent('<style>body{margin:0}svg{display:block}</style>' + rendered.svg);
        const boxes = await page.evaluate(async () => {
          await document.fonts.ready;
          return [...document.querySelectorAll('svg text')].map(element => {
            const rect = element.getBoundingClientRect();
            return { text: element.textContent, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
              width: rect.width, height: rect.height, font: getComputedStyle(element).fontFamily };
          });
        });
        const rows = boxes.filter(box => /^\d\. /u.test(box.text));
        const markers = boxes.filter(box => /^[1-6]$/u.test(box.text));
        const footer = boxes.filter(box => /^(?:NO CURRENT STREAK|LONGEST STREAK|ACTIVE WEEKS)/u.test(box.text));
        const overlaps = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
        const collisions = [];
        const labels = [...rows, ...markers];
        for (const [index, label] of labels.entries()) {
          for (const other of labels.slice(index + 1).concat(footer)) {
            if (overlaps(label, other)) collisions.push([label.text, other.text]);
          }
        }
        const legendRight = width / 2 - 95 * 0.94 - 4;
        const overflow = rows.some(row => row.right > legendRight - 1) ||
          labels.some(box => box.x < 0 || box.right > width || box.y < 0 || box.bottom > 480);
        const entry = { theme, layout, glyph, arrangement: near ? 'near' : 'coincident', angle,
          svgSha256: digest(rendered.svg), legendRight, rows, markers, footer, overflow, collisions };
        report.layout.push(entry);
        if ((overflow || collisions.length) && !report.firstLayoutFailure) {
          report.firstLayoutFailure = { theme, layout, glyph, angle };
          await page.screenshot({ path: path.join(out, 'layout-counterexample.png') });
        }
        if (glyph === '😀' && near && angle === 210) {
          const stem = `layout-${theme}-${layout}`;
          await page.screenshot({ path: path.join(out, `${stem}.png`) });
          await writeFile(path.join(out, `${stem}.svg`), rendered.svg);
        }
        assert.equal(rows.length, 6, 'every release needs one legend row');
        assert.equal(markers.length, 6, 'every release needs one numbered marker');
      }
    }
  }
  await page.close();
  const layoutFailures = report.layout.filter(entry => entry.overflow || entry.collisions.length);
  assert.equal(layoutFailures.length, 0, `${layoutFailures.length} measured layout cases cross reserved text bounds`);

  // Each direct-image row has its own document, load clock, unmodified SVG and continuous video.
  // Screenshots keep animations running. The last frame is beyond the README 45-second limit.
  const frameTimes = [0, 250, 1_000, 5_000, 46_000];
  await mkdir(path.join(out, 'videos'));
  const captures = [];
  for (const backend of ['css', 'smil']) for (const state of ['ambient', 'none', 'stale']) {
    const input = fixture();
    if (state === 'stale') {
      input.snapshot.freshness.mode = 'stale';
      input.snapshot.contributions.freshness.mode = 'stale';
    }
    const rendered = render(input, { backend, layout: 'compact', motion: state === 'none' ? 'none' : 'ambient' });
    const key = `${backend}-${state}`;
    await writeFile(path.join(out, `${key}.svg`), rendered.svg);
    const context = await browser.newContext({ viewport: { width: 480, height: 480 }, deviceScaleFactor: 1,
      recordVideo: { dir: path.join(out, 'videos'), size: { width: 480, height: 480 } } });
    contexts.push(context);
    const capturePage = await context.newPage();
    await capturePage.setContent('<style>body{margin:0}img{display:block;width:480px;height:480px}</style><img id="plate" alt="Synthetic chronograph">');
    const entry = { key, backend, state, svgSha256: digest(rendered.svg), counters: rendered.counters,
      frameTimes, frames: [], differences: [], video: null };
    report.playback.push(entry);
    captures.push({ key, context, page: capturePage, entry, body: Buffer.from(rendered.svg).toString('base64'), images: [] });
  }
  await Promise.all(captures.map(capture => capture.page.evaluate(body => new Promise((resolve, reject) => {
    const image = document.querySelector('#plate');
    image.onload = () => { window.chronographLoadedAt = performance.now(); resolve(); };
    image.onerror = () => reject(new Error('synthetic SVG image failed to decode'));
    image.src = `data:image/svg+xml;base64,${body}`;
  }), capture.body)));
  for (const requestedMs of frameTimes) {
    await Promise.all(captures.map(async capture => {
      await capture.page.waitForFunction(target => performance.now() - window.chronographLoadedAt >= target, requestedMs,
        { timeout: 50_000 });
      const image = capture.page.locator('#plate');
      const beforeMs = await capture.page.evaluate(() => performance.now() - window.chronographLoadedAt);
      const file = `${capture.key}-${requestedMs}.png`;
      const bytes = await image.screenshot({ path: path.join(out, file), animations: 'allow' });
      const afterMs = await capture.page.evaluate(() => performance.now() - window.chronographLoadedAt);
      assert.ok(afterMs - requestedMs < 2_000, 'capture was too late to represent the requested interval');
      capture.entry.frames.push({ file, requestedMs, beforeMs, afterMs, sha256: digest(bytes) });
      capture.images.push(decodePng(bytes));
    }));
  }
  for (const capture of captures) {
    capture.entry.differences = capture.images.slice(1).map(image => pixelDifference(capture.images[0], image));
    if (capture.entry.state === 'ambient') {
      assert.ok(capture.entry.differences.slice(0, 3).some(delta => delta.changedPixels >= 16 && delta.totalChannelDelta >= 1_000),
        `${capture.key} has no measured motion`);
      const still = captures.find(other => other.entry.backend === capture.entry.backend && other.entry.state === 'none');
      const stopped = pixelDifference(capture.images.at(-1), still.images.at(-1));
      capture.entry.stoppedVersusStill = stopped;
      assert.equal(stopped.changedPixels, 0, `${capture.key} failed to return to the truthful still reading after 45 seconds`);
    } else {
      assert.ok(capture.entry.differences.every(delta => delta.changedPixels === 0), `${capture.key} changed despite the still/stale control`);
      assert.equal(capture.entry.counters.animatedElements, 0);
    }
    const video = capture.page.video();
    await capture.context.close();
    capture.entry.video = path.relative(out, await video.path());
    capture.entry.videoSha256 = digest(await readFile(path.join(out, capture.entry.video)));
  }
  report.complete = true;
  console.log(JSON.stringify({ browser: report.browserVersion, layoutCases: report.layout.length,
    layoutFailures: 0, playbackRows: report.playback.length, framesPerRow: frameTimes.length,
    controlsStill: true, ambientReturnsToStillAfter45Seconds: true }));
} catch (error) {
  report.error = error.message;
  throw error;
} finally {
  await Promise.allSettled(contexts.map(context => context.close()));
  await browser.close();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}
