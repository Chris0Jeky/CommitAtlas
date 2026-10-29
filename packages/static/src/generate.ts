import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { SCENE_MOTION_BUDGET } from "@commit-atlas/svg";
import {
  GitHubClient,
  fetchDeliverySnapshot,
  type DeliverySnapshot,
  type PortfolioSnapshot,
  type ProjectLifecycle,
  type ProjectWorkflow,
} from "@commit-atlas/github";
import {
  loadStaticConfig,
  resolveContainedPath,
  STATIC_CARD_NAMES,
  type StaticConfig,
  type StaticThemeName,
} from "./config.js";
import { renderDeliveryCard, renderDeliveryEvidence } from "./delivery.js";
import { assembleStaticPortfolio, renderStaticArtifacts, type StaticSvgArtifacts } from "./render.js";
import { renderProjectCatalogArtifacts } from "./projects-catalog.js";
import { loadStaticLensProjection } from "./lens.js";
import { isSceneArtifactName } from "./scene-config.js";

const MAX_ARTIFACT_BYTES = 96 * 1024;
const MAX_TEXT_ARTIFACT_BYTES = 64 * 1024;
const MANIFEST_NAME = "manifest.json";
/**
 * Filenames CommitAtlas may write inside `outputDir`. `projects.json`, `projects.md`, and
 * `delivery.json` are reserved CommitAtlas-managed names there (see the package README).
 *
 * Reserving a name is not on its own a licence to delete it. Membership here only makes a file
 * *eligible* for stale-artifact cleanup; a file is actually removed only when the previous
 * `manifest.json` in the same directory records CommitAtlas as its writer and its integrity
 * entry matches the current file (see `previouslyWritten` and `verifyStaleArtifacts`).
 */
const MANAGED_ARTIFACT_NAMES = [
  ...STATIC_CARD_NAMES.map((card) => `${card}.svg`),
  "atlas-compact.svg",
  "atlas-wide.svg",
  "atlas-still.svg",
  "atlas-compact-still.svg",
  "atlas-wide-still.svg",
  "activity-still.svg",
  "projects.json",
  "projects.md",
  "delivery.json",
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
  /** Required only when the selected cards include `delivery`. Never written to an artifact. */
  readonly token?: string;
}

export interface GenerateStaticResult {
  readonly root: string;
  readonly outputDir: string;
  readonly manifest: StaticManifest;
  readonly written: boolean;
  /** Additional theme outputs rendered from the same snapshot as the primary result. */
  readonly variants: readonly GeneratedStaticVariant[];
}

export interface GeneratedStaticVariant {
  readonly theme: StaticThemeName;
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
  const delivery = config.cards.includes("delivery")
    ? await fetchDeliverySnapshot({
      token: options.token ?? process.env.GITHUB_TOKEN ?? "",
      login: config.user,
      repositories: config.projects.map((project) => project.repo),
      now: () => now,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    })
    : undefined;
  return generateStaticFromSnapshot({
    root: loaded.root,
    config,
    snapshot,
    ...(delivery ? { delivery } : {}),
    dryRun: options.dryRun,
  });
}

export async function generateStaticFromSnapshot(options: {
  readonly root: string;
  readonly config: StaticConfig;
  readonly snapshot: PortfolioSnapshot;
  readonly delivery?: DeliverySnapshot;
  readonly dryRun?: boolean;
}): Promise<GenerateStaticResult> {
  const lens = options.config.lens ? await loadStaticLensProjection(options.root, options.config.lens, options.snapshot) : undefined;
  const delivery = options.config.cards.includes("delivery")
    ? validateDeliverySnapshot(options.config, options.snapshot, options.delivery)
    : null;
  const configs: StaticConfig[] = [
    options.config,
    ...(options.config.themes ?? []).map((variant) => ({
      ...options.config,
      theme: variant.theme,
      outputDir: variant.outputDir,
      themes: [],
    })),
  ];
  // Render and validate every variant before the first write. A malformed secondary output must
  // not leave the primary directory updated while the pair is still unusable.
  const targets = await Promise.all(configs.map(async (config) => {
    const outputDir = await resolveContainedPath(options.root, config.outputDir, {
      mustExist: false,
      label: "output",
    });
    const rendered = {
      ...renderStaticArtifacts(options.snapshot, config, lens),
      ...(config.cards.includes("projects") ? renderProjectCatalogArtifacts(options.snapshot, config) : {}),
      ...(config.cards.includes("delivery") && delivery ? {
        "delivery.svg": renderDeliveryCard(delivery, {
          theme: config.theme,
          width: config.layout === "compact" ? 480 : 860,
          motion: config.motion,
        }),
        "delivery.json": renderDeliveryEvidence(delivery),
      } : {}),
    };
    const payloads = validateArtifacts(rendered);
    const manifest = buildManifest(options.snapshot, payloads);
    return { config, outputDir, payloads, manifest };
  }));
  const seenOutputDirs = new Set<string>();
  for (const target of targets) {
    const outputKey = path.resolve(target.outputDir).toLowerCase();
    if (seenOutputDirs.has(outputKey)) throw new Error("themes must use unique outputDir paths");
    seenOutputDirs.add(outputKey);
  }
  if (!options.dryRun) await publishArtifacts(options.root, targets);
  const [primary, ...variants] = targets;
  if (!primary) throw new Error("No static cards were selected");
  return {
    root: options.root,
    outputDir: primary.outputDir,
    manifest: primary.manifest,
    written: !options.dryRun,
    variants: variants.map((variant) => ({
      theme: variant.config.theme,
      outputDir: variant.outputDir,
      manifest: variant.manifest,
      written: !options.dryRun,
    })),
  };
}

