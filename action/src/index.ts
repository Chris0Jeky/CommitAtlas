import path from "node:path";
import * as core from "@actions/core";
import { generateStatic } from "@commit-atlas/static";

async function run(): Promise<void> {
  const root = process.env.GITHUB_WORKSPACE;
  if (!root) throw new Error("GITHUB_WORKSPACE is required");
  const dryRunInput = core.getInput("dry-run").trim();
  if (dryRunInput !== "true" && dryRunInput !== "false") {
    throw new Error("dry-run must be true or false");
  }
  const result = await generateStatic({
    cwd: root,
    configPath: core.getInput("config") || ".commitatlas.json",
    ...(core.getInput("output-dir") ? { outputDir: core.getInput("output-dir") } : {}),
    ...(core.getInput("as-of") ? { asOf: core.getInput("as-of") } : {}),
    dryRun: dryRunInput === "true",
  });

  const outputRoot = relative(root, result.outputDir);
  core.setOutput("manifest", `${outputRoot}/manifest.json`);
  const generated = new Set(result.manifest.artifacts.map((artifact) => artifact.path));
  for (const [output, artifact] of [
    ["atlas", "atlas.svg"],
    ["atlas-compact", "atlas-compact.svg"],
    ["atlas-wide", "atlas-wide.svg"],
    ["profile", "profile.svg"],
    ["streak", "streak.svg"],
    ["activity", "activity.svg"],
    ["languages", "languages.svg"],
    ["projects", "projects.svg"],
  ] as const) {
    core.setOutput(output, generated.has(artifact) ? `${outputRoot}/${artifact}` : "");
  }
  core.info(`Generated ${result.manifest.artifacts.length} CommitAtlas card(s) for ${result.manifest.user}.`);
  await core.summary
    .addHeading("CommitAtlas static portfolio")
    .addTable([
      [{ data: "Signal", header: true }, { data: "Value", header: true }],
      ["User", result.manifest.user],
      ["Window", `${result.manifest.window.from} to ${result.manifest.window.to}`],
      ["Cards", String(result.manifest.artifacts.length)],
      ["Output", outputRoot],
    ])
    .write();
}

function relative(root: string, target: string): string {
  const value = path.relative(root, target).replaceAll("\\", "/");
  if (!value || value.startsWith("../") || path.isAbsolute(value)) throw new Error("Action output escaped GITHUB_WORKSPACE");
  return value;
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : "CommitAtlas generation failed");
});
