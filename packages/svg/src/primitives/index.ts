/** Static plate fragments. The scene owns its SVG root, description, and motion plan. */
import { escapeXml, themes, truncateText } from "../index.js";
import type { SvgTheme } from "../index.js";
import { scenePackGeometry } from "../packs.js";
import type { RenderContext, SceneDefinition, ScenePack } from "../scene.js";

export type PrimitiveContext = Pick<RenderContext, "theme"> & Partial<Pick<RenderContext, "pack" | "layout">>;
export type EvidenceRung = "observed" | "derived" | "hypothesis";
export interface PrimitivePosition { readonly x?: number; readonly y?: number }
export interface FrameOptions {
  readonly title: string; readonly ref: string; readonly family: SceneDefinition<unknown>["family"];
  readonly width?: number; readonly height?: number; readonly stale?: boolean;
}
export interface MetricOptions extends PrimitivePosition {
  readonly label: string; readonly value: string | number | null; readonly unit?: string; readonly width?: number;
}
export interface BadgeOptions extends PrimitivePosition { readonly label: string; readonly width?: number }
export type CoverageState =
  | { readonly state: "complete"; readonly observed: number; readonly total: number }
  | { readonly state: "partial"; readonly observed: number; readonly total: number }
  | { readonly state: "unavailable" }
  | { readonly state: "not-observed" };
export interface CoverageOptions extends PrimitivePosition { readonly width?: number }

const SANS = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace";
const FAMILY_LABELS = {
  instrument: "INSTRUMENT", map: "MAP", signature: "DERIVED SIGNATURE", scene: "SCENE", finding: "RESEARCH FINDING",
} as const;

