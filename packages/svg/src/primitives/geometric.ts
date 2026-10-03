/** Bounded static geometry. A scene supplies the reading's meaning and any motion wrappers. */
import { stableHash } from "../seed.js";
import {
  begin, box, clamp, coordinate, end, label, list, path, primitiveTheme, reading, svgText, unavailable,
} from "./common.js";
import type { Box, PrimitiveBounds, PrimitiveContext } from "./common.js";
export type { PrimitiveBounds, PrimitiveContext } from "./common.js";

export const DNA_AXES = Object.freeze(["focus", "shipping", "collaboration", "consistency", "breadth", "stewardship"] as const);
export interface OrbitBody { readonly ring: number; readonly angle: number; readonly size?: number; readonly label?: string }
export interface OrbitOptions extends PrimitiveBounds { readonly rings: readonly number[]; readonly bodies: readonly OrbitBody[] }
export interface RadarOptions extends PrimitiveBounds { readonly axes: readonly string[]; readonly values: readonly number[] }
export interface SeriesOptions extends PrimitiveBounds { readonly series: readonly number[]; readonly label?: string }
export interface TerrainOptions extends SeriesOptions { readonly peaks?: readonly { readonly index: number; readonly label: string }[] }
export interface TimelineOptions extends PrimitiveBounds { readonly stations: readonly string[]; readonly position?: number }
export type ProjectDisclosure = "public" | "private-alias" | "masked-alias" | "synthetic";
export interface ProjectNodeOptions extends PrimitiveBounds {
  readonly label: string; readonly disclosure: ProjectDisclosure; readonly language?: string;
  readonly size: number; readonly state?: "observed" | "unavailable";
}
const SERIES_LIMIT = 1_000_000_000;
function chartPoints(values: readonly number[], bounds: Box, smooth = false): [number, number][] {
  const maximum = Math.max(...values, 1);
  return values.map((value, index) => {
    // Keep observed zero runs flat; smoothing only alters positive samples.
    const smoothed = smooth && value > 0 ? ((values[index - 1] ?? value) + value + (values[index + 1] ?? value)) / 3 : value;
    return [values.length === 1 ? bounds.width / 2 : 8 + index / (values.length - 1) * (bounds.width - 16),
      bounds.height - 40 - smoothed / maximum * (bounds.height - 56)];
  });
}
function circle(x: number, y: number, radius: number, ink: string, filled = false, dashed = false): string {
  return `<circle cx="${coordinate(x)}" cy="${coordinate(y)}" r="${coordinate(radius)}" fill="${filled ? ink : "none"}" stroke="${ink}"${dashed ? ' stroke-dasharray="4 3"' : ""}/>`;
}

/** Ring radius fractions are 0..1; body angles are degrees, body radii are 2..12 pixels. */
export function orbit(context: PrimitiveContext, options: OrbitOptions): string {
  const theme = primitiveTheme(context), bounds = box(options);
  const rings = list(options.rings, 8, "rings").map(reading);
  const bodies = list(options.bodies, 12, "bodies").map(body => {
    if (!body || !Number.isInteger(body.ring) || body.ring < 0 || body.ring >= rings.length) throw new Error("invalid body ring index");
    return { ring: body.ring, angle: reading(body.angle), size: body.size === undefined ? 4 : reading(body.size), label: body.label === undefined ? "" : label(body.label) };
  });
  const title = `Orbit. ${bodies.map(body => body.label).filter(Boolean).join(". ")}`;
  if (!rings.length || rings.some(value => !Number.isFinite(value)) || bodies.some(body => !Number.isFinite(body.angle) || !Number.isFinite(body.size))) return unavailable(bounds, theme, title);
  const cx = bounds.width / 2, cy = (bounds.height - 28) / 2 + 4;
  const radius = Math.min(bounds.width / 2, (bounds.height - 28) / 2) - 16;
  let output = begin(title);
  for (const ring of rings) output += circle(cx, cy, clamp(ring, 0, 1) * radius, theme.muted);
  for (const body of bodies) {
    const angle = (body.angle % 360) * Math.PI / 180, distance = clamp(rings[body.ring]!, 0, 1) * radius;
    const x = cx + Math.cos(angle) * distance, y = cy + Math.sin(angle) * distance;
    output += circle(x, y, clamp(body.size, 2, 12), theme.chrome, true);
    if (body.label) output += svgText(clamp(x + 8, 8, bounds.width - 108), clamp(y - 8, 14, bounds.height - 24), body.label, theme.text, 100, 9);
  }
  return output + end(bounds, theme, rings.some(value => value < 0 || value > 1) || bodies.some(body => body.size < 2 || body.size > 12));
}

