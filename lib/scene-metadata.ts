import type { SceneRenderResult } from "@/packages/svg/src/index";
import { isHostedSceneId, type HostedSceneId } from "./hosted-scene-catalog";

export const SCENE_METADATA_HEADER = "X-CommitAtlas-Scene-Metadata";
export const MAX_SCENE_PREVIEW_BYTES = 128 * 1024;
export interface SceneResponseMetadata {
  readonly version: 1;
  readonly scene: HostedSceneId;
  readonly bytes: number;
  readonly animatedElements: number;
  readonly loopingGroups: number;
  readonly unavailable: boolean;
}

/** These are compiler/renderer counters, not a claim that a browser played the animation. */
export function sceneResponseMetadata(scene: HostedSceneId, result: SceneRenderResult): SceneResponseMetadata {
  return Object.freeze({ version: 1, scene, ...result.counters, unavailable: result.unavailable });
}

/** A closed, versioned receipt for the decoded response bytes. Never estimate from SVG syntax. */
export function parseSceneResponseMetadata(header: string, scene: string, bytes: number): SceneResponseMetadata {
  const invalid = () => new Error("Scene response metadata does not match this preview");
  if (header.length > 512 || !isHostedSceneId(scene)) throw invalid();
  let value: Record<string, unknown>;
  try { value = JSON.parse(header) as Record<string, unknown>; } catch { throw invalid(); }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== 6 || Object.keys(value).some(key => !["version", "scene", "bytes", "animatedElements", "loopingGroups", "unavailable"].includes(key))) throw invalid();
  const integer = (number: unknown, max: number) => typeof number === "number" && Number.isSafeInteger(number) && number >= 0 && number <= max;
  if (value.version !== 1 || value.scene !== scene || value.bytes !== bytes || bytes < 1 || bytes > MAX_SCENE_PREVIEW_BYTES ||
    !integer(value.animatedElements, 96) || !integer(value.loopingGroups, 6) || typeof value.unavailable !== "boolean" ||
    (value.loopingGroups as number) > (value.animatedElements as number) ||
    (value.unavailable && (value.animatedElements !== 0 || value.loopingGroups !== 0))) throw invalid();
  return Object.freeze({ version: 1, scene, bytes, animatedElements: value.animatedElements as number,
    loopingGroups: value.loopingGroups as number, unavailable: value.unavailable });
}
