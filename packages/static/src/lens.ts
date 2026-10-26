import { constants, type Stats } from "node:fs";
import path from "node:path";
import { lstat, open, realpath } from "node:fs/promises";
import { LensProjectionError } from "@commit-atlas/core/lens";
import type { PortfolioSnapshot } from "@commit-atlas/github";
import { createLensProjectionContext, type SceneLensProjection } from "@commit-atlas/svg";
import { assertTracked, resolveContainedPath, type StaticConfig } from "./config.js";

export const MAX_LENS_PROJECTION_BYTES = 256 * 1024;
function pathKey(file: string): string { return process.platform === "win32" ? file.toLowerCase() : file; }
function sameFile(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}
async function inspectPath(root: string, file: string): Promise<readonly Stats[]> {
  const relative = path.relative(root, file);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new LensProjectionError("LENS_INVALID_FILE");
  const parts = relative.split(path.sep);
  const states: Stats[] = [];
  let current = root;
  for (let index = 0; index <= parts.length; index += 1) {
    if (index > 0) current = path.join(current, parts[index - 1]!);
    const state = await lstat(current);
    if (state.isSymbolicLink() || (index < parts.length ? !state.isDirectory() : !state.isFile())) throw new LensProjectionError("LENS_INVALID_FILE");
    states.push(state);
  }
  if (pathKey(await realpath(file)) !== pathKey(file)) throw new LensProjectionError("LENS_INVALID_FILE");
  return states;
}
async function assertStablePath(root: string, file: string, before: readonly Stats[]): Promise<void> {
  const after = await inspectPath(root, file);
  if (before.some((state, index) => state.dev !== after[index]!.dev || state.ino !== after[index]!.ino || state.mode !== after[index]!.mode) || !sameFile(before.at(-1)!, after.at(-1)!)) throw new LensProjectionError("LENS_INVALID_FILE");
}
/** No URL input; observed symlinks/substitutions and all filesystem errors fail with codes. */
export async function loadStaticLensProjection(root: string, config: NonNullable<StaticConfig["lens"]>, snapshot: PortfolioSnapshot): Promise<SceneLensProjection> {
  let file: string;
  let canonicalRoot: string;
  try { canonicalRoot = await realpath(root); file = await resolveContainedPath(canonicalRoot, config.path, { mustExist: true, label: "lens" }); }
  catch { throw new LensProjectionError("LENS_INVALID_FILE"); }
  try { await assertTracked(root, file); }
  catch { throw new LensProjectionError("LENS_UNTRACKED_FILE"); }
  let input: unknown;
  try {
    // Refuse a tracked filename replaced by a FIFO/device before opening it. O_NONBLOCK also
    // bounds a replacement race between this check and open; fstat below must still be regular.
    const before = await inspectPath(canonicalRoot, file);
    const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile() || !sameFile(before.at(-1)!, metadata)) throw new LensProjectionError("LENS_INVALID_FILE");
      await assertStablePath(canonicalRoot, file, before);
      if (metadata.size > MAX_LENS_PROJECTION_BYTES) throw new LensProjectionError("LENS_FILE_TOO_LARGE");
      // Cap the allocation and the read even if the tracked file grows after stat.
      const buffer = Buffer.alloc(MAX_LENS_PROJECTION_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (bytesRead === 0) break;
        length += bytesRead;
      }
      if (length > MAX_LENS_PROJECTION_BYTES) throw new LensProjectionError("LENS_FILE_TOO_LARGE");
      if (!sameFile(metadata, await handle.stat())) throw new LensProjectionError("LENS_INVALID_FILE");
      await assertStablePath(canonicalRoot, file, before);
      input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length)));
    } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof LensProjectionError) throw error;
    throw new LensProjectionError("LENS_INVALID_FILE");
  }
  return createLensProjectionContext(input, snapshot, config.maxAgeDays);
}
