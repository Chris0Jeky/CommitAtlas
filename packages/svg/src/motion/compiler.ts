import {
  ENTRANCE_MIN_DELAY_MS, MOTION_BACKEND_DEFAULTS, MOTION_BUDGET_CLASS, MOTION_BUDGETS,
  MOTION_BUDGETS_PROVISIONAL, MOTION_DEFAULTS_PROVISIONAL, MOTION_TIMINGS,
  README_MOTION_INTERVAL_MS, SUBTLE_MAX_DURATION_MS,
} from "./profile.js";
import { CSS_UNSUPPORTED, cssTargetRule, encodeCssMotion } from "./css.js";
import { encodeSmilMotion } from "./smil.js";
import { MOTION_PRIMITIVES } from "./types.js";
import type { CompiledMotionApplication, CompiledMotionPlan, MotionApplication, MotionBinding, MotionPlanOptions, MotionPrimitive } from "./types.js";

const PARAMETER_KEYS: Record<MotionPrimitive, readonly string[]> = {
  enter: ["x", "y"], stagger: ["x", "y", "index", "staggerMs"], breathe: ["cx", "cy", "scale"],
  scan: ["x", "y"], sweep: ["x", "y"], rotate: ["cx", "cy"], orbit: ["cx", "cy"],
  plot: ["length"], flow: ["points"], twinkle: ["minOpacity"], pulse: ["minOpacity", "state"],
  acquisitionFailure: ["cx", "cy"],
};
const ONE_SHOT = new Set<MotionPrimitive>(["enter", "stagger", "acquisitionFailure"]);
const DECORATIVE_ONLY = new Set<MotionPrimitive>(["breathe", "twinkle", "pulse", "rotate", "orbit", "flow", "acquisitionFailure"]);

function fields(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${label} must be a plain object`);
  }
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !keys.includes(key)) throw new Error(`unknown ${label} parameter`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor)) throw new Error(`${label} parameter accessors are forbidden`);
    result[key] = descriptor.value;
  }
  return result;
}
function identifier(value: unknown, label: string, max = 64): string {
  if (typeof value !== "string" || value.length > max || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(value)) {
    throw new Error(`invalid ${label}`);
  }
  return value;
}
function number(value: unknown, fallback: number, label: string, min: number, max: number, integer = false): number {
  if (value === undefined && Number.isFinite(fallback)) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} parameter must be finite`);
  if (value < min || value > max || integer && !Number.isInteger(value)) throw new Error(`${label} parameter outside bounds ${min}..${max}`);
  return value;
}
function property(primitive: MotionPrimitive): string {
  return primitive === "plot" ? "stroke-dashoffset" : primitive === "pulse" || primitive === "twinkle" ? "opacity" : "transform";
}

/** Pure compiler. Bind its IDs/classes to identity-transform wrappers around finished base geometry. */
export class MotionPlan {
  private readonly options: MotionPlanOptions;
  private readonly prefix: string;
  private readonly collected: CompiledMotionApplication[] = [];