function palette(context: PrimitiveContext): SvgTheme {
  if (!context || typeof context.theme !== "string" || !Object.hasOwn(themes, context.theme)) throw new Error("invalid primitive theme");
  if (context.pack !== undefined && context.pack !== "survey") throw new Error("structural primitives support only the survey pack");
  if (context.layout !== undefined && context.layout !== "wide" && context.layout !== "compact") throw new Error("invalid primitive layout");
  return themes[context.theme];
}
function frameTheme(context: PrimitiveContext): SvgTheme {
  if (!context || typeof context.theme !== "string" || !Object.hasOwn(themes, context.theme)) throw new Error("invalid primitive theme");
  if (context.pack !== "orbital" && context.pack !== "survey" && context.pack !== "spectral" && context.pack !== "terminal") throw new Error("invalid primitive pack");
  if (context.layout !== undefined && context.layout !== "wide" && context.layout !== "compact") throw new Error("invalid primitive layout");
  return themes[context.theme];
}
function packMarks(pack: ScenePack, width: number, height: number, ink: string): string {
  const geometry = scenePackGeometry(pack);
  if (geometry.marker === "plate") return "";
  const pitch = geometry.gridPitch;
  let marks = "";
  for (let x = pitch; x < width; x += pitch) marks += `<path d="M${x} 0V${height}" fill="none" stroke="${ink}"/>`;
  for (let y = pitch; y < height; y += pitch) marks += `<path d="M0 ${y}H${width}" fill="none" stroke="${ink}"/>`;
  if (geometry.marker === "ring") marks += `<circle cx="${pitch}" cy="${pitch}" r="14" fill="none" stroke="${ink}"/>`;
  if (geometry.marker === "band") marks += `<rect x="${pitch}" y="${pitch * 2}" width="${pitch * 3}" height="4" fill="none" stroke="${ink}"/>`;
  if (geometry.marker === "cell") marks += `<rect x="${pitch}" y="${pitch}" width="${pitch}" height="${pitch}" fill="none" stroke="${ink}"/>`;
  return marks;
}
function boundedText(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > 160) throw new Error("primitive text must contain 1 to 160 characters");
  return value;
}
function number(value: number, min: number, max: number, label: string): number {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`invalid primitive ${label}`);
  return Math.round(value * 1_000) / 1_000;
}
function position(options: PrimitivePosition): string {
  const x = number(options.x ?? 0, -4_096, 4_096, "coordinate");
  const y = number(options.y ?? 0, -4_096, 4_096, "coordinate");
  return `translate(${x} ${y})`;
}
function text(x: number, y: number, value: string, ink: string, size = 11, mono = true, anchor = "start"): string {
  return `<text x="${x}" y="${y}" fill="${ink}" font-family="${mono ? MONO : SANS}" font-size="${size}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}
function clipped(value: string, width: number, size: number): string {
  // A full em per code point remains conservative when system-font fallback widens glyphs.
  return truncateText(value, Math.max(1, Math.floor(width / size)));
}

/** An opaque corner-cut plate, family stamp, reference, and optional frozen stale strip. */
export function frame(context: PrimitiveContext, options: FrameOptions): string {
  const theme = context.pack === undefined || context.pack === "survey" ? palette(context) : frameTheme(context);
  const title = boundedText(options.title), ref = boundedText(options.ref);
  if (typeof options.family !== "string" || !Object.hasOwn(FAMILY_LABELS, options.family)) throw new Error("invalid primitive family");
  if (options.stale !== undefined && typeof options.stale !== "boolean") throw new Error("invalid primitive stale state");
  const width = number(options.width ?? (context.layout === "compact" ? 480 : 720), 320, 1_600, "dimension");
  const height = number(options.height ?? 320, 140, 1_000, "dimension");
  const corner = scenePackGeometry(context.pack ?? "survey").corner;
  const path = `M0 0H${width - corner}L${width} ${corner}V${height}H0Z`;
  let output = `<g><title>${escapeXml(`${title} (${ref})`)}</title><path d="${path}" fill="${theme.background}"/>`;
  output += `<path d="M1 1H${width - (corner + 1)}L${width - 1} ${corner + 1}V${height - 1}H1Z" fill="none" stroke="${theme.border}"/>`;
  output += text(20, 25, FAMILY_LABELS[options.family], theme.chrome);
  output += text(width - 20, 25, clipped(ref, width / 3, 10), theme.muted, 10, true, "end");
  output += text(20, 57, clipped(title, width - 40, 22), theme.text, 22, false);
  output += `<path d="M20 74H${width - 20}" fill="none" stroke="${theme.border}"/>`;
  if (options.stale) {
    output += `<path d="M20 ${height - 36}H${width - 20}" fill="none" stroke="${theme.muted}" stroke-dasharray="3 3"/>`;
    output += text(20, height - 16, "STALE", theme.muted, 10);
  }
  if (options.family === "signature") output += text(width - 20, height - 16, "not a productivity score", theme.muted, 10, true, "end");
  output += packMarks(context.pack ?? "survey", width, height, theme.chrome);
  return `${output}</g>`;
}

/** Renders a supplied reading, never a computed score. Null is visibly unavailable, not zero. */
export function metric(context: PrimitiveContext, options: MetricOptions): string {
  const theme = palette(context), label = boundedText(options.label);
  const width = number(options.width ?? 240, 120, 640, "dimension");
  let value: string;
  if (options.value === null) value = "UNAVAILABLE";
  else if (typeof options.value === "number" && Number.isFinite(options.value)) value = String(options.value);
  else if (typeof options.value === "string") value = boundedText(options.value);
  else throw new Error("invalid metric value");
  const unit = options.unit === undefined ? "" : boundedText(options.unit);
  const description = `${label}: ${value}${unit && options.value !== null ? ` ${unit}` : ""}`;
  const readingSize = options.value === null ? Math.min(14, Math.floor(width / value.length)) : 26;
  let output = `<g transform="${position(options)}"><title>${escapeXml(description)}</title>`;
  output += text(0, 12, clipped(label, width, 11), theme.muted);
  output += text(0, 42, clipped(value, width, readingSize), options.value === null ? theme.muted : theme.text, readingSize, false);
  if (unit && options.value !== null) output += text(0, 62, clipped(unit, width, 10), theme.muted, 10);
  return `${output}</g>`;
}

/** Neutral annotation. It carries no health meaning or caller-supplied colour. */
export function badge(context: PrimitiveContext, options: BadgeOptions): string {
  const theme = palette(context), label = boundedText(options.label);
  const width = number(options.width ?? Math.min(320, Math.max(64, [...label.trim()].length * 11 + 24)), 64, 640, "dimension");
  return `<g transform="${position(options)}"><title>${escapeXml(label)}</title>` +
    `<rect x="0" y="0" width="${width}" height="26" rx="3" fill="none" stroke="${theme.muted}"/>` +
    text(12, 17, clipped(label, width - 24, 11), theme.muted) + "</g>";
}

/** Word + solid/half/dashed dot + solid/double/dashed border survive removal of all colour. */
export function evidenceLabel(context: PrimitiveContext, rung: EvidenceRung, options: PrimitivePosition = {}): string {
  const theme = palette(context);
  if (rung !== "observed" && rung !== "derived" && rung !== "hypothesis") throw new Error("invalid evidence rung");
  const dashed = rung === "hypothesis";
  let output = `<g transform="${position(options)}"><rect x="0" y="0" width="136" height="26" fill="none" stroke="${theme.muted}"${dashed ? ' stroke-dasharray="4 3"' : ""}/>`;
  if (rung === "derived") output += `<rect x="2" y="2" width="132" height="22" fill="none" stroke="${theme.muted}"/>`;
  output += `<circle cx="14" cy="13" r="4" fill="${rung === "observed" ? theme.muted : "none"}" stroke="${theme.muted}"${dashed ? ' stroke-dasharray="2 2"' : ""}/>`;
  if (rung === "derived") output += `<path d="M14 9A4 4 0 0 0 14 17Z" fill="${theme.muted}"/>`;
  return output + text(26, 17, rung.toUpperCase(), theme.muted, 10) + "</g>";
}

/** Observed coverage is a fraction, not a health score. Unknown coverage never gets signal ink. */
export function coverageBar(context: PrimitiveContext, coverage: CoverageState, options: CoverageOptions = {}): string {
  const theme = palette(context), width = number(options.width ?? 280, 240, 640, "dimension");
  if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) throw new Error("invalid coverage state");
  const known = coverage.state === "complete" || coverage.state === "partial";
  if (!known && coverage.state !== "unavailable" && coverage.state !== "not-observed") throw new Error("invalid coverage state");
  const allowed = known ? ["state", "observed", "total"] : ["state"];
  if (Object.keys(coverage).some(key => !allowed.includes(key))) throw new Error("unknown coverage field");
  let output = `<g transform="${position(options)}">`;
  if (coverage.state === "unavailable" || coverage.state === "not-observed") {
    const unavailable = coverage.state === "unavailable";
    output += `<g${unavailable ? ' transform="rotate(-3 48 10)"' : ""}><rect x="0" y="0" width="112" height="22" fill="none" stroke="${theme.muted}"${unavailable ? "" : ' stroke-dasharray="4 3"'}/>`;
    output += text(6, 15, unavailable ? "NO SIGNAL" : "NOT OBSERVED", theme.muted, 10) + "</g>";
    if (unavailable) output += text(width, 15, "UNAVAILABLE", theme.muted, 10, true, "end");
    output += `<path d="M0 34H${width}" fill="none" stroke="${theme.muted}"${unavailable ? "" : ' stroke-dasharray="4 3"'}/>`;
  } else {
    const { observed, total } = coverage;
    if (!Number.isSafeInteger(observed) || !Number.isSafeInteger(total) || total < 1 || total > 1_000_000 || observed < 0 || observed > total || (coverage.state === "complete" ? observed !== total : observed === total)) throw new Error("invalid coverage counts");
    const extent = Math.round(width * observed / total * 1_000) / 1_000;
    const complete = coverage.state === "complete";
    output += `<circle cx="5" cy="10" r="4" fill="${complete ? theme.chrome : "none"}" stroke="${theme.chrome}"/>`;
    if (!complete) output += `<path d="M5 6A4 4 0 0 0 5 14Z" fill="${theme.chrome}"/>`;
    output += text(16, 15, complete ? "COMPLETE" : "PARTIAL", theme.chrome, 10);
    output += text(width, 15, `${observed}/${total}`, theme.muted, 10, true, "end");
    output += `<path d="M0 34H${width}" fill="none" stroke="${theme.muted}"${complete ? "" : ' stroke-dasharray="4 3"'}/>`;
    if (observed > 0) output += `<path d="M0 34H${extent}" fill="none" stroke="${theme.chrome}" stroke-width="3"/>`;
  }
  return `${output}</g>`;
}
