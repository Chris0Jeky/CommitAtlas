import { execFile } from "node:child_process";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  parseHandle,
  parseManifest,
  type ProjectManifest,
} from "@commit-atlas/core";
import { z } from "zod";

export const STATIC_CARD_NAMES = [
  "atlas", "profile", "streak", "activity", "breakdown", "rhythm", "languages", "projects",
  "cadence", "releases",
] as const;
export type StaticCardName = (typeof STATIC_CARD_NAMES)[number];

export const STATIC_THEME_NAMES = ["aurora", "midnight", "paper", "ember"] as const;
export type StaticThemeName = (typeof STATIC_THEME_NAMES)[number];

const STATIC_THEME_SCHEMES: Readonly<Record<StaticThemeName, "dark" | "light">> = {
  aurora: "dark",
  midnight: "dark",
  paper: "light",
  ember: "dark",
};

const RelativePathSchema = z.string().trim().min(1).max(240).refine((value) => {
  if (path.isAbsolute(value) || value === ".") return false;
  return !value.replaceAll("\\", "/").split("/").some((part) => part === ".." || part === "");
}, "Expected a contained relative path");

const RawStaticConfigSchema = z.object({
  version: z.literal(1),
  user: z.string().trim().min(1).max(39),
  theme: z.enum(STATIC_THEME_NAMES).default("aurora"),
  themes: z.array(z.object({
    theme: z.enum(STATIC_THEME_NAMES),
    outputDir: RelativePathSchema,
  }).strict()).max(3).default([]),
  days: z.number().int().min(7).max(365).default(365),
  motion: z.enum(["none", "subtle"]).default("none"),
  layout: z.enum(["wide", "compact"]).default("wide"),
  responsiveAtlas: z.boolean().default(false),
  outputDir: RelativePathSchema,
  cards: z.array(z.enum(STATIC_CARD_NAMES)).min(1).max(STATIC_CARD_NAMES.length).default([...STATIC_CARD_NAMES]),
  projects: z.array(z.unknown()).min(1).max(6),
}).strict();

export interface StaticConfig {
  readonly version: 1;
  readonly user: string;
  readonly theme: StaticThemeName;
  readonly themes: readonly StaticThemeVariant[];
  readonly days: number;
  readonly motion: "none" | "subtle";
  readonly layout: "wide" | "compact";
  readonly responsiveAtlas: boolean;
  readonly outputDir: string;
  readonly cards: readonly StaticCardName[];
  readonly projects: ProjectManifest["projects"];
}

export interface StaticThemeVariant {
  readonly theme: StaticThemeName;
  readonly outputDir: string;
}

export interface LoadedStaticConfig {
  readonly root: string;
  readonly configPath: string;
  readonly config: StaticConfig;
}

export function parseStaticConfig(input: unknown): StaticConfig {
  const raw = RawStaticConfigSchema.parse(input);
  const cards = [...new Set(raw.cards)];
  if (cards.length !== raw.cards.length) throw new Error("cards must not contain duplicates");
  if (raw.responsiveAtlas && !cards.includes("atlas")) {
    throw new Error("responsiveAtlas requires atlas in cards");
  }
  const outputDir = raw.outputDir.replaceAll("\\", "/");
  const themes: StaticThemeVariant[] = [];
  const seenThemes = new Set<StaticThemeName>([raw.theme]);
  const seenOutputDirs = new Set<string>([outputDir.toLowerCase()]);
  for (const variant of raw.themes) {
    if (seenThemes.has(variant.theme)) throw new Error("themes must not contain duplicate themes");
    if (STATIC_THEME_SCHEMES[variant.theme] === STATIC_THEME_SCHEMES[raw.theme]) {
      throw new Error("themes must use the opposite colour scheme");
    }
    const variantOutputDir = variant.outputDir.replaceAll("\\", "/");
    const outputKey = variantOutputDir.toLowerCase();
    if (seenOutputDirs.has(outputKey)) throw new Error("themes must use unique outputDir paths");
    seenThemes.add(variant.theme);
    seenOutputDirs.add(outputKey);
    themes.push({ theme: variant.theme, outputDir: variantOutputDir });
  }
  const user = parseHandle({ version: 1, handle: raw.user }).handle;
  const manifest = parseManifest({ version: 1, projects: raw.projects });
  if (manifest.projects.some((project) => project.repo.split("/")[0]?.toLowerCase() !== user)) {
    throw new Error("Every v1 static project must be owned by the configured user");
  }
  return {
    version: 1,
    user,
    theme: raw.theme,
    themes,
    days: raw.days,
    motion: raw.motion,
    layout: raw.layout,
    responsiveAtlas: raw.responsiveAtlas,
    outputDir,
    cards,
    projects: manifest.projects,
  };
}

export async function loadStaticConfig(cwd: string, configPath = ".commitatlas.json"): Promise<LoadedStaticConfig> {
  const root = await realpath(cwd);
  const resolved = await resolveContainedPath(root, configPath, { mustExist: true, label: "config" });
  await assertTracked(root, resolved);
  const metadata = await stat(resolved);
  if (!metadata.isFile() || metadata.size > 64 * 1024) throw new Error("config must be a regular JSON file below 64 KiB");
  let input: unknown;
  try {
    input = JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw new Error("config must contain valid UTF-8 JSON");
  }
  return { root, configPath: resolved, config: parseStaticConfig(input) };
}

export async function resolveContainedPath(
  root: string,
  relativePath: string,
  options: { readonly mustExist: boolean; readonly label: string },
): Promise<string> {
  if (path.isAbsolute(relativePath)) throw new Error(`${options.label} path must be relative`);
  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized === "." || normalized.split("/").some((part) => part === ".." || part === "")) {
    throw new Error(`${options.label} path must stay inside the repository`);
  }
  const target = path.resolve(root, relativePath);
  assertInside(root, target, options.label);
  await assertNoSymlinkComponents(root, target, options.mustExist);
  return target;
}

function assertInside(root: string, target: string, label: string): void {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error(`${label} path must stay inside the repository`);
  }
}

async function assertNoSymlinkComponents(root: string, target: string, mustExist: boolean): Promise<void> {
  const relative = path.relative(root, target);
  const parts = relative.split(path.sep);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]!);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) throw new Error("Repository paths must not traverse symbolic links");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" && (!mustExist || index < parts.length - 1)) return;
      throw error;
    }
  }
}

async function assertTracked(root: string, file: string): Promise<void> {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  try {
    await promisify(execFile)("git", ["-C", root, "ls-files", "--error-unmatch", "--", relative], {
      windowsHide: true,
    });
  } catch {
    throw new Error("config must be tracked by the current Git repository");
  }
}
