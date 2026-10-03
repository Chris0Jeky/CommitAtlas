/** Decorative field recipes. Compile all recipes once through the active scene's motion plan. */
import { compileSceneMotion, sceneClassName, sceneElementId } from "../scene.js";
import type { RenderContext } from "../scene.js";
import { seededRandom } from "../seed.js";
import type { MotionTarget } from "../motion/profile.js";
import type { CompiledMotionPlan, MotionApplication } from "../motion/types.js";
import { begin, box, coordinate, limitNotice, list, path, primitiveTheme, svgText } from "./common.js";
import type { PrimitiveBounds, PrimitiveContext } from "./common.js";

export interface FieldPrimitive { readonly key: string; readonly count: number; readonly capped: boolean }
export interface FieldOptions extends PrimitiveBounds { readonly key: string }
export interface ParticleFieldOptions extends FieldOptions {
  readonly count: number; readonly seed?: string; readonly ink?: "chrome" | "muted" | "density";
}
export interface ScanlineOptions extends FieldOptions { readonly orientation?: "vertical" | "horizontal" }
export interface PlotterPathOptions extends FieldOptions { readonly d: string }
export type SignalState = "pending" | "passing" | "failing" | "unavailable" | "unconfigured" | "stale";
export interface SignalPulseOptions extends FieldOptions { readonly state: SignalState }
interface Part { readonly key: string; readonly geometry: string; readonly application: MotionApplication; readonly attributes?: string }
interface Recipe {
  readonly theme: string; readonly key: string; readonly title: string;
  readonly before: string; readonly after: string; readonly parts: readonly Part[];
}
const recipes = new WeakMap<FieldPrimitive, Recipe>();
function key(value: unknown): string {
  if (typeof value !== "string" || value.length > 48 || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(value)) throw new Error("invalid field key");
  return value;
}
function recipe(context: PrimitiveContext, name: string, title: string, parts: readonly Part[], before = "", after = "", capped = false): FieldPrimitive {
  const result = Object.freeze({ key: name, count: parts.length, capped });
  recipes.set(result, Object.freeze({ theme: context.theme, key: name, title, before, after, parts: Object.freeze([...parts]) }));
  return result;
}

/** Seeded placement is purely decorative. The returned count discloses the 96-particle cap. */
export function particleField(context: PrimitiveContext & { readonly seed?: string }, options: ParticleFieldOptions): FieldPrimitive {
  const theme = primitiveTheme(context), bounds = box(options), name = key(options.key);
  if (!Number.isSafeInteger(options.count) || options.count < 0) throw new Error("particle count must be a nonnegative safe integer");
  const ink = options.ink ?? "chrome";
  if (ink !== "chrome" && ink !== "muted" && ink !== "density") throw new Error("invalid particle ink role");
  const random = seededRandom(options.seed ?? context.seed ?? ""), count = Math.min(options.count, 96);
  const parts: Part[] = [];
  for (let i = 0; i < count; i++) {
    const x = 8 + random() * (bounds.width - 16), y = 8 + random() * (bounds.height - 32);
    const radius = 1 + random() * 1.5, delayMs = Math.floor(random() * 3000), target = `${name}-p${i}`;
    const colour = ink === "density" ? theme.density[i % theme.density.length]! : theme[ink];
    parts.push({ key: target,
      geometry: `<circle cx="${coordinate(x)}" cy="${coordinate(y)}" r="${coordinate(radius)}" fill="${colour}"/>`,
      application: { primitive: "twinkle", target, decorative: true, loopGroup: name, params: { minOpacity: 0.35, durationMs: 7000, delayMs } },
    });
  }
  return recipe(context, name, "Decorative particle field", parts, "", limitNotice(bounds, theme), options.count > count);
}

/** The carrier remains within its declared bounds throughout either orientation's translation. */
export function scanline(context: PrimitiveContext, options: ScanlineOptions): FieldPrimitive {
  const theme = primitiveTheme(context), bounds = box(options), name = key(options.key);
  const orientation = options.orientation ?? "vertical";
  if (orientation !== "vertical" && orientation !== "horizontal") throw new Error("invalid scanline orientation");
  const vertical = orientation === "vertical", target = `${name}-beam`;
  const points: [number, number][] = vertical ? [[8, 8], [8, bounds.height - 24]] : [[8, 8], [bounds.width - 8, 8]];
  return recipe(context, name, "Decorative scanline", [{ key: target,
    geometry: `<path d="${path(points)}" fill="none" stroke="${theme.chrome}" stroke-opacity="0.35"/>`,
    application: { primitive: "scan", target, decorative: true, loopGroup: name,
      params: { x: vertical ? bounds.width - 16 : 0, y: vertical ? 0 : bounds.height - 32, steps: 48 } },
  }], "", limitNotice(bounds, theme));
}

