import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateStaticFromSnapshot, generatedScenePaths, parseStaticConfig } from '../dist/index.js';
import { signatureInputs, signatureProjection } from '../../svg/tests/signature.fixture.mjs';

async function temporary(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commitatlas-signature-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    await writeFile(path.join(root, 'lens.json'), JSON.stringify(signatureProjection));
    execFileSync('git', ['-C', root, 'add', 'lens.json']);
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
function configuration(extra = {}) {
  return parseStaticConfig({ version: 1, user: 'scene-demo', cards: ['profile'], days: 7,
    projects: [{ repo: 'scene-demo/atlas', label: 'Atlas', lifecycle: 'active' }],
    scenes: ['signature'], lens: { path: 'lens.json' }, theme: 'ember', outputDir: 'output/dark',
    themes: [{ theme: 'paper', outputDir: 'output/light' }], ...extra });
}

for (const motion of ['none', 'ambient']) test(`static signature ${motion} writes real paired artifacts and integrity-bearing scene paths`, async () => temporary(async root => {
  const result = await generateStaticFromSnapshot({ root, config: configuration({ motion }), snapshot: signatureInputs().snapshot });
  assert.deepEqual(generatedScenePaths(result), ['output/dark/scene-signature.svg', 'output/light/scene-signature.svg']);
  const hashes = [];
  for (const output of [result, ...result.variants]) {
    const artifact = output.manifest.artifacts.find(item => item.path === 'scene-signature.svg');
    assert.ok(artifact);
    const bytes = await readFile(path.join(output.outputDir, artifact.path));
    assert.equal(bytes.byteLength, artifact.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256);
    assert.match(bytes.toString(), /The Force Multiplier/);
    assert.match(bytes.toString(), /SYNTHETIC SHOWCASE/);
    assert.match(bytes.toString(), /not a productivity score/);
    if (motion === 'ambient') assert.match(bytes.toString(), /repeatDur="45s"/);
    else assert.doesNotMatch(bytes.toString(), /<style|<animate/);
    hashes.push(artifact.sha256);
  }
  assert.notEqual(hashes[0], hashes[1]);
}));

for (const ageDays of [55, 91]) test(`static signature preserves ${ageDays}-day projection disclosure in both themes`, async () => temporary(async root => {
  const result = await generateStaticFromSnapshot({ root, config: configuration({ motion: 'ambient' }), snapshot: signatureInputs({ ageDays }).snapshot });
  for (const output of [result, ...result.variants]) {
    const image = await readFile(path.join(output.outputDir, 'scene-signature.svg'), 'utf8');
    assert.match(image, new RegExp(`${ageDays} days`));
    assert.doesNotMatch(image, /<animate|<style/);
    if (ageDays === 55) assert.match(image, /STALE PROJECTION/);
    else { assert.match(image, /EXPIRED PROJECTION/); assert.doesNotMatch(image, /The Force Multiplier/); }
  }
}));

test('a selected static signature without Lens input produces unavailable, never six zero readings', async () => temporary(async root => {
  const result = await generateStaticFromSnapshot({ root, config: configuration({ lens: undefined }), snapshot: signatureInputs().snapshot });
  for (const output of [result, ...result.variants]) {
    const image = await readFile(path.join(output.outputDir, 'scene-signature.svg'), 'utf8');
    assert.match(image, /SIGNATURE UNAVAILABLE/);
    assert.doesNotMatch(image, /Focus|Shipping|100%/);
  }
}));
