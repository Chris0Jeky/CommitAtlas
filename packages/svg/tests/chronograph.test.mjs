import assert from 'node:assert/strict';
import test from 'node:test';
import * as svg from '../dist/index.js';
import { parseSceneXml, sceneXmlText } from '../dist/scene-svg.js';
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

function assertInside(markup, width) {
  const visit = (node, originX) => {
    let x = originX;
    const translated = /translate\(([-\d.]+) [-\d.]+\)/u.exec(node.attrs.transform ?? '');
    if (translated) x += Number(translated[1]);
    if (node.name === 'rect') {
      const left = x + Number(node.attrs.x ?? 0);
      const right = left + Number(node.attrs.width ?? 0);
      assert.ok(left >= -0.5 && right <= width + 0.5, `rect ${left}..${right}`);
    }
    if (node.name === 'circle') {
      const cx = x + Number(node.attrs.cx);
      const radius = Number(node.attrs.r ?? 0);
      assert.ok(cx - radius >= -0.5 && cx + radius <= width + 0.5, `circle ${cx} r ${radius}`);
    }
    if (node.name === 'line') {
      for (const attr of ['x1', 'x2']) {
        const value = x + Number(node.attrs[attr] ?? 0);
        assert.ok(value >= -0.5 && value <= width + 0.5, `line ${attr} ${value}`);
      }
    }
    if (node.name === 'text') {
      const words = sceneXmlText(node);
      const size = Number(node.attrs['font-size'] ?? 16);
      const extent = [...words].length * size * 0.62;
      const anchor = node.attrs['text-anchor'];
      const tx = x + Number(node.attrs.x ?? 0);
      const left = anchor === 'end' ? tx - extent : anchor === 'middle' ? tx - extent / 2 : tx;
      const right = anchor === 'end' ? tx : anchor === 'middle' ? tx + extent / 2 : tx + extent;
      assert.ok(left >= -0.5 && right <= width + 0.5, `text ${words} ${left}..${right}`);
    }
    for (const child of node.children) visit(child, x);
  };
  visit(parseSceneXml(markup).root, 0);
}

test('a one-day fragment of a 14-day window is unavailable and draws no full ring', () => {
  const value = inputs();
  value.snapshot.contributions.days = [value.snapshot.contributions.days[0]];
  const result = render(value);
  assert.equal(result.unavailable, true);
  assert.doesNotMatch(result.svg, /<circle\b/u);
  const partial = inputs();
  partial.snapshot.contributions.freshness.mode = 'partial';
  assert.equal(render(partial).unavailable, true);
});

test('a complete 730-day calendar renders available', () => {
  const length = 730;
  const start = Date.parse('2024-01-01T00:00:00.000Z');
  const days = Array.from({ length }, (_, index) => day(new Date(start + index * 86_400_000).toISOString().slice(0, 10), 1));
  const value = inputs();
  value.snapshot.contributions.days = days;
  value.snapshot.metrics.window = { from: days[0].date, to: days.at(-1).date, days: length, observedDays: length, complete: true };
  value.snapshot.projects = null;
  const result = render(value, { layout: 'compact' });
  assert.equal(result.unavailable, false);
  assert.equal(definition().buildModel(value).observedDays, 730);
  assert.match(result.svg, /ACTIVE WEEKS \d+/u);
  assertInside(result.svg, 480);
  assert.equal(render(value, { layout: 'wide' }).unavailable, false);
});

test('an unavailable project release blocks the signal while published marks remain', () => {
  const value = inputs();
  const published = release('v-in', '2026-01-08T00:00:00Z');
  const missing = { ...release('v-gap', '2026-01-09T00:00:00Z'), repo: 'scene-demo/gap', releaseState: 'unavailable', release: null };
  value.snapshot.projects.projects = [published, missing];
  const model = definition().buildModel(value);
  assert.equal(model.releasesBlocked, true);
  assert.ok(model.releases.some(item => item.tag === 'v-in'));
  assert.match(render(value).svg, /RELEASE SIGNAL BLOCKED/u);
});

test('a release on the final day plots before the seam and the next midnight draws no tick', () => {
  const value = inputs();
  value.snapshot.projects.freshness.generatedAt = '2026-01-14T23:59:59.999Z';
  value.snapshot.projects.projects = [release('v-noon', '2026-01-14T12:00:00Z'), release('v-after', '2026-01-15T00:00:00Z')];
  const model = definition().buildModel(value);
  const mark = model.releases.find(item => item.tag === 'v-noon');
  assert.ok(mark, 'final-day release is kept');
  assert.ok(mark.angle > -90 && mark.angle < 270, String(mark.angle));
  assert.equal(model.releases.some(item => item.tag === 'v-after'), false);
  const painted = render(value).svg;
  assert.match(painted, /v-noon/u);
  assert.doesNotMatch(painted, /v-after/u);

  const one = inputs();
  one.snapshot.contributions.days = [day(FROM, 1)];
  one.snapshot.metrics.window = { from: FROM, to: FROM, days: 1, observedDays: 1, complete: true };
  one.snapshot.projects.projects = [release('v-only', '2026-01-01T12:00:00Z')];
  const single = definition().buildModel(one);
  assert.equal(single.releases.length, 1);
  assert.ok(Number.isFinite(single.releases[0].angle));
  assert.ok(single.releases[0].angle > -90 && single.releases[0].angle < 270, String(single.releases[0].angle));
  assert.equal(render(one).unavailable, false);
});