/** Generic axes retain input order; the complete six-key DNA set has a fixed canonical order. */
export function radar(context: PrimitiveContext, options: RadarOptions): string {
  const theme = primitiveTheme(context), bounds = box(options);
  const axes = list(options.axes, 8, "axes").map(label), values = list(options.values, 8, "values").map(reading);
  if (axes.length < 3 || new Set(axes).size !== axes.length) throw new Error("radar axes require 3..8 unique labels");
  if (values.length !== axes.length) throw new Error("radar values must match axes");
  const canonical = axes.length === 6 && DNA_AXES.every(axis => axes.includes(axis));
  const entries = (canonical ? [...DNA_AXES] : axes).map(axis => ({ axis, value: values[axes.indexOf(axis)]! }));
  const title = `Radar. ${entries.map(entry => `${entry.axis}: ${Number.isFinite(entry.value) ? entry.value : "unavailable"}`).join(". ")}`;
  if (values.some(value => !Number.isFinite(value))) return unavailable(bounds, theme, title);
  const cx = bounds.width * 0.29, cy = bounds.height / 2 - 6, radius = Math.min(bounds.width * 0.25, bounds.height * 0.36);
  const point = (index: number, scale: number): [number, number] => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / axes.length;
    return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
  };
  let output = begin(title);
  for (const scale of [0.25, 0.5, 0.75, 1]) output += `<path d="${path(entries.map((_, i) => point(i, scale)), true)}" fill="none" stroke="${theme.border}"/>`;
  entries.forEach((_, i) => { output += `<path d="${path([[cx, cy], point(i, 1)])}" fill="none" stroke="${theme.muted}"/>`; });
  output += `<path d="${path(entries.map((entry, i) => point(i, clamp(entry.value, 0, 1))), true)}" fill="${theme.density[0]}" stroke="${theme.chrome}"/>`;
  entries.forEach((entry, i) => { output += svgText(bounds.width * 0.59, 18 + i * Math.min(18, (bounds.height - 40) / entries.length), entry.axis, theme.text, bounds.width * 0.41 - 8, 9); });
  return output + end(bounds, theme, values.some(value => value < 0 || value > 1));
}

/** Four smoothed contour traces, with observed zero samples preserved as flat basins. */
export function terrain(context: PrimitiveContext, options: TerrainOptions): string {
  const theme = primitiveTheme(context), bounds = box(options);
  const values = list(options.series, 366, "series").map(reading);
  const peaks = list(options.peaks ?? [], 12, "peaks").map(peak => {
    if (!peak || !Number.isInteger(peak.index) || peak.index < 0 || peak.index >= values.length) throw new Error("invalid terrain peak index");
    return { index: peak.index, label: label(peak.label) };
  });
  const title = `${options.label === undefined ? "Activity terrain" : label(options.label)}. ${peaks.map(peak => peak.label).join(". ")}`;
  if (!values.length || values.some(value => !Number.isFinite(value))) return unavailable(bounds, theme, title);
  const clamped = values.map(value => clamp(value, 0, SERIES_LIMIT)), points = chartPoints(clamped, bounds, true);
  const zero = clamped.every(value => value === 0);
  let output = begin(`${title}${zero ? " NO OBSERVED ACTIVITY IN WINDOW" : ""}`);
  for (const [i, scale] of (zero ? [0] : [0.25, 0.5, 0.75, 1]).entries()) {
    const contour: [number, number][] = zero
      ? [[8, bounds.height - 40], [bounds.width - 8, bounds.height - 40]]
      : points.map(([x, y]) => [x, bounds.height - 40 - (bounds.height - 40 - y) * scale]);
    output += `<path d="${path(contour)}" fill="none" stroke="${zero ? theme.muted : theme.density[i]}"/>`;
  }
  if (zero) output += svgText(8, bounds.height - 20, "NO OBSERVED ACTIVITY IN WINDOW", theme.muted, bounds.width - 16, 9);
  for (const peak of peaks) {
    const [x, y] = points[peak.index]!;
    output += circle(x, y, 3, theme.chrome);
    output += svgText(clamp(x, 8, bounds.width - 108), Math.max(12, y - 8), peak.label, theme.text, 100, 9);
  }
  return output + end(bounds, theme, values.some((value, i) => value !== clamped[i]));
}