function plotPath(value: unknown, width: number, height: number): { d: string; length: number } {
  if (typeof value !== "string" || value.length > 24_000) throw new Error("invalid plotter path length");
  const tokens = value.match(/[ML]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/gu) ?? [];
  if (value.replace(/[ML]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/gu, "").replace(/[\s,]/gu, "") !== "") throw new Error("plotter path only supports absolute M/L pairs");
  if (tokens.length < 6 || tokens.length > 366 * 3 || tokens.length % 3 !== 0) throw new Error("plotter path requires 2..366 points");
  const points: [number, number][] = [];
  for (let i = 0; i < tokens.length; i += 3) {
    if (tokens[i] !== (i === 0 ? "M" : "L")) throw new Error("invalid plotter path command");
    const x = Number(tokens[i + 1]), y = Number(tokens[i + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > width || y < 0 || y > height) throw new Error("plotter path coordinate outside bounds");
    points.push([Number(coordinate(x)), Number(coordinate(y))]);
  }
  const measured = points.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - points[i]![0], y - points[i]![1]), 0);
  if (measured === 0) throw new Error("plotter path must have visible length");
  const length = Math.max(1, Math.ceil(measured * 1000) / 1000);
  if (length > 10_000) throw new Error("plotter path exceeds compiler length bound");
  return { d: path(points), length };
}

/** A complete 22%-opacity trace remains outside the animated stroke at every animation phase. */
export function plotterPath(context: PrimitiveContext, options: PlotterPathOptions): FieldPrimitive {
  const theme = primitiveTheme(context), bounds = box(options), name = key(options.key);
  const trace = plotPath(options.d, bounds.width, bounds.height), target = `${name}-trace`;
  const geometry = `<path d="${trace.d}" fill="none" stroke="${theme.chrome}"/>`;
  return recipe(context, name, "Plotter trace", [{ key: target, geometry,
    attributes: ` stroke-dasharray="${coordinate(trace.length)}" stroke-dashoffset="0"`,
    application: { primitive: "plot", target, decorative: true, loopGroup: name, params: { length: trace.length } },
  }], `<path d="${trace.d}" fill="none" stroke="${theme.chrome}" opacity="0.22"/>`, limitNotice(bounds, theme));
}

/** Only the pending lamp pulses; the state text and all unknown states remain static. */
export function signalPulse(context: PrimitiveContext, options: SignalPulseOptions): FieldPrimitive {
  const theme = primitiveTheme(context), bounds = box(options), name = key(options.key), state = options.state;
  if (!["pending", "passing", "failing", "unavailable", "unconfigured", "stale"].includes(state)) throw new Error("invalid signal state");
  const known = state === "pending" || state === "passing" || state === "failing";
  const ink = state === "pending" ? theme.warning : state === "passing" ? theme.positive : state === "failing" ? theme.negative : theme.muted;
  const lamp = `<circle cx="16" cy="20" r="5" fill="${known ? ink : "none"}" stroke="${ink}"${known ? "" : ' stroke-dasharray="3 2"'}/>`;
  const after = svgText(32, 24, state.toUpperCase(), theme.text, bounds.width - 40) + limitNotice(bounds, theme);
  if (state !== "pending") return recipe(context, name, `Signal ${state}`, [], lamp, after);
  const target = `${name}-lamp`;
  return recipe(context, name, "Signal pending", [{ key: target, geometry: lamp,
    application: { primitive: "pulse", target, decorative: true, loopGroup: name, params: { state: "pending", minOpacity: 0.45 } },
  }], "", after);
}

/** Compose field recipes and optional reading entrances into exactly one scene-budgeted plan. */
export function compileFieldPrimitives(
  context: RenderContext, fields: readonly FieldPrimitive[],
  options: { readonly target: MotionTarget; readonly applications?: readonly MotionApplication[] },
): { readonly fragment: string; readonly fragments: Readonly<Record<string, string>>; readonly motion: CompiledMotionPlan } {
  primitiveTheme(context);
  if (!options || typeof options !== "object" || Object.keys(options).some(name => name !== "target" && name !== "applications")) throw new Error("invalid field compile options");
  const names = new Set<string>(), reserved = new Set<string>();
  const records = list(fields, 96, "field recipes").map(field => {
    const data = recipes.get(field);
    if (!data) throw new Error("field recipe must come from a validated factory");
    if (names.has(data.key)) throw new Error("duplicate field key");
    names.add(data.key);
    if (data.theme !== context.theme) throw new Error("field theme does not match scene");
    for (const part of data.parts) {
      if (reserved.has(part.key)) throw new Error("duplicate field target");
      reserved.add(part.key);
    }
    return data;
  });
  const extra = list(options.applications ?? [], 288, "motion applications");
  for (const app of extra) if (reserved.has(app.target)) throw new Error("additional application uses a reserved field target");
  // None and subtle retain the same finished geometry, without ambient texture applications.
  const applications = context.motion === "ambient" || context.motion === "cinematic"
    ? records.flatMap(data => data.parts.map(part => part.application)) : [];
  const motion = compileSceneMotion(context, [...applications, ...extra], { target: options.target });
  const fragments = Object.freeze(Object.fromEntries(records.map(data => [data.key, begin(data.title) + data.before + data.parts.map(part => {
    const binding = motion.bindings.find(item => item.target === part.key);
    return `<g id="${sceneElementId(context, part.key)}" class="${sceneClassName(context, part.key)}" aria-hidden="true"${part.attributes ?? ""}>${part.geometry}${binding?.children ?? ""}</g>`;
  }).join("") + data.after + "</g>"])));
  return Object.freeze({ fragment: Object.values(fragments).join(""), fragments, motion });
}
