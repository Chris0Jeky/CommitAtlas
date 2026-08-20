#!/usr/bin/env node
import { generateStatic } from "./generate.js";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArguments(argv);
  const result = await generateStatic(parsed);
  process.stdout.write(`${JSON.stringify({
    user: result.manifest.user,
    outputDir: result.outputDir,
    written: result.written,
    window: result.manifest.window,
    artifacts: result.manifest.artifacts,
  }, null, 2)}\n`);
}

function parseArguments(argv: readonly string[]): {
  configPath?: string;
  outputDir?: string;
  asOf?: string;
  dryRun?: boolean;
} {
  if (argv[0] !== "generate") throw new Error("Usage: commitatlas generate [--config PATH] [--output-dir PATH] [--as-of YYYY-MM-DD] [--dry-run]");
  const parsed: { configPath?: string; outputDir?: string; asOf?: string; dryRun?: boolean } = {};
  const seen = new Set<string>();
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index]!;
    if (seen.has(key)) throw new Error(`Duplicate argument: ${key}`);
    seen.add(key);
    if (key === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (!["--config", "--output-dir", "--as-of"].includes(key)) throw new Error(`Unknown argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    index += 1;
    if (key === "--config") parsed.configPath = value;
    if (key === "--output-dir") parsed.outputDir = value;
    if (key === "--as-of") parsed.asOf = value;
  }
  return parsed;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "CommitAtlas generation failed";
  process.stderr.write(`CommitAtlas: ${message}\n`);
  process.exitCode = 1;
});