/** Equal-spaced declared stations; position is an optional normalized position, not inferred time. */
export function timeline(context: PrimitiveContext, options: TimelineOptions): string {
  const theme = primitiveTheme(context), bounds = box(options);
  const stations = list(options.stations, 12, "stations").map(label);
  const position = options.position === undefined ? undefined : reading(options.position);
  const title = `Timeline. ${stations.join(". ")}`;
  if (!stations.length || position !== undefined && !Number.isFinite(position)) return unavailable(bounds, theme, title);
  const y = bounds.height / 2 - 10, inset = 16, width = bounds.width - 2 * inset;
  let output = begin(title) + `<path d="${path([[inset, y], [bounds.width - inset, y]])}" fill="none" stroke="${theme.muted}"/>`;
  stations.forEach((station, index) => {
    const x = stations.length === 1 ? bounds.width / 2 : inset + index / (stations.length - 1) * width;
    output += circle(x, y, 4, theme.chrome);
    const cell = width / Math.max(stations.length, 1), textX = clamp(x, cell / 2 + 4, bounds.width - cell / 2 - 4);
    output += svgText(textX, y + 22, station, theme.text, cell, 9, "middle");
  });
  if (position !== undefined) {
    const x = inset + clamp(position, 0, 1) * width;
    output += `<path d="${path([[x - 4, y - 16], [x + 4, y - 16], [x, y - 8]], true)}" fill="${theme.chrome}"/>`;
  }
  return output + end(bounds, theme, position !== undefined && (position < 0 || position > 1));
}

/** A normalized body size and disclosure shape. Language is resolved through theme ink, never raw colour. */
export function projectNode(context: PrimitiveContext, options: ProjectNodeOptions): string {
  const theme = primitiveTheme(context), bounds = box(options), name = label(options.label);
  if (!["public", "private-alias", "masked-alias", "synthetic"].includes(options.disclosure)) throw new Error("invalid project disclosure");
  if (options.state !== undefined && options.state !== "observed" && options.state !== "unavailable") throw new Error("invalid project state");
  const language = options.language === undefined ? undefined : label(options.language), size = reading(options.size);
  const title = `${name}. ${options.disclosure}${language ? `. ${language}` : ""}`;
  if (!Number.isFinite(size) || options.state === "unavailable") return unavailable(bounds, theme, title);
  const ink = language ? theme.languagePalette[Number.parseInt(stableHash(language).slice(0, 8), 16) % theme.languagePalette.length]! : theme.chrome;
  const cy = (bounds.height - 56) / 2 + 6, maxRadius = Math.min(bounds.width / 2 - 8, (bounds.height - 56) / 2 - 4);
  const radius = 6 + clamp(size, 0, 1) * (maxRadius - 6);
  return begin(title) + circle(bounds.width / 2, cy, radius, ink, false, options.disclosure.endsWith("alias")) +
    svgText(bounds.width / 2, bounds.height - 32, name, theme.text, bounds.width - 16, 10, "middle") +
    svgText(bounds.width / 2, bounds.height - 19, options.disclosure.toUpperCase(), theme.muted, bounds.width - 16, 9, "middle") + end(bounds, theme, size < 0 || size > 1);
}

/** At most 366 nonnegative readings. Empty/non-finite data is unavailable; zero is a real flat trace. */
export function sparkline(context: PrimitiveContext, options: SeriesOptions): string {
  const theme = primitiveTheme(context), bounds = box(options);
  const values = list(options.series, 366, "series").map(reading), title = options.label === undefined ? "Sparkline" : label(options.label);
  if (!values.length || values.some(value => !Number.isFinite(value))) return unavailable(bounds, theme, title);
  const clamped = values.map(value => clamp(value, 0, SERIES_LIMIT)), points = chartPoints(clamped, bounds);
  const zero = clamped.every(value => value === 0), last = points[points.length - 1]!;
  return begin(title) + `<path d="${path(points)}" fill="none" stroke="${zero ? theme.muted : theme.chrome}"/>` +
    circle(last[0], last[1], 3, zero ? theme.muted : theme.chrome) +
    (zero ? svgText(8, bounds.height - 20, "ZERO SERIES", theme.muted, bounds.width - 16, 9) : "") +
    end(bounds, theme, values.some((value, i) => value !== clamped[i]));
}
