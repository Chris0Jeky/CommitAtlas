import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateStaticFromSnapshot, generatedScenePaths, parseStaticConfig } from '../dist/index.js';
import { parseSceneXml, sceneVisibleText } from '../../svg/dist/scene-svg.js';
import { coverageInputs, unavailableCoverageInputs } from '../../svg/tests/evidence-coverage.fixture.mjs';

const raw = {
  version: 1, user: 'scene-demo', theme: 'ember', days: 7, motion: 'ambient',
  outputDir: 'assets/commitatlas', cards: ['profile'], scenes: ['evidence-coverage'],
  themes: [{ theme: 'paper', outputDir: 'assets/commitatlas/light' }],
  projects: [{ repo: 'scene-demo/atlas', label: 'Atlas', lifecycle: 'active' }],
};
async function temporary(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commitatlas-evidence-'));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
test('real evidence coverage is opt-in and writes paired hashed scenes from one snapshot', async () => temporary(async root => {
  const config = parseStaticConfig(raw), snapshot = coverageInputs().snapshot;
  const result = await generateStaticFromSnapshot({ root, config, snapshot });
  assert.deepEqual(generatedScenePaths(result), [
    'assets/commitatlas/scene-evidence-coverage.svg', 'assets/commitatlas/light/scene-evidence-coverage.svg',
  ]);
  const hashes = [];
  for (const target of [result, ...result.variants]) {
    const artifact = target.manifest.artifacts.find(item => item.path === 'scene-evidence-coverage.svg');
    const bytes = await readFile(path.join(target.outputDir, artifact.path));
    assert.match(bytes.toString(), /Evidence coverage/u);
    assert.match(bytes.toString(), /<animateTransform/u);
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256);
    assert.equal(target.manifest.generatedAt, snapshot.freshness.generatedAt);
    assert.deepEqual(target.manifest.window, result.manifest.window);
    hashes.push(artifact.sha256);
  }
  assert.notEqual(hashes[0], hashes[1]);
}));
test('unavailable source scenes still publish dark readable paired artifacts without motion', async () => temporary(async root => {
  const result = await generateStaticFromSnapshot({ root, config: parseStaticConfig(raw), snapshot: unavailableCoverageInputs().snapshot });
  for (const target of [result, ...result.variants]) {
    const body = await readFile(path.join(target.outputDir, 'scene-evidence-coverage.svg'), 'utf8');
    assert.match(body, /UNAVAILABLE/u);
    assert.doesNotMatch(body, /<animate|<style/u);
    assert.match(body, /PRIVATE ACTIVITY/u);
  }
}));
test('evidence dry-run lists both scenes but writes nothing; legacy configs remain unchanged', async () => temporary(async root => {
  const snapshot = coverageInputs().snapshot;
  const result = await generateStaticFromSnapshot({ root, config: parseStaticConfig(raw), snapshot, dryRun: true });
  assert.equal(generatedScenePaths(result).length, 2);
  assert.deepEqual(await readdir(root), []);
  const legacy = { ...raw }; delete legacy.scenes;
  const without = await generateStaticFromSnapshot({ root, config: parseStaticConfig(legacy), snapshot, dryRun: true });
  assert.deepEqual(generatedScenePaths(without), []);
  assert.deepEqual(without.manifest.artifacts.map(item => item.path), ['profile.svg']);
  assert.throws(() => parseStaticConfig({ ...raw, motion: 'cinematic' }), /unsupported.*motion/u);
  assert.throws(() => parseStaticConfig({ ...raw, scenePack: 'orbital' }), /unsupported.*pack/u);
}));


const lensFixture = await readFile(new URL('../../../research-contracts/lens-projection/v1/showcase.fixture.json', import.meta.url), 'utf8');
async function trackLens(root) {
  execFileSync('git', ['init', '-q', root]);
  await writeFile(path.join(root, 'lens.json'), lensFixture);
  execFileSync('git', ['-C', root, 'add', 'lens.json']);
}
for (const [days, state] of [[44, 'FRESH'], [46, 'STALE'], [91, 'EXPIRED']]) {
  test(`tracked C0 Lens ${state.toLowerCase()} rows publish in both hashed evidence scenes`, async () => temporary(async root => {
    await trackLens(root);
    const snapshot = coverageInputs().snapshot;
    snapshot.freshness.generatedAt = new Date(Date.parse(JSON.parse(lensFixture).generatedAt) + days * 86_400_000).toISOString();
    const config = parseStaticConfig({ ...raw, lens: { path: 'lens.json' } });
    const result = await generateStaticFromSnapshot({ root, config, snapshot });
    for (const target of [result, ...result.variants]) {
      const body = await readFile(path.join(target.outputDir, 'scene-evidence-coverage.svg'));
      const doc = parseSceneXml(body.toString());
      const rows = doc.nodes.filter(node => node.attrs.id?.includes('-row-'));
      assert.equal(rows.length, 9);
      const summary = rows.find(row => row.attrs.id.endsWith('-row-lens'));
      assert.equal(sceneVisibleText(summary), `DEVELOPER LENS · SYNTHETIC ${state === 'FRESH' ? '' : 'LAST '}DERIVED COVERAGE 100% · ${days} DAYS · ${state}`);
      assert.doesNotMatch(summary.raw, /OBSERVED|COMPLETE|<animate|target-scan/);
      const warning = rows.find(row => row.attrs.id.endsWith('-row-lens-warning-synthetic_showcase'));
      assert.equal(sceneVisibleText(warning), 'Synthetic showcase data; these statistics do not describe a person.');
      const artifact = target.manifest.artifacts.find(item => item.path === 'scene-evidence-coverage.svg');
      assert.equal(body.byteLength, artifact.bytes);
      assert.equal(createHash('sha256').update(body).digest('hex'), artifact.sha256);
      assert.ok(body.byteLength < 30_000);
    }
  }));
}
test('configured Lens evidence dry-run creates no publication artifacts', async () => temporary(async root => {
  await trackLens(root);
  const snapshot = coverageInputs().snapshot;
  snapshot.freshness.generatedAt = JSON.parse(lensFixture).generatedAt;
  const result = await generateStaticFromSnapshot({ root, config: parseStaticConfig({ ...raw, lens: { path: 'lens.json' } }), snapshot, dryRun: true });
  assert.equal(generatedScenePaths(result).length, 2);
  assert.deepEqual((await readdir(root)).sort(), ['.git', 'lens.json']);
}));
