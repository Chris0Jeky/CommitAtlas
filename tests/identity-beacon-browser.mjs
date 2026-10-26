/** Synthetic #134 geometry and direct-image playback; never GitHub/Camo qualification. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as svg from '../packages/svg/dist/index.js';
import { demoProjects } from '../packages/github/dist/index.js';
import { sceneInputs, sceneContext } from '../packages/svg/tests/scene.fixture.mjs';
import { stripSceneMotion } from '../packages/svg/tests/scene-harness.mjs';
import { createFreshOutputDirectory, decodePng, inspectWebmFile, pixelDifference } from './motion-probes/capture.mjs';

const require = createRequire(path.resolve(process.env.PLAYWRIGHT_PREFIX ?? '.', 'driver.cjs'));
const { chromium } = require('playwright');
const playwrightVersion = require('playwright/package.json').version;
assert.equal(playwrightVersion, '1.57.0', 'use the existing external Playwright pin');
const browserExecutable = process.env.IDENTITY_BEACON_BROWSER_EXECUTABLE ?? chromium.executablePath();
const out = process.env.IDENTITY_BEACON_QA_OUTPUT;
assert.ok(out && path.isAbsolute(out), 'IDENTITY_BEACON_QA_OUTPUT must be a fresh absolute directory');
await createFreshOutputDirectory(out);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = {};
for (const file of ['packages/svg/src/scenes/identity-beacon.ts', 'packages/svg/src/identity.ts',
  'packages/svg/src/primitives/index.ts', 'packages/svg/src/primitives/common.ts', 'packages/svg/src/primitives/geometric.ts',
  'packages/svg/src/motion/compiler.ts', 'packages/svg/src/motion/css.ts', 'packages/svg/src/motion/smil.ts',
  'packages/svg/src/motion/profile.ts', 'packages/svg/src/scene.ts', 'packages/svg/tests/scene.fixture.mjs',
  'packages/svg/tests/scene-harness.mjs', 'tests/motion-probes/capture.mjs', 'tests/identity-beacon-browser.mjs']) sourceFiles[file] = digest(await readFile(file));
const report = {
  kind: 'identity-beacon-synthetic-browser-qualification',
  scope: 'actual system-font text/body geometry and direct SVG image playback; no hosted identity inputs, GitHub/Camo or profile-adoption claim',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceWorkingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().length > 0,
  sourceFiles, observedAt: new Date().toISOString(), playwrightVersion, browserExecutable, browserVersion: null,
  fontconfigOverride: Boolean(process.env.FONTCONFIG_FILE),
  frameTimes: [0, 2_000, 6_000], maximumLateMs: 1_000,
  firstFrameBoundary: 'requested zero is the first load-relative observation, not exact animation frame zero; structural motion stripping proves frame-zero geometry',
  reducedControlProtocol: 'both backends explicitly select the static none twin through picture; this does not qualify a direct-CSS media-query override inside an SVG image',
  layout: [], playback: [], complete: false,
};
const frameSize = body => {
  const match = body.match(/viewBox="0 0 (\d+) (\d+)"/u);
  assert.ok(match, 'SVG must have explicit source bounds');
  return { width: Number(match[1]), height: Number(match[2]) };
};
const bounded = (glyph, units, suffix = '') => glyph.repeat(Math.floor((units - suffix.length) / glyph.length)) + suffix;
const words = (units, length, glyph = 'W') => `${glyph.repeat(length)} `.repeat(Math.ceil(units / (length + 1))).slice(0, units);
function fixture(glyph = 'plain', arrangement = 'matched') {
  const value = sceneInputs();
  const repos = ['atlas', 'forge', 'signal'];
  const wordFixture = glyph.startsWith('words') || glyph === 'emoji-words';
  const labelGlyph = glyph === 'emoji-words' ? '⌚' : wordFixture ? 'W' : glyph;
  const labels = glyph === 'plain' ? ['Atlas', 'Forge', 'Signal'] : glyph === 'mixed-emoji' ? ['W', 'M', 'N'].map(last => `${'⌚'.repeat(13)}${'W'.repeat(10)}${last}`) : labelGlyph === '⌚' ? ['⌚'.repeat(24), `${'⌚'.repeat(23)}☕`, `${'⌚'.repeat(23)}☎`] : repos.map((_, index) => bounded(labelGlyph, 24, `A${index}`));
  value.snapshot.projects = demoProjects('scene-demo', repos, new Map(repos.map(repo => [repo, 'active'])), new Map(), new Date(value.snapshot.freshness.generatedAt));
  value.snapshot.projects.projects.forEach((project, index) => {
    project.name = labels[index];
    project.openIssuesAndPullRequests = arrangement === 'zero' ? 0 : [9, 4, 0][index];
  });
  const unknown = glyph === 'mixed-emoji' ? ['W', 'M', 'N'].map(last => `${'☺'.repeat(13)}${'W'.repeat(10)}${last}`) : labelGlyph === '⌚' ? ['☺'.repeat(24), `${'☺'.repeat(23)}☕`, `${'☺'.repeat(23)}☎`] : labels.map((_, index) => glyph === 'plain' ? `Unmatched ${index}` : bounded(labelGlyph, 24, `U${index}`));
  const focus = arrangement === 'unmatched' ? unknown : arrangement === 'mixed' ? [labels[0], unknown[1], labels[2]] : labels;
  value.identity = svg.createIdentityConfig({
    name: glyph === 'plain' ? 'Ada Example' : glyph === 'mixed-emoji' ? '⌚W'.repeat(20) : glyph === 'emoji-words' ? words(40, 8, '⌚') : wordFixture ? words(40, glyph === 'words-low' ? 10 : glyph === 'words-high' ? 12 : 11) : bounded(glyph, 40),
    tagline: glyph === 'plain' ? 'Observed systems · synthetic qualification' : glyph === 'mixed-emoji' ? '⌚W'.repeat(40) : glyph === 'emoji-words' ? words(80, 14, '⌚') : wordFixture ? words(80, glyph === 'words-low' ? 18 : glyph === 'words-high' ? 20 : 19) : bounded(glyph, 80),
    focus,
  });
  return value;
}
function render(input, overrides = {}) {
  return svg.renderSceneDefinition(svg.getScene('identity-beacon'), input, { ...sceneContext, motion: 'none', ...overrides });
}
function overlaps(a, b) {
  return a.x < b.right - 0.1 && a.right > b.x + 0.1 && a.y < b.bottom - 0.1 && a.bottom > b.y + 0.1;
}
const openContexts = new Set();
let browser;
let failure = null;
try {
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  report.browserVersion = browser.version();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const theme of Object.keys(svg.themes)) for (const layout of ['compact', 'wide']) {
    for (const glyph of ['W', '界', '😀', '⌚', 'mixed-emoji', 'emoji-words', 'words-low', 'words', 'words-high']) for (const font of ['native', 'serif', 'monospace']) {
      for (const arrangement of ['matched', 'mixed', 'unmatched', 'zero']) {
        const input = fixture(glyph, arrangement);
        const rendered = render(input, { theme, layout });
        assert.equal(rendered.unavailable, false);
        const size = frameSize(rendered.svg);
        assert.equal(size.width, layout === 'compact' ? 480 : 860);
        assert.ok(size.height <= 1_000, 'existing frame bound must remain unchanged');
        await page.setViewportSize(size);
        const override = font === 'native' ? '' : `svg text{font-family:${font}!important}`;
        await page.setContent(`<style>body{margin:0}svg{display:block;width:${size.width}px;height:${size.height}px}${override}</style>${rendered.svg}`);
        const measured = await page.evaluate(async () => {
          await document.fonts.ready;
          const bounds = element => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
          };
          const root = document.querySelector('svg');
          const texts = [...root.querySelectorAll('text')].map(element => ({ text: element.textContent,
            font: getComputedStyle(element).fontFamily, size: getComputedStyle(element).fontSize, ...bounds(element) }));
          const bodies = [...root.querySelectorAll('g[id]')].filter(element => /-body\d$/u.test(element.id)).map(element => {
            const parent = element.parentElement;
            const transform = parent.transform.baseVal.consolidate().matrix;
            return { id: element.id, slotX: transform.e, slotY: transform.f,
              slotWidth: 2 * Number(element.querySelector('circle').getAttribute('cx')),
              texts: [...element.querySelectorAll('text')].map(text => ({ text: text.textContent, ...bounds(text) })), ...bounds(element) };
          });
          return { actual: bounds(root), texts, bodies,
            name: [...root.querySelectorAll('g[id$="-name"] text')].map(element => element.textContent).join(''),
            tagline: [...root.querySelectorAll('g[id$="-tagline"] text')].map(element => element.textContent).join(''),
            unmatched: [...root.querySelectorAll('text[class$="-unmatched"]')].map(element => element.textContent) };
        });
        const model = svg.getScene('identity-beacon').buildModel(input);
        const errors = [];
        if (measured.actual.width !== size.width || measured.actual.height !== size.height) errors.push('source and displayed bounds differ');
        if (measured.name !== input.identity.name || measured.tagline !== input.identity.tagline) errors.push('full identity text lost');
        if (JSON.stringify(measured.unmatched) !== JSON.stringify(model.unmatched)) errors.push('unmatched focus lost');
        if (measured.bodies.length !== model.bodies.length) errors.push('matched body lost');
        measured.bodies.forEach((body, index) => {
          if (body.texts[0]?.text !== model.bodies[index].name) errors.push('full project label lost');
          const nodeWidth = body.slotWidth;
          if (![260, 398, 432].includes(nodeWidth)) errors.push('unexpected body slot width');
          if (body.texts.some(text => text.x < body.slotX || text.right > body.slotX + nodeWidth || text.y < body.slotY || text.bottom > body.slotY + 120)) errors.push('body label crosses its slot');
        });
        if (measured.texts.some(text => text.x < -0.1 || text.right > size.width + 0.1 || text.y < -0.1 || text.bottom > size.height + 0.1)) errors.push('text crosses the actual frame');
        for (const [index, text] of measured.texts.entries()) if (measured.texts.slice(index + 1).some(other => overlaps(text, other))) errors.push('text collision');
        const entry = { theme, layout, glyph, font, arrangement, source: size, svgSha256: digest(rendered.svg), counters: rendered.counters, ...measured, errors };
        report.layout.push(entry);
        if (errors.length && !report.firstLayoutFailure) {
          report.firstLayoutFailure = { theme, layout, glyph, font, arrangement, errors };
          await page.screenshot({ path: path.join(out, 'layout-counterexample.png') });
          await writeFile(path.join(out, 'layout-counterexample.svg'), rendered.svg);
        }
        if (glyph === '😀' && font === 'native' && arrangement === 'matched') {
          const stem = `layout-${theme}-${layout}`;
          await page.screenshot({ path: path.join(out, `${stem}.png`) });
          await writeFile(path.join(out, `${stem}.svg`), rendered.svg);
        }
      }
    }
  }
  await page.close();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.layout.filter(entry => entry.errors.length).length, 0, 'measured identity geometry failed; no playback qualification accepted');

  const plan = ['compact', 'wide'].flatMap(layout => ['css', 'smil'].flatMap(backend => ['ambient', 'cinematic', 'none', 'stale', 'reduced'].map(state => ({ layout, backend, state }))));
  for (let start = 0; start < plan.length; start += 2) {
    const captures = [];
    for (const planned of plan.slice(start, start + 2)) {
      const { layout, backend, state } = planned;
      const input = fixture();
      if (layout === 'wide') {
        const mixedLabel = `${'⌚'.repeat(13)}${'W'.repeat(11)}`;
        input.snapshot.projects.projects[0].name = mixedLabel;
        input.identity = svg.createIdentityConfig({ name: input.identity.name, tagline: input.identity.tagline, focus: [mixedLabel, ...input.identity.focus.slice(1)] });
      }
      if (state === 'stale') input.snapshot.projects.freshness.mode = 'stale';
      const motion = state === 'none' ? 'none' : state === 'cinematic' ? 'cinematic' : 'ambient';
      const rendered = render(input, { layout, backend, motion });
      assert.equal(rendered.unavailable, state === 'stale');
      const still = render(input, { layout, backend, motion: 'none' });
      if (state !== 'stale') assert.equal(stripSceneMotion(rendered.svg), still.svg, 'structural frame-zero geometry must equal none');
      const key = `${layout}-${backend}-${state}`;
      const directory = path.join(out, key);
      await mkdir(directory);
      await writeFile(path.join(directory, 'source.svg'), rendered.svg);
      const size = frameSize(rendered.svg);
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: state === 'reduced' ? 'reduce' : 'no-preference', recordVideo: { dir: directory, size } });
      openContexts.add(context);
      const capturePage = await context.newPage();
      const useTwin = state === 'reduced';
      const source = `data:image/svg+xml;base64,${Buffer.from(rendered.svg).toString('base64')}`;
      const twin = `data:image/svg+xml;base64,${Buffer.from(still.svg).toString('base64')}`;
      await capturePage.setContent(`<style>body{margin:0}img{display:block;width:${size.width}px;height:${size.height}px}</style>${useTwin ? '<picture><source media="(prefers-reduced-motion: reduce)">' : ''}<img id="plate" alt="Synthetic Identity Beacon">${useTwin ? '</picture>' : ''}`);
      const entry = { key, ...planned, source: size, svgSha256: digest(rendered.svg), stillSha256: digest(still.svg), counters: rendered.counters,
        selectedSource: useTwin ? 'picture-none-twin' : 'same-svg', frames: [], differences: [], video: null };
      report.playback.push(entry);
      captures.push({ context, page: capturePage, entry, directory, source, twin, useTwin, images: [] });
    }
    await Promise.all(captures.map(capture => capture.page.evaluate(({ source, twin, useTwin }) => new Promise((resolve, reject) => {
      const image = document.querySelector('#plate');
      image.onload = () => { window.beaconLoadedAt = performance.now(); resolve(); };
      image.onerror = () => reject(new Error('synthetic identity SVG failed to decode'));
      if (useTwin) document.querySelector('source').srcset = twin;
      image.src = source;
    }), { source: capture.source, twin: capture.twin, useTwin: capture.useTwin })));
    for (const requestedMs of report.frameTimes) await Promise.all(captures.map(async capture => {
      await capture.page.waitForFunction(target => performance.now() - window.beaconLoadedAt >= target, requestedMs, { timeout: 10_000 });
      const beforeMs = await capture.page.evaluate(() => performance.now() - window.beaconLoadedAt);
      const file = path.join(capture.directory, `${requestedMs}.png`);
      const bytes = await capture.page.locator('#plate').screenshot({ path: file, animations: 'allow' });
      const afterMs = await capture.page.evaluate(() => performance.now() - window.beaconLoadedAt);
      assert.ok(afterMs - requestedMs < report.maximumLateMs, 'capture was too late for the requested interval');
      capture.entry.frames.push({ file: path.relative(out, file), requestedMs, beforeMs, afterMs, sha256: digest(bytes) });
      capture.images.push(decodePng(bytes));
    }));
    for (const capture of captures) {
      const { entry } = capture;
      entry.selectedBodySha256 = await capture.page.locator('#plate').evaluate(image => image.currentSrc.split(',')[1]);
      entry.selectedBodySha256 = digest(Buffer.from(entry.selectedBodySha256, 'base64'));
      assert.equal(entry.selectedBodySha256, capture.useTwin ? entry.stillSha256 : entry.svgSha256);
      entry.differences = capture.images.slice(1).map(image => pixelDifference(capture.images[0], image));
      if (['ambient', 'cinematic'].includes(entry.state)) assert.ok(entry.differences.some(delta => delta.changedPixels >= 16 && delta.totalChannelDelta >= 1_000), `${entry.key} had no measured motion`);
      else assert.ok(entry.differences.every(delta => delta.changedPixels === 0), `${entry.key} changed despite its still/stale/reduced control`);
      if (['none', 'stale'].includes(entry.state)) assert.equal(entry.counters.animatedElements, 0);
      const video = capture.page.video();
      await capture.context.close();
      openContexts.delete(capture.context);
      const file = path.join(capture.directory, 'motion.webm');
      await rename(await video.path(), file);
      entry.video = { file: path.relative(out, file), measuredVisibleDurationMs: entry.frames.at(-1).afterMs, ...await inspectWebmFile(file) };
    }
    await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  for (const entry of report.playback.filter(row => row.state === 'reduced')) {
    const still = report.playback.find(row => row.layout === entry.layout && row.backend === entry.backend && row.state === 'none');
    const difference = pixelDifference(decodePng(await readFile(path.join(out, entry.frames[0].file))), decodePng(await readFile(path.join(out, still.frames[0].file))));
    entry.reducedVersusStill = difference;
    assert.equal(difference.changedPixels, 0, 'reduced-motion answer must equal the none twin');
  }
  report.complete = true;
} catch (error) {
  failure = error instanceof Error ? error : new Error(String(error));
  report.error = failure.message;
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  const cleanup = await Promise.allSettled([...openContexts].map(context => context.close()));
  if (browser) cleanup.push(...await Promise.allSettled([browser.close()]));
  const failed = cleanup.filter(result => result.status === 'rejected');
  if (failed.length) {
    report.cleanupFailures = failed.map(result => String(result.reason));
    report.complete = false;
    failure ??= new Error('browser cleanup failed');
  }
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}
if (failure) throw failure;
console.log(JSON.stringify({ browser: report.browserVersion, layoutCases: report.layout.length, playbackRows: report.playback.length, framesPerRow: report.frameTimes.length, complete: report.complete }));
