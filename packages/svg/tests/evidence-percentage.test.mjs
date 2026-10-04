import assert from 'node:assert/strict';
import test from 'node:test';
import { getScene, renderSceneDefinition, themes } from '../dist/index.js';
import { assertWellFormedXml } from './scene-harness.mjs';
import { coverageInputs } from './evidence-coverage.fixture.mjs';
import { sceneContext } from './scene.fixture.mjs';

function inputsFor(values) {
  const inputs = coverageInputs();
  for (const [index, field] of ['commits', 'issues', 'pullRequests', 'reviews'].entries()) {
    inputs.snapshot.contributions[field] = values[index];
  }
  return inputs;
}

test('inconsistent annual percentages are neutral and never scanned as complete coverage', () => {
  const scene = getScene('evidence-coverage');
  for (const values of [[25, 25, 25, 0], [100, 100, 100, 100], [60, 20, 10, 8.99], [60, 20, 10, 11.01]]) {
    const inputs = inputsFor(values);
    const mix = scene.buildModel(inputs).rows.find(row => row.id === 'mix');
    assert.deepEqual(mix.coverage, { state: 'unavailable' }, String(values));
    for (const theme of Object.keys(themes)) {
      const rendered = renderSceneDefinition(scene, inputs, { ...sceneContext, theme, motion: 'ambient', backend: 'smil' });
      const row = assertWellFormedXml(rendered.svg).nodes.find(node => node.attrs.id?.endsWith('-row-mix'));
      assert.doesNotMatch(row.raw, /COMPLETE|4\/4|<animate|-target-scan/u);
      assert.equal(row.raw.includes(themes[theme].chrome), false);
    }
  }
});

test('rounded and fractional annual percentages retain the producer tolerance', () => {
  for (const values of [[60, 20, 10, 9], [60, 20, 10, 11], [60.2, 9.8, 20, 10], [25, 25, 25, 25]]) {
    const row = getScene('evidence-coverage').buildModel(inputsFor(values)).rows.find(row => row.id === 'mix');
    assert.deepEqual(row.coverage, { state: 'complete', observed: 4, total: 4 }, String(values));
  }
});

test('the public parser zero-activity representation remains an observed zero', () => {
  const inputs = inputsFor([0, 0, 0, 0]);
  inputs.snapshot.contributions.totalContributions = 0;
  inputs.snapshot.contributions.days.forEach(day => { day.count = 0; });
  const row = getScene('evidence-coverage').buildModel(inputs).rows.find(row => row.id === 'mix');
  assert.deepEqual(row.coverage, { state: 'complete', observed: 4, total: 4 });
});

test('exact counts are not subject to a percentage total', () => {
  const inputs = inputsFor([25, 25, 25, 0]);
  inputs.snapshot.contributions.breakdownBasis = 'exact-counts';
  inputs.snapshot.contributions.freshness.source = 'github-graphql';
  const row = getScene('evidence-coverage').buildModel(inputs).rows.find(row => row.id === 'mix');
  assert.equal(row.detail, 'EXACT COUNTS · WINDOW-SCOPED');
  assert.deepEqual(row.coverage, { state: 'complete', observed: 4, total: 4 });
});

test('zero percentages require an observed zero total and zero calendar, not contradictory activity', () => {
  const scene = getScene('evidence-coverage');
  for (const [total, days] of [
    [1, [{ date: '2026-01-07', count: 0 }]],
    [0, [{ date: '2026-01-07', count: 1 }]],
    [null, [{ date: '2026-01-07', count: 0 }]],
    [0, []], [0, null], [0, [{}]], [0, [{ count: null }]],
  ]) {
    const inputs = inputsFor([0, 0, 0, 0]);
    Object.assign(inputs.snapshot.contributions, { totalContributions: total, days });
    const row = scene.buildModel(inputs).rows.find(item => item.id === 'mix');
    assert.equal(row.coverage.state, 'unavailable', JSON.stringify({ total, days }));
    const rendered = renderSceneDefinition(scene, inputs, { ...sceneContext, motion: 'ambient', backend: 'smil' });
    const node = assertWellFormedXml(rendered.svg).nodes.find(item => item.attrs.id?.endsWith('-row-mix'));
    assert.doesNotMatch(node.raw, /COMPLETE|4\/4|<animate|-target-scan/u);
  }
});

test('zero-percentage exception requires valid unique dated calendar observations', () => {
  for (const days of [[{ count: 0 }], [{ date: '2026-02-30', count: 0 }],
    [{ date: '2026-01-07', count: 0 }, { date: '2026-01-07', count: 0 }]]) {
    const inputs = inputsFor([0, 0, 0, 0]);
    Object.assign(inputs.snapshot.contributions, { totalContributions: 0, days });
    const row = getScene('evidence-coverage').buildModel(inputs).rows.find(item => item.id === 'mix');
    assert.equal(row.coverage.state, 'unavailable', JSON.stringify(days));
  }
});
