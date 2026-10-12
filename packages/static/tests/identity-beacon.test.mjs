import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as staticApi from '../dist/index.js';
import { demoProjects } from '../../github/dist/index.js';
import { sceneInputs } from '../../svg/tests/scene.fixture.mjs';

const raw = {
  version: 1, user: 'scene-demo', theme: 'ember', days: 7, motion: 'none',
  outputDir: 'assets/commitatlas', cards: ['profile'],
  projects: [{ repo: 'scene-demo/atlas', label: 'Atlas', lifecycle: 'active' }],
};
function observedSnapshot() {
  const snapshot = sceneInputs().snapshot;
  snapshot.projects = demoProjects('scene-demo', ['atlas'], new Map([['atlas', 'active']]), new Map(), new Date(snapshot.freshness.generatedAt));
  snapshot.projects.projects[0].name = 'Atlas';
  return snapshot;
}
function config(overrides = {}) {
  return staticApi.parseStaticConfig({
    ...raw, scenes: ['identity-beacon'], identity: { name: 'Ada', tagline: 'Signals', focus: ['Atlas'] }, ...overrides,
  });
}

test('a beacon without an identity is not rendered', () => {
  assert.throws(() => staticApi.parseStaticConfig({ ...raw, scenes: ['identity-beacon'] }), /requires a static identity/i);
});

test('a configured identity with observed projects renders the beacon instead of an empty plate', () => {
  for (const theme of ['ember', 'aurora', 'midnight', 'paper']) {
    for (const layout of ['wide', 'compact']) {
      const artifacts = staticApi.renderStaticArtifacts(observedSnapshot(), config({ theme, layout }));
      assert.match(artifacts['scene-identity-beacon.svg'], /Ada/);
      assert.match(artifacts['scene-identity-beacon.svg'], /Signals/);
      assert.match(artifacts['scene-identity-beacon.svg'], /Atlas/);
      assert.doesNotMatch(artifacts['scene-identity-beacon.svg'], /UNAVAILABLE/u);
    }
  }
});

const blockedBoards = [
  ['missing board', snapshot => { delete snapshot.projects; }],
  ['null board', snapshot => { snapshot.projects = null; }],
  ...['unavailable', 'stale', 'partial'].map(mode => [mode, snapshot => { snapshot.projects.freshness.mode = mode; }]),
  ['malformed date', snapshot => { snapshot.projects.freshness.generatedAt = '2026-01-07Tinvalid'; }],
  ['unknown source', snapshot => { snapshot.projects.freshness.source = 'untrusted'; }],
  ['missing reading', snapshot => { delete snapshot.projects.projects[0].openIssuesAndPullRequests; }],
];
for (const [name, mutate] of blockedBoards) {
  test(`static beacon keeps ${name} unavailable without altering the profile card`, () => {
    const snapshot = observedSnapshot();
    const selected = config();
    const expectedProfile = staticApi.renderStaticArtifacts(snapshot, selected)['profile.svg'];
    mutate(snapshot);
    for (const motion of ['none', 'ambient', 'cinematic']) {
      const artifacts = staticApi.renderStaticArtifacts(snapshot, config({ motion }));
      assert.match(artifacts['scene-identity-beacon.svg'], /UNAVAILABLE/u);
      assert.doesNotMatch(artifacts['scene-identity-beacon.svg'], />OBSERVED<|<animate|<style/u);
      // Compare the same unrelated card presentation, not different motion profiles.
      assert.equal(artifacts['profile.svg'], staticApi.renderStaticArtifacts(snapshot, staticApi.parseStaticConfig({ ...raw, motion }))['profile.svg']);
    }
    assert.equal(staticApi.renderStaticArtifacts(snapshot, selected)['profile.svg'], expectedProfile);
  });
}

test('an explicitly observed empty project list remains different from an absent board', () => {
  const snapshot = observedSnapshot();
  snapshot.projects.projects = [];
  const artifacts = staticApi.renderStaticArtifacts(snapshot, config());
  assert.match(artifacts['scene-identity-beacon.svg'], /Ada/);
  assert.doesNotMatch(artifacts['scene-identity-beacon.svg'], /UNAVAILABLE/u);
});

test('static generation attributes issue counts to the board clock and source', () => {
  const snapshot = observedSnapshot();
  Object.assign(snapshot.freshness, { source: 'github-profile-html', mode: 'live' });
  Object.assign(snapshot.projects.freshness, { source: 'github-rest', mode: 'live', generatedAt: '2026-01-07T00:00:01.5Z' });
  const artifacts = staticApi.renderStaticArtifacts(snapshot, config());
  assert.match(artifacts['scene-identity-beacon.svg'], /2026-01-07T00:00:01\.500Z/);
  assert.match(artifacts['scene-identity-beacon.svg'], /github-rest/);
  assert.doesNotMatch(artifacts['scene-identity-beacon.svg'], /github-profile-html/);
});

test('paired publication preserves the unavailable beacon in both manifests', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commitatlas-beacon-evidence-'));
  try {
    const snapshot = observedSnapshot();
    snapshot.projects.freshness.mode = 'unavailable';
    const result = await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({
      themes: [{ theme: 'paper', outputDir: 'assets/commitatlas/light' }],
    }) });
    assert.equal(result.variants.length, 1);
    for (const target of [result, ...result.variants]) {
      const record = target.manifest.artifacts.find(artifact => artifact.path === 'scene-identity-beacon.svg');
      assert.ok(record);
      const content = await readFile(path.join(target.outputDir, record.path), 'utf8');
      assert.match(content, /UNAVAILABLE/u);
      assert.doesNotMatch(content, />OBSERVED<|<animate|<style/u);
      assert.equal(Buffer.byteLength(content), record.bytes);
      assert.equal(target.manifest.generatedAt, snapshot.freshness.generatedAt);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
