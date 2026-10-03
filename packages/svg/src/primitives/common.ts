import { escapeXml, themes, truncateText } from "../index.js";
import type { SvgTheme } from "../index.js";
import type { RenderContext } from "../scene.js";

export type PrimitiveContext = Pick<RenderContext, "theme"> & Partial<Pick<RenderContext, "pack" | "layout">>;
export interface PrimitiveBounds { readonly width?: number; readonly height?: number }
export interface Box { readonly width: number; readonly height: number; readonly clamped: boolean }
export const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export function primitiveTheme(context: PrimitiveContext): SvgTheme {
  if (!context || typeof context.theme !== "string" || !Object.hasOwn(themes, context.theme)) throw new Error("invalid primitive theme");
  if (context.pack !== undefined && context.pack !== "survey") throw new Error("primitive pack must be survey");
  if (context.layout !== undefined && context.layout !== "wide" && context.layout !== "compact") throw new Error("invalid primitive layout");
  return themes[context.theme];
}
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
export function coordinate(value: number): string { return String(Number(value.toFixed(3))); }
export function box(options: PrimitiveBounds): Box {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("primitive options must be an object");
  const width = options.width === undefined ? 320 : options.width;
  const height = options.height === undefined ? 180 : options.height;
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("primitive dimension must be finite");
  const w = clamp(width, 160, 1600), h = clamp(height, 96, 1000);
  return { width: w, height: h, clamped: w !== width || h !== height };
}
export function label(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > 160) throw new Error("primitive text must contain 1..160 characters");
  return value;
}
export function list<T>(value: readonly T[], max: number, name: string): T[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`invalid ${name} length`);
  const result: T[] = [];
  for (let i = 0; i < value.length; i++) {
    const entry = Object.getOwnPropertyDescriptor(value, i);
    if (!entry || !("value" in entry)) throw new Error(`${name} must not be sparse or contain accessors`);
    result.push(entry.value as T);
  }
  return result;
}
export function reading(value: unknown): number {
  if (typeof value !== "number") throw new Error("primitive reading must be a number");
  return value;
}
export function svgText(x: number, y: number, value: string, ink: string, width: number, size = 10, anchor = "start"): string {
  const text = truncateText(value, Math.max(1, Math.floor(width / size)));
  return `<text x="${coordinate(x)}" y="${coordinate(y)}" fill="${ink}" font-family="${MONO}" font-size="${size}" text-anchor="${anchor}">${escapeXml(text)}</text>`;
}
export function path(points: readonly (readonly [number, number])[], close = false): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${coordinate(x)} ${coordinate(y)}`).join("") + (close ? "Z" : "");
}
export function begin(title: string): string { return `<g><title>${escapeXml(title)}</title>`; }
export function end(bounds: Box, theme: SvgTheme, clamped = false): string {
  return (bounds.clamped || clamped ? svgText(8, bounds.height - 6, "GEOMETRY CLAMPED", theme.muted, bounds.width - 16, 9) : "") + "</g>";
}
export function unavailable(bounds: Box, theme: SvgTheme, title: string): string {
  return begin(`${title}: unavailable`) +
    `<path d="${path([[8, bounds.height / 2], [bounds.width - 8, bounds.height / 2]])}" fill="none" stroke="${theme.muted}" stroke-dasharray="4 3"/>` +
    svgText(8, bounds.height / 2 - 12, "UNAVAILABLE", theme.muted, bounds.width - 16) + end(bounds, theme);
}
