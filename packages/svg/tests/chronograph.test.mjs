import assert from 'node:assert/strict';
import test from 'node:test';
import * as svg from '../dist/index.js';
import { assertSceneContract, stripSceneMotion } from './scene-harness.mjs';
import { sceneContext } from './scene.fixture.mjs';

const FROM = '2026-01-01';
const TO = '2026-01-14';

function day(date, count) {
  return { date, count, level: count === 0 ? 0 : 1 };
}
function calendar() {
  const days = [];
  const start = Date.parse(`${FROM}T00:00:00.000Z`);
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    days.push(day(date, date === '2026-01-01' || date === '2026-01-12' ? 4 : 0));
  }
  return days;
}
function release(tag, publishedAt) {
  return {
    repo: 'scene-demo/dial', name: 'Dial', description: null, sourceUrl: 'https://github.com/scene-demo/dial',
    websiteUrl: null, lifecycle: 'active', primaryLanguage: null, stars: 0, forks: 0, openIssuesAndPullRequests: 0,
    pushedAt: null, license: null, ci: { state: 'passing', label: 'ci', workflow: null, url: null },
    releaseState: 'published', release: { tag, name: tag, url: 'https://github.com/scene-demo/dial/releases/tag/v1', publishedAt, download: null },
  };
}
function inputs(overrides = {}) {
  const days = calendar();
  return {
    snapshot: {
      version: 1,
      profile: { version: 1, login: 'scene-demo', name: 'Scene Demo', profileUrl: 'https://github.com/scene-demo', publicRepositories: 1, followers: 0, following: 0, stars: 0, forks: 0, primaryLanguages: [], latestPushAt: null, repositoriesTruncated: false, freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'demo' } },
      contributions: { version: 1, login: 'scene-demo', totalContributions: 8, commits: 8, issues: 0, pullRequests: 0, reviews: 0, breakdownBasis: 'exact-counts', days, freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'demo' } },
      metrics: {
        version: 1,
        window: { from: FROM, to: TO, days: 14, observedDays: 14, complete: true },
        total: 8, activeDays: 2, density: 14.3, averagePerDay: 0, averagePerActiveDay: 4,
        peakDay: { date: '2026-01-01', count: 4 },
        streak: { version: 1, asOf: TO, current: 6, currentThrough: '2026-01-12', longest: 9, basis: 'returned-window', boundary: { current: 'closed', longest: 'closed' } },
        breakdown: { commits: 8, issues: 0, pullRequests: 0, reviews: 0 }, breakdownBasis: 'exact-counts',
        trend: { buckets: [], recent28Days: 8, previous28Days: null, changePercent: null, direction: 'new' },
        rhythm: { score: 0, level: 'starting', basis: '70% active-day density (capped at 80%) + 30% current streak (capped at 30 days)' },
      },
      projects: { version: 1, owner: 'scene-demo', projects: [release('v-in', '2026-01-08T00:00:00Z')], freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'demo' } },
      freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'demo' },
      ...overrides.snapshot,
    },
  };
}
const definition = () => {
  const scene = svg.getScene('chronograph');
  assert.ok(scene, 'chronograph scene is registered');
  return scene;
};
const render = (value = inputs(), overrides = {}) => svg.renderSceneDefinition(definition(), value, { ...sceneContext, ...overrides });

test('chronograph is a survey map over days, weeks, months and the supplied streak', () => {
  assert.equal(definition().family, 'map');
  assert.equal(definition().budget, 'map');
  assert.deepEqual(definition().supportedPacks, ['survey']);
  assert.deepEqual(definition().supportedMotion, ['none', 'subtle', 'ambient']);
  const model = definition().buildModel(inputs());
  assert.equal(model.current, 6);
  assert.equal(model.longest, 9);
  assert.equal(model.activeWeeks, 2);
  assert.equal(model.needle, -54);
  assert.equal(model.ticks.length, 7);
});

test('chronograph passes the shared harness and keeps ring motion decorative', () => {
  const ready = inputs();
  const changed = structuredClone(ready);
  changed.snapshot.metrics.streak.current = 7;
  assertSceneContract(definition(), {
    ready: {
      inputs: ready,
      textFields: ['snapshot.projects.projects.0.release.tag'],
      readings: ['CURRENT STREAK 6', 'LONGEST STREAK 9', 'ACTIVE WEEKS 2', 'v-in'],
      encodings: ['Illuminated arcs', 'Release ticks', 'streak needle', 'Ring rotation is decorative'],
    },
    changed: { inputs: changed },
    unavailable: { inputs: inputs({ snapshot: { freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'unavailable' } } }) },
  });
  const still = render();
  assert.match(still.svg, /\sA\s/u);
  const moving = render(undefined, { motion: 'ambient', backend: 'smil' });
  assert.equal(stripSceneMotion(moving.svg), still.svg);
  assert.equal(moving.counters.loopingGroups, 3);
  assert.ok(moving.counters.loopingGroups <= 4);
  assert.match(moving.svg, /dur="0\.6s"/u);
  assert.match(moving.svg, /dur="4\.2s"/u);
  assert.match(moving.svg, /dur="18s"/u);
  assert.match(still.svg, /rotate\(-54 /u);
  const subtle = render(undefined, { motion: 'subtle', backend: 'smil' });
  assert.equal(subtle.counters.animatedElements, 7);
  assert.equal(subtle.counters.loopingGroups, 0);
  assert.doesNotMatch(subtle.svg, /type="rotate"/u);
});

test('no current streak rests the needle at -90 degrees and never at zero', () => {
  const value = inputs();
  value.snapshot.metrics.streak.current = 0;
  value.snapshot.metrics.streak.currentThrough = null;
  value.snapshot.contributions.days = value.snapshot.contributions.days.map(item => ({ ...item, count: 0, level: 0 }));
  const result = render(value);
  assert.match(result.svg, /NO CURRENT STREAK/u);
  assert.match(result.svg, /rotate\(-90 /u);
  assert.doesNotMatch(result.svg, /rotate\(0[ )]/u);
  assert.doesNotMatch(result.svg, /\sA\s/u);
});

test('four themes and both layouts keep the readings', () => {
  for (const theme of Object.keys(svg.themes)) for (const layout of ['wide', 'compact']) {
    const result = render(undefined, { theme, layout, motion: 'ambient', backend: 'smil' });
    assert.equal(Number(result.svg.match(/viewBox="0 0 (\d+) /u)[1]), layout === 'compact' ? 480 : 720);
    assert.match(result.svg, /CURRENT STREAK 6/u);
    assert.match(result.svg, /LONGEST STREAK 9/u);
    assert.match(result.svg, /ACTIVE WEEKS 2/u);
    assert.ok(result.svg.includes(svg.themes[theme].chrome));
    assert.match(result.svg, />OBSERVED</u);
  }
});
