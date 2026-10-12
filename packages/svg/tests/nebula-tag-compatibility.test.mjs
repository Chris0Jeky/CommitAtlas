import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubClient } from '../../github/dist/index.js';
import * as svg from '../dist/index.js';
import { assertWellFormedXml, stripSceneMotion } from './scene-harness.mjs';
import { sceneContext, sceneInputs } from './scene.fixture.mjs';

function input(tag, synthetic = true) {
  const value = sceneInputs();
  if (!synthetic) {
    for (const freshness of [value.snapshot.freshness, value.snapshot.contributions.freshness]) {
      Object.assign(freshness, { source: 'github-graphql', mode: 'live' });
    }
  }
  value.snapshot.projects = {
    version: 1, owner: 'scene-demo',
    freshness: { ...value.snapshot.freshness, source: synthetic ? 'synthetic-demo' : 'github-rest' },
    projects: [{ repo: 'scene-demo/alpha', primaryLanguage: 'TypeScript',
      releaseState: 'published', release: { tag, publishedAt: value.snapshot.freshness.generatedAt } }],
  };
  return value;
}
const scene = () => svg.getScene('nebula');
const render = (value, context = {}) => svg.renderSceneDefinition(scene(), value, { ...sceneContext, ...context });
function assertMarks(output, value, expected) {
  assert.equal(output.unavailable, false);
  assert.equal((output.svg.match(/r="5\.5"/gu) ?? []).length, expected);
  assert.equal((output.svg.match(/r="1\.6"/gu) ?? []).length, value.snapshot.contributions.days.length);
  assertWellFormedXml(output.svg);
}

const accepted = [
  ['ASCII', 'v1.0.0'], ['slash', 'release/v1.0.0'],
  ['CJK', '版本-1.0'], ['Cyrillic', 'релиз-1.0'], ['astral', 'release/🚀-1'],
  ['old 64-unit boundary', 'a'.repeat(64)], ['beyond old boundary', 'a'.repeat(65)],
  ['200 BMP code points', '版'.repeat(200)], ['200 astral code points', '🚀'.repeat(200)],
  ['decomposed identity', 're\u0301lease/1'], ['composed identity', 'rélease/1'],
  // A seed-only identity is never interpolated into SVG, even when it resembles markup.
  ['markup-looking identity', '<script>'], ['attribute-looking identity', '<x/onload=alert(1)>'], ['punctuation', 'v1&"release\'<x>'],
];
for (const [name, tag] of accepted) {
  for (const synthetic of [true, false]) {
    test(`nebula retains ${name} tag exactly, synthetic=${synthetic}`, () => {
      const value = input(tag, synthetic), before = structuredClone(value);
      assert.equal(scene().buildModel(value).clusters[0].tag, tag);
      for (const theme of ['aurora', 'midnight', 'ember', 'paper']) {
        for (const layout of ['wide', 'compact']) {
          for (const backend of ['css', 'smil']) {
            const still = render(value, { theme, layout, backend, motion: 'none' });
            const moving = render(value, { theme, layout, backend, motion: 'ambient' });
            assertMarks(still, value, 1);
            assertMarks(moving, value, 1);
            assert.equal(stripSceneMotion(moving.svg), still.svg);
            assert.doesNotMatch(moving.svg, /<script|<x>|onload=/u);
          }
        }
      }
      assert.deepEqual(value, before, 'tag validation must not rewrite caller data');
    });
  }
}