test('stale freshness shows the stale strip and does not claim observation', () => {
  for (const layer of ['root', 'contributions']) {
    const value = inputs();
    if (layer === 'root') value.snapshot.freshness.mode = 'stale';
    else value.snapshot.contributions.freshness.mode = 'stale';
    const result = render(value);
    assert.equal(result.unavailable, false, layer);
    assert.match(result.svg, />STALE</u, layer);
    assert.match(result.svg, /STALE SNAPSHOT/u, layer);
    assert.doesNotMatch(result.svg, />OBSERVED</u, layer);
  }
});

test('demo and synthetic sources show a synthetic preview', () => {
  const result = render();
  assert.match(result.svg, /SYNTHETIC PREVIEW/u);
  assert.match(result.svg, /Synthetic preview\. /u);
  const sourced = inputs();
  sourced.snapshot.freshness.mode = 'live';
  sourced.snapshot.contributions.freshness.mode = 'live';
  sourced.snapshot.projects.freshness.mode = 'live';
  sourced.snapshot.freshness.source = 'synthetic-demo';
  const marked = render(sourced);
  assert.match(marked.svg, /SYNTHETIC PREVIEW/u);
  assert.match(marked.svg, /Synthetic preview\. /u);
});

test('an unknown freshness mode is not labelled observed', () => {
  const value = inputs();
  value.snapshot.freshness.mode = 'archival';
  value.snapshot.contributions.freshness.mode = 'live';
  value.snapshot.projects.freshness.mode = 'live';
  value.snapshot.freshness.source = 'github-rest';
  value.snapshot.contributions.freshness.source = 'github-graphql';
  value.snapshot.projects.freshness.source = 'github-rest';
  const result = render(value);
  assert.equal(result.unavailable, true);
  assert.doesNotMatch(result.svg, />OBSERVED</u);
  assert.doesNotMatch(result.svg, /SYNTHETIC PREVIEW/u);
});

