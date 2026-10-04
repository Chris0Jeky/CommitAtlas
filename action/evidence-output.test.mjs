import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
const exec = promisify(execFile);

test('executed Action bundle retains built-in registration and reports paired scene paths', async () => {
  for (const dryRun of [true, false]) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'commitatlas-action-evidence-'));
    try {
      await exec('git', ['init', '-q'], { cwd: root, windowsHide: true });
      await writeFile(path.join(root, '.commitatlas.json'), JSON.stringify({
        version: 1, user: 'scene-demo', days: 7, theme: 'ember', motion: 'none',
        outputDir: 'assets/commitatlas', cards: ['profile'], scenes: ['evidence-coverage'],
        themes: [{ theme: 'paper', outputDir: 'assets/commitatlas/light' }],
        projects: [{ repo: 'scene-demo/atlas', label: 'Synthetic Atlas', lifecycle: 'active' }],
      }));
      await exec('git', ['add', '.commitatlas.json'], { cwd: root, windowsHide: true });
      const output = path.join(root, 'action-output.txt'), summary = path.join(root, 'action-summary.md');
      await writeFile(output, ''); await writeFile(summary, '');
      await exec(process.execPath, ['--import', new URL('./evidence-network.fixture.mjs', import.meta.url).href,
        fileURLToPath(new URL('./dist/index.js', import.meta.url))], {
        cwd: root, timeout: 20_000, windowsHide: true,
        env: { ...process.env, GITHUB_WORKSPACE: root, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
          GITHUB_TOKEN: '', 'INPUT_GITHUB-TOKEN': '', INPUT_CONFIG: '.commitatlas.json',
          'INPUT_DRY-RUN': String(dryRun), 'INPUT_OUTPUT-DIR': '', 'INPUT_AS-OF': '2026-01-07' },
      }).catch(error => { throw new Error(`Synthetic Action failed: ${error.stdout} ${error.stderr}`, { cause: error }); });
      const outputs = await readFile(output, 'utf8');
      const match = /(?:^|\n)scenes<<[^\r\n]+\r?\n([^\r\n]+)/u.exec(outputs);
      assert.ok(match, 'executed Action must write the scenes output');
      assert.deepEqual(JSON.parse(match[1]), ['assets/commitatlas/scene-evidence-coverage.svg', 'assets/commitatlas/light/scene-evidence-coverage.svg']);
      for (const relative of JSON.parse(match[1])) {
        if (dryRun) await assert.rejects(readFile(path.join(root, relative)), { code: 'ENOENT' });
        else assert.match(await readFile(path.join(root, relative), 'utf8'), /Evidence coverage/u);
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});
