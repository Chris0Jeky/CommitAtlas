import type { MotionBackend, MotionBudgetClass, MotionFamily, MotionProfile, MotionTarget } from "./profile.js";
import { README_MOTION_INTERVAL_MS } from "./profile.js";

export const MOTION_PRIMITIVES = Object.freeze([
  "enter", "stagger", "breathe", "scan", "sweep", "rotate", "orbit", "plot", "flow",
  "twinkle", "pulse", "acquisitionFailure",
] as const);
export type MotionPrimitive = typeof MOTION_PRIMITIVES[number];
interface TimingParams { readonly durationMs?: number; readonly delayMs?: number }
interface TranslationParams extends TimingParams { readonly x?: number; readonly y?: number }
interface OriginParams extends TimingParams { readonly cx?: number; readonly cy?: number }
interface OpacityParams extends TimingParams { readonly minOpacity?: number }
export interface MotionParameterMap {
  enter: TranslationParams;
  stagger: TranslationParams & { readonly index?: number; readonly staggerMs?: number };
  breathe: OriginParams & { readonly scale?: number };
  scan: TranslationParams & { readonly steps?: number };
  sweep: TranslationParams;
  rotate: OriginParams;
  orbit: OriginParams;
  plot: TimingParams & { readonly length?: number };
  flow: TimingParams & { readonly points: readonly (readonly [number, number])[] };
  twinkle: OpacityParams;
  pulse: OpacityParams & { readonly state: "pending" };
  acquisitionFailure: OriginParams;
}
export type MotionApplication = {
  [P in MotionPrimitive]: {
    readonly primitive: P;
    /** Logical wrapper key, never a CSS selector or caller-provided SVG markup. */
    readonly target: string;
    readonly decorative: boolean;
    readonly loopGroup?: string;
  } & (P extends "flow" | "pulse" ? { readonly params: MotionParameterMap[P] } : { readonly params?: MotionParameterMap[P] })
}[MotionPrimitive];

export interface MotionPlanOptions {
  readonly instanceNamespace: string;
  readonly sceneId: string;
  readonly family: MotionFamily;
  readonly profile: MotionProfile;
  readonly target: MotionTarget;
  readonly backend?: MotionBackend;
  /** May narrow the family's default budget, never raise any of its limits. */
  readonly budgetClass?: MotionBudgetClass;
}
/** Internal, normalized numerical vocabulary. No caller strings reach backend encoders. */
export interface MotionValues {
  readonly x: number; readonly y: number; readonly cx: number; readonly cy: number;
  readonly scale: number; readonly length: number; readonly minOpacity: number;
  readonly steps: number;
  readonly points: readonly (readonly [number, number])[];
}
export interface CompiledMotionApplication {
  readonly primitive: MotionPrimitive;
  readonly target: string;
  readonly decorative: boolean;
  readonly animationId: string;
  readonly durationMs: number;
  readonly delayMs: number;
  readonly looping: boolean;
  readonly loopGroup: string;
  readonly values: MotionValues;
}
export interface MotionBinding {
  readonly target: string;
  readonly id: string;
  /** Stable even for none, so removing animation nodes preserves the complete base document. */
  readonly className: string;
  readonly children: string;
}
export interface CompiledMotionPlan {
  readonly backend: MotionBackend;
  readonly defaultsProvisional: boolean;
  readonly budgetClass: MotionBudgetClass;
  readonly budgetsProvisional: boolean;
  readonly style: string;
  readonly bindings: readonly MotionBinding[];
  readonly applications: readonly CompiledMotionApplication[];
  readonly unsupported: readonly { readonly target: string; readonly primitive: MotionPrimitive; readonly reason: string }[];
  readonly counters: { readonly animatedElements: number; readonly loopingGroups: number; readonly bytesAdded: number };
  readonly inlineStyles: boolean;
  readonly reducedMotion: "css-media-query" | "none-twin-required" | "not-needed";
}

export function motionNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}
export function activeLoopMs(application: CompiledMotionApplication, options: MotionPlanOptions): number | undefined {
  return application.looping && options.target === "github-readme" ? README_MOTION_INTERVAL_MS - application.delayMs : undefined;
}
