import { createIdentityConfig, getScene, type IdentityConfig, type SceneDefinition, type ScenePack } from "@commit-atlas/svg";
import type { StaticConfig } from "./config.js";

export const STATIC_SCENE_PACKS = ["orbital", "survey", "spectral", "terminal"] as const;
export const MAX_STATIC_SCENES = 32;
export type SceneArtifactName = `scene-${string}.svg`;
export type SceneStillArtifactName = `scene-${string}.still.svg`;

function isSceneId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 48 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(value);
}
export function isSceneArtifactName(value: unknown): value is SceneArtifactName {
  return typeof value === "string" && value.startsWith("scene-") && value.endsWith(".svg") && isSceneId(value.slice(6, -4));
}
export function sceneArtifactName(id: string): SceneArtifactName {
  if (!isSceneId(id)) throw new Error("invalid static scene id");
  return `scene-${id}.svg`;
}

// A dot cannot occur in a scene ID, so a still twin never collides with a normal scene,
// including a definition whose ID ends in -still. Keep each ID's existing 48-character bound.
export function isSceneStillArtifactName(value: unknown): value is SceneStillArtifactName {
  return typeof value === "string" && value.startsWith("scene-") && value.endsWith(".still.svg") && isSceneId(value.slice(6, -10));
}
export function sceneStillArtifactName(id: string): SceneStillArtifactName {
  if (!isSceneId(id)) throw new Error("invalid static scene id");
  return `scene-${id}.still.svg`;
}

/** Recheck programmatic configs as well as parsed JSON before a renderer can touch output paths. */
export function staticSceneOptions(config: Pick<StaticConfig, "scenes" | "scenePack" | "motion" | "reducedMotion"> & { readonly identity?: unknown }): {
  readonly definitions: readonly SceneDefinition<unknown>[];
  readonly pack: ScenePack;
  readonly identity?: IdentityConfig;
} {
  const ids: unknown = config.scenes === undefined ? [] : config.scenes;
  const pack = config.scenePack === undefined ? "survey" : config.scenePack;
  if (!STATIC_SCENE_PACKS.includes(pack)) throw new Error("invalid static scene pack");
  if (!Array.isArray(ids) || ids.length > MAX_STATIC_SCENES) throw new Error("invalid static scenes list");
  const definitions: SceneDefinition<unknown>[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(ids, i);
    if (!descriptor || !("value" in descriptor) || !isSceneId(descriptor.value)) throw new Error("invalid static scene id");
    const id: string = descriptor.value;
    if (seen.has(id)) throw new Error("static scenes must not contain duplicates");
    seen.add(id);
    const definition = getScene(id);
    if (!definition) throw new Error(`unknown static scene: ${id}`);
    if (id === "identity-beacon" && config.identity === undefined) {
      throw new Error("identity-beacon requires a static identity; a beacon without an identity is not rendered");
    }
    if (!definition.supportedPacks.includes(pack)) throw new Error(`unsupported static scene pack: ${id}`);
    if (!definition.supportedMotion.includes(config.motion)) throw new Error(`unsupported static scene motion: ${id}`);
    if (config.reducedMotion === true && !definition.supportedMotion.includes("none")) {
      throw new Error(`static scene reduced-motion companion requires none support: ${id}`);
    }
    definitions.push(definition);
  }
  const identity = config.identity === undefined ? undefined : createIdentityConfig(config.identity);
  return { definitions: Object.freeze(definitions), pack, ...(identity ? { identity } : {}) };
}
