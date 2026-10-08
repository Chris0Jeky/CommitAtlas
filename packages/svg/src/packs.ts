import type { ScenePack } from "./scene.js";

export interface ScenePackGeometry {
  readonly corner: number;
  readonly gridPitch: number;
  readonly marker: "plate" | "ring" | "band" | "cell";
}

/** `plate` is the shipped survey frame: corner 18 and no painted grid. */
export const SCENE_PACKS: Readonly<Record<ScenePack, ScenePackGeometry>> = Object.freeze({
  survey: Object.freeze({ corner: 18, gridPitch: 24, marker: "plate" as const }),
  orbital: Object.freeze({ corner: 48, gridPitch: 40, marker: "ring" as const }),
  spectral: Object.freeze({ corner: 0, gridPitch: 12, marker: "band" as const }),
  terminal: Object.freeze({ corner: 0, gridPitch: 8, marker: "cell" as const }),
});

export function scenePackGeometry(pack: ScenePack): ScenePackGeometry {
  if (typeof pack !== "string" || !Object.hasOwn(SCENE_PACKS, pack)) throw new Error("unknown scene pack");
  const geometry = SCENE_PACKS[pack];
  if (!geometry) throw new Error("unknown scene pack");
  return geometry;
}
