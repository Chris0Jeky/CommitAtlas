/** Browser-safe, explicit public scene surface. Registry/capability parity is tested in CI. */
export const HOSTED_SCENE_IDS = Object.freeze(["activity-terrain", "chronograph", "evidence-coverage", "lifecycle-map"] as const);
export type HostedSceneId = typeof HOSTED_SCENE_IDS[number];
export const HOSTED_SCENE_LABELS: Readonly<Record<HostedSceneId, string>> = Object.freeze({
  "activity-terrain": "Activity terrain", "chronograph": "Chronograph", "evidence-coverage": "Evidence coverage", "lifecycle-map": "Lifecycle map",
});
export const HOSTED_SCENE_PACKS = Object.freeze({
  "activity-terrain": Object.freeze(["survey"] as const),
  "chronograph": Object.freeze(["survey"] as const),
  "evidence-coverage": Object.freeze(["survey"] as const),
  "lifecycle-map": Object.freeze(["survey"] as const),
});
export function isHostedSceneId(value: string): value is HostedSceneId {
  return (HOSTED_SCENE_IDS as readonly string[]).includes(value);
}
