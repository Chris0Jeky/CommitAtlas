import assert from 'node:assert/strict';
import test from 'node:test';
import * as svg from '../dist/index.js';
import { sceneXmlText } from '../dist/scene-svg.js';
import { assertSceneContract, assertWellFormedXml, stripSceneMotion, SCENE_INJECTION } from './scene-harness.mjs';
import { exampleScene, sceneContext } from './scene.fixture.mjs';
import { coverageInputs, unavailableCoverageInputs } from './evidence-coverage.fixture.mjs';

const definition = () => {
  const scene = svg.getScene('evidence-coverage');
  assert.ok(scene, 'real evidence-coverage scene is registered');
  return scene;
};
const model = (inputs = coverageInputs()) => definition().buildModel(inputs);
const render = (inputs = coverageInputs(), overrides = {}) => svg.renderSceneDefinition(definition(), inputs, { ...sceneContext, ...overrides });
const row = (id, inputs) => model(inputs).rows.find(item => item.id === id);
const ROWS = ['calendar', 'mix', 'ci', 'releases', 'line-changes', 'private-activity', 'snapshot'];

test('evidence scene is an opt-in survey instrument, never the integration fixture', () => {
  assert.equal(definition().family, 'instrument');
  assert.equal(definition().budget, 'instrument');
  assert.deepEqual(definition().supportedPacks, ['survey']);
  assert.deepEqual(definition().supportedMotion, ['none', 'subtle', 'ambient']);
  assert.equal(svg.getScene('static-example'), undefined);
  assert.deepEqual(model().rows.map(item => item.id), ROWS);
});

test('each coverage row is grounded in its declared snapshot field', () => {
  // metrics.window.{observedDays,days,complete} plus contributions.freshness.
  assert.equal(row('calendar').label, 'PUBLIC PROFILE VIEW');
  assert.deepEqual(row('calendar').coverage, { state: 'complete', observed: 7, total: 7 });
  // contributions.breakdownBasis and the four named activity-mix fields.
  assert.equal(row('mix').detail, 'ANNUAL PERCENTAGES · NOT WINDOW-SCOPED');
  assert.deepEqual(row('mix').coverage, { state: 'complete', observed: 4, total: 4 });
  // projects.projects[].ci.state. Stale and unconfigured do not count as current observations.
  assert.equal(row('ci').detail, '4 PASSING · 1 STALE · 1 UNCONFIGURED');
  assert.deepEqual(row('ci').coverage, { state: 'partial', observed: 4, total: 6 });
  // projects.projects[].releaseState, checked against release presence.
  assert.equal(row('releases').detail, '3 PUBLISHED · 1 NONE · 2 UNAVAILABLE');
  assert.deepEqual(row('releases').coverage, { state: 'partial', observed: 4, total: 6 });
  // Explicit absence from this snapshot schema and collection contract.
  assert.equal(row('line-changes').detail, 'NOT OBSERVED');
  assert.equal(row('private-activity').detail, 'NOT REQUESTED');
  assert.equal(row('snapshot').detail, 'LIVE');
});

test('coverage passes the shared seven contracts', () => {
  const ready = coverageInputs(), changed = structuredClone(ready);
  changed.snapshot.projects.projects[0].ci.state = 'failing';
  assertSceneContract(definition(), {
    ready: { inputs: ready, textFields: [], readings: ['4 PASSING', '1 STALE', '1 UNCONFIGURED', '3 PUBLISHED', 'NOT WINDOW-SCOPED', 'NOT OBSERVED', 'NOT REQUESTED', 'LIVE'], encodings: ['Bar length', 'Neutral ink', 'Row order', 'Dashed', 'scan'] },
    changed: { inputs: changed }, unavailable: { inputs: unavailableCoverageInputs() },
  });
});

test('all themes, layouts and backends retain finished geometry and truthful descriptions', () => {
  for (const theme of Object.keys(svg.themes)) for (const layout of ['wide', 'compact']) for (const backend of ['css', 'smil']) {
    const still = render(undefined, { theme, layout, backend });
    const moving = render(undefined, { theme, layout, backend, motion: 'ambient' });
    assert.equal(stripSceneMotion(moving.svg), still.svg);
    assert.ok(moving.counters.bytes < 30_000);
    assert.equal(moving.counters.animatedElements, 4);
    assert.equal(moving.counters.loopingGroups, 1);
    const doc = assertWellFormedXml(still.svg);
    assert.equal(Number(doc.root.attrs.viewBox.split(' ')[2]), layout === 'compact' ? 480 : 720);
    for (const id of ROWS) assert.ok(doc.nodes.some(node => node.attrs.id?.endsWith(`-row-${id}`)));
    assert.match(still.svg, />OBSERVED</u);
    assert.doesNotMatch(still.svg, /DERIVED|HYPOTHESIS/u);
  }
});

