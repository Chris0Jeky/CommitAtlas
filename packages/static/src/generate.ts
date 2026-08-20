import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GitHubClient, type PortfolioSnapshot, type ProjectLifecycle, type ProjectWorkflow } from "@commit-atlas/github";
import {
  loadStaticConfig,
  resolveContainedPath,
  STATIC_CARD_NAMES,
  type StaticConfig,
} from "./config.js";
import { assembleStaticPortfolio, renderStaticArtifacts, type StaticSvgArtifacts } from "./render.js";

const MAX_ARTIFACT_BYTES = 96 * 1024;
const MANAGED_ARTIFACT_NAMES = [
  ...STATIC_CARD_NAMES.map((card) => `${card}.svg`),
  "atlas-compact.svg",
  "atlas-wide.svg",
] as const;

export interface GeneratedArtifact {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface StaticManifest {
  readonly version: 1;
  readonly generator: "CommitAtlas";
  readonly user: string;
  readonly source: "github-public-profile";
  readonly window: { readonly from: string; readonly to: string; readonly days: number };
  readonly generatedAt: string;
  readonly artifacts: readonly GeneratedArtifact[];
}

export interface GenerateStaticOptions {
  readonly cwd?: string;
  readonly configPath?: string;
  readonly outputDir?: string;
  readonly asOf?: string;
  readonly dryRun?: boolean;
  readonly fetchImpl?: typeof fetch;
}

export interface GenerateStaticResult {
  readonly root: string;
  readonly outputDir: string;
  readonly manifest: StaticManifest;
  readonly written: boolean;
}

export async function generateStatic(options: GenerateStaticOptions = {}): Promise<GenerateStaticResult> {
  const loaded = await loadStaticConfig(options.cwd ?? process.cwd(), options.configPath);
  const config = options.outputDir ? { ...loaded.config, outputDir: options.outputDir } : loaded.config;
  const now = resolveAsOf(options.asOf);
  const snapshot = await fetchStaticPortfolio(config, now, options.fetchImpl);
  return generateStaticFromSnapshot({
    root: loaded.root,
    config,
    snapshot,
    dryRun: options.dryRun,
  });
}

export async function generateStaticFromSnapshot(options: {
  readonly root: string;
  readonly config: StaticConfig;
  readonly snapshot: PortfolioSnapshot;
  readonly dryRun?: boolean;
}): Promise<GenerateStaticResult> {
  const outputDir = await resolveContainedPath(options.root, options.config.outputDir, {
    mustExist: false,
    label: "output",
  });
  const rendered = renderStaticArtifacts(options.snapshot, options.config);
  const payloads = validateArtifacts(rendered);
  const manifest: StaticManifest = {
    version: 1,
    generator: "CommitAtlas",
    user: options.snapshot.profile.login,
    source: "github-public-profile",
    window: {
      from: options.snapshot.metrics.window.from,
      to: options.snapshot.metrics.window.to,
      days: options.snapshot.metrics.window.days,
    },
    generatedAt: options.snapshot.freshness.generatedAt,
    artifacts: payloads.map(({ name, body }) => ({
      path: name,
      bytes: Buffer.byteLength(body, "utf8"),
      sha256: hash(body),
    })),
  };
  if (!options.dryRun) await writeArtifacts(outputDir, payloads, manifest);
  return { root: options.root, outputDir, manifest, written: !options.dryRun };
}

async function fetchStaticPortfolio(config: StaticConfig, now: Date, fetchImpl?: typeof fetch): Promise<PortfolioSnapshot> {
  const client = new GitHubClient({ fetchImpl, now: () => now });
  const repositories = config.projects.map((project) => project.repo.split("/")[1]!);
  const lifecycles = new Map<string, ProjectLifecycle>();
  const workflows = new Map<string, ProjectWorkflow>();
  for (const project of config.projects) {
    const repository = project.repo.split("/")[1]!;
    lifecycles.set(repository.toLowerCase(), project.lifecycle);
    if (project.workflow) workflows.set(repository.toLowerCase(), project.workflow);
  }
  const [profile, contributions, projects] = await Promise.all([
    client.fetchProfile(config.user),
    client.fetchPublicProfileContributions(config.user, config.days),
    client.fetchProjects(config.user, repositories, lifecycles, workflows),
  ]);
  return assembleStaticPortfolio(profile, contributions, projects);
}

function validateArtifacts(rendered: StaticSvgArtifacts): { name: string; body: string }[] {
  const payloads = Object.entries(rendered).sort(([left], [right]) => left.localeCompare(right));
  if (payloads.length === 0) throw new Error("No static cards were selected");
  for (const [name, body] of payloads) {
    const bytes = Buffer.byteLength(body, "utf8");
    if (!name.endsWith(".svg") || !body.startsWith("<svg") || !body.endsWith("</svg>")) {
      throw new Error(`Renderer returned an invalid ${name} artifact`);
    }
    if (bytes > MAX_ARTIFACT_BYTES) throw new Error(`${name} exceeded the static artifact size limit`);
    if (/<script\b|<foreignObject\b|<image\b/i.test(body)) throw new Error(`${name} contains a forbidden SVG element`);
  }
  return payloads.map(([name, body]) => ({ name, body }));
}

async function writeArtifacts(
  outputDir: string,
  payloads: readonly { readonly name: string; readonly body: string }[],
  manifest: StaticManifest,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const staged: { temporary: string; destination: string }[] = [];
  try {
    for (const payload of [...payloads, { name: "manifest.json", body: `${JSON.stringify(manifest, null, 2)}\n` }]) {
      const temporary = path.join(outputDir, `.${payload.name}.${randomUUID()}.tmp`);
      await writeFile(temporary, payload.body, { encoding: "utf8", flag: "wx" });
      staged.push({ temporary, destination: path.join(outputDir, payload.name) });
    }
    for (const file of staged) await rename(file.temporary, file.destination);
    const current = new Set(payloads.map(({ name }) => name));
    await Promise.all(MANAGED_ARTIFACT_NAMES
      .filter((name) => !current.has(name))
      .map((name) => rm(path.join(outputDir, name), { force: true })));
  } finally {
    await Promise.all(staged.map(({ temporary }) => rm(temporary, { force: true }).catch(() => undefined)));
  }
}

function resolveAsOf(value: string | undefined): Date {
  if (value === undefined) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("as-of must use YYYY-MM-DD");
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("as-of must be a real UTC date");
  }
  return parsed;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
