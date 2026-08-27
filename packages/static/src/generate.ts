import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GitHubClient, type PortfolioSnapshot, type ProjectLifecycle, type ProjectWorkflow } from "@commit-atlas/github";
import {
  loadStaticConfig,
  resolveContainedPath,
  STATIC_CARD_NAMES,
  type StaticConfig,
} from "./config.js";
import { assembleStaticPortfolio, renderStaticArtifacts, type StaticSvgArtifacts } from "./render.js";
import { renderProjectCatalogArtifacts } from "./projects-catalog.js";

const MAX_ARTIFACT_BYTES = 96 * 1024;
const MAX_TEXT_ARTIFACT_BYTES = 64 * 1024;
const MANIFEST_NAME = "manifest.json";
/**
 * Filenames CommitAtlas may write inside `outputDir`. `projects.json` and `projects.md` are reserved
 * CommitAtlas-managed names there (see the package README): a run that selects `projects` overwrites
 * them.
 *
 * Reserving a name is not on its own a licence to delete it. Membership here only makes a file
 * *eligible* for stale-artifact cleanup; a file is actually removed only when the previous
 * `manifest.json` in the same directory records CommitAtlas as its writer (see `previouslyWritten`),
 * so an unrelated pre-existing `projects.json` a caller had before ever running CommitAtlas survives.
 */
const MANAGED_ARTIFACT_NAMES = [
  ...STATIC_CARD_NAMES.map((card) => `${card}.svg`),
  "atlas-compact.svg",
  "atlas-wide.svg",
  "projects.json",
  "projects.md",
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
  const snapshot = await fetchStaticPortfolio(
    config,
    now,
    options.fetchImpl,
    options.asOf === undefined ? "open" : "closed",
  );
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
  const rendered = {
    ...renderStaticArtifacts(options.snapshot, options.config),
    ...(options.config.cards.includes("projects") ? renderProjectCatalogArtifacts(options.snapshot, options.config) : {}),
  };
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

async function fetchStaticPortfolio(
  config: StaticConfig,
  now: Date,
  fetchImpl?: typeof fetch,
  currentDay: "closed" | "open" = "closed",
): Promise<PortfolioSnapshot> {
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
  return assembleStaticPortfolio(profile, contributions, projects, { currentDay });
}

function validateArtifacts(rendered: StaticSvgArtifacts & Record<string, string>): { name: string; body: string }[] {
  const payloads = Object.entries(rendered).sort(([left], [right]) => left.localeCompare(right));
  if (payloads.length === 0) throw new Error("No static cards were selected");
  for (const [name, body] of payloads) {
    if (!/^[a-z0-9-]+\.(svg|json|md)$/.test(name) || path.basename(name) !== name) {
      throw new Error(`Renderer returned an unsafe ${name} artifact`);
    }
    const bytes = Buffer.byteLength(body, "utf8");
    if (name.endsWith(".svg")) {
      if (!body.startsWith("<svg") || !body.endsWith("</svg>")) throw new Error(`Renderer returned an invalid ${name} artifact`);
      if (bytes > MAX_ARTIFACT_BYTES) throw new Error(`${name} exceeded the static artifact size limit`);
      if (/<script\b|<foreignObject\b|<image\b/i.test(body)) throw new Error(`${name} contains a forbidden SVG element`);
    } else {
      if (bytes > MAX_TEXT_ARTIFACT_BYTES) throw new Error(`${name} exceeded the static text artifact size limit`);
      if (name.endsWith(".json")) {
        try { JSON.parse(body); } catch { throw new Error(`${name} is not valid JSON`); }
      }
      if (containsControl(body)) throw new Error(`${name} contains a forbidden control character`);
    }
  }
  return payloads.map(([name, body]) => ({ name, body }));
}

function containsControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0)!;
    return code === 0 || (code <= 0x08) || (code >= 0x0b && code <= 0x0c) || (code >= 0x0e && code <= 0x1f) || (code >= 0x7f && code <= 0x9f);
  });
}

async function writeArtifacts(
  outputDir: string,
  payloads: readonly { readonly name: string; readonly body: string }[],
  manifest: StaticManifest,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const owned = await previouslyWritten(outputDir);
  const staged: { temporary: string; destination: string }[] = [];
  try {
    for (const payload of payloads) staged.push(await stage(outputDir, payload));
    const stagedManifest = await stage(outputDir, {
      name: MANIFEST_NAME,
      body: `${JSON.stringify(manifest, null, 2)}\n`,
    });
    staged.push(stagedManifest);
    for (const file of staged) {
      if (file !== stagedManifest) await rename(file.temporary, file.destination);
    }
    // Collect stale artifacts while the PREVIOUS manifest is still the one on disk. That manifest is
    // the only ownership record, so installing the new one first would drop a name from `owned`
    // before the file it names was removed: a crash or a failing `rm` inside that window leaks the
    // stale artifact permanently, because no later run could then prove it was CommitAtlas's to
    // delete. Cleaning up first needs no recovery state — an interrupted run just leaves the old
    // manifest in place, and the next successful run repeats the same collection.
    const current = new Set(payloads.map(({ name }) => name));
    await Promise.all(MANAGED_ARTIFACT_NAMES
      .filter((name) => !current.has(name) && owned.has(name))
      .map((name) => rm(path.join(outputDir, name), { force: true })));
    await rename(stagedManifest.temporary, stagedManifest.destination);
  } finally {
    await Promise.all(staged.map(({ temporary }) => rm(temporary, { force: true }).catch(() => undefined)));
  }
}

async function stage(
  outputDir: string,
  payload: { readonly name: string; readonly body: string },
): Promise<{ temporary: string; destination: string }> {
  const temporary = path.join(outputDir, `.${payload.name}.${randomUUID()}.tmp`);
  await writeFile(temporary, payload.body, { encoding: "utf8", flag: "wx" });
  return { temporary, destination: path.join(outputDir, payload.name) };
}

/**
 * Names the previous CommitAtlas manifest in this directory claims to have written.
 *
 * Read before the new manifest replaces it, and that replacement is deliberately held back until
 * cleanup has finished, so this record stays recoverable for the whole deletion window.
 * Anything unreadable, non-CommitAtlas, or malformed yields
 * an empty set, so cleanup does nothing rather than guessing — deleting a caller's file is the worse
 * failure than leaving a stale artifact behind. Callers intersect the result with
 * `MANAGED_ARTIFACT_NAMES`, so a tampered manifest cannot direct a delete at an arbitrary path.
 */
async function previouslyWritten(outputDir: string): Promise<ReadonlySet<string>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path.join(outputDir, MANIFEST_NAME), "utf8"));
  } catch {
    return new Set();
  }
  if (typeof parsed !== "object" || parsed === null) return new Set();
  const record = parsed as Partial<StaticManifest>;
  if (record.version !== 1 || record.generator !== "CommitAtlas" || !Array.isArray(record.artifacts)) return new Set();
  const names = new Set<string>();
  for (const artifact of record.artifacts) {
    const artifactPath: unknown = (artifact as { path?: unknown } | null)?.path;
    if (typeof artifactPath === "string") names.add(artifactPath);
  }
  return names;
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