test('the complete unavailable composition retains every dark static row and its accessible explanation', () => {
  for (const theme of Object.keys(svg.themes)) for (const layout of ['wide', 'compact']) {
    const result = render(unavailableCoverageInputs(), { theme, layout, motion: 'ambient', backend: 'smil' });
    assert.equal(result.unavailable, true);
    assert.equal(result.counters.animatedElements, 0);
    assert.doesNotMatch(result.svg, /<animate|<style/u);
    const doc = assertWellFormedXml(result.svg);
    const desc = sceneXmlText(doc.root.children.find(node => node.name === 'desc'));
    for (const id of ROWS) {
      const node = doc.nodes.find(node => node.attrs.id?.endsWith(`-row-${id}`));
      assert.ok(node, id);
      assert.equal(node.raw.includes(svg.themes[theme].chrome), false, `${id} must stay neutral`);
    }
    for (const literal of ['Calendar', 'mix', 'CI', 'releases', 'Line changes', 'Private activity', 'Snapshot']) assert.ok(desc.includes(literal), literal);
  }
});

test('only current observation rows receive scan targets; policy and stale rows never do', () => {
  const inputs = coverageInputs();
  inputs.snapshot.projects.freshness.mode = 'stale';
  const doc = assertWellFormedXml(render(inputs, { motion: 'ambient' }).svg);
  for (const id of ['ci', 'releases', 'line-changes', 'private-activity', 'snapshot']) {
    const node = doc.nodes.find(node => node.attrs.id?.endsWith(`-row-${id}`));
    assert.doesNotMatch(node.raw, /-target-|<animate/u);
  }
  assert.deepEqual(row('ci', inputs).coverage, { state: 'unavailable' });
  assert.deepEqual(row('releases', inputs).coverage, { state: 'unavailable' });
});

test('zero contributions and observed release absence are not missing data', () => {
  const inputs = coverageInputs();
  Object.assign(inputs.snapshot.contributions, { breakdownBasis: 'exact-counts', commits: 0, issues: 0, pullRequests: 0, reviews: 0, totalContributions: 0 });
  inputs.snapshot.contributions.days.forEach(day => { day.count = 0; });
  inputs.snapshot.projects.projects.forEach(project => { project.releaseState = 'none'; project.release = null; });
  assert.equal(row('calendar', inputs).coverage.state, 'complete');
  assert.equal(row('mix', inputs).detail, 'EXACT COUNTS · WINDOW-SCOPED');
  assert.deepEqual(row('releases', inputs).coverage, { state: 'complete', observed: 6, total: 6 });
  assert.equal(row('releases', inputs).detail, '6 NONE');
});

test('missing project boards remain not configured, never complete zero out of zero', () => {
  for (const projects of [null, { ...coverageInputs().snapshot.projects, projects: [] }]) {
    const inputs = coverageInputs(); inputs.snapshot.projects = projects;
    assert.deepEqual(row('ci', inputs).coverage, { state: 'not-observed' });
    assert.deepEqual(row('releases', inputs).coverage, { state: 'not-observed' });
    assert.doesNotMatch(render(inputs).svg, /0\/0/u);
  }
});

test('partial, stale, unavailable and unknown provenance cannot become complete current evidence', () => {
  for (const mode of ['partial', 'stale', 'unavailable', 'unknown']) {
    const inputs = coverageInputs(); inputs.snapshot.contributions.freshness.mode = mode;
    assert.notEqual(row('calendar', inputs).coverage.state, 'complete');
    assert.notEqual(row('mix', inputs).coverage.state, 'complete');
  }
  const partial = coverageInputs();
  partial.snapshot.contributions.freshness.mode = 'partial';
  Object.assign(partial.snapshot.metrics.window, { observedDays: 3, complete: false });
  assert.deepEqual(row('calendar', partial).coverage, { state: 'partial', observed: 3, total: 7 });
  partial.snapshot.metrics.window.observedDays = 8;
  assert.equal(row('calendar', partial).coverage.state, 'unavailable');
  const stale = coverageInputs(); stale.snapshot.freshness.mode = 'stale';
  assert.equal(row('calendar', stale).coverage.state, 'unavailable');
  assert.equal(row('ci', stale).coverage.state, 'unavailable');
});

