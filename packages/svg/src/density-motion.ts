import { MotionPlan } from "./motion/compiler.js";
import type { MotionBackend } from "./motion/profile.js";
import type { CompiledMotionPlan } from "./motion/types.js";
import type { SceneXmlDocument } from "./scene-svg.js";

export interface DensityMotionGeometry {
  readonly kind: "atlas" | "activity";
  readonly namespace: string;
  readonly backend: MotionBackend;
  readonly columns: number;
  readonly pitch: number;
  readonly left: number;
  readonly top: number;
  readonly height: number;
  readonly width: number;
  readonly frameWidth: number;
  readonly ink: string;
}

/** M3 steps exclusively through non-data gaps. The rotating ornament carries no reading. */
export function densityMotion(geometry: DensityMotionGeometry, active: boolean): {
  readonly fragment: string;
  readonly compiled: CompiledMotionPlan;
  readonly plan: MotionPlan;
} {
  const g = geometry;
  const plan = new MotionPlan({ instanceNamespace: g.namespace, sceneId: `${g.kind}-density`, family: "instrument", profile: active ? "ambient" : "none", target: "github-readme", backend: g.backend });
  if (g.columns > 1) plan.add({ primitive: "scan", target: "scan", decorative: true, params: { x: Math.max(0, g.columns - 2) * g.pitch, steps: Math.max(1, g.columns - 2) } });
  const cx = g.left + g.width + 9;
  const cy = g.top + g.height / 2;
  plan.add({ primitive: "rotate", target: "ornament", decorative: true, params: { cx, cy } });
  if (g.kind === "atlas") plan.add({ primitive: "sweep", target: "beam", decorative: true, params: { x: g.frameWidth - 114 } });
  const compiled = plan.compile();
  let fragment = `<g data-density-motion="${g.kind}" data-motion-namespace="${g.namespace}" data-motion-backend="${g.backend}" data-motion-columns="${g.columns}" data-motion-pitch="${g.pitch}" data-motion-left="${g.left}" data-motion-top="${g.top}" data-motion-height="${g.height}" data-motion-width="${g.width}" data-motion-frame-width="${g.frameWidth}" data-motion-ink="${g.ink}">`;
  for (const binding of compiled.bindings) {
    fragment += `<g id="${binding.id}" class="${binding.className}" aria-hidden="true">${binding.children}`;
    if (binding.target === "scan") {
      const x = g.left + g.pitch - 1;
      fragment += `<path d="M${x} ${g.top}v${g.height}" stroke="${g.ink}" stroke-width="1" opacity="0.7"/>`;
    } else if (binding.target === "ornament") {
      // Broken compass ring with a broad pointer: its rotation remains visible at README size.
      fragment += `<path d="M${cx} ${cy - 6}l3 3h-6zM${cx + 5} ${cy}a5 5 0 0 1-5 5M${cx - 5} ${cy}a5 5 0 0 1 5-5" stroke="${g.ink}" stroke-width="1" fill="none" opacity="0.8"/>`;
    } else {
      const inkId = `${binding.id}-ink`;
      fragment += `<defs><linearGradient id="${inkId}" x1="22" y1="62" x2="92" y2="62" gradientUnits="userSpaceOnUse"><stop stop-color="${g.ink}" stop-opacity="0"/><stop offset="1" stop-color="${g.ink}"/></linearGradient></defs><path d="M22 62h70" stroke="url(#${inkId})" stroke-width="2"/>`;
    }
    fragment += "</g>";
  }
  return { fragment: `${fragment}</g>`, compiled, plan };
}

/** Rebuild the exact compiler output from renderer-owned geometry; mutations fail closed. */
export function measureDensityMotion(document: SceneXmlDocument, kind: string): CompiledMotionPlan | undefined {
  const containers = document.nodes.filter(node => node.attrs["data-density-motion"] !== undefined);
  if (!containers.length) return undefined;
  if (containers.length !== 1 || !["atlas", "activity"].includes(kind)) throw new Error("Unsupported card motion contract");
  const container = containers[0]!;
  if (container.name !== "g" || container.attrs["data-density-motion"] !== kind) throw new Error("Unsupported card motion contract");
  const parent = document.nodes.find(node => node.children.includes(container));
  if (kind === "atlas" ? parent !== document.root : parent?.attrs.class !== "card-enter" || !document.root.children.includes(parent)) throw new Error("Unsupported card motion placement");
  if (document.nodes.some(node => node.name === "use")) throw new Error("Unsupported cloned card motion target");
  const attrs = container.attrs;
  const value = (key: string) => {
    const raw = attrs[`data-motion-${key}`];
    const parsed = Number(raw);
    if (raw === undefined || raw !== String(parsed) || !Number.isFinite(parsed) || parsed < 0 || parsed > 1200) throw new Error("Unsupported card motion geometry");
    return parsed;
  };
  const backend = attrs["data-motion-backend"];
  if (backend !== "smil" && backend !== "css") throw new Error("Unsupported card motion backend");
  const ink = attrs["data-motion-ink"]!;
  if (!/^#[0-9a-f]{6}$/u.test(ink)) throw new Error("Unsupported card motion ink");
  const styles = document.nodes.filter(node => node.name === "style");
  const animations = document.nodes.filter(node => /^(?:animate|set)/u.test(node.name));
  const hasCompilerStyle = styles.some(node => node.raw.includes(`ca-${attrs["data-motion-namespace"]?.length}-${attrs["data-motion-namespace"]}-`));
  const active = animations.length > 0 || hasCompilerStyle;
  const rebuilt = densityMotion({ kind: kind as "atlas" | "activity", namespace: attrs["data-motion-namespace"]!, backend,
    columns: value("columns"), pitch: value("pitch"), left: value("left"), top: value("top"), height: value("height"), width: value("width"), frameWidth: value("frame-width"), ink }, active);
  if (container.raw !== rebuilt.fragment) throw new Error("Unsupported card motion contract or wrapper");
  if (active && (styles.length !== (rebuilt.compiled.style ? 1 : 0) || styles.some(node => node.raw !== rebuilt.compiled.style))) throw new Error("Unsupported card motion contract or stylesheet");
  if (animations.map(node => node.raw).join("") !== rebuilt.compiled.bindings.map(binding => binding.children).join("")) throw new Error("Unsupported card motion contract or animation");
  for (const binding of rebuilt.compiled.bindings) {
    if (document.nodes.filter(node => node.attrs.id === binding.id).length !== 1 || document.nodes.filter(node => node.attrs.class?.split(/\s+/u).includes(binding.className)).length !== 1) throw new Error("Unsupported duplicate card motion binding");
  }
  return rebuilt.compiled;
}
