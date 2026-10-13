import assert from 'node:assert/strict';
import test from 'node:test';
import * as svg from '../dist/index.js';
import { parseSceneXml, sceneVisibleText, sceneXmlText } from '../dist/scene-svg.js';
import { sceneContext } from './scene.fixture.mjs';

const FROM = '2026-01-01';
const TO = '2026-01-14';
const LONG = 'W'.repeat(40);
const SPECIAL = 'v<1&2';
// Old rim text sits at polar+(8,-6). The same instant shares that anchor; the one-hour pair is only ~1.67px apart.
const MIN_ANCHOR = 8;

function day(date) {
  return { date, count: 0, level: 0 };
}
function calendar() {
  const days = [];
  const start = Date.parse(`${FROM}T00:00:00.000Z`);
  for (let index = 0; index < 14; index += 1) days.push(day(new Date(start + index * 86_400_000).toISOString().slice(0, 10)));
  return days;
}
function release(tag, publishedAt, repo) {
  return {
    repo: `scene-demo/${repo}`, name: repo, description: null, sourceUrl: `https://github.com/scene-demo/${repo}`,
    websiteUrl: null, lifecycle: 'active', primaryLanguage: null, stars: 0, forks: 0, openIssuesAndPullRequests: 0,
    pushedAt: null, license: null, ci: { state: 'passing', label: 'ci', workflow: null, url: null },
    releaseState: 'published', release: { tag, name: tag, url: `https://github.com/scene-demo/${repo}/releases/tag/v1`, publishedAt, download: null },
  };
}
const RELEASES = [
  release('b-same', '2026-01-08T00:00:00Z', 'beta'),
  release(SPECIAL, '2026-01-12T18:00:00Z', 'mark'),
  release('early', '2026-01-02T00:00:00Z', 'early'),
  release('c-hour', '2026-01-08T01:00:00Z', 'hour'),
  release(LONG, '2026-01-04T12:00:00Z', 'long'),
  release('a-same', '2026-01-08T00:00:00Z', 'alpha'),
];
function inputs(projects = RELEASES) {
  const days = calendar();
  return {
    snapshot: {
      version: 1,
      profile: { version: 1, login: 'scene-demo', name: 'Scene Demo', profileUrl: 'https://github.com/scene-demo', publicRepositories: 6, followers: 0, following: 0, stars: 0, forks: 0, primaryLanguages: [], latestPushAt: null, repositoriesTruncated: false, freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'demo' } },
      contributions: { version: 1, login: 'scene-demo', totalContributions: 0, commits: 0, issues: 0, pullRequests: 0, reviews: 0, breakdownBasis: 'exact-counts', days, freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'demo' } },
      metrics: {
        version: 1,
        window: { from: FROM, to: TO, days: 14, observedDays: 14, complete: true },
        total: 0, activeDays: 0, density: 0, averagePerDay: 0, averagePerActiveDay: 0,
        peakDay: { date: FROM, count: 0 },
        streak: { version: 1, asOf: TO, current: 0, currentThrough: null, longest: 0, basis: 'returned-window', boundary: { current: 'closed', longest: 'closed' } },
        breakdown: { commits: 0, issues: 0, pullRequests: 0, reviews: 0 }, breakdownBasis: 'exact-counts',
        trend: { buckets: [], recent28Days: 0, previous28Days: null, changePercent: null, direction: 'flat' },
        rhythm: { score: 0, level: 'starting', basis: '70% active-day density (capped at 80%) + 30% current streak (capped at 30 days)' },
      },
      projects: { version: 1, owner: 'scene-demo', projects, freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'demo' } },
      freshness: { generatedAt: '2026-01-14T00:00:00.000Z', source: 'synthetic-demo', mode: 'demo' },
    },
  };
}
const render = (value, overrides) => svg.renderSceneDefinition(svg.getScene('chronograph'), value, { ...sceneContext, motion: 'none', ...overrides });

function walk(node, origin, visit) {
  let x = origin.x;
  let y = origin.y;
  const translated = /translate\(([-\d.]+) ([-\d.]+)\)/u.exec(node.attrs.transform ?? '');
  if (translated) {
    x += Number(translated[1]);
    y += Number(translated[2]);
  }
  visit(node, x, y);
  for (const child of node.children) walk(child, { x, y }, visit);
}
function textBox(node, originX, originY) {
  const words = sceneXmlText(node);
  const size = Number(node.attrs['font-size'] ?? 16);
  const extent = [...words].length * size * 0.62;
  const tx = originX + Number(node.attrs.x ?? 0);
  const anchor = node.attrs['text-anchor'];
  const left = anchor === 'end' ? tx - extent : anchor === 'middle' ? tx - extent / 2 : tx;
  const baseline = originY + Number(node.attrs.y ?? 0);
  return { left, right: left + extent, top: baseline - size, bottom: baseline + size * 0.3, text: words, x: tx, y: baseline };
}
function overlaps(left, right) {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}
function apart(left, right) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  assert.ok(dx * dx + dy * dy >= MIN_ANCHOR * MIN_ANCHOR, `shared text anchor (${left.x},${left.y}) and (${right.x},${right.y})`);
}
function layoutOf(output) {
  const doc = parseSceneXml(output.svg);
  const texts = [];
  const rects = [];
  walk(doc.root, { x: 0, y: 0 }, (node, x, y) => {
    if (node.name === 'text') texts.push(textBox(node, x, y));
    if (node.name === 'rect') rects.push({ node, x, y });
  });
  return { doc, texts, rects };
}

