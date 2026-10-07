import assert from 'node:assert/strict';
import test from 'node:test';
import * as svg from '../dist/index.js';
import { parseSceneXml, sceneVisibleText } from '../dist/scene-svg.js';
import { calculateContributionMetrics } from '../../core/dist/index.js';

const DAY = 86_400_000;
const freshness = { generatedAt: '2026-01-17T23:59:59.999Z', source: 'synthetic-demo', mode: 'demo' };
function inputs(from = '2026-01-04', length = 14, count = 0) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const days = Array.from({length}, (_, index) => ({date: new Date(start + index * DAY).toISOString().slice(0, 10), count}));
  const to = days.at(-1).date;
  const stamp = {...freshness, generatedAt: `${to}T23:59:59.999Z`};
  return {snapshot: {version: 1, freshness: {...stamp}, contributions: {days, freshness: {...stamp}, breakdownBasis: 'exact-counts'},
    metrics: calculateContributionMetrics(days, {days: length, asOf: to, commits: length * count, issues: 0, pullRequests: 0, reviews: 0}),
    projects: {projects: [], freshness: {...stamp}}}};
}
function release(tag, publishedAt) {
  return {repo: `scene-demo/${tag}`, name: tag, releaseState: 'published', release: {tag, name: tag, publishedAt,
    url: `https://github.com/scene-demo/${tag}/releases/tag/v1`, download: null}};
}
const scene = () => svg.getScene('activity-terrain');
const render = (value, overrides = {}) => svg.renderSceneDefinition(scene(), value, {theme: 'aurora', pack: 'survey', motion: 'none', backend: 'smil', layout: 'wide', instanceNamespace: 'bounds', seed: '', ...overrides});
const painted = result => sceneVisibleText(parseSceneXml(result.svg).root);