/** Repository-relative paths for primary and variant scene outputs, also available during dry-run. */
export function generatedScenePaths(result: GenerateStaticResult): readonly string[] {
  const paths: string[] = [];
  for (const target of [result, ...result.variants]) {
    for (const artifact of target.manifest.artifacts) {
      if (!isSceneArtifactName(artifact.path)) continue;
      const relative = path.relative(result.root, path.join(target.outputDir, artifact.path)).replaceAll("\\", "/");
      if (!relative || relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
        throw new Error("scene output escaped the repository");
      }
      if (paths.includes(relative)) throw new Error("duplicate scene output path");
      paths.push(relative);
    }
  }
  return Object.freeze(paths);
}

function validateDeliverySnapshot(
  config: StaticConfig,
  snapshot: PortfolioSnapshot,
  delivery: DeliverySnapshot | undefined,
): DeliverySnapshot {
  if (!delivery) throw new Error("delivery card selection requires a delivery snapshot or GitHub token");
  if (delivery.version !== 1 || delivery.login.toLowerCase() !== config.user.toLowerCase()) {
    throw new Error("delivery snapshot user does not match the static configuration");
  }
  const expected = config.projects.map((project) => project.repo.toLowerCase()).sort();
  const actual = delivery.scope.repositories.map((repository) => repository.toLowerCase()).sort();
  if (expected.length !== actual.length || expected.some((repository, index) => repository !== actual[index])) {
    throw new Error("delivery snapshot scope does not match the configured public repositories");
  }
  if (delivery.generatedAt !== snapshot.freshness.generatedAt) {
    throw new Error("delivery snapshot freshness does not match the portfolio snapshot");
  }
  if (delivery.asOf !== snapshot.metrics.window.to) {
    throw new Error("delivery snapshot date does not match the portfolio window");
  }
  return delivery;
}

function buildManifest(snapshot: PortfolioSnapshot, payloads: readonly { readonly name: string; readonly body: string }[]): StaticManifest {
  return {
    version: 1,
    generator: "CommitAtlas",
    user: snapshot.profile.login,
    source: "github-public-profile",
    window: {
      from: snapshot.metrics.window.from,
      to: snapshot.metrics.window.to,
      days: snapshot.metrics.window.days,
    },
    generatedAt: snapshot.freshness.generatedAt,
    artifacts: payloads.map(({ name, body }) => ({
      path: name,
      bytes: Buffer.byteLength(body, "utf8"),
      sha256: hash(body),
    })),
  };
}

