import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const sceneIds = ["identity-beacon", "evidence-coverage", "activity-terrain"];
const stillOutputs = ["atlas-still", "atlas-compact-still", "atlas-wide-still", "activity-still"];
const base = {
  version: 1, user: "scene-demo", days: 7, theme: "ember", motion: "ambient",
  outputDir: "assets/commitatlas", cards: ["atlas", "activity", "profile"], scenes: sceneIds,
  responsiveAtlas: true, reducedMotion: true,
  identity: { name: "Synthetic owner", tagline: "Public signals", focus: ["Atlas"] },
  projects: [{ repo: "scene-demo/atlas", label: "Atlas", lifecycle: "active" }],
  themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
};
const hash = value => createHash("sha256").update(value).digest("hex");
function outputValue(outputs, name) {
  const match = new RegExp(`(?:^|\\n)${name}<<([^\\r\\n]+)\\r?\\n([\\s\\S]*?)\\r?\\n\\1(?:\\r?\\n|$)`, "u").exec(outputs);
  assert.ok(match, `the executed Action must set ${name}, including when it is empty`);
  return match[2];
}
async function execute({ changes = {}, dryRun = false, outputDir = "" } = {}, inspect) {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-action-stills-"));
  try {
    await exec("git", ["init", "-q"], { cwd: root, windowsHide: true });
    const config = { ...base, ...changes };
    await writeFile(path.join(root, ".commitatlas.json"), JSON.stringify(config));
    await exec("git", ["add", ".commitatlas.json"], { cwd: root, windowsHide: true });
    const output = path.join(root, "outputs.txt"), summary = path.join(root, "summary.md");
    await writeFile(output, "");
    await writeFile(summary, "");
    await exec(process.execPath, ["--import", new URL("./evidence-network.fixture.mjs", import.meta.url).href,
      fileURLToPath(new URL("./dist/index.js", import.meta.url))], {
      cwd: root, timeout: 20_000, windowsHide: true,
      env: { ...process.env, GITHUB_WORKSPACE: root, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
        GITHUB_TOKEN: "", "INPUT_GITHUB-TOKEN": "", INPUT_CONFIG: ".commitatlas.json",
        "INPUT_DRY-RUN": String(dryRun), "INPUT_OUTPUT-DIR": outputDir, "INPUT_AS-OF": "2026-01-07" },
    }).catch(error => { throw new Error(`Synthetic still Action failed: ${error.stdout} ${error.stderr}`, { cause: error }); });
    await inspect({ root, config, primary: outputDir || config.outputDir, outputs: await readFile(output, "utf8") });
  } finally { await rm(root, { recursive: true, force: true }); }
}
function scenePaths(primary, selected, suffix) {
  return [primary, base.themes[0].outputDir].flatMap(directory => selected.map(id => `${directory}/scene-${id}${suffix}`).sort());
}

for (const layout of ["wide", "compact"]) test(`executed Action exposes ${layout} card stills and separate paired scene stills with manifest integrity`, async () => {
  await execute({ changes: { layout } }, async ({ root, primary, outputs }) => {
    const companion = layout === "wide" ? "atlas-compact" : "atlas-wide";
    const inactive = layout === "wide" ? "atlas-wide" : "atlas-compact";
    for (const output of ["atlas-still", `${companion}-still`, "activity-still"]) {
      assert.equal(outputValue(outputs, output), `${primary}/${output}.svg`);
    }
    assert.equal(outputValue(outputs, `${inactive}-still`), "");
    assert.deepEqual(JSON.parse(outputValue(outputs, "scenes")), scenePaths(primary, sceneIds, ".svg"));
    assert.deepEqual(JSON.parse(outputValue(outputs, "scene-stills")), scenePaths(primary, sceneIds, ".still.svg"));
    const expected = ["atlas.svg", `${companion}.svg`, "activity.svg", "profile.svg",
      "atlas-still.svg", `${companion}-still.svg`, "activity-still.svg",
      ...sceneIds.flatMap(id => [`scene-${id}.svg`, `scene-${id}.still.svg`])].sort();
    const manifests = [];
    for (const directory of [primary, base.themes[0].outputDir]) {
      const manifest = JSON.parse(await readFile(path.join(root, directory, "manifest.json"), "utf8"));
      assert.deepEqual(manifest.artifacts.map(artifact => artifact.path), expected);
      assert.equal(manifest.window.to, "2026-01-07");
      for (const artifact of manifest.artifacts) {
        const body = await readFile(path.join(root, directory, artifact.path));
        assert.equal(body.byteLength, artifact.bytes);
        assert.equal(hash(body), artifact.sha256);
        if (artifact.path.endsWith("-still.svg") || artifact.path.endsWith(".still.svg")) {
          assert.doesNotMatch(body.toString("utf8"), /<style\b|<animate|<set\b|@keyframes/);
        }
      }
      manifests.push(manifest);
    }
    assert.equal(manifests[0].generatedAt, manifests[1].generatedAt);
    assert.deepEqual(manifests[0].window, manifests[1].window);
    for (const id of sceneIds) {
      assert.notEqual(manifests[0].artifacts.find(a => a.path === `scene-${id}.still.svg`).sha256,
        manifests[1].artifacts.find(a => a.path === `scene-${id}.still.svg`).sha256);
    }
  });
});

test("executed Action dry-run reports still paths and output override without creating artifact directories", async () => {
  await execute({ dryRun: true, outputDir: "preview/assets" }, async ({ root, primary, outputs }) => {
    assert.equal(outputValue(outputs, "manifest"), `${primary}/manifest.json`);
    for (const output of ["atlas-still", "atlas-compact-still", "activity-still"]) {
      assert.equal(outputValue(outputs, output), `${primary}/${output}.svg`);
    }
    assert.equal(outputValue(outputs, "atlas-wide-still"), "");
    assert.deepEqual(JSON.parse(outputValue(outputs, "scenes")), scenePaths(primary, sceneIds, ".svg"));
    assert.deepEqual(JSON.parse(outputValue(outputs, "scene-stills")), scenePaths(primary, sceneIds, ".still.svg"));
    for (const directory of ["assets", "preview"]) await assert.rejects(lstat(path.join(root, directory)), { code: "ENOENT" });
  });
});

for (const [label, changes] of [
  ["disabled", { reducedMotion: false }],
  ["default", { reducedMotion: undefined }],
  ["unselected", { cards: ["profile"], scenes: [], responsiveAtlas: false }],
]) test(`executed Action explicitly clears ${label} still outputs without changing ordinary scenes`, async () => {
  await execute({ changes }, async ({ root, config, primary, outputs }) => {
    for (const output of stillOutputs) assert.equal(outputValue(outputs, output), "");
    assert.deepEqual(JSON.parse(outputValue(outputs, "scene-stills")), []);
    assert.deepEqual(JSON.parse(outputValue(outputs, "scenes")), scenePaths(primary, config.scenes, ".svg"));
    for (const directory of [primary, base.themes[0].outputDir]) {
      const manifest = JSON.parse(await readFile(path.join(root, directory, "manifest.json"), "utf8"));
      assert.ok(manifest.artifacts.every(artifact => !artifact.path.endsWith("-still.svg") && !artifact.path.endsWith(".still.svg")));
    }
  });
});
