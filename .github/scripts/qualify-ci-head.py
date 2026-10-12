"""Pinned source transport for #348. Removed after publishing the verified blobs."""
from pathlib import Path
import hashlib
import re

EXPECTED = {
    'packages/github/src/client.ts': 'd8e772ab14e2c9fe8ff74e57aadcfa3a71716a28',
    'lib/github/client.test.ts': 'ad70822cbe8470abc8ff066a7aa0fd364c245e08',
    'lib/github/terminal-conclusions.test.ts': 'c89e78e0fcc75a95f3557a064993a3031266e58b',
    'tests/rendered-html.test.mjs': '2b4b33dd4323c2e36bebade84f51f1ba3326f6a3',
    'package.json': '1ba796f948dabe66746f1c94359c0924f4a199bb',
}

def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

for path, expected in EXPECTED.items():
    assert blob(Path(path).read_bytes()) == expected, f'Preimage changed: {path}'


def replace(text, old, new, count=1):
    assert text.count(old) == count, f'Unexpected anchor count: {old[:80]}'
    return text.replace(old, new)


def omit_tip_from_test(text, title):
    start = text.index('test("' + title)
    end = text.find('\ntest(', start + 1)
    if end < 0:
        end = len(text)
    block = text[start:end]
    block, count = re.subn(r'^ *if \(url\.pathname\.endsWith\("/branches/main"\)\).*\n', '', block, flags=re.M)
    assert count == 1, title
    return text[:start] + block + text[end:]

p = Path('packages/github/src/client.ts')
s = p.read_text()
s = replace(s, 'const defaultBranch = textField(repo, "default_branch", GITHUB_TEXT_LIMITS.branch) ?? "main";',
            'const defaultBranch = textField(repo, "default_branch", GITHUB_TEXT_LIMITS.branch) ?? "";')
s = replace(s, '''  ): Promise<ProjectCiSignal> {
    const result = await this.getJson(''', '''  ): Promise<ProjectCiSignal> {
    const unavailable = () => toJsonCiSignal(
      calculateGitHubCiState({ available: false, configured: true }, this.now()), workflow, null, null,
    );
    // Bind the workflow to the observed default-branch tip, not merely to its name.
    // No guessed branch and no additional request when CI is unconfigured.
    if (!branch) return unavailable();
    const tip = await this.getJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/branches/${encodeURIComponent(branch)}`,
      true,
    );
    if (!isRecord(tip) || tip.name !== branch || !isRecord(tip.commit) ||
      typeof tip.commit.sha !== "string" || !/^[a-f\\d]{40}$/iu.test(tip.commit.sha)) return unavailable();
    const headSha = tip.commit.sha.toLowerCase();
    const result = await this.getJson(''')
s = replace(s, 'if (result === null || result === OPTIONAL_LOOKUP_UNAVAILABLE || !isRecord(result)) {\n      return toJsonCiSignal',
            'if (!isRecord(result)) {\n      return toJsonCiSignal')
s = replace(s, '    const status = calculateGitHubCiState(workflowObservation(run), this.now());', '''    // Ignore even successful, failed or pending runs for another revision.
    // Do not attach their timestamps or URLs to the current-head signal.
    if (typeof run.head_sha !== "string" || run.head_sha.length !== 40 || run.head_sha.toLowerCase() !== headSha) return unavailable();
    const status = calculateGitHubCiState(workflowObservation(run), this.now());''')
s = replace(s, 'textField(run, "head_sha", GITHUB_TEXT_LIMITS.commitSha),', 'headSha,')
p.write_text(s)

