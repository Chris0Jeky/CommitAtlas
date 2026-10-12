import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubApiError, GitHubClient } from '../dist/index.js';

const NOW = new Date('2026-10-12T12:00:00Z');
const A = 'a'.repeat(40), B = 'b'.repeat(40);
const STAMP = '2026-10-12T11:00:00Z';
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
function fixture(options = {}) {
  const calls = [];
  const branch = options.branch ?? 'main';
  const workflow = options.workflow ?? 'ci.yml';
  const repo = { name: 'atlas', private: false, html_url: 'https://github.com/scene-demo/atlas',
    default_branch: branch, stargazers_count: 0, forks_count: 0, open_issues_count: 0,
    ...options.repo };
  const run = { status: 'completed', conclusion: 'success', updated_at: STAMP,
    html_url: 'https://github.com/scene-demo/atlas/actions/runs/1', head_sha: A, ...options.run };
  const fetchImpl = async request => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    calls.push(url);
    assert.equal(url.origin, 'https://api.github.com');
    if (url.pathname === '/repos/scene-demo/atlas') return response(repo);
    if (url.pathname.endsWith('/releases/latest')) return response({}, 404);
    if (url.pathname === `/repos/scene-demo/atlas/branches/${encodeURIComponent(branch)}`) {
      if (options.tipError) throw new Error('synthetic upstream outage');
      return response(Object.hasOwn(options, 'tip') ? options.tip : { name: branch, commit: { sha: A } },
        options.tipStatus ?? 200, options.tipHeaders);
    }
    if (url.pathname === `/repos/scene-demo/atlas/actions/workflows/${encodeURIComponent(workflow)}/runs`) {
      assert.equal(url.searchParams.get('branch'), branch);
      assert.equal(url.searchParams.get('per_page'), '1');
      assert.equal(url.searchParams.get('exclude_pull_requests'), 'true');
      return response(Object.hasOwn(options, 'runs') ? options.runs : { workflow_runs: [run] });
    }
    assert.fail(`unexpected request ${url.pathname}`);
  };
  const get = () => new GitHubClient({ fetchImpl, now: () => NOW }).fetchProjects('scene-demo', ['atlas'],
    new Map([['atlas', 'active']]), options.unconfigured ? new Map() : new Map([['atlas', workflow]]));
  return { get, calls };
}
const tipCalls = calls => calls.filter(url => url.pathname.includes('/branches/'));
const runCalls = calls => calls.filter(url => url.pathname.includes('/actions/'));
function noReading(board) {
  assert.equal(board.projects[0].ci.state, 'unavailable');
  assert.equal(board.projects[0].ci.label, 'CI unavailable');
  assert.equal(board.projects[0].ci.headSha, null);
  assert.equal(board.projects[0].ci.checkedAt, null);
  assert.equal(board.projects[0].ci.url, null);
  assert.equal(board.freshness.mode, 'partial');
}
for (const conclusion of ['success', 'failure', 'cancelled', 'timed_out']) {
  test(`a ${conclusion} run on an older revision cannot describe current HEAD`, async () => {
    const f = fixture({ tip: { name: 'main', commit: { sha: B } }, run: { conclusion } });
    noReading(await f.get());
    assert.equal(tipCalls(f.calls).length, 1);
    assert.equal(runCalls(f.calls).length, 1);
    assert.equal(f.calls.length, 4);
  });
}
for (const [run, expected] of [
  [{}, 'passing'], [{ conclusion: 'failure' }, 'failing'],
  [{ status: 'in_progress', conclusion: null }, 'pending'],
  [{ status: 'queued', conclusion: null }, 'pending'],
  [{ updated_at: '2026-10-08T00:00:00Z' }, 'stale'],
  [{ head_sha: A.toUpperCase() }, 'passing'],
]) {
  test(`matching observed tip retains ${expected} (${JSON.stringify(run)})`, async () => {
    const f = fixture({ run });
    const board = await f.get();
    assert.equal(board.projects[0].ci.state, expected);
    assert.equal(board.projects[0].ci.headSha, A);
    assert.equal(board.projects[0].ci.checkedAt, run.updated_at ?? STAMP);
    assert.equal(f.calls.length, 4);
    assert.ok(f.calls.findIndex(u => u.pathname.includes('/branches/')) < f.calls.findIndex(u => u.pathname.includes('/actions/')));
  });
}
for (const [name, tip] of [
  ['missing commit', { name: 'main' }], ['null commit', { name: 'main', commit: null }],
  ['array commit', { name: 'main', commit: [] }], ['missing SHA', { name: 'main', commit: {} }],
  ['short SHA', { name: 'main', commit: { sha: 'abc123' } }],
  ['invalid SHA', { name: 'main', commit: { sha: 'z'.repeat(40) } }],
  ['nonstring SHA', { name: 'main', commit: { sha: 123 } }],
  ['oversized SHA', { name: 'main', commit: { sha: 'a'.repeat(100000) } }],
  ['wrong branch', { name: 'other', commit: { sha: A } }], ['array', []],
]) {
  test(`an unreadable tip (${name}) cannot authorize a healthy CI reading`, async () => {
    const f = fixture({ tip });
    noReading(await f.get());
    assert.equal(runCalls(f.calls).length, 0, 'no workflow query without a bound tip');
  });
}
for (const sha of [null, 123, 'abc123', 'g'.repeat(40), 'a'.repeat(41)]) {
  test(`malformed run SHA ${JSON.stringify(sha)} cannot bind to the tip`, async () => {
    noReading(await fixture({ run: { head_sha: sha } }).get());
  });
}
for (const defaultBranch of [undefined, null, '', 12]) {
  test(`missing or invalid default branch ${JSON.stringify(defaultBranch)} is not guessed as main`, async () => {
    const f = fixture({ repo: { default_branch: defaultBranch } });
    noReading(await f.get());
    assert.equal(tipCalls(f.calls).length, 0);
    assert.equal(runCalls(f.calls).length, 0);
  });
}
for (const tipStatus of [403, 404]) {
  test(`a refused or missing tip (${tipStatus}) is unavailable, not unconfigured`, async () => {
    noReading(await fixture({ tipStatus }).get());
  });
}
for (const tipStatus of [429, 500]) {
  test(`tip transport failure ${tipStatus} preserves the upstream error contract`, async () => {
    await assert.rejects(() => fixture({ tipStatus, tipHeaders: { 'retry-after': '15' } }).get(), error => {
      assert.ok(error instanceof GitHubApiError);
      assert.equal(error.code, tipStatus === 429 ? 'github_rate_limited' : 'github_unavailable');
      return true;
    });
  });
}
for (const runs of [{}, { workflow_runs: [] }, { workflow_runs: [null] }, { workflow_runs: ['bad'] }]) {
  test(`unusable or missing run remains unavailable (${JSON.stringify(runs)})`, async () => {
    noReading(await fixture({ runs }).get());
  });
}
test('branch and workflow identities remain single encoded path segments', async () => {
  const f = fixture({ branch: 'release/v2', workflow: 'ci checks.yml' });
  assert.equal((await f.get()).projects[0].ci.state, 'passing');
  assert.ok(f.calls.some(url => url.pathname.endsWith('/branches/release%2Fv2')));
  assert.ok(f.calls.some(url => url.pathname.includes('/workflows/ci%20checks.yml/')));
});
test('unconfigured CI performs neither branch nor workflow lookup', async () => {
  const f = fixture({ unconfigured: true, repo: { default_branch: undefined } });
  assert.equal((await f.get()).projects[0].ci.state, 'unconfigured');
  assert.equal(f.calls.length, 2);
});
test('private repositories are rejected before any auxiliary request', async () => {
  const f = fixture({ repo: { private: true } });
  await assert.rejects(() => f.get(), error => error instanceof GitHubApiError && error.code === 'private_data');
  assert.equal(f.calls.length, 1);
});