test('compact blocked badge stays inside the viewBox on both layouts', () => {
  const value = inputs();
  value.snapshot.projects.projects = [{ ...release('v-gap', '2026-01-08T00:00:00Z'), releaseState: 'unavailable', release: null }];
  for (const layout of ['compact', 'wide']) {
    const result = render(value, { layout });
    const width = layout === 'compact' ? 480 : 720;
    assert.match(result.svg, /RELEASE SIGNAL BLOCKED/u);
    assert.equal(Number(result.svg.match(/viewBox="0 0 (\d+) /u)[1]), width);
    assertInside(result.svg, width);
  }
});

for (const layer of ['root', 'contributions']) {
  for (const [label, field, value] of [
    ['unknown source', 'source', 'unverified'], ['missing source', 'source', undefined],
    ['unknown mode', 'mode', 'cached'], ['missing mode', 'mode', undefined],
    ['invalid timestamp', 'generatedAt', '2026-02-30T00:00:00Z'],
    ['missing timestamp', 'generatedAt', undefined],
  ]) test(`chronograph rejects ${layer} ${label}`, () => {
    const valueIn = inputs();
    const freshness = layer === 'root' ? valueIn.snapshot.freshness : valueIn.snapshot.contributions.freshness;
    if (value === undefined) delete freshness[field];
    else freshness[field] = value;
    assert.equal(render(valueIn).unavailable, true);
  });
}

for (const mode of ['stale', 'unavailable']) test(`${mode} project board cannot authorize release ticks`, () => {
  const value = inputs(); value.snapshot.projects.freshness.mode = mode;
  const result = definition().buildModel(value);
  assert.deepEqual(result.releases, []);
  assert.equal(result.releasesBlocked, true);
});

for (const [label, change] of [
  ['impossible date', p => { p.release.publishedAt = '2026-02-30T00:00:00Z'; }],
  ['future publication', p => { p.release.publishedAt = '2026-01-14T00:00:00.001Z'; }],
  ['empty tag', p => { p.release.tag = ''; }],
  ['contradictory none', p => { p.releaseState = 'none'; }],
]) test(`invalid release ${label} stays blocked rather than absent or published`, () => {
  const value = inputs(); change(value.snapshot.projects.projects[0]);
  const result = definition().buildModel(value);
  assert.deepEqual(result.releases, []); assert.equal(result.releasesBlocked, true);
});

test('chronograph does not animate stale observations in either backend', () => {
  for (const backend of ['css', 'smil']) {
    const value = inputs(); value.snapshot.contributions.freshness.mode = 'stale';
    const result = render(value, { motion: 'ambient', backend });
    assert.equal(result.unavailable, false);
    assert.equal(result.counters.animatedElements, 0);
    assert.equal(result.counters.loopingGroups, 0);
    assert.match(parseSceneXml(result.svg).nodes.find(n => n.name === 'desc').raw, /STALE/i);
  }
});

test('zero-streak needle uses neutral ink instead of the lit reading ink', () => {
  const value = inputs(); value.snapshot.metrics.streak.current = 0;
  for (const theme of Object.keys(svg.themes)) {
    const document = parseSceneXml(render(value, { theme }).svg);
    const needle = document.nodes.find(node => node.name === 'g' && node.attrs.id?.endsWith('-needle'));
    assert.ok(needle);
    assert.equal(needle.children.find(node => node.name === 'line').attrs.stroke, svg.themes[theme].muted);
  }
});

test('source timestamp and declared calendar bounds are painted beside the chronograph', () => {
  for (const layout of ['wide', 'compact']) {
    const output = render(inputs(), { layout }).svg;
    const text = parseSceneXml(output).nodes.filter(node => node.name === 'text').map(sceneXmlText).join('\n');
    for (const reading of ['synthetic-demo', '2026-01-14T00:00:00Z', FROM, TO]) assert.ok(text.includes(reading), reading);
    assertInside(output, layout === 'compact' ? 480 : 720);
  }
});

test('long release tags stay within the compact frame at every rim position', () => {
  for (const date of ['2026-01-01', '2026-01-04', '2026-01-08', '2026-01-11', '2026-01-14']) {
    const value = inputs(); value.snapshot.projects.projects = [release('W'.repeat(40), `${date}T00:00:00Z`)];
    assertInside(render(value, { layout: 'compact' }).svg, 480);
  }
});

test('a claimed window after the contribution observation date stays unavailable', () => {
  const value = inputs();
  value.snapshot.contributions.freshness.generatedAt = '2026-01-13T23:59:59.999Z';
  assert.equal(render(value).unavailable, true);
});

test('mixed public and synthetic provenance cannot authorize a chronograph', () => {
  const value = inputs();
  value.snapshot.contributions.freshness.source = 'github-graphql';
  value.snapshot.contributions.freshness.mode = 'live';
  assert.equal(render(value).unavailable, true);
});

for (const [name, edit] of [
  ['incomplete', window => { window.complete = false; }],
  ['missing completion flag', window => { delete window.complete; }],
  ['nonboolean completion flag', window => { window.complete = 'true'; }],
  ['fewer observed days', window => { window.observedDays = window.days - 1; }],
  ['excess observed days', window => { window.observedDays = window.days + 1; }],
  ['missing observed days', window => { delete window.observedDays; }],
  ['noninteger observed days', window => { window.observedDays = String(window.days); }],
]) test(`declared ${name} cannot authorize a complete chronograph`, () => {
  const value = inputs();
  edit(value.snapshot.metrics.window);
  // Keep the full unique day array: the explicit observation contract is independent.
  assert.equal(value.snapshot.contributions.days.length, value.snapshot.metrics.window.days);
  for (const backend of ['smil', 'css']) for (const motion of ['none', 'subtle', 'ambient']) {
    const result = render(value, { backend, motion });
    assert.equal(result.unavailable, true, `${backend}/${motion}`);
    assert.equal(result.counters.animatedElements, 0);
    assert.equal(result.counters.loopingGroups, 0);
    assert.doesNotMatch(result.svg, />OBSERVED</u);
  }
});

test('a declared complete all-zero window remains observed rather than unavailable', () => {
  const value = inputs();
  value.snapshot.contributions.days = value.snapshot.contributions.days.map(item => ({ ...item, count: 0, level: 0 }));
  value.snapshot.contributions.totalContributions = 0;
  value.snapshot.contributions.commits = 0;
  value.snapshot.metrics.total = 0;
  value.snapshot.metrics.activeDays = 0;
  value.snapshot.metrics.streak.current = 0;
  value.snapshot.metrics.streak.longest = 0;
  value.snapshot.metrics.streak.currentThrough = null;
  const result = render(value);
  assert.equal(result.unavailable, false);
  assert.match(result.svg, /NO CURRENT STREAK/u);
  assert.match(result.svg, />OBSERVED</u);
});
