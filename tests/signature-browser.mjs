/** Synthetic C0 Signature geometry and direct-image playback; never GitHub/Camo qualification.
 * Run from the repository root after npm ci. The harness freshly builds SVG, core and github
 * before importing the renderer, retaining build.log and all executed workspace JS hashes.
 * Supply the existing external
 * Playwright 1.57.0 driver and Chrome 143.0.7499.4; SIGNATURE_QA_OUTPUT must be a fresh absolute path.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
assert.equal(process.cwd(), root, 'run the Signature browser harness from the repository root');
const local = file => pathToFileURL(path.join(root, file)).href;
const require = createRequire(path.resolve(process.env.PLAYWRIGHT_PREFIX ?? '.', 'driver.cjs'));
const { chromium } = require('playwright');
const playwrightVersion = require('playwright/package.json').version;
assert.equal(playwrightVersion, '1.57.0', 'use the existing external Playwright pin');
const browserExecutable = process.env.SIGNATURE_BROWSER_EXECUTABLE ?? process.env.CHROME_BIN ?? chromium.executablePath();
const expectedBrowserVersion = process.env.SIGNATURE_EXPECTED_BROWSER_VERSION ?? '143.0.7499.4';
const out = process.env.SIGNATURE_QA_OUTPUT;
assert.ok(out && path.isAbsolute(out), 'SIGNATURE_QA_OUTPUT must be a fresh absolute directory');
await mkdir(out); // An existing directory must fail rather than mix receipts from different runs.
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const trackedSources = [
  'packages/svg/src/scenes/signature.ts', 'packages/svg/src/scene.ts', 'packages/svg/src/index.ts',
  'packages/svg/src/primitives/index.ts', 'packages/svg/src/primitives/geometric.ts', 'packages/svg/src/primitives/common.ts',
  'packages/svg/src/motion/compiler.ts', 'packages/svg/src/motion/profile.ts', 'packages/svg/src/motion/css.ts', 'packages/svg/src/motion/smil.ts', 'packages/svg/src/motion/types.ts',
  'packages/core/src/lens-projection.ts', 'research-contracts/lens-projection/v1/showcase.fixture.json',
  'packages/svg/tests/signature.fixture.mjs', 'packages/svg/tests/scene.fixture.mjs', 'packages/svg/tests/scene-harness.mjs', 'tests/signature-fixtures.mjs', 'tests/motion-probes/capture.mjs',
  'scripts/build-package.mjs', 'scripts/package-build-utils.mjs', 'package-lock.json',
];
const sourcePaths = Object.fromEntries(trackedSources.map(file => [file, path.join(root, file)]));
sourcePaths['tests/signature-browser.mjs'] = fileURLToPath(import.meta.url);
const sourceFiles = {};
for (const [file, filename] of Object.entries(sourcePaths)) sourceFiles[file] = digest(await readFile(filename));
async function builtJavaScriptHashes() {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await visit(relative);
      else if (entry.isFile() && relative.endsWith('.js')) files.push(relative);
    }
  }
  for (const directory of ['packages/core/dist', 'packages/github/dist', 'packages/svg/dist']) await visit(directory);
  assert.ok(files.length > 0, 'build the renderer and its workspace dependencies first');
  return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, digest(await readFile(path.join(root, file)))])));
}
const sourceWorkingTreeStatus = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).trim();
const provenance = {
  kind: 'signature-c0-synthetic-browser-qualification',
  scope: 'actual SVG text/frame geometry and direct image playback of synthetic C0 fixtures; no real projection publication, GitHub/Camo, sanitizer or profile-adoption claim',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceWorkingTreeDirty: sourceWorkingTreeStatus.length > 0, sourceWorkingTreeStatus, sourceFiles,
  observedAt: new Date().toISOString(), nodeVersion: process.version, playwrightVersion, browserExecutable, expectedBrowserVersion,
  build: null, builtFiles: null, complete: false,
};
let modules;
try {
  const startedAt = new Date().toISOString(), start = performance.now();
  const command = ['npm', '--prefix', 'packages/svg', 'run', 'build'];
  const built = spawnSync(command[0], command.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const buildLog = `${built.stdout ?? ''}${built.stderr ?? ''}`;
  await writeFile(path.join(out, 'build.log'), buildLog);
  provenance.build = { command, startedAt, finishedAt: new Date().toISOString(), durationMs: performance.now() - start,
    exitCode: built.status, signal: built.signal, logFile: 'build.log', logSha256: digest(buildLog), error: built.error?.message ?? null };
  assert.equal(built.status, 0, 'fresh renderer build failed; inspect build.log');
  provenance.builtFiles = await builtJavaScriptHashes();
  modules = await Promise.all([
    import(local('packages/svg/dist/index.js')),
    import(local('tests/signature-fixtures.mjs')),
    import(local('packages/svg/tests/signature.fixture.mjs')),
    import(local('packages/svg/tests/scene-harness.mjs')),
    import(local('tests/motion-probes/capture.mjs')),
  ]);
} catch (error) {
  provenance.error = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  throw error;
}
const [svg, fixtures, fixtureInputs, motion, capture] = modules;
const scenarios = [...fixtures.SIGNATURE_CASES, 'latin'];
const themes = ['ember', 'aurora', 'midnight', 'paper'];
const layouts = ['wide', 'compact'];
const fonts = ['native', 'serif', 'monospace'];
const report = {
  ...provenance, projectionGeneratedAt: fixtureInputs.signatureProjection.generatedAt,
  buildCorrespondence: 'This harness successfully rebuilt SVG and its core/github prebuild chain before imports. Every built workspace JavaScript file is hashed before import and the complete manifest is checked unchanged after capture.',
  browserVersion: null,
  platform: process.platform, fontconfigOverride: Boolean(process.env.FONTCONFIG_FILE), fontSources: [],
  expectedLayoutCases: scenarios.length * themes.length * layouts.length * fonts.length,
  frameBoundary: 'the frame body is at most 1000px; the engine adds its separate 28px stale banner outside that body, permitting a displayed total of 1028px',
  frameTimes: [0, 1_000, 5_000, 46_000], maximumLateMs: 1_500,
  firstFrameBoundary: 'requested zero is the first load-relative observation, not exact animation frame zero; structural motion stripping verifies frame-zero geometry',
  reducedControlProtocol: 'both backends explicitly select a motion=none twin through picture under prefers-reduced-motion; direct-CSS media-query behavior inside an image is not claimed',
  layout: [], representativeImages: [], playback: [], pageErrors: [], complete: false,
};

function inputsFor(scenario) {
  if (scenario !== 'latin') return fixtures.signatureFixtureInputs(scenario);
  return fixtureInputs.signatureInputs({ mutate(value) {
    fixtureInputs.maximumSignatureProjection(value);
    value.archetype.name = 'W'.repeat(40);
    value.archetype.description = 'W'.repeat(160);
    value.rangeLabel = 'W'.repeat(40);
    value.privacyNote = 'W'.repeat(240);
  } });
}
function render(options) {
  if (options.scenario !== 'latin') return fixtures.renderSignatureFixture(options);
  return svg.renderSceneDefinition(svg.getScene('signature'), inputsFor(options.scenario), {
    theme: options.theme, layout: options.layout, motion: options.motion, backend: options.backend,
    pack: 'survey', instanceNamespace: 'signatureEvidence', seed: '',
  });
}
function frame(body) {
  const match = body.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/u);
  assert.ok(match, 'SVG must declare its actual source bounds');
  const [x, y, width, height] = match.slice(1).map(Number);
  assert.ok([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0);
  return { x, y, width, height };
}
function overlaps(a, b) {
  return Math.min(a.right, b.right) - Math.max(a.x, b.x) > 0.25 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 0.25;
}
function representative(scenario, theme, layout, font) {
  return font === 'native' && (scenario === 'fresh' && (layout === 'wide' || ['ember', 'paper'].includes(theme)) ||
    scenario === 'maximum' && theme === 'paper' && layout === 'compact' || scenario === 'latin' && theme === 'ember' && layout === 'wide' ||
    scenario === 'dense' && theme === 'paper');
}
const openContexts = new Set();
let browser, failure;
const checkpoint = () => writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
try {
  for (const family of ['sans-serif', 'serif', 'monospace']) for (const codePoint of [0x57, 0x754c, 0x2728]) {
    const [filename, matchedFamily] = execFileSync('fc-match', ['--format', '%{file}\n%{family}\n', `${family}:charset=${codePoint.toString(16)}`], { encoding: 'utf8' }).trim().split('\n');
    const charset = execFileSync('fc-query', ['--format', '%{charset}', filename], { encoding: 'utf8' }).trim();
    const hasGlyph = charset.split(/\s+/u).some(range => {
      const [start, end = start] = range.split('-').map(value => parseInt(value, 16));
      return start <= codePoint && end >= codePoint;
    });
    const checkedCodePoint = `U+${codePoint.toString(16).toUpperCase()}`;
    assert.ok(hasGlyph, `install fonts-noto-cjk and fonts-noto-color-emoji before qualification; ${family} currently lacks ${checkedCodePoint}`);
    report.fontSources.push({ requestedFamily: family, matchedFamily, file: filename, sha256: digest(await readFile(filename)), checkedCodePoint, hasGlyph });
  }
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  report.browserVersion = browser.version();
  assert.equal(report.browserVersion, expectedBrowserVersion, 'use the explicitly pinned Chromium build');
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const fontProbe = await page.context().newCDPSession(page);
  await fontProbe.send('DOM.enable');
  await fontProbe.send('CSS.enable');
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.route('**/*', route => route.abort());
  for (const scenario of scenarios) for (const theme of themes) for (const layout of layouts) for (const font of fonts) {
    const options = { scenario, theme, layout, motion: 'none', backend: 'css' };
    const inputs = inputsFor(scenario), lens = inputs.lens;
    const rendered = render(options);
    const size = frame(rendered.svg);
    assert.equal(size.width, layout === 'wide' ? 860 : 480);
    const staleHeaderHeight = lens.freshness.status === 'stale' ? 28 : 0;
    assert.equal(size.y, staleHeaderHeight ? -staleHeaderHeight : 0, 'only the engine-owned stale header may extend above the frame body');
    const bodyHeight = size.height - staleHeaderHeight;
    assert.equal(rendered.unavailable, lens.freshness.status === 'expired');
    await page.setViewportSize({ width: size.width, height: size.height });
    const override = font === 'native' ? '' : `svg text,svg tspan{font-family:${font}!important}`;
    await page.setContent(`<style>body{margin:0}svg{display:block;width:${size.width}px;height:${size.height}px}${override}</style>${rendered.svg}`);
    const measured = await page.evaluate(async archetype => {
      await document.fonts.ready;
      const bounds = element => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const root = document.querySelector('svg');
      const blocks = [...root.querySelectorAll('text')];
      const lines = blocks.flatMap(element => element.querySelector('tspan') ? [...element.querySelectorAll('tspan')] : [element]);
      const radar = root.querySelector('g[id$="-radar"]');
      const bottomAxis = [...(radar?.querySelectorAll('text') ?? [])].find(element => element.textContent === '4');
      const caption = blocks.find(element => element.textContent === 'SCALE 0–1');
      const calibration = root.querySelector('g[id$="-calibration"]');
      const title = blocks.find(element => element.textContent === archetype) ?? blocks[0];
      (title.querySelector('tspan') ?? title).setAttribute('data-font-probe', 'true');
      return { actual: bounds(root), textBlocks: blocks.map(element => element.textContent),
        lines: lines.map(element => ({ text: element.textContent, font: getComputedStyle(element).fontFamily, fontSize: getComputedStyle(element).fontSize, ...bounds(element) })),
        contextText: root.querySelector('g[id$="-projection-context"]')?.textContent ?? '',
        radar: radar ? bounds(radar) : null,
        scaleCaption: caption ? bounds(caption) : null, bottomAxis: bottomAxis ? bounds(bottomAxis) : null,
        calibration: calibration ? bounds(calibration) : null,
      };
    }, lens.archetype.name);
    const { root: documentNode } = await fontProbe.send('DOM.getDocument');
    const { nodeId: fontNode } = await fontProbe.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector: '[data-font-probe]' });
    const { fonts: platformFonts } = await fontProbe.send('CSS.getPlatformFontsForNode', { nodeId: fontNode });
    const errors = [];
    if (!platformFonts.some(used => used.glyphCount > 0)) errors.push('browser did not identify any rendered title glyphs');
    if (bodyHeight > 1_000 || size.height > 1_000 + staleHeaderHeight) errors.push('Signature exceeded its 1000px body plus the optional 28px stale-header bound');
    if (measured.actual.width !== size.width || measured.actual.height !== size.height) errors.push('displayed frame differs from declared bounds');
    const overflow = measured.lines.filter(line => line.x < -0.25 || line.y < -0.25 || line.right > size.width + 0.25 || line.bottom > size.height + 0.25);
    if (overflow.length) errors.push('text crosses the displayed frame');
    const collisions = [];
    measured.lines.forEach((line, index) => measured.lines.slice(index + 1).forEach(other => {
      if (overlaps(line, other)) collisions.push({ left: line, right: other });
    }));
    if (collisions.length) errors.push('rendered text lines overlap');
    if (lens.freshness.status !== 'expired') {
      const expectedBlocks = new Map();
      for (const value of [lens.archetype.name, lens.archetype.description, lens.rangeLabel]) expectedBlocks.set(value, (expectedBlocks.get(value) ?? 0) + 1);
      for (const [value, count] of expectedBlocks) if (measured.textBlocks.filter(text => text === value).length < count) errors.push('full archetype/range text was lost');
      if (!measured.contextText.includes(lens.privacyNote)) errors.push('full privacy note was lost');
      for (const warning of lens.coverage.warnings) if (!measured.contextText.includes(warning.displayText)) errors.push(`warning text lost: ${warning.code}`);
      const labels = ['1  Focus', '2  Shipping', '3  Collaboration', '4  Consistency', '5  Breadth', '6  Stewardship'];
      const keys = ['focus', 'shipping', 'collaboration', 'consistency', 'breadth', 'stewardship'];
      labels.forEach((label, index) => {
        const position = measured.textBlocks.indexOf(label), axis = lens.dna.find(value => value.key === keys[index]);
        if (position < 0) errors.push(`dimension label lost: ${label}`);
        else if (measured.textBlocks[position + 1] !== String(axis.value)) errors.push(`exact dimension value lost: ${axis.key}`);
      });
      if (!measured.radar || measured.radar.x < 0 || measured.radar.right > size.width || measured.radar.y < 0 || measured.radar.bottom > size.height) errors.push('radar crosses its frame');
      if (layout === 'compact' && (!measured.scaleCaption || !measured.bottomAxis || !measured.calibration || measured.scaleCaption.y < Math.max(measured.bottomAxis.bottom, measured.calibration.bottom) + 6)) errors.push('compact scale caption must clear the bottom axis and plot by 6px');
    }
    const entry = { scenario, theme, layout, font, source: size, bodyHeight, staleHeaderHeight, svgSha256: digest(rendered.svg), counters: rendered.counters,
      actual: measured.actual, textBlocks: measured.textBlocks, lines: measured.lines, platformFonts, radar: measured.radar,
      scaleCaption: measured.scaleCaption, bottomAxis: measured.bottomAxis, calibration: measured.calibration, overflow, collisions, errors };
    report.layout.push(entry);
    if (errors.length && !report.firstLayoutFailure) {
      report.firstLayoutFailure = { scenario, theme, layout, font, errors, overflow, collisions };
      await page.screenshot({ path: path.join(out, 'layout-counterexample.png') });
      await writeFile(path.join(out, 'layout-counterexample.svg'), rendered.svg);
    }
    if (representative(scenario, theme, layout, font)) {
      const stem = `layout-${scenario}-${theme}-${layout}`;
      const png = await page.screenshot({ path: path.join(out, `${stem}.png`) });
      const decoded = capture.decodePng(png);
      assert.equal(decoded.width, size.width); assert.equal(decoded.height, size.height);
      await writeFile(path.join(out, `${stem}.svg`), rendered.svg);
      report.representativeImages.push({ file: `${stem}.png`, sha256: digest(png), pngSignatureHex: png.subarray(0, 8).toString('hex'), width: decoded.width, height: decoded.height, svgFile: `${stem}.svg`, svgSha256: digest(rendered.svg) });
    }
  }
  await page.close();
  await checkpoint();
  assert.equal(report.layout.length, report.expectedLayoutCases);
  assert.equal(report.layout.filter(entry => entry.errors.length).length, 0, 'measured Signature geometry failed; playback is not accepted');

  // Static backends are byte-identical, so one observed control per state covers both outputs.
  // Each moving/reduced row retains its own document, image load clock and unmodified SVG.
  for (const layout of layouts) {
    const planned = [
      { backend: 'css', state: 'ambient' }, { backend: 'smil', state: 'ambient' },
      { backend: 'css', state: 'none', sharedStatic: true }, { backend: 'css', state: 'stale', sharedStatic: true },
      { backend: 'css', state: 'expired', sharedStatic: true },
      { backend: 'css', state: 'reduced' }, { backend: 'smil', state: 'reduced' },
    ];
    const captures = [];
    for (const { backend, state, sharedStatic = false } of planned) {
      const scenario = ['stale', 'expired'].includes(state) ? state : 'fresh';
      const options = { scenario, theme: 'ember', layout, backend, motion: state === 'none' ? 'none' : 'ambient' };
      const rendered = render(options), still = render({ ...options, motion: 'none' });
      assert.equal(motion.stripSceneMotion(rendered.svg), still.svg, 'structural frame-zero geometry must equal the none twin');
      if (sharedStatic) assert.equal(render({ ...options, backend: 'smil' }).svg, rendered.svg, 'shared static CSS/SMIL control bodies differ');
      const size = frame(rendered.svg), key = `${layout}-${backend}-${state}`;
      const directory = path.join(out, key);
      await mkdir(directory);
      await writeFile(path.join(directory, 'source.svg'), rendered.svg);
      await writeFile(path.join(directory, 'none.svg'), still.svg);
      const moving = state === 'ambient', reduced = state === 'reduced';
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1,
        reducedMotion: reduced ? 'reduce' : 'no-preference', ...(moving ? { recordVideo: { dir: directory, size: { width: size.width, height: size.height } } } : {}) });
      openContexts.add(context);
      const capturePage = await context.newPage();
      capturePage.on('pageerror', error => report.pageErrors.push(error.message));
      await capturePage.route('**/*', route => route.abort());
      await capturePage.setContent(`<style>body{margin:0}img{display:block;width:${size.width}px;height:${size.height}px}</style>${reduced ? '<picture><source media="(prefers-reduced-motion: reduce)">' : ''}<img id="plate" alt="Synthetic C0 Developer Signature">${reduced ? '</picture>' : ''}`);
      const source = `data:image/svg+xml;base64,${Buffer.from(rendered.svg).toString('base64')}`;
      const twin = `data:image/svg+xml;base64,${Buffer.from(still.svg).toString('base64')}`;
      const entry = { key, layout, backend, state, sharedStaticBackends: sharedStatic ? ['css', 'smil'] : null, source: size,
        svgSha256: digest(rendered.svg), stillSha256: digest(still.svg), counters: rendered.counters,
        selectedSource: reduced ? 'picture-none-twin' : 'same-svg', frames: [], differences: [], video: null };
      report.playback.push(entry);
      captures.push({ context, page: capturePage, directory, entry, source, twin, reduced, moving, images: [] });
    }
    await Promise.all(captures.map(item => item.page.evaluate(({ source, twin, reduced }) => new Promise((resolve, reject) => {
      const image = document.querySelector('#plate');
      image.onload = () => { window.signatureLoadedAt = performance.now(); resolve(); };
      image.onerror = () => reject(new Error('synthetic Signature SVG failed to decode'));
      if (reduced) document.querySelector('source').srcset = twin;
      image.src = source;
    }), { source: item.source, twin: item.twin, reduced: item.reduced })));
    for (const requestedMs of report.frameTimes) await Promise.all(captures.map(async item => {
      await item.page.waitForFunction(target => performance.now() - window.signatureLoadedAt >= target, requestedMs, { timeout: 50_000 });
      const beforeMs = await item.page.evaluate(() => performance.now() - window.signatureLoadedAt);
      const filename = path.join(item.directory, `${requestedMs}.png`);
      const png = await item.page.locator('#plate').screenshot({ path: filename, animations: 'allow' });
      const afterMs = await item.page.evaluate(() => performance.now() - window.signatureLoadedAt);
      const decoded = capture.decodePng(png);
      item.entry.frames.push({ file: path.relative(out, filename), requestedMs, beforeMs, afterMs, captureDurationMs: afterMs - beforeMs,
        sha256: digest(png), pngSignatureHex: png.subarray(0, 8).toString('hex'), width: decoded.width, height: decoded.height });
      item.images.push(decoded);
      assert.ok(afterMs - requestedMs < report.maximumLateMs, `${item.entry.key} capture was too late for ${requestedMs}ms`);
      assert.equal(decoded.width, item.entry.source.width); assert.equal(decoded.height, item.entry.source.height);
    }));
    const control = captures.find(item => item.entry.state === 'none');
    for (const item of captures) {
      const selected = await item.page.locator('#plate').evaluate(image => ({ currentSrc: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight }));
      const selectedBody = Buffer.from(selected.currentSrc.split(',')[1], 'base64');
      item.entry.selectedBodySha256 = digest(selectedBody);
      assert.equal(item.entry.selectedBodySha256, item.reduced ? item.entry.stillSha256 : item.entry.svgSha256);
      item.entry.intrinsicSize = { width: selected.width, height: selected.height };
      assert.ok(selected.width > 0 && selected.height > 0 && selected.width <= 4096 && selected.height <= 4096, 'the selected SVG did not decode to positive bounded intrinsic dimensions');
      item.entry.differences = item.images.slice(1).map(image => capture.pixelDifference(item.images[0], image));
      if (item.moving) {
        assert.ok(item.entry.differences.slice(0, 2).some(delta => delta.changedPixels >= 16 && delta.totalChannelDelta >= 1_000), `${item.entry.key} had no measured motion`);
        item.entry.restVersusStill = capture.pixelDifference(item.images.at(-1), control.images.at(-1));
        assert.equal(item.entry.restVersusStill.changedPixels, 0, `${item.entry.key} did not return to its still twin after the README limit`);
      } else {
        assert.ok(item.entry.differences.every(delta => delta.changedPixels === 0), `${item.entry.key} changed despite its static control`);
        if (!item.reduced) assert.equal(item.entry.counters.animatedElements, 0);
      }
      if (item.reduced) {
        item.entry.reducedVersusStill = capture.pixelDifference(item.images[0], control.images[0]);
        assert.equal(item.entry.reducedVersusStill.changedPixels, 0, 'explicit reduced picture did not equal the none twin');
      }
      const video = item.page.video();
      await item.context.close();
      openContexts.delete(item.context);
      if (video) {
        const filename = path.join(item.directory, 'motion.webm');
        await rename(await video.path(), filename);
        item.entry.video = { file: path.relative(out, filename), measuredVisibleDurationMs: item.entry.frames.at(-1).afterMs, ...await capture.inspectWebmFile(filename) };
      }
    }
    await checkpoint();
  }
  assert.equal(report.playback.length, 14);
  assert.deepEqual(report.pageErrors, []);
  for (const [file, filename] of Object.entries(sourcePaths)) assert.equal(digest(await readFile(filename)), sourceFiles[file], `${file} changed during capture`);
  assert.deepEqual(await builtJavaScriptHashes(), provenance.builtFiles, 'executed workspace JavaScript changed during capture');
  report.complete = true;
} catch (error) {
  failure = error instanceof Error ? error : new Error(String(error));
  report.error = failure.message;
} finally {
  const cleanup = await Promise.allSettled([...openContexts].map(context => context.close()));
  if (browser) cleanup.push(...await Promise.allSettled([browser.close()]));
  const failed = cleanup.filter(result => result.status === 'rejected');
  if (failed.length) { report.cleanupFailures = failed.map(result => String(result.reason)); report.complete = false; failure ??= new Error('browser cleanup failed'); }
  await checkpoint();
}
if (failure) throw failure;
console.log(JSON.stringify({ sourceCommit: report.sourceCommit, dirty: report.sourceWorkingTreeDirty, browser: report.browserVersion,
  layoutCases: report.layout.length, playbackRows: report.playback.length, framesPerRow: report.frameTimes.length, complete: report.complete }));