test('six coincident releases keep separate anchors, legend rows, and escaped tags', () => {
  assert.equal(RELEASES.length, 6);
  for (const project of RELEASES) assert.match(project.sourceUrl, /^https:\/\/github\.com\//u);
  for (const theme of Object.keys(svg.themes)) {
    for (const layout of ['compact', 'wide']) {
      const width = layout === 'compact' ? 480 : 720;
      const output = render(inputs(), { theme, layout, motion: 'none' });
      assert.equal(output.unavailable, false, `${theme}/${layout}`);
      assert.equal(output.counters.animatedElements, 0);
      assert.doesNotMatch(output.svg, /<animate/u);
      assert.equal(output.svg.includes('viewBox="0 0 ' + width + ' 480"'), true);
      const { doc, texts } = layoutOf(output);
      const visible = sceneVisibleText(doc.root);
      const description = sceneXmlText(doc.nodes.find(node => node.name === 'desc'));
      for (const tag of ['early', 'a-same', 'b-same', 'c-hour', SPECIAL, LONG]) assert.ok(description.includes(tag), `${tag} missing from description`);
      for (const tag of ['early', 'a-same', 'b-same', 'c-hour', SPECIAL]) assert.ok(visible.includes(tag), `${tag} missing from the plate`);
      assert.equal(visible.includes(LONG), false, 'painted legend keeps the full long tag');
      assert.match(output.svg, /NO CURRENT STREAK/u);
      assert.match(output.svg, /LONGEST STREAK 0/u);
      assert.match(output.svg, /ACTIVE WEEKS 0/u);
      assert.match(output.svg, /rotate\(-90 /u);
      const rows = texts.filter(item => /^\d\. /u.test(item.text)).sort((left, right) => left.y - right.y);
      assert.deepEqual(rows.map(item => item.text.slice(0, 3)), ['1. ', '2. ', '3. ', '4. ', '5. ', '6. ']);
      assert.ok(rows[0].text.includes('early'));
      assert.ok(rows[1].text.includes('…') && !rows[1].text.includes(LONG));
      assert.ok(rows[2].text.includes('a-same'));
      assert.ok(rows[3].text.includes('b-same'));
      assert.ok(rows[4].text.includes('c-hour'));
      assert.ok(rows[5].text.includes(SPECIAL));
      assert.equal(rows[2].y === rows[3].y, false, 'same-instant releases share a legend row');
      apart(rows[2], rows[3]);
      apart(rows[2], rows[4]);
      apart(rows[3], rows[4]);
      const special = doc.nodes.find(node => node.name === 'text' && sceneXmlText(node).includes(SPECIAL));
      assert.ok(special, 'special tag is painted');
      assert.match(special.raw, /&lt;/u);
      assert.match(special.raw, /&amp;/u);
      assert.doesNotMatch(special.raw, /v<1&2/u);
      const markers = texts.filter(item => /^[1-6]$/u.test(item.text));
      assert.deepEqual(markers.map(item => item.text).sort(), ['1', '2', '3', '4', '5', '6']);
      for (let index = 0; index < markers.length; index += 1) {
        for (let other = index + 1; other < markers.length; other += 1) apart(markers[index], markers[other]);
      }
      const footer = texts.filter(item => /^(?:NO CURRENT STREAK|CURRENT STREAK|LONGEST STREAK|ACTIVE WEEKS)/u.test(item.text));
      assert.equal(footer.length, 3);
      for (const item of [...rows, ...markers]) {
        assert.ok(item.left >= -0.5 && item.right <= width + 0.5 && item.top >= -0.5 && item.bottom <= 480.5, `outside viewBox ${item.text} ${item.left}..${item.right},${item.top}..${item.bottom}`);
        for (const reading of footer) assert.equal(overlaps(item, reading), false, `${item.text} covers ${reading.text}`);
      }
      for (const row of rows) assert.equal(doc.nodes.find(node => node.name === 'text' && sceneXmlText(node) === row.text).attrs.fill, svg.themes[theme].text);
    }
  }
});

test('a blocked release badge stays clear of legend rows and rim digits', () => {
  const hidden = { ...release('v-hidden', '2026-01-09T00:00:00Z', 'gap'), releaseState: 'unavailable', release: null };
  const projects = [
    release('b-same', '2026-01-08T00:00:00Z', 'beta'),
    release('a-same', '2026-01-08T00:00:00Z', 'alpha'),
    release('c-hour', '2026-01-08T01:00:00Z', 'hour'),
    release('early', '2026-01-02T00:00:00Z', 'early'),
    release('later', '2026-01-11T00:00:00Z', 'later'),
    hidden,
  ];
  for (const layout of ['compact', 'wide']) {
    const width = layout === 'compact' ? 480 : 720;
    const output = render(inputs(projects), { layout, motion: 'none' });
    const { doc, texts } = layoutOf(output);
    assert.match(output.svg, /RELEASE SIGNAL BLOCKED/u);
    assert.equal(sceneVisibleText(doc.root).includes('v-hidden'), false);
    const badgeGroup = doc.nodes.find(node => node.name === 'g' && node.children.some(child => child.name === 'text' && sceneXmlText(child) === 'RELEASE SIGNAL BLOCKED'));
    let badge = null;
    walk(doc.root, { x: 0, y: 0 }, (node, x, y) => {
      if (node === badgeGroup) {
        const rect = node.children.find(child => child.name === 'rect');
        badge = { left: x + Number(rect.attrs.x ?? 0), top: y + Number(rect.attrs.y ?? 0), right: x + Number(rect.attrs.width), bottom: y + Number(rect.attrs.height) };
      }
    });
    assert.ok(badge, 'blocked badge is painted');
    const footer = texts.filter(item => /^(?:NO CURRENT STREAK|LONGEST STREAK|ACTIVE WEEKS)/u.test(item.text));
    const painted = texts.filter(item => /^\d\. /u.test(item.text) || /^[1-5]$/u.test(item.text));
    assert.equal(painted.filter(item => /^\d\. /u.test(item.text)).length, 5);
    for (const item of painted) {
      assert.ok(item.left >= -0.5 && item.right <= width + 0.5 && item.bottom <= 480.5, `outside viewBox ${item.text}`);
      assert.equal(overlaps(item, badge), false, `${item.text} covers the blocked badge`);
      for (const reading of footer) assert.equal(overlaps(item, reading), false, `${item.text} covers ${reading.text}`);
    }
    const same = painted.filter(item => item.text.includes('a-same') || item.text.includes('b-same'));
    assert.equal(same.length, 2);
    apart(same[0], same[1]);
  }
});

test('stale and unavailable plates do not paint release tags as a live signal', () => {
  const staleBoard = inputs();
  staleBoard.snapshot.projects.freshness.mode = 'stale';
  const blocked = render(staleBoard, { motion: 'none' });
  assert.equal(blocked.unavailable, false);
  assert.equal(blocked.counters.animatedElements, 0);
  assert.equal(sceneVisibleText(parseSceneXml(blocked.svg).root).includes('a-same'), false);
  assert.match(blocked.svg, /RELEASE SIGNAL BLOCKED/u);
  assert.equal(blocked.counters.loopingGroups, 0);

  const stalePlate = inputs();
  stalePlate.snapshot.contributions.freshness.mode = 'stale';
  const still = render(stalePlate, { motion: 'ambient', backend: 'smil' });
  assert.equal(still.unavailable, false);
  assert.equal(still.counters.animatedElements, 0);
  assert.equal(still.counters.loopingGroups, 0);
  assert.match(still.svg, /STALE/u);
  assert.doesNotMatch(still.svg, />OBSERVED</u);
  assert.doesNotMatch(still.svg, /<animate/u);

  const unavailable = inputs();
  unavailable.snapshot.freshness.mode = 'unavailable';
  const hidden = render(unavailable, { motion: 'ambient', backend: 'smil' });
  assert.equal(hidden.unavailable, true);
  assert.equal(hidden.counters.animatedElements, 0);
  const hiddenDoc = parseSceneXml(hidden.svg);
  const hiddenText = `${sceneVisibleText(hiddenDoc.root)}\n${sceneXmlText(hiddenDoc.nodes.find(node => node.name === 'desc'))}`;
  for (const tag of ['a-same', 'b-same', 'c-hour', 'early', SPECIAL, LONG]) assert.equal(hiddenText.includes(tag), false, tag);
  assert.doesNotMatch(hidden.svg, /RELEASE SIGNAL BLOCKED|>OBSERVED</u);
  assert.match(hidden.svg, /UNAVAILABLE/u);
});