for name, count in [('lib/github/client.test.ts', 10), ('lib/github/terminal-conclusions.test.ts', 1)]:
    p = Path(name)
    s = replace(p.read_text(), 'const NOW =', 'const HEAD_SHA = "a".repeat(40);\nconst NOW =')
    pattern = r'^( *)if \(url\.pathname\.endsWith\("/releases/latest"\)\) return json\(\{\}, 404\);'
    s, actual = re.subn(pattern, lambda m: m[1] + 'if (url.pathname.endsWith("/branches/main")) return json({ name: "main", commit: { sha: HEAD_SHA } });\n' + m[0], s, flags=re.M)
    assert actual == count
    if name.endswith('/client.test.ts'):
        s = replace(s, 'head_sha: "abc123",', 'head_sha: HEAD_SHA,')
        s = replace(s, 'workflow_runs: [{ status: "completed", conclusion: "success", updated_at:',
                    'workflow_runs: [{ head_sha: HEAD_SHA, status: "completed", conclusion: "success", updated_at:', 2)
        s = replace(s, 'workflow_runs: [run]', 'workflow_runs: [{ head_sha: HEAD_SHA, ...run }]', 2)
        s = replace(s, 'if (optionalPath(url.pathname)) return optional();',
                    'if (url.pathname.endsWith("/branches/main")) return json({ name: "main", commit: { sha: HEAD_SHA } });\n    if (optionalPath(url.pathname)) return optional();')
        for title in ['leaves CI unconfigured without inspecting arbitrary repository workflows',
                      'rejects a fractional repository metric rather than storing it as exact data',
                      'bounds concurrent project lookups below the Worker connection limit']:
            s = omit_tip_from_test(s, title)
    else:
        s = replace(s, 'workflow_runs: [{\n          status:', 'workflow_runs: [{\n          head_sha: HEAD_SHA,\n          status:')
    p.write_text(s)

p = Path('tests/rendered-html.test.mjs')
s = p.read_text()
pattern = r'^( *)if \(url\.pathname === "/repos/acme/atlas"\) return githubJson\(publicProjectPayload\(\)\);'
s, count = re.subn(pattern, lambda m: m[0] + '\n' + m[1] + 'if (url.pathname.endsWith("/branches/main")) return githubJson({ name: "main", commit: { sha: CI_HEAD_SHA } });', s, flags=re.M)
assert count == 5
s = replace(s, '''noWorkflowCalls.push(url.pathname);
    if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
    if (url.pathname.endsWith("/branches/main")) return githubJson({ name: "main", commit: { sha: CI_HEAD_SHA } });''', '''noWorkflowCalls.push(url.pathname);
    if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());''')
s = replace(s, 'const RECENT_RUN_UPDATED_AT =', 'const CI_HEAD_SHA = "a".repeat(40);\nconst RECENT_RUN_UPDATED_AT =')
s = replace(s, 'workflow_runs: [{ status: "completed", conclusion, updated_at: RECENT_RUN_UPDATED_AT }]',
            'workflow_runs: [{ head_sha: CI_HEAD_SHA, status: "completed", conclusion, updated_at: RECENT_RUN_UPDATED_AT }]')
s += '''\n\ntest("the built Worker attributes workflow status only to the captured default-branch tip", async () => {
  for (const matches of [false, true]) {
    const response = await withMockedFetch(async input => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
      if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
      if (url.pathname.endsWith("/branches/main")) return githubJson({ name: "main", commit: { sha: matches ? CI_HEAD_SHA : "b".repeat(40) } });
      if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) return githubJson(workflowRuns("success"));
      assert.fail(`unexpected fixture request: ${url.pathname}`);
    }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:ci.yml"));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.projects[0].ci.state, matches ? "passing" : "unavailable");
    assert.equal(payload.projects[0].ci.headSha, matches ? CI_HEAD_SHA : null);
    assert.equal(payload.projects[0].ci.checkedAt, matches ? RECENT_RUN_UPDATED_AT : null);
    assert.equal(payload.freshness.mode, matches ? "live" : "partial");
  }
});\n'''
p.write_text(s)
p = Path('package.json')
s = replace(p.read_text(), '"test:github": "node --test tests/github-test-discovery.test.mjs',
            '"test:github": "npm run build:github && node --test packages/github/tests/ci-current-head.test.mjs && node --test tests/github-test-discovery.test.mjs')
p.write_text(s)
for path in EXPECTED:
    print('PREPARED_BLOB', path, blob(Path(path).read_bytes()))