for (const index of [0, 6, 13]) test(`missing calendar date ${index} never becomes observed zero activity`, () => {
  const value = inputs();
  value.snapshot.contributions.days.splice(index, 1);
  const result = render(value, {motion: 'ambient'});
  assert.equal(result.unavailable, true);
  assert.equal(result.counters.animatedElements, 0);
});
test('duplicate dates cannot inflate a complete-looking calendar', () => {
  const value = inputs('2026-01-04', 14, 1);
  value.snapshot.contributions.days[6] = {...value.snapshot.contributions.days[5]};
  assert.equal(render(value).unavailable, true);
});
test('a missing leap date is not an inactive day', () => {
  const value = inputs('2024-02-25', 14, 1);
  value.snapshot.contributions.days = value.snapshot.contributions.days.filter(day => day.date !== '2024-02-29');
  assert.equal(render(value).unavailable, true);
});
test('contradictory window coverage metadata fails closed', () => {
  for (const patch of [{days: 15}, {observedDays: 13}, {complete: false}]) {
    const value = inputs();
    Object.assign(value.snapshot.metrics.window, patch);
    assert.equal(render(value).unavailable, true, JSON.stringify(patch));
  }
});
test('reordering a complete calendar leaves the model and output unchanged', () => {
  const value = inputs('2026-01-04', 14, 1);
  const reverse = structuredClone(value);
  reverse.snapshot.contributions.days.reverse();
  assert.deepEqual(scene().buildModel(value), scene().buildModel(reverse));
  assert.deepEqual(render(value), render(reverse));
});
for (const length of [365, 366, 730, 731]) test(`complete ${length}-day windows remain supported`, () => {
  const value = inputs('2024-01-01', length, 1);
  const model = scene().buildModel(value);
  assert.equal(model.total, length);
  assert.equal(render(value).unavailable, false);
});
for (const layout of ['wide', 'compact']) test(`${layout} prints every primary reading, exact window and provenance`, () => {
  const value = inputs();
  const text = painted(render(value, {layout}));
  for (const reading of ['TOTAL 0', 'PEAK WEEK 0', 'QUIET RUN 2', 'CURRENT STREAK 0', 'SYNTHETIC PREVIEW', '2026-01-04', '2026-01-17', '2026-01-17T23:59:59.999Z']) assert.ok(text.includes(reading), reading);
  assert.match(text, /QUIET RUN 2 WEEKS/);
});
for (const layer of ['freshness', 'contributions']) test(`${layer} stale and unknown sources never render current observations`, () => {
  for (const patch of [{mode: 'stale'}, {mode: 'unavailable'}, {mode: 'unknown'}, {source: 'unknown'}, {generatedAt: '2026-01-99T00:00:00Z'}]) {
    const value = inputs();
    Object.assign(layer === 'freshness' ? value.snapshot.freshness : value.snapshot.contributions.freshness, patch);
    const result = render(value, {motion: 'ambient'});
    assert.equal(result.unavailable, true, JSON.stringify(patch));
    assert.equal(result.counters.animatedElements, 0);
    assert.doesNotMatch(painted(result), /NO OBSERVED ACTIVITY IN WINDOW/);
  }
});
test('a stale plate retains the observation timestamp and stale distinction', () => {
  const value = inputs();
  value.snapshot.contributions.freshness.mode = 'stale';
  const text = painted(render(value));
  assert.match(text, /[Ss][Tt][Aa][Ll][Ee]/);
  assert.ok(text.includes(freshness.generatedAt));
});
test('partial contribution freshness cannot authorize a full terrain', () => {
  const value = inputs();
  value.snapshot.contributions.freshness.mode = 'partial';
  assert.equal(render(value).unavailable, true);
});
test('an observed release remains marked on a flat zero-activity basin', () => {
  const value = inputs();
  value.snapshot.projects.projects = [release('v-zero', '2026-01-10T12:00:00.000Z')];
  const result = render(value);
  assert.match(painted(result), /NO OBSERVED ACTIVITY IN WINDOW/);
  assert.ok(painted(result).includes('v-zero'));
});
test('release timestamps are actual UTC instants and malformed evidence remains blocked', () => {
  for (const stamp of ['2026-01-10T99:99:99Z', '2026-01-10T24:00:00Z', '2026-01-10', '2026-02-30T00:00:00Z']) {
    const value = inputs();
    value.snapshot.projects.projects = [release('bad-release', stamp)];
    const model = scene().buildModel(value);
    assert.equal(model.peaks.length, 0, stamp);
    assert.equal(model.blocked, 1, stamp);
  }
});
test('final-day releases are inside the window but next midnight is not', () => {
  const value = inputs();
  value.snapshot.projects.projects = [release('v-last', '2026-01-17T23:59:59.999Z'), release('v-next', '2026-01-18T00:00:00.000Z')];
  const model = scene().buildModel(value);
  assert.deepEqual(model.peaks, [{index: 1, label: 'v-last'}]);
});
test('two releases in the same week both retain their identity', () => {
  const value = inputs();
  value.snapshot.projects.projects = [release('v-one', '2026-01-11T12:00:00Z'), release('v-two', '2026-01-12T12:00:00Z')];
  const text = painted(render(value));
  assert.ok(text.includes('v-one'));
  assert.ok(text.includes('v-two'));
});
test('stale project evidence is blocked independently of a current calendar', () => {
  const value = inputs();
  value.snapshot.projects.freshness.mode = 'stale';
  value.snapshot.projects.projects = [release('stale-tag', '2026-01-10T12:00:00Z')];
  const result = render(value);
  assert.equal(result.unavailable, false);
  assert.doesNotMatch(painted(result), /stale-tag/);
  assert.match(painted(result), /RELEASE SIGNAL BLOCKED/);
});
test('inconsistent release absence never appears as confirmed none', () => {
  const value = inputs();
  value.snapshot.projects.projects = [{...release('v-one', '2026-01-10T12:00:00Z'), releaseState: 'none'}];
  assert.equal(scene().buildModel(value).blocked, 1);
});
