import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);

test("action keeps delivery credentials optional and exposes generated evidence outputs", async () => {
  const metadata = await readFile(new URL("../action.yml", import.meta.url), "utf8");
  assert.match(metadata, /using: node24/);
  assert.match(metadata, /main: action\/dist\/index\.js/);
  assert.match(metadata, /github-token:\r?\n[\s\S]*?required: false/);
  assert.match(metadata, /dry-run:/);
  for (const output of [
    "scenes", "scene-stills", "manifest", "atlas", "atlas-compact", "atlas-wide", "profile", "streak", "activity", "breakdown",
    "atlas-still", "atlas-compact-still", "atlas-wide-still", "activity-still",
    "rhythm", "languages", "projects", "cadence", "releases", "delivery", "delivery-json",
    "projects-json", "projects-markdown",
  ]) {
    assert.match(metadata, new RegExp(`  ${output}:`));
  }
});

test("checked bundle contains delivery generation but no source map or token sentinel", async () => {
  const bundle = await readFile(new URL("./dist/index.js", import.meta.url), "utf8");
  assert.match(bundle, /CommitAtlas static portfolio/);
  assert.match(bundle, /Variant/);
  assert.match(bundle, /delivery\.json/);
  assert.match(bundle, /github-token/);
  assert.match(bundle, /activity-terrain/);
  assert.doesNotMatch(bundle, /must-not-leave-process|sourceMappingURL=/);
});

test("Action reports the aggregate scene output from generated results", async () => {
  const source = await readFile(new URL("./src/index.ts", import.meta.url), "utf8");
  assert.match(source, /core\.setOutput\("scenes", JSON\.stringify\(generatedScenePaths\(result\)\)\)/);
  const bundle = await readFile(new URL("./dist/index.js", import.meta.url), "utf8");
  assert.match(bundle, /setOutput\)\("scenes"|setOutput\("scenes"/);
});

test("failed Action refresh identifies the failure and preserves committed artifacts", async () => {
  for (const failure of ["backend", "network"]) {
    const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-action-failure-"));
    try {
      await exec("git", ["init", "-q"], { cwd: root, windowsHide: true });
      await writeFile(path.join(root, ".commitatlas.json"), JSON.stringify({
        version: 1, user: "scene-demo", days: 7, theme: "ember", motion: "none",
        outputDir: "assets/commitatlas", cards: ["profile"],
        projects: [{ repo: "scene-demo/atlas", label: "Synthetic Atlas", lifecycle: "active" }],
      }));
      const artifacts = path.join(root, "assets/commitatlas");
      await mkdir(artifacts, { recursive: true });
      await writeFile(path.join(artifacts, "profile.svg"), "previous-good-profile");
      await writeFile(path.join(artifacts, "manifest.json"), "previous-good-manifest");
      await exec("git", ["add", ".commitatlas.json", "assets/commitatlas"], { cwd: root, windowsHide: true });

      const fixture = path.join(root, "network-failure.mjs");
      await writeFile(fixture, `import ${JSON.stringify(new URL("./evidence-network.fixture.mjs", import.meta.url).href)};
const success = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === "https://github.com") {
    if (${JSON.stringify(failure)} === "network") throw new Error("fixture-sensitive-network-detail");
    return new Response("fixture-sensitive-upstream-detail", { status: 503, headers: { "retry-after": "0" } });
  }
  return success(input, init);
};
`);
      const output = path.join(root, "action-output.txt"), summary = path.join(root, "action-summary.md");
      await writeFile(output, "");
      await writeFile(summary, "");
      await assert.rejects(exec(process.execPath, ["--import", pathToFileURL(fixture).href,
        fileURLToPath(new URL("./dist/index.js", import.meta.url))], {
        cwd: root, timeout: 20_000, windowsHide: true,
        env: { ...process.env, GITHUB_WORKSPACE: root, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
          GITHUB_TOKEN: "", "INPUT_GITHUB-TOKEN": "", INPUT_CONFIG: ".commitatlas.json",
          "INPUT_DRY-RUN": "false", "INPUT_OUTPUT-DIR": "", "INPUT_AS-OF": "2026-01-07" },
      }), (error) => {
        assert.equal(error.code, 1);
        const diagnostic = `${error.stdout} ${error.stderr}`;
        assert.match(diagnostic, /\[github_unavailable\]/);
        if (failure === "backend") assert.match(diagnostic, /HTTP 503\b/);
        else assert.match(diagnostic, /GitHub could not be reached/);
        assert.doesNotMatch(diagnostic, /fixture-sensitive|deadline/);
        return true;
      });
      assert.equal(await readFile(path.join(artifacts, "profile.svg"), "utf8"), "previous-good-profile");
      assert.equal(await readFile(path.join(artifacts, "manifest.json"), "utf8"), "previous-good-manifest");
      assert.equal(await readFile(output, "utf8"), "");
      assert.equal(await readFile(summary, "utf8"), "");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