test('unknown and contradictory per-project states fail neutral without echoing input text', () => {
  const inputs = coverageInputs();
  inputs.snapshot.projects.projects.forEach(project => { project.ci.state = SCENE_INJECTION; project.releaseState = 'published'; project.release = null; });
  assert.equal(row('ci', inputs).detail, '6 UNAVAILABLE');
  assert.deepEqual(row('ci', inputs).coverage, { state: 'unavailable' });
  assert.equal(row('releases', inputs).detail, '6 UNAVAILABLE');
  assertWellFormedXml(render(inputs).svg);
  assert.doesNotMatch(render(inputs).svg, /<script|onerror/u);
});

test('synthetic provenance is visible even when carried by a nested source', () => {
  const inputs = coverageInputs();
  inputs.snapshot.contributions.freshness.source = 'synthetic-demo';
  assert.match(render(inputs).svg, /SYNTHETIC PREVIEW/u);
  assert.doesNotMatch(render().svg, /SYNTHETIC PREVIEW/u);
});

test('unavailable renderer remains optional and subject to engine naming and motion checks', () => {
  const base = exampleScene({ buildModel: () => svg.sceneUnavailable('Synthetic unavailable') });
  const custom = { ...base, renderUnavailable(_state, _context, accessibility) {
    return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${svg.escapeXml(accessibility.title)}" viewBox="0 0 400 120"><title>${svg.escapeXml(accessibility.title)}</title><desc>${svg.escapeXml(accessibility.description)}</desc><text x="20" y="30">UNAVAILABLE</text></svg>`;
  } };
  assert.equal(svg.renderSceneDefinition(custom, coverageInputs(), sceneContext).unavailable, true);
  assert.throws(() => svg.renderSceneDefinition({ ...custom, renderUnavailable: 1 }, coverageInputs(), sceneContext), /renderUnavailable/u);
  assert.throws(() => svg.renderSceneDefinition({ ...custom, renderUnavailable(state, context, accessibility) {
    return custom.renderUnavailable(state, context, accessibility).replace('UNAVAILABLE</text>', 'PASSING</text>');
  } }, coverageInputs(), sceneContext), /unavailable.*visible|UNAVAILABLE/u);
  assert.throws(() => svg.renderSceneDefinition({ ...custom, renderUnavailable(state, context, accessibility) {
    svg.compileSceneMotion(context, [{ primitive: 'scan', target: 'row', decorative: true }], { target: 'github-readme' });
    return custom.renderUnavailable(state, context, accessibility);
  } }, coverageInputs(), { ...sceneContext, motion: 'ambient' }), /unavailable.*motion/u);
});

test('weighted public-profile percentages remain observed when they contain decimals', () => {
  const inputs = coverageInputs();
  Object.assign(inputs.snapshot.contributions, { commits: 60.2, issues: 9.8, pullRequests: 20, reviews: 10 });
  assert.deepEqual(row('mix', inputs).coverage, { state: 'complete', observed: 4, total: 4 });
});

test('snapshot mode is a neutral status, not a fabricated completeness fraction or missing observation', () => {
  const doc = assertWellFormedXml(render().svg);
  const snapshot = doc.nodes.find(node => node.attrs.id?.endsWith('-row-snapshot'));
  assert.match(snapshot.raw, />LIVE</u);
  assert.doesNotMatch(snapshot.raw, /NOT OBSERVED|COMPLETE|\d\/\d/u);
});


test('partial project freshness preserves independently observed CI and release evidence', () => {
  // GitHubClient sets the board partial when either family has an unavailable member.
  const inputs = coverageInputs();
  inputs.snapshot.projects.freshness.mode = 'partial';
  inputs.snapshot.projects.projects.forEach(project => {
    project.ci.state = 'passing'; project.releaseState = 'unavailable'; project.release = null;
  });
  assert.deepEqual(row('ci', inputs).coverage, { state: 'complete', observed: 6, total: 6 });
  assert.deepEqual(row('releases', inputs).coverage, { state: 'unavailable' });
  inputs.snapshot.projects.projects.forEach(project => {
    project.ci.state = 'unavailable'; project.releaseState = 'none';
  });
  assert.deepEqual(row('ci', inputs).coverage, { state: 'unavailable' });
  assert.deepEqual(row('releases', inputs).coverage, { state: 'complete', observed: 6, total: 6 });
});