const rejected = [
  ['empty', ''], ['blank', ' '], ['leading whitespace', ' v1'], ['trailing whitespace', 'v1 '],
  ['internal whitespace', 'release v1'], ['Unicode space', 'v1\u2003x'], ['BOM', '\uFEFFv1'],
  ['NUL', 'v\u0000x'], ['tab', 'v\tx'], ['newline', 'v\nx'], ['C0', 'v\u001fx'],
  ['DEL', 'v\u007fx'], ['C1', 'v\u0085x'], ['high surrogate', 'v\ud800x'], ['low surrogate', 'v\udc00x'],
  ['201 BMP code points', '版'.repeat(201)], ['201 astral code points', '🚀'.repeat(201)],
  ['mixed 201 code points', 'a'.repeat(200) + '🚀'], ['large text', 'a'.repeat(100_000)],
  ['null', null], ['number', 12], ['boolean', false], ['array', ['v1']], ['object', { tag: 'v1' }],
];
for (const [name, tag] of rejected) {
  test(`nebula suppresses malformed ${name} tag without losing contribution stars`, () => {
    for (const synthetic of [true, false]) {
      const value = input(tag, synthetic);
      const cluster = scene().buildModel(value).clusters[0];
      assert.equal(cluster.tag, null);
      assert.equal(cluster.release, false);
      assert.equal(cluster.publishedAt, null);
      for (const backend of ['css', 'smil']) {
        for (const motion of ['none', 'ambient']) assertMarks(render(value, { backend, motion }), value, 0);
      }
    }
  });
}

test('missing tag remains an unqualified release', () => {
  const value = input('v1'); delete value.snapshot.projects.projects[0].release.tag;
  assertMarks(render(value), value, 0);
});
for (const mode of ['stale', 'partial', 'unavailable']) {
  test(`a compatible tag does not authorize a ${mode} project board`, () => {
    const value = input('release/版本-1.0');
    value.snapshot.projects.freshness.mode = mode;
    assertMarks(render(value), value, 0);
  });
}

test('all 200 code points participate in the seed without normalization or truncation', () => {
  for (const [left, right] of [
    ['a'.repeat(199) + 'b', 'a'.repeat(199) + 'c'],
    ['🚀'.repeat(199) + 'x', '🚀'.repeat(199) + 'y'],
    ['re\u0301lease/1', 'rélease/1'],
  ]) {
    const a = input(left), b = input(right);
    assert.equal(scene().buildModel(a).clusters[0].tag, left);
    assert.equal(scene().buildModel(b).clusters[0].tag, right);
    assert.notEqual(render(a).seed, render(b).seed);
    assert.equal(render(a).svg, render(a).svg);
  }
});

async function collectedBoard(tag) {
  const stamp = sceneInputs().snapshot.freshness.generatedAt;
  const requests = [];
  const client = new GitHubClient({
    now: () => new Date(stamp),
    fetchImpl: async request => {
      const url = new URL(request instanceof Request ? request.url : String(request));
      requests.push(url.pathname);
      assert.equal(url.origin, 'https://api.github.com');
      let response;
      if (url.pathname === '/repos/scene-demo/alpha') {
        response = { name: 'alpha', private: false, html_url: 'https://github.com/scene-demo/alpha',
          default_branch: 'main', stargazers_count: 0, forks_count: 0, open_issues_count: 0 };
      } else if (url.pathname === '/repos/scene-demo/alpha/releases/latest') {
        response = { tag_name: tag, name: 'Synthetic release fixture',
          html_url: 'https://github.com/scene-demo/alpha/releases', published_at: stamp, assets: [] };
      } else assert.fail(`unexpected fixture request: ${url.pathname}`);
      return new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } });
    },
  });
  const board = await client.fetchProjects('scene-demo', ['alpha'], new Map([['alpha', 'active']]));
  assert.deepEqual(requests, ['/repos/scene-demo/alpha', '/repos/scene-demo/alpha/releases/latest']);
  return board;
}
for (const [name, tag] of [['slash', 'release/v1'], ['CJK', '版本-1'], ['astral bound', '🚀'.repeat(200)]]) {
  test(`collector-to-nebula preserves ${name} release identity`, async () => {
    const value = input(tag, false);
    value.snapshot.projects = await collectedBoard(tag);
    assert.equal(value.snapshot.projects.projects[0].release.tag, tag);
    assert.equal(scene().buildModel(value).clusters[0].tag, tag);
    assertMarks(render(value), value, 1);
  });
}

test('the producer refuses a tag beyond its 200-code-point bound', async () => {
  await assert.rejects(() => collectedBoard('🚀'.repeat(201)), /oversized tag_name field/u);
});
