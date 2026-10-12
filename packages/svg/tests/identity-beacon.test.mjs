import assert from 'node:assert/strict';
import test from 'node:test';
import * as svg from '../dist/index.js';
import { assertSceneContract, assertWellFormedXml, stripSceneMotion } from './scene-harness.mjs';
import { sceneContext, sceneInputs } from './scene.fixture.mjs';

function project(name, issues) {
  return {
    repo: `scene-demo/${name.toLowerCase()}`, name, description: null, sourceUrl: 'https://github.com/scene-demo/atlas',
    websiteUrl: null, lifecycle: 'active', primaryLanguage: null, stars: 0, forks: 0, openIssuesAndPullRequests: issues,
    pushedAt: null, license: null, ci: { state: 'passing', label: 'ci', workflow: null, url: null },
    releaseState: 'none', release: null,
  };
}
function inputs() {
  const base = sceneInputs();
  const identity = svg.createIdentityConfig({ name: 'Ada', tagline: 'Signals', focus: ['Alpha', 'Missing', 'Beta'] });
  base.snapshot.projects = {
    version: 1, owner: 'scene-demo',
    projects: [project('Alpha', 4), project('Beta', 2), project('Gamma', 9)],
    freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'demo' },
  };
  return { snapshot: base.snapshot, identity };
}
const definition = () => {
  const scene = svg.getScene('identity-beacon');
  assert.ok(scene, 'identity-beacon scene is registered');
  return scene;
};
const render = (value = inputs(), overrides = {}) => svg.renderSceneDefinition(definition(), value, { ...sceneContext, ...overrides });

test('identity-beacon is a static scene hero, not a hosted plate', () => {
  assert.equal(definition().family, 'scene');
  assert.equal(definition().budget, 'scene');
  assert.deepEqual(definition().supportedPacks, ['survey']);
  assert.deepEqual(definition().supportedMotion, ['none', 'ambient', 'cinematic']);
  const model = definition().buildModel(inputs());
  assert.equal(model.name, 'Ada');
  assert.deepEqual(model.bodies.map(body => body.name), ['Alpha', 'Beta']);
  assert.deepEqual(model.bodies.map(body => body.size), [1, 0.5]);
  assert.deepEqual(model.unmatched, ['Missing']);
});

test('identity-beacon passes the harness and keeps cinematic frame zero still', () => {
  const ready = inputs();
  const changed = structuredClone(ready);
  changed.snapshot.projects.projects[0].openIssuesAndPullRequests = 8;
  changed.identity = ready.identity;
  assertSceneContract(definition(), {
    ready: {
      inputs: ready, textFields: [],
      readings: ['Ada', 'Signals', 'Missing', 'Alpha'],
      encodings: ['Coordinate grid', 'OPEN ISSUES AND PULL REQUESTS', 'Survey beam', 'Project bodies'],
    },
    changed: { inputs: changed },
    unavailable: { inputs: { snapshot: ready.snapshot } },
  });
  const still = render();
  const cinematic = render(undefined, { motion: 'cinematic', backend: 'smil' });
  assert.equal(stripSceneMotion(cinematic.svg), still.svg);
  assert.match(cinematic.svg, /dur="12s"/u);
  const ambient = render(undefined, { motion: 'ambient', backend: 'smil' });
  assert.equal(ambient.counters.animatedElements, 3);
  assert.equal(ambient.counters.loopingGroups, 2);
  assert.ok(ambient.counters.loopingGroups <= svg.MOTION_BUDGETS.scene.loopingGroups);
});

test('identity text is escaped and a missing identity is not a healthy plate', () => {
  const identity = svg.createIdentityConfig({ name: 'A<b>&"', tagline: 'Tag <script>', focus: ['F<img>'] });
  const value = inputs();
  value.identity = identity;
  const result = render(value);
  assertWellFormedXml(result.svg);
  assert.ok(result.svg.includes(svg.escapeXml('A<b>&"')));
  assert.ok(result.svg.includes(svg.escapeXml('Tag <script>')));
  assert.ok(result.svg.includes(svg.escapeXml('F<img>')));
  assert.doesNotMatch(result.svg, /<script|<img|<b>/u);
  const missing = render({ snapshot: value.snapshot });
  assert.equal(missing.unavailable, true);
  assert.match(missing.svg, /UNAVAILABLE/u);
  assert.doesNotMatch(missing.svg, /<animate|<style/u);
});

