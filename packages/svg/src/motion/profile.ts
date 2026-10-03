export type MotionProfile = "none" | "subtle" | "ambient" | "cinematic";
export type MotionBackend = "css" | "smil";
export type MotionTarget = "github-readme" | "web" | "studio";
export type MotionFamily = "instrument" | "map" | "signature" | "finding" | "scene" | "hero";
export type MotionBudgetClass = "instrument" | "map" | "scene";

/** #113 has not qualified the complete browser/host/embed matrix. */
export const MOTION_DEFAULTS_PROVISIONAL = true;
export const MOTION_BACKEND_DEFAULTS = Object.freeze({
  "github-readme": "smil", web: "css", studio: "css",
} satisfies Record<MotionTarget, MotionBackend>);

/** Hypotheses until #114 measures scene render cost; retain the existing <30,000-byte card gate. */
export const MOTION_BUDGETS_PROVISIONAL = true;
export const INSTRUMENT_MOTION_BUDGET = Object.freeze({ bytes: 30_000, animatedElements: 24, loopingGroups: 3 });
export const MAP_MOTION_BUDGET = Object.freeze({ bytes: 80 * 1024, animatedElements: 64, loopingGroups: 6 });
export const SCENE_MOTION_BUDGET = Object.freeze({ bytes: 120 * 1024, animatedElements: 96, loopingGroups: 6 });
export const MOTION_BUDGETS = Object.freeze({
  instrument: INSTRUMENT_MOTION_BUDGET, map: MAP_MOTION_BUDGET, scene: SCENE_MOTION_BUDGET,
});
export const MOTION_BUDGET_CLASS = Object.freeze({
  instrument: "instrument", map: "map", signature: "map", finding: "map", scene: "scene", hero: "scene",
} satisfies Record<MotionFamily, MotionBudgetClass>);

export const README_MOTION_INTERVAL_MS = 45_000;
export const ENTRANCE_MIN_DELAY_MS = 60;
export const SUBTLE_MAX_DURATION_MS = 600;
export const MOTION_TIMINGS = Object.freeze({
  enter: 400, stagger: 400, staggerStep: 14, breathe: 4500, scan: 5600,
  sweep: 7000, rotate: 12000, orbit: 12000, plot: 9000, flow: 9000,
  twinkle: 7000, pulse: 2400, acquisitionFailure: 1200,
});