test('unknown source provenance cannot authorize calendar, mix or board observations', () => {
  const inputs = coverageInputs();
  inputs.snapshot.contributions.freshness.source = 'unrecognized';
  inputs.snapshot.projects.freshness.source = 'unrecognized';
  for (const id of ['calendar', 'mix', 'ci', 'releases']) {
    assert.equal(row(id, inputs).coverage.state, 'unavailable', id);
  }
  assert.equal(render(inputs, { motion: 'ambient' }).counters.animatedElements, 0);
});

test('unknown root source makes the whole scene unavailable despite valid nested evidence', () => {
  for (const source of ['unknown', '', null, 7, {}]) for (const mode of ['live', 'demo', 'partial', 'stale']) {
    const inputs = coverageInputs();
    Object.assign(inputs.snapshot.freshness, { source, mode });
    const rendered = render(inputs, { motion: 'ambient', backend: 'smil' });
    assert.equal(rendered.unavailable, true, JSON.stringify({ source, mode }));
    assert.equal(rendered.counters.animatedElements, 0);
    assert.doesNotMatch(rendered.svg, /PUBLIC SNAPSHOT|COMPLETE|<animate/u);
    const doc = assertWellFormedXml(rendered.svg);
    assert.equal(doc.nodes.filter(node => /-row-/u.test(node.attrs.id ?? '')).length, 7);
  }
});

test('malformed published releases cannot grant complete coverage or a scan target', () => {
  const valid = coverageInputs().snapshot.projects.projects[0].release;
  const invalid = [null, [], {}, true, 'v1'];
  for (const key of Object.keys(valid)) {
    const missing = { ...valid }; delete missing[key]; invalid.push(missing);
  }
  invalid.push(
    { ...valid, tag: '' }, { ...valid, tag: 't'.repeat(201) }, { ...valid, name: 0 },
    { ...valid, name: 'n'.repeat(201) }, { ...valid, url: 'javascript:alert(1)' },
    { ...valid, url: 'https://user:password@github.com/release' },
    { ...valid, url: `https://github.com/${'a'.repeat(501)}` },
    { ...valid, publishedAt: '' }, { ...valid, publishedAt: '2026-02-30T00:00:00Z' },
    { ...valid, publishedAt: 'invalid' }, { ...valid, download: {} }, { ...valid, download: [] },
    { ...valid, download: { name: 'asset', url: 'http://github.com/asset' } },
  );
  for (const release of invalid) {
    const inputs = coverageInputs();
    inputs.snapshot.projects.projects.forEach(project => { project.releaseState = 'published'; project.release = release; });
    assert.deepEqual(row('releases', inputs).coverage, { state: 'unavailable' }, JSON.stringify(release));
    assert.equal(row('releases', inputs).detail, '6 UNAVAILABLE');
    const doc = assertWellFormedXml(render(inputs, { motion: 'ambient', backend: 'smil' }).svg);
    const node = doc.nodes.find(item => item.attrs.id?.endsWith('-row-releases'));
    assert.doesNotMatch(node.raw, /COMPLETE|6\/6|<animate|-target-scan/u);
    assert.equal(row('ci', inputs).coverage.observed, 4, 'release validation must not erase separate CI evidence');
  }
});

test('valid bounded release records and confirmed absence remain observations', () => {
  const inputs = coverageInputs();
  const release = { ...inputs.snapshot.projects.projects[0].release,
    tag: '界'.repeat(200), name: '😀'.repeat(200), publishedAt: '2026-01-07T00:00:00.500Z',
    download: { name: '😀'.repeat(255), url: 'https://github.com/scene-demo/atlas/releases/download/v1/asset.zip' },
  };
  inputs.snapshot.projects.projects.forEach((project, i) => {
    project.releaseState = i % 2 === 0 ? 'published' : 'none';
    project.release = i % 2 === 0 ? release : null;
  });
  assert.deepEqual(row('releases', inputs).coverage, { state: 'complete', observed: 6, total: 6 });
  assert.equal(row('releases', inputs).detail, '3 PUBLISHED · 3 NONE');
  assertWellFormedXml(render(inputs).svg);
});
