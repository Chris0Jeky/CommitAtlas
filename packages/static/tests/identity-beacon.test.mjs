import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as staticApi from '../dist/index.js';
import { GitHubClient, demoContributions, demoProfile, demoProjects } from '../../github/dist/index.js';
import { parseSceneXml, sceneVisibleText } from '../../svg/dist/scene-svg.js';
import { sceneInputs } from '../../svg/tests/scene.fixture.mjs';

const raw = {
  version: 1, user: 'scene-demo', theme: 'ember', days: 7, motion: 'none',
  outputDir: 'assets/commitatlas', cards: ['profile'],
  projects: [{ repo: 'scene-demo/atlas', label: 'Atlas', lifecycle: 'active' }],
};
function observedSnapshot() {
  const snapshot = sceneInputs().snapshot;
  snapshot.projects = demoProjects('scene-demo', ['atlas'], new Map([['atlas', 'active']]), new Map(), new Date(snapshot.freshness.generatedAt));
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
      assert.deepEqual(bodyLabels(artifacts['scene-identity-beacon.svg']), ['Atlas']);
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


function bodyLabels(content) {
  return parseSceneXml(content).nodes.filter(node => /-body\d$/u.test(node.attrs.id ?? ''))
    .map(node => node.children.find(child => child.name === 'g'))
    .map(node => node.children.find(child => child.name === 'text'))
    .map(node => sceneVisibleText(node));
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('real generation maps tracked configured labels to fetched repository identities', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commitatlas-beacon-label-pipeline-'));
  const now = new Date('2026-01-07T00:00:00Z');
  let fetchedNames;
  t.mock.method(GitHubClient.prototype, 'fetchProfile', async login => demoProfile(login, now));
  t.mock.method(GitHubClient.prototype, 'fetchPublicProfileContributions', async (login, days) => demoContributions(login, days, now));
  t.mock.method(GitHubClient.prototype, 'fetchProjects', async (login, repositories, lifecycles, workflows) => {
    const board = demoProjects(login, repositories, lifecycles, workflows, now);
    fetchedNames = board.projects.map(project => project.name);
    return board;
  });
  try {
    execFileSync('git', ['init', '-q', root]);
    await writeFile(path.join(root, '.commitatlas.json'), JSON.stringify({ ...raw, scenes: ['identity-beacon'],
      projects: [{ repo: 'scene-demo/atlas', label: 'Atlas Friendly', lifecycle: 'active' }],
      identity: { name: 'Ada', focus: ['Atlas Friendly'] } }));
    execFileSync('git', ['-C', root, 'add', '.commitatlas.json']);
    const result = await staticApi.generateStatic({ cwd: root, asOf: '2026-01-07' });
    assert.deepEqual(fetchedNames, ['atlas'], 'the fetched GitHub name must stay a normal repo name');
    const content = await readFile(path.join(result.outputDir, 'scene-identity-beacon.svg'), 'utf8');
    assert.deepEqual(bodyLabels(content), ['Atlas Friendly']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Beacon labels follow canonical repo identity across board order and preserve caller/card/scene bytes', () => {
  const snapshot = sceneInputs().snapshot;
  snapshot.projects = demoProjects('scene-demo', ['atlas', 'beta'], new Map([['atlas', 'active'], ['beta', 'active']]), new Map(), new Date(snapshot.freshness.generatedAt));
  snapshot.projects.projects[0].openIssuesAndPullRequests = 17;
  snapshot.projects.projects[1].openIssuesAndPullRequests = 2;
  const selected = config({ cards: ['atlas', 'profile', 'projects'], scenes: ['identity-beacon', 'lifecycle-map'],
    projects: [{ repo: 'scene-demo/atlas', label: 'Atlas Friendly', lifecycle: 'active' }, { repo: 'scene-demo/beta', label: 'Beta Friendly', lifecycle: 'active' }],
    identity: { name: 'Ada', focus: ['Atlas Friendly', 'Beta Friendly'] } });
  const original = JSON.stringify(snapshot);
  freeze(snapshot);
  const first = staticApi.renderStaticArtifacts(snapshot, selected);
  assert.deepEqual(bodyLabels(first['scene-identity-beacon.svg']), ['Atlas Friendly', 'Beta Friendly']);
  const reversed = structuredClone(snapshot);
  reversed.projects.projects.reverse();
  reversed.projects.projects.forEach(project => { project.repo = ` ${project.repo.toUpperCase()} `; });
  assert.equal(staticApi.renderStaticArtifacts(reversed, selected)['scene-identity-beacon.svg'], first['scene-identity-beacon.svg'], 'repo identity, not board order, binds each count to its label');
  assert.equal(JSON.stringify(snapshot), original);
  const withoutBeacon = staticApi.renderStaticArtifacts(snapshot, { ...selected, scenes: ['lifecycle-map'] });
  for (const [name, content] of Object.entries(withoutBeacon)) assert.equal(first[name], content, `${name} must retain its original snapshot semantics`);
});

test('an identity focus naming duplicate configured labels is rejected without choosing a project', () => {
  const projects = [{ repo: 'scene-demo/atlas', label: 'Shared', lifecycle: 'active' }, { repo: 'scene-demo/beta', label: 'Shared', lifecycle: 'active' }];
  assert.throws(() => config({ projects, identity: { name: 'Ada', focus: ['Shared'] } }), /ambiguous configured project label/u);
  const programmatic = { ...config({ identity: { name: 'Ada', focus: ['Shared'] } }), projects };
  assert.throws(() => staticApi.renderStaticArtifacts(observedSnapshot(), programmatic), /ambiguous configured project label/u);
  assert.doesNotThrow(() => config({ scenes: [], projects, identity: { name: 'Ada', focus: ['Shared'] } }), 'unselected Beacon must not constrain other consumers');
});

test('duplicate labels outside the selected focus do not prevent a unique match', () => {
  const snapshot = sceneInputs().snapshot;
  snapshot.projects = demoProjects('scene-demo', ['atlas', 'beta', 'gamma'], new Map([['atlas', 'active'], ['beta', 'active'], ['gamma', 'active']]), new Map(), new Date(snapshot.freshness.generatedAt));
  const selected = config({ projects: [{ repo: 'scene-demo/atlas', label: 'Atlas', lifecycle: 'active' }, { repo: 'scene-demo/beta', label: 'Other', lifecycle: 'active' }, { repo: 'scene-demo/gamma', label: 'Other', lifecycle: 'active' }] });
  assert.deepEqual(bodyLabels(staticApi.renderStaticArtifacts(snapshot, selected)['scene-identity-beacon.svg']), ['Atlas']);
});

for (const [name, mutate] of [
  ['unconfigured repository with a coincidentally matching name', snapshot => { snapshot.projects.projects[0].repo = 'scene-demo/unconfigured'; }],
  ['foreign owner with the same repository basename', snapshot => { snapshot.projects.projects[0].repo = 'other-owner/atlas'; }],
  ['duplicate repository identity', snapshot => { snapshot.projects.projects.push({ ...snapshot.projects.projects[0], repo: 'SCENE-DEMO/ATLAS' }); }],
  ['malformed repository identity', snapshot => { snapshot.projects.projects[0].repo = 'scene-demo/../atlas'; }],
]) test(`Beacon refuses ${name} without changing other cards`, () => {
  const snapshot = observedSnapshot();
  mutate(snapshot);
  const selected = config({ projects: [{ repo: 'scene-demo/atlas', label: 'atlas', lifecycle: 'active' }], identity: { name: 'Ada', focus: ['atlas'] } });
  const original = JSON.stringify(snapshot);
  const artifacts = staticApi.renderStaticArtifacts(snapshot, selected);
  assert.match(artifacts['scene-identity-beacon.svg'], /UNAVAILABLE/u);
  assert.deepEqual(bodyLabels(artifacts['scene-identity-beacon.svg']), []);
  assert.equal(artifacts['profile.svg'], staticApi.renderStaticArtifacts(snapshot, { ...selected, scenes: [] })['profile.svg']);
  assert.equal(JSON.stringify(snapshot), original);
});

test('focus stays literal while configured labels replace repo names only for Beacon', () => {
  const selected = config({ projects: [{ repo: 'scene-demo/atlas', label: 'Atlas Friendly', lifecycle: 'active' }], identity: { name: 'Ada', focus: ['atlas friendly', ' Atlas Friendly ', 'atlas'] } });
  const output = staticApi.renderStaticArtifacts(observedSnapshot(), selected)['scene-identity-beacon.svg'];
  assert.deepEqual(bodyLabels(output), []);
  assert.ok(output.includes('atlas friendly'));
  assert.ok(output.includes(' Atlas Friendly '));
});


test('programmatic configured canonical repo duplicates cannot overwrite label association', () => {
  const selected = config();
  const projects = [...selected.projects, { ...selected.projects[0], repo: 'SCENE-DEMO/ATLAS', label: 'Different' }];
  assert.throws(() => staticApi.renderStaticArtifacts(observedSnapshot(), { ...selected, projects }), /unique valid configured project identities/u);
});


test('matched configured label injection stays escaped inside a body with its own counts and board provenance', () => {
  const label = "F<img>&'";
  const snapshot = sceneInputs().snapshot;
  snapshot.projects = demoProjects('scene-demo', ['atlas', 'beta'], new Map([['atlas', 'active'], ['beta', 'active']]), new Map(), new Date(snapshot.freshness.generatedAt));
  assert.deepEqual(snapshot.projects.projects.map(project => project.name), ['atlas', 'beta']);
  snapshot.projects.projects[0].openIssuesAndPullRequests = 2;
  snapshot.projects.projects[1].openIssuesAndPullRequests = 8;
  snapshot.freshness = { generatedAt: '2026-01-07T00:00:00Z', mode: 'live', source: 'github-profile-html' };
  snapshot.projects.freshness = { generatedAt: '2026-01-07T00:00:01Z', mode: 'live', source: 'github-rest' };
  const selected = config({ projects: [{ repo: 'scene-demo/atlas', label, lifecycle: 'active' }, { repo: 'scene-demo/beta', label: 'Control', lifecycle: 'active' }],
    identity: { name: 'Ada', focus: [label, 'Control'] } });
  const content = staticApi.renderStaticArtifacts(snapshot, selected)['scene-identity-beacon.svg'];
  const document = parseSceneXml(content);
  const bodies = document.nodes.filter(node => /-body\d$/u.test(node.attrs.id ?? ''));
  assert.deepEqual(bodyLabels(content), [label, 'Control'], 'the full injected label must be matched body text, not unmatched fallback');
  assert.ok(bodies[0].raw.includes('F&lt;img&gt;&amp;&apos;'));
  assert.deepEqual(bodies.map(node => Number(node.children.find(child => child.name === 'g').children.find(child => child.name === 'circle').attrs.r)), [11.5, 28], 'the 2/8 observed counts retain their normalized body sizes');
  for (const node of document.nodes) {
    assert.ok(!['img', 'script', 'image', 'foreignObject'].includes(node.name));
    for (const attribute of Object.keys(node.attrs)) assert.doesNotMatch(attribute, /^on/iu);
  }
  const visible = sceneVisibleText(document.root);
  assert.ok(visible.includes('BODY SIZE · OPEN ISSUES AND PULL REQUESTS'));
  assert.ok(visible.includes('2026-01-07T00:00:01.000Z'));
  assert.ok(visible.includes('SOURCE · github-rest'));
  assert.doesNotMatch(content, /github-profile-html|UNAVAILABLE/u);
});
