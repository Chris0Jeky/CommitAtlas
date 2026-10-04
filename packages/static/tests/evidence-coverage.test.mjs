import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateStaticFromSnapshot, generatedScenePaths, parseStaticConfig } from '../dist/index.js';
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