test('the name line fits the 860 and 480 plates without a webfont', () => {
  for (const layout of ['wide', 'compact']) {
    const result = render(undefined, { layout, theme: 'paper' });
    assert.equal(Number(result.svg.match(/viewBox="0 0 (\d+) /u)[1]), layout === 'compact' ? 480 : 860);
    assert.match(result.svg, /Ada/);
    assert.doesNotMatch(result.svg, /@font-face|fonts\.google/u);
    assert.ok(result.svg.includes(svg.themes.paper.text));
  }
});

const invalidEvidence = [
  ['missing root freshness', value => { delete value.snapshot.freshness; }],
  ['unknown root mode', value => { value.snapshot.freshness.mode = 'fresh'; }],
  ['stale root', value => { value.snapshot.freshness.mode = 'stale'; }],
  ['partial root', value => { value.snapshot.freshness.mode = 'partial'; }],
  ['missing root date', value => { delete value.snapshot.freshness.generatedAt; }],
  ['invalid root date', value => { value.snapshot.freshness.generatedAt = 'not-a-date'; }],
  ['impossible root date', value => { value.snapshot.freshness.generatedAt = '2026-02-30T00:00:00Z'; }],
  ['non-UTC root date', value => { value.snapshot.freshness.generatedAt = '2026-01-07T00:00:00+00:00'; }],
  ['unknown root source', value => { value.snapshot.freshness.source = 'invented'; }],
  ['demo mode with public root source', value => { value.snapshot.freshness.source = 'github-rest'; }],
  ['live mode with synthetic root source', value => { value.snapshot.freshness.mode = 'live'; }],
  ['missing project board', value => { delete value.snapshot.projects; }],
  ['null project board', value => { value.snapshot.projects = null; }],
  ['missing project freshness', value => { delete value.snapshot.projects.freshness; }],
  ['unavailable project board with residual rows', value => { value.snapshot.projects.freshness.mode = 'unavailable'; }],
  ['stale project board with residual rows', value => { value.snapshot.projects.freshness.mode = 'stale'; }],
  ['partial project board', value => { value.snapshot.projects.freshness.mode = 'partial'; }],
  ['unknown project mode', value => { value.snapshot.projects.freshness.mode = 'ready'; }],
  ['invalid project date', value => { value.snapshot.projects.freshness.generatedAt = '2026-01-14Tnot-a-time'; }],
  ['impossible project date', value => { value.snapshot.projects.freshness.generatedAt = '2026-02-30T00:00:00.000Z'; }],
  ['unknown project source', value => { value.snapshot.projects.freshness.source = 'invented'; }],
  ['demo mode with public board source', value => { value.snapshot.projects.freshness.source = 'github-rest'; }],
  ['live mode with synthetic board source', value => { value.snapshot.projects.freshness.mode = 'live'; }],
  ['mixed synthetic and public observations', value => { value.snapshot.projects.freshness = { ...value.snapshot.projects.freshness, source: 'github-rest', mode: 'live' }; }],
  ['old project observation still labelled live', value => {
    value.snapshot.freshness = { generatedAt: '2026-01-18T00:00:00Z', source: 'github-graphql', mode: 'live' };
    value.snapshot.projects.freshness = { generatedAt: '2026-01-14T00:00:00Z', source: 'github-rest', mode: 'live' };
  }],
  ['missing issue reading', value => { delete value.snapshot.projects.projects[0].openIssuesAndPullRequests; }],
  ['negative issue reading', value => { value.snapshot.projects.projects[0].openIssuesAndPullRequests = -1; }],
  ['fractional issue reading', value => { value.snapshot.projects.projects[0].openIssuesAndPullRequests = 1.5; }],
  ['null project row', value => { value.snapshot.projects.projects[0] = null; }],
];
for (const [name, change] of invalidEvidence) {
  test(`beacon refuses ${name} without observed readings or animation`, () => {
    const value = inputs();
    change(value);
    for (const motion of ['none', 'ambient', 'cinematic']) {
      for (const backend of ['css', 'smil']) {
        const result = render(value, { motion, backend });
        assert.equal(result.unavailable, true);
        assert.equal(result.counters.animatedElements, 0);
        assert.doesNotMatch(result.svg, />OBSERVED<|<animate|<style/u);
      }
    }
  });
}

test('beacon accepts an explicitly observed empty board but not an absent board', () => {
  const value = inputs();
  value.snapshot.projects.projects = [];
  const result = render(value);
  assert.equal(result.unavailable, false);
  assert.deepEqual(definition().buildModel(value).bodies, []);
  assert.deepEqual(definition().buildModel(value).unmatched, ['Alpha', 'Missing', 'Beta']);
});

test('beacon validates component clocks independently and attributes counts to the board', () => {
  const value = inputs();
  value.snapshot.freshness = { generatedAt: '2026-01-14T00:00:00Z', source: 'github-graphql', mode: 'live' };
  value.snapshot.projects.freshness = { generatedAt: '2026-01-14T00:00:01.5Z', source: 'github-rest', mode: 'live' };
  const model = definition().buildModel(value);
  assert.equal(model.source, 'github-rest');
  assert.equal(model.generatedAt, '2026-01-14T00:00:01.500Z');
  assert.equal(model.disclosure, 'public');
  assert.equal(render(value).unavailable, false);
});

test('beacon keeps genuinely observed zero issue counts available', () => {
  const value = inputs();
  for (const project of value.snapshot.projects.projects) project.openIssuesAndPullRequests = 0;
  const model = definition().buildModel(value);
  assert.deepEqual(model.bodies.map(body => body.size), [0, 0]);
  assert.equal(render(value).unavailable, false);
});

// Nonfinite inputs are also rejected by the shared canonical-JSON boundary.
test('beacon rejects nonfinite readings at the model and serialization boundaries', () => {
  const value = inputs();
  value.snapshot.projects.projects[0].openIssuesAndPullRequests = Infinity;
  assert.equal(definition().buildModel(value).state, 'unavailable');
  assert.throws(() => render(value), /canonical JSON requires finite numbers/u);
});