  constructor(input: MotionPlanOptions) {
    const opts = fields(input, ["instanceNamespace", "sceneId", "family", "profile", "target", "backend", "budgetClass"], "options");
    const namespace = identifier(opts.instanceNamespace, "instance namespace", 32);
    const sceneId = identifier(opts.sceneId, "scene id", 48);
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(sceneId)) throw new Error("invalid scene id");
    if (typeof opts.family !== "string" || !Object.hasOwn(MOTION_BUDGET_CLASS, opts.family)) throw new Error("invalid family");
    if (typeof opts.profile !== "string" || !["none", "subtle", "ambient", "cinematic"].includes(opts.profile)) throw new Error("invalid profile");
    if (typeof opts.target !== "string" || !Object.hasOwn(MOTION_BACKEND_DEFAULTS, opts.target)) throw new Error("invalid target");
    if (opts.backend !== undefined && opts.backend !== "css" && opts.backend !== "smil") throw new Error("invalid backend");
    const familyBudgetClass = MOTION_BUDGET_CLASS[input.family];
    const budgetClass = input.budgetClass === undefined ? familyBudgetClass : input.budgetClass;
    if (typeof budgetClass !== "string" || !Object.hasOwn(MOTION_BUDGETS, budgetClass)) throw new Error("invalid budget class");
    const familyBudget = MOTION_BUDGETS[familyBudgetClass];
    const selectedBudget = MOTION_BUDGETS[budgetClass];
    if (selectedBudget.bytes > familyBudget.bytes || selectedBudget.animatedElements > familyBudget.animatedElements || selectedBudget.loopingGroups > familyBudget.loopingGroups) throw new Error("budget class may only narrow the family default");
    if (opts.profile === "cinematic" && budgetClass !== "scene") throw new Error("cinematic requires scene/hero budget class");
    this.options = Object.freeze({ ...input, budgetClass, backend: input.backend ?? MOTION_BACKEND_DEFAULTS[input.target] });
    // Length delimiters prevent namespace/scene pairs containing '-' from aliasing each other.
    this.prefix = `ca-${namespace.length}-${namespace}-${sceneId.length}-${sceneId}`;
  }

  add(input: MotionApplication): this {
    if (this.collected.length >= 288) throw new Error("motion application budget exceeded");
    const app = fields(input, ["primitive", "target", "decorative", "loopGroup", "params"], "application");
    if (!MOTION_PRIMITIVES.includes(app.primitive as MotionPrimitive)) throw new Error("invalid primitive");
    const primitive = app.primitive as MotionPrimitive;
    const target = identifier(app.target, "target");
    if (typeof app.decorative !== "boolean") throw new Error("decorative must be boolean");
    if (DECORATIVE_ONLY.has(primitive) && !app.decorative) throw new Error(`${primitive} requires a decorative target`);
    if (primitive === "twinkle" && this.options.family !== "scene") throw new Error("twinkle requires scene-family decoration");
    if (this.options.profile === "subtle" && primitive !== "enter" && primitive !== "stagger") throw new Error("subtle only permits entrance primitives");
    const params = fields(app.params ?? {}, ["durationMs", "delayMs", ...PARAMETER_KEYS[primitive]], primitive);
    if (primitive === "pulse" && params.state !== "pending") throw new Error("pulse requires pending state");
    const durationMs = number(params.durationMs, MOTION_TIMINGS[primitive], "duration", 60, 20_000, true);
    if (this.options.profile === "subtle" && durationMs > SUBTLE_MAX_DURATION_MS) throw new Error("subtle duration exceeds 600 ms");
    const entrance = primitive === "enter" || primitive === "stagger";
    let delayMs = number(params.delayMs, entrance ? ENTRANCE_MIN_DELAY_MS : 0, "delay", entrance ? ENTRANCE_MIN_DELAY_MS : 0, 44_999, true);
    if (primitive === "stagger") delayMs += number(params.index, 0, "index", 0, 95, true) * number(params.staggerMs, MOTION_TIMINGS.staggerStep, "stagger", 0, 1000, true);
    const looping = !ONE_SHOT.has(primitive);
    if (this.options.target === "github-readme" && delayMs + (looping ? 1 : durationMs) > README_MOTION_INTERVAL_MS) throw new Error("delay exceeds README motion interval");
    const loopGroup = app.loopGroup === undefined ? target : identifier(app.loopGroup, "loop group");
    const points: (readonly [number, number])[] = [];
    if (primitive === "flow") {
      if (!Array.isArray(params.points) || params.points.length < 2 || params.points.length > 32) throw new Error("flow points must contain 2..32 coordinate pairs");
      for (const point of params.points) {
        if (!Array.isArray(point) || point.length !== 2) throw new Error("flow points must be coordinate pairs");
        points.push(Object.freeze([number(point[0], NaN, "points", -10_000, 10_000), number(point[1], NaN, "points", -10_000, 10_000)]));
      }
    }
    const values = Object.freeze({
      x: number(params.x, primitive === "sweep" ? 70 : primitive === "scan" ? 100 : 0, "x", -10_000, 10_000),
      y: number(params.y, entrance ? 4 : 0, "y", -10_000, 10_000),
      cx: number(params.cx, 0, "cx", -10_000, 10_000), cy: number(params.cy, 0, "cy", -10_000, 10_000),
      scale: number(params.scale, 1.045, "scale", 1, 1.1), length: number(params.length, 100, "length", 1, 10_000),
      minOpacity: number(params.minOpacity, primitive === "twinkle" ? 0.35 : 0.45, "opacity", 0.35, 1),
      points: Object.freeze(points),
    });
    for (const previous of this.collected.filter(item => item.target === target)) {
      if (previous.decorative !== app.decorative) throw new Error("target decorative classification must be consistent");
      if (property(previous.primitive) === property(primitive)) throw new Error("conflicting motion properties on one target");
    }
    this.collected.push(Object.freeze({ primitive, target, decorative: app.decorative,
      animationId: `${this.prefix}-animation-${this.collected.length}`, durationMs, delayMs, looping, loopGroup, values }));
    return this;
  }

  compile(input: { readonly baseBytes?: number } = {}): CompiledMotionPlan {
    const args = fields(input, ["baseBytes"], "compile");
    const baseBytes = number(args.baseBytes, 0, "baseBytes", 0, Number.MAX_SAFE_INTEGER, true);
    const backend = this.options.backend!;
    const budgetClass = this.options.budgetClass!;
    const budget = MOTION_BUDGETS[budgetClass];
    const bindings: MotionBinding[] = [];
    const emitted: CompiledMotionApplication[] = [];
    const unsupported: CompiledMotionPlan["unsupported"][number][] = [];
    const css: string[] = [];
    const targets = [...new Set(this.collected.map(app => app.target))];
    for (const target of targets) {
      const className = `${this.prefix}-target-${target}`;
      const id = `${this.prefix}-element-${target}`;
      const accepted = this.collected.filter(app => app.target === target).filter(app => {
        if (this.options.profile === "none") return false;
        if (backend === "css" && app.primitive === "flow") {
          unsupported.push({ target, primitive: app.primitive, reason: CSS_UNSUPPORTED.flow });
          return false;
        }
        return true;
      });
      emitted.push(...accepted);
      if (backend === "css" && accepted.length > 0) {
        const encodings = accepted.map(app => encodeCssMotion(app, this.options));
        css.push(...encodings.map(encoding => encoding.keyframes), cssTargetRule(className, encodings));
      }
      bindings.push({ target, id, className, children: backend === "smil" ? accepted.map(app => encodeSmilMotion(app, this.options)).join("") : "" });
    }
    const animatedElements = new Set(emitted.map(app => app.target)).size;
    const loopingGroups = new Set(emitted.filter(app => app.looping).map(app => app.loopGroup)).size;
    const selectors = bindings.filter(binding => emitted.some(app => app.target === binding.target)).map(binding => `.${binding.className}`);
    const style = css.length > 0 ? `<style>${css.join("")}@media (prefers-reduced-motion:reduce){${selectors.join(",")}{animation:none!important}}</style>` : "";
    const bytesAdded = new TextEncoder().encode(style + bindings.map(binding => binding.children).join("")).length;
    if (animatedElements > budget.animatedElements) throw new Error("animated element budget exceeded");
    if (loopingGroups > budget.loopingGroups) throw new Error("looping group budget exceeded");
    if (baseBytes + bytesAdded > budget.bytes || budgetClass === "instrument" && baseBytes + bytesAdded === budget.bytes) throw new Error("motion byte budget exceeded");
    return { backend, defaultsProvisional: MOTION_DEFAULTS_PROVISIONAL, budgetClass,
      budgetsProvisional: MOTION_BUDGETS_PROVISIONAL, style, bindings, applications: emitted, unsupported,
      counters: { animatedElements, loopingGroups, bytesAdded }, inlineStyles: style.length > 0,
      reducedMotion: emitted.length === 0 ? "not-needed" : backend === "css" ? "css-media-query" : "none-twin-required" };
  }
}
