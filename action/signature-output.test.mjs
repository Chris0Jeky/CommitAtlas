import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const fixture = await readFile(new URL('../research-contracts/lens-projection/v1/showcase.fixture.json', import.meta.url));
const projection = JSON.parse(fixture.toString('utf8'));
const scenePaths = ['assets/commitatlas/scene-signature.svg', 'assets/commitatlas/light/scene-signature.svg'];

async function executeSignature({ asOf, dryRun = false }, inspect) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commitatlas-action-signature-'));
  try {
    await exec('git', ['init', '-q'], { cwd: root, windowsHide: true });
    await writeFile(path.join(root, 'lens.json'), fixture);
    await writeFile(path.join(root, '.commitatlas.json'), JSON.stringify({
      version: 1, user: 'scene-demo', days: 7, theme: 'ember', motion: 'ambient',
      outputDir: 'assets/commitatlas', cards: ['profile'], scenes: ['signature'], scenePack: 'survey',
      lens: { path: 'lens.json' }, themes: [{ theme: 'paper', outputDir: 'assets/commitatlas/light' }],
      projects: [{ repo: 'scene-demo/atlas', label: 'Synthetic Atlas', lifecycle: 'active' }],
    }));
    await exec('git', ['add', '.commitatlas.json', 'lens.json'], { cwd: root, windowsHide: true });
    const output = path.join(root, 'action-output.txt'), summary = path.join(root, 'action-summary.md');
    await writeFile(output, ''); await writeFile(summary, '');
    await exec(process.execPath, ['--import', new URL('./evidence-network.fixture.mjs', import.meta.url).href,
      fileURLToPath(new URL('./dist/index.js', import.meta.url))], {
      cwd: root, timeout: 20_000, windowsHide: true,
      env: { ...process.env, GITHUB_WORKSPACE: root, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
        GITHUB_TOKEN: '', 'INPUT_GITHUB-TOKEN': '', INPUT_CONFIG: '.commitatlas.json',
        'INPUT_DRY-RUN': String(dryRun), 'INPUT_OUTPUT-DIR': '', 'INPUT_AS-OF': asOf },
    }).catch(error => { throw new Error(`Synthetic Signature Action failed: ${error.stdout} ${error.stderr}`, { cause: error }); });
    const outputs = await readFile(output, 'utf8');
    const match = /(?:^|\n)scenes<<[^\r\n]+\r?\n([^\r\n]+)/u.exec(outputs);
    assert.ok(match, 'the executed bundle must report scene paths');
    assert.deepEqual(JSON.parse(match[1]), scenePaths);
    assert.deepEqual(await readFile(path.join(root, 'lens.json')), fixture, 'the tracked C0 artifact stays byte-identical');
    assert.equal(projection.generatedAt, '2026-09-01T12:00:00Z', 'freshness tests move only the explicit snapshot clock');
    await inspect(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

async function pairedScenes(root, asOf) {
  const bodies = [], hashes = [];
  for (const relative of scenePaths) {
    const directory = path.join(root, path.dirname(relative));
    const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
    assert.equal(Date.parse(manifest.generatedAt), Date.parse(`${asOf}T12:00:00Z`));
    assert.equal(manifest.window.to, asOf);
    assert.deepEqual(manifest.artifacts.map(artifact => artifact.path).sort(), ['profile.svg', 'scene-signature.svg']);
    for (const artifact of manifest.artifacts) {
      const bytes = await readFile(path.join(directory, artifact.path));
      assert.equal(bytes.byteLength, artifact.bytes, `${relative}: actual byte count`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256, `${relative}: actual SHA-256`);
      if (artifact.path === 'scene-signature.svg') {
        bodies.push(bytes.toString('utf8')); hashes.push(artifact.sha256);
      }
    }
  }
  assert.notEqual(hashes[0], hashes[1], 'the paired scenes carry their distinct themes');
  return bodies;
}

test('executed Action bundle generates fresh ambient Signature pairs with real manifest integrity', async () => {
  const asOf = '2026-09-01';
  await executeSignature({ asOf }, async root => {
    for (const body of await pairedScenes(root, asOf)) {
      assert.match(body, /<title>Developer signature<\/title>/);
      assert.ok(body.includes(projection.archetype.name));
      assert.match(body, /SYNTHETIC SHOWCASE/);
      assert.match(body, /Projection age: 0 days/);
      assert.match(body, /<animate(?:Transform)?\b/);
      assert.match(body, /repeatDur="45s"/);
      assert.doesNotMatch(body, /STALE PROJECTION|EXPIRED PROJECTION|SIGNATURE UNAVAILABLE/);
    }
  });
});

for (const [asOf, ageDays, state] of [
  ['2026-10-26', 55, 'STALE'], ['2026-12-01', 91, 'EXPIRED'],
]) test(`executed Action preserves ${state.toLowerCase()} Signature disclosure without motion`, async () => {
  await executeSignature({ asOf }, async root => {
    for (const body of await pairedScenes(root, asOf)) {
      assert.match(body, new RegExp(`${state} PROJECTION`));
      assert.match(body, new RegExp(`${ageDays} days`));
      assert.doesNotMatch(body, /<style\b|<animate(?:Transform|Motion)?\b/);
      if (state === 'STALE') {
        assert.ok(body.includes(projection.archetype.name));
        assert.match(body, /LAST DERIVED COVERAGE/);
      } else {
        assert.match(body, /SIGNATURE UNAVAILABLE/);
        assert.ok(!body.includes(projection.archetype.name));
        assert.doesNotMatch(body, /\b(?:Focus|Shipping|STRONGEST DIMENSIONS)\b/);
      }
    }
  });
});

test('executed Signature dry run reports both paths without writing artifact trees', async () => {
  await executeSignature({ asOf: '2026-09-01', dryRun: true }, async root => {
    await assert.rejects(lstat(path.join(root, 'assets')), { code: 'ENOENT' });
  });
});
