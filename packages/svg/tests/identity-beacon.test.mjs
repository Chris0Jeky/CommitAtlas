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