async function fetchStaticPortfolio(
  config: StaticConfig,
  now: Date,
  fetchImpl?: typeof fetch,
  currentDay: "closed" | "open" = "closed",
): Promise<PortfolioSnapshot> {
  // A static refresh is a background job: allow the observed ~10s calendar
  // backend failure, its Retry-After delay and one recovery request. Hosted
  // request clients retain their shorter default budget.
  const client = new GitHubClient({ fetchImpl, now: () => now, deadlineMs: 30_000 });
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
  const payloads = Object.entries(rendered).map(([name, body]): [string, string] => {
    if (typeof body !== "string") throw new Error(`Renderer returned a non-text ${name} artifact`);
    return [name, body];
  }).sort(([left], [right]) => left.localeCompare(right));
  if (payloads.length === 0) throw new Error("No static cards were selected");
  for (const [name, body] of payloads) {
    if (!/^[a-z0-9-]+\.(svg|json|md)$/.test(name) || path.basename(name) !== name) {
      throw new Error(`Renderer returned an unsafe ${name} artifact`);
    }
    const bytes = Buffer.byteLength(body, "utf8");
    if (name.endsWith(".svg")) {
      if (!body.startsWith("<svg") || !body.endsWith("</svg>")) throw new Error(`Renderer returned an invalid ${name} artifact`);
      if (bytes > (isSceneArtifactName(name) ? SCENE_MOTION_BUDGET.bytes : MAX_ARTIFACT_BYTES)) throw new Error(`${name} exceeded the static artifact size limit`);
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

interface StaticWriteTarget {
  readonly outputDir: string;
  readonly payloads: readonly { readonly name: string; readonly body: string }[];
  readonly manifest: StaticManifest;
}

interface StagedFile {
  readonly temporary: string;
  readonly destination: string;
}

interface PreparedArtifacts {
  readonly outputDir: string;
  readonly payloads: readonly StagedFile[];
  readonly manifest: StagedFile;
  readonly stale: readonly GeneratedArtifact[];
}

async function publishArtifacts(root: string, targets: readonly StaticWriteTarget[]): Promise<void> {
  const prepared: PreparedArtifacts[] = [];
  try {
    // Preparation is deliberately sequential: if a later theme cannot be created or staged, every
    // earlier theme still contains only temporary files, which the shared `finally` removes.
    for (const target of targets) prepared.push(await prepareArtifacts(root, target));

    // Preflight every visible destination across every theme before cleanup or the first rename.
    // Existing regular files are valid replacement targets; missing files are new artifacts. A
    // directory, symlink, or other special entry would make a later rename fail after an earlier
    // theme had already committed, so reject the whole publication while only temp files exist.
    for (const target of prepared) await verifyCurrentDestinations(target);

    // Verify every stale file's kind and current contents before deleting anything in any theme.
    // Missing files are harmless and are not queued for deletion if a new entry later appears.
    const staleFiles: string[][] = [];
    for (const target of prepared) staleFiles.push(await verifyStaleArtifacts(target));

    // Cleanup precedes payload installation. The previous manifest therefore remains an honest
    // ownership record if cleanup fails, and no new bytes are exposed under that old manifest.
    for (const files of staleFiles) await Promise.all(files.map((file) => rm(file, { force: true })));

    // Each manifest is still the final rename in its directory. All target directories and bytes
    // were successfully staged before this commit phase began, so predictable storage and path
    // failures cannot leave the primary theme ahead of its paired output.
    for (const target of prepared) {
      for (const file of target.payloads) await rename(file.temporary, file.destination);
      await rename(target.manifest.temporary, target.manifest.destination);
    }
  } finally {
    await cleanupStaged(prepared.flatMap((target) => [...target.payloads, target.manifest]));
  }
}

async function prepareArtifacts(root: string, target: StaticWriteTarget): Promise<PreparedArtifacts> {
  await mkdirContained(root, target.outputDir);

  // `resolveContainedPath` ran before rendering, but rendering is caller-controlled data work and a
  // path component could be replaced meanwhile. Re-run the no-symlink containment walk after the
  // directory exists and immediately before staging bytes into it.
  const relativeOutput = path.relative(root, target.outputDir);
  const verifiedOutput = await resolveContainedPath(root, relativeOutput, {
    mustExist: true,
    label: "output",
  });
  if (path.resolve(verifiedOutput) !== path.resolve(target.outputDir)) {
    throw new Error("output path must stay inside the repository");
  }

  const owned = await previouslyWritten(target.outputDir);
  const current = new Set(target.payloads.map(({ name }) => name));
  const candidates = new Set<string>([
    ...MANAGED_ARTIFACT_NAMES, ...[...owned.keys()].filter(isSceneArtifactName),
  ]);
  const stale = [...candidates].filter((name) => !current.has(name) && owned.has(name)).map((name) => owned.get(name)!);
  const staged: StagedFile[] = [];
  try {
    for (const payload of target.payloads) staged.push(await stage(target.outputDir, payload));
    const manifest = await stage(target.outputDir, {
      name: MANIFEST_NAME,
      body: `${JSON.stringify(target.manifest, null, 2)}\n`,
    });
    return {
      outputDir: target.outputDir,
      payloads: staged,
      manifest,
      stale,
    };
  } catch (error) {
    await cleanupStaged(staged);
    throw error;
  }
}

/**
 * Creates `outputDir` one component at a time, refusing any existing symlink or non-directory.
 * A recursive mkdir would follow a parent swapped for a symlink during rendering and create empty
 * directories outside the repository before the containment re-check could reject the path.
 */
async function mkdirContained(root: string, outputDir: string): Promise<void> {
  let current = root;
  for (const part of path.relative(root, outputDir).split(path.sep)) {
    current = path.join(current, part);
    let metadata;
    try {
      metadata = await lstat(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // Another writer may create the same missing prefix first; the lstat below still validates it.
      await mkdir(current).catch((mkdirError: NodeJS.ErrnoException) => {
        if (mkdirError.code !== "EEXIST") throw mkdirError;
      });
      metadata = await lstat(current);
    }
    if (metadata.isSymbolicLink()) throw new Error("Repository paths must not traverse symbolic links");
    if (!metadata.isDirectory()) throw new Error("output path component is not a directory");
  }
}

async function verifyCurrentDestinations(target: PreparedArtifacts): Promise<void> {
  for (const file of [...target.payloads, target.manifest]) {
    try {
      const metadata = await lstat(file.destination);
      if (!metadata.isFile()) {
        throw new Error(`${path.basename(file.destination)} is not a regular artifact file`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

async function verifyStaleArtifacts(target: PreparedArtifacts): Promise<string[]> {
  const verified: string[] = [];
  for (const artifact of target.stale) {
    const file = path.join(target.outputDir, artifact.path);
    try {
      const metadata = await lstat(file);
      if (metadata.isDirectory()) throw new Error(`${artifact.path} is a directory, not a managed artifact`);
      if (!metadata.isFile() || metadata.nlink !== 1) throw new Error(`${artifact.path} is not a regular single-link stale artifact`);
      if (metadata.size !== artifact.bytes) throw new Error(`stale artifact ${artifact.path} no longer matches its prior manifest`);
      const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== metadata.dev || opened.ino !== metadata.ino || opened.size !== artifact.bytes) {
          throw new Error(`stale artifact ${artifact.path} changed while opening`);
        }
        // Bound reads even if the file grows after stat; one extra byte detects that growth.
        const body = Buffer.alloc(artifact.bytes + 1);
        let length = 0;
        while (length < body.length) {
          const { bytesRead } = await handle.read(body, length, body.length - length, length);
          if (bytesRead === 0) break;
          length += bytesRead;
        }
        if (length !== artifact.bytes || createHash("sha256").update(body.subarray(0, length)).digest("hex") !== artifact.sha256) {
          throw new Error(`stale artifact ${artifact.path} no longer matches its prior manifest`);
        }
        const current = await lstat(file);
        if (!current.isFile() || current.nlink !== 1 || current.dev !== opened.dev || current.ino !== opened.ino || current.size !== artifact.bytes) {
          throw new Error(`stale artifact ${artifact.path} changed while reading`);
        }
      } finally {
        await handle.close();
      }
      verified.push(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return verified;
}

async function cleanupStaged(files: readonly StagedFile[]): Promise<void> {
  await Promise.all(files.map(({ temporary }) => rm(temporary, { force: true }).catch(() => undefined)));
}

async function stage(
  outputDir: string,
  payload: { readonly name: string; readonly body: string },
): Promise<StagedFile> {
  const temporary = path.join(outputDir, `.${payload.name}.${randomUUID()}.tmp`);
  await writeFile(temporary, payload.body, { encoding: "utf8", flag: "wx" });
  return { temporary, destination: path.join(outputDir, payload.name) };
}

/**
 * Integrity-bearing files the previous CommitAtlas manifest claims to have written.
 *
 * Read before the new manifest replaces it, and that replacement is deliberately held back until
 * cleanup has finished, so this record stays recoverable for the whole deletion window.
 * Anything unreadable, non-CommitAtlas, or malformed yields
 * an empty map, so cleanup does nothing rather than guessing. Legacy name-only or invalid
 * integrity entries cannot prove current contents and are preserved; duplicate paths disable
 * cleanup entirely. Callers intersect the result with fixed managed or canonical scene names.
 */
async function previouslyWritten(outputDir: string): Promise<ReadonlyMap<string, GeneratedArtifact>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path.join(outputDir, MANIFEST_NAME), "utf8"));
  } catch {
    return new Map();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return new Map();
  const record = parsed as Partial<StaticManifest>;
  if (record.version !== 1 || record.generator !== "CommitAtlas" || !Array.isArray(record.artifacts)) return new Map();
  const owned = new Map<string, GeneratedArtifact>();
  const seen = new Set<string>();
  for (const artifact of record.artifacts) {
    const artifactPath: unknown = (artifact as { path?: unknown } | null)?.path;
    if (typeof artifactPath !== "string") continue;
    if (seen.has(artifactPath)) return new Map();
    seen.add(artifactPath);
    const limit = isSceneArtifactName(artifactPath) ? SCENE_MOTION_BUDGET.bytes
      : artifactPath.endsWith(".svg") ? MAX_ARTIFACT_BYTES : MAX_TEXT_ARTIFACT_BYTES;
    if (!artifact || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0 || artifact.bytes > limit ||
      typeof artifact.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(artifact.sha256)) continue;
    owned.set(artifactPath, { path: artifactPath, bytes: artifact.bytes, sha256: artifact.sha256 });
  }
  return owned;
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
