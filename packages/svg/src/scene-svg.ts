import type { CompiledMotionPlan } from "./motion/types.js";

export interface SceneXmlNode {
  readonly name: string;
  readonly attrs: Record<string, string>;
  readonly children: SceneXmlNode[];
  readonly parts: (string | SceneXmlNode)[];
  readonly start: number;
  readonly openEnd: number;
  end: number;
  raw: string;
}
export interface SceneXmlDocument { readonly root: SceneXmlNode; readonly nodes: readonly SceneXmlNode[] }

function xmlCharacter(code: number): boolean {
  return code === 9 || code === 10 || code === 13 || code >= 0x20 && code <= 0xd7ff ||
    code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff;
}
export function sceneSafeText(value: string): string {
  return [...value].map(character => xmlCharacter(character.codePointAt(0)!) ? character : "\uFFFD").join("");
}
export function sceneEscapeXml(value: string): string {
  return sceneSafeText(value).replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
}
function decode(value: string): string {
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/u.test(value)) throw new Error("invalid XML entity");
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/gu, (_, entity: string) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (Object.hasOwn(named, entity)) return named[entity]!;
    const code = entity.startsWith("#x") ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!xmlCharacter(code)) throw new Error("invalid XML character entity");
    return String.fromCodePoint(code);
  });
}

/** Lifted from the shared card scanner: no DTD, processing instructions, or implicit entities. */
export function parseSceneXml(output: string): SceneXmlDocument {
  if (typeof output !== "string" || output.length > 1_000_000) throw new Error("invalid XML document size");
  for (const character of output) if (!xmlCharacter(character.codePointAt(0)!)) throw new Error("forbidden XML 1.0 character");
  const stack: SceneXmlNode[] = [];
  const nodes: SceneXmlNode[] = [];
  let root: SceneXmlNode | undefined;
  let index = 0;
  while (index < output.length) {
    const open = output.indexOf("<", index);
    const rawText = output.slice(index, open < 0 ? output.length : open);
    if (rawText.includes(">")) throw new Error("unescaped XML text");
    const text = decode(rawText);
    if (stack.length > 0) stack[stack.length - 1]!.parts.push(text);
    else if (!/^[ \t\r\n]*$/u.test(rawText)) throw new Error("text outside XML root");
    if (open < 0) break;
    const tag = /^<(\/)?([A-Za-z][\w:.-]*)((?:[ \t\r\n]+[A-Za-z][\w:.-]*[ \t\r\n]*=[ \t\r\n]*"[^"<]*")*)[ \t\r\n]*(\/?)>/u.exec(output.slice(open));
    if (!tag) throw new Error(`malformed XML tag at ${open}`);
    const [raw, closing, name, attributes, selfClosing] = tag;
    const attrs: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const attribute of attributes!.matchAll(/[ \t\r\n]+([A-Za-z][\w:.-]*)[ \t\r\n]*=[ \t\r\n]*"([^"]*)"/gu)) {
      if (Object.hasOwn(attrs, attribute[1]!)) throw new Error("duplicate XML attribute");
      attrs[attribute[1]!] = decode(attribute[2]!);
    }
    if (closing) {
      if (attributes!.trim() !== "" || selfClosing) throw new Error("invalid XML closing tag");
      const node = stack.pop();
      if (!node || node.name !== name) throw new Error("mismatched XML closing tag");
      node.end = open + raw!.length;
      node.raw = output.slice(node.start, node.end);
    } else {
      const node: SceneXmlNode = { name: name!, attrs, children: [], parts: [], start: open, openEnd: open + raw!.length, end: open + raw!.length, raw: raw! };
      const parent = stack[stack.length - 1];
      if (parent) { parent.children.push(node); parent.parts.push(node); }
      else {
        if (root) throw new Error("multiple XML roots");
        root = node;
      }
      nodes.push(node);
      if (nodes.length > 10_000 || stack.length >= 64) throw new Error("XML structural budget exceeded");
      if (!selfClosing) stack.push(node);
    }
    index = open + raw!.length;
  }
  if (!root || stack.length > 0) throw new Error("unclosed or absent XML root");
  return { root, nodes };
}
export function sceneXmlText(node: SceneXmlNode): string {
  return node.parts.map(part => typeof part === "string" ? part : sceneXmlText(part)).join("");
}

const NON_FRAME_ELEMENTS = new Set(["defs", "linearGradient", "radialGradient", "clipPath", "mask", "filter", "pattern", "marker", "title", "desc", "style"]);

function paintedFill(fill: string): boolean {
  if (fill === "none" || fill === "transparent") return false;
  if (/^#[0-9a-f]{4}$/u.test(fill)) return fill[4] !== "0";
  if (/^#[0-9a-f]{8}$/u.test(fill)) return fill.slice(-2) !== "00";
  const color = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(([\s\S]*)\)$/u.exec(fill);
  if (!color) return true;
  const components = color[2]!;
  const comma = components.split(",");
  const alpha = components.includes("/") ? components.slice(components.lastIndexOf("/") + 1).trim() :
    comma.length === 4 && ["rgba", "hsla", "rgb", "hsl"].includes(color[1]!) ? comma[3]!.trim() : undefined;
  if (alpha === undefined || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/u.test(alpha)) return true;
  return Number(alpha.replace(/%$/u, "")) > 0;
}

/** Common signature context must be in rendered, accessible text, rather than a definition. */
export function sceneVisibleText(root: SceneXmlNode): string {
  interface Presentation { fillOpacity: number; fill: string; fontSize: number }
  const opacity = (value: string | undefined, inherited: number): number => {
    if (value === undefined || value.trim() === "inherit" || value.trim() === "unset") return inherited;
    const trimmed = value.trim();
    const parsed = Number(trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed);
    return Number.isFinite(parsed) ? parsed / (trimmed.endsWith("%") ? 100 : 1) : inherited;
  };
  const fontSize = (value: string | undefined, inherited: number): number => {
    if (value === undefined) return inherited;
    const match = /^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|em|rem|%)?$/iu.exec(value.trim());
    if (!match) return inherited;
    const amount = Number(match[1]);
    return match[2] === "%" ? inherited * amount / 100 : match[2] === "em" ? inherited * amount : match[2] === "rem" ? 16 * amount : amount;
  };
  const walk = (node: SceneXmlNode, inherited: Presentation, withinText: boolean): string => {
    if (NON_FRAME_ELEMENTS.has(node.name) || node.attrs["aria-hidden"]?.trim().toLowerCase() === "true" ||
      opacity(node.attrs.opacity, 1) <= 0) return "";
    const fill = node.attrs.fill?.trim().toLowerCase();
    const presentation = {
      fillOpacity: opacity(node.attrs["fill-opacity"], inherited.fillOpacity),
      fill: fill === undefined || fill === "inherit" || fill === "unset" ? inherited.fill : fill,
      fontSize: fontSize(node.attrs["font-size"], inherited.fontSize),
    };
    if (withinText || node.name === "text") {
      const visible = presentation.fillOpacity > 0 && paintedFill(presentation.fill) && presentation.fontSize > 0;
      return node.parts.map(part => typeof part === "string" ? visible ? part : "" : walk(part, presentation, true)).join("");
    }
    return node.children.map(child => walk(child, presentation, false)).filter(Boolean).join(" ");
  };
  return walk(root, { fillOpacity: 1, fill: "black", fontSize: 16 }, false);
}

const ELEMENTS = new Set(["svg", "title", "desc", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "filter", "feGaussianBlur", "feMerge", "feMergeNode", "feOffset", "feFlood", "feComposite", "feColorMatrix", "pattern", "marker", "a", "use", "style", "animate", "animateTransform", "animateMotion"]);
const ATTRIBUTES = new Set(("id class xmlns role aria-label aria-labelledby aria-describedby aria-hidden viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity transform transform-origin transform-box font-family font-size font-weight font-style text-anchor dominant-baseline letter-spacing textLength lengthAdjust dx dy href gradientUnits gradientTransform offset stop-color stop-opacity clip-path clip-rule clipPathUnits mask maskUnits maskContentUnits filter filterUnits primitiveUnits stdDeviation in in2 result mode type values color-interpolation-filters patternUnits patternContentUnits patternTransform markerWidth markerHeight markerUnits refX refY orient preserveAspectRatio data-scene-seed attributeName begin dur repeatCount repeatDur additive calcMode keyTimes keySplines keyPoints path").split(" "));
const MOTION = new Set(["animate", "animateTransform", "animateMotion"]);

export function validateSceneSvg(document: SceneXmlDocument, prefix: string, compiled?: CompiledMotionPlan): void {
  const { root, nodes } = document;
  if (root.name !== "svg" || root.attrs.xmlns !== "http://www.w3.org/2000/svg" || root.attrs.role !== "img" || !root.attrs["aria-label"]?.trim() || root.attrs["aria-hidden"]?.trim().toLowerCase() === "true") throw new Error("scene SVG requires accessible SVG root");
  const ids = new Map<string, SceneXmlNode>();
  const parents = new Map<SceneXmlNode, SceneXmlNode>();
  for (const node of nodes) {
    for (const child of node.children) parents.set(child, node);
    if (!ELEMENTS.has(node.name) || node !== root && node.name === "svg") throw new Error("forbidden SVG element");
    for (const [name, value] of Object.entries(node.attrs)) {
      if (/^on/iu.test(name) || name.includes(":") || !ATTRIBUTES.has(name)) throw new Error("forbidden SVG attribute");
      if (name === "xmlns" && node !== root) throw new Error("SVG namespace overrides are forbidden");
      if (name === "id") {
        if (!value.startsWith(`${prefix}-`) || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(value) || ids.has(value)) throw new Error("invalid or duplicate namespaced SVG id");
        ids.set(value, node);
      }
      if (name === "class" && value.split(/\s+/u).some(item => !item.startsWith(`${prefix}-`) || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(item))) throw new Error("invalid namespaced SVG class");
    }
  }
  const localReference = (value: string) => {
    if (!value.startsWith(`${prefix}-`) || !ids.has(value)) throw new Error("unknown or cross-namespace SVG reference");
  };
  for (const node of nodes) {
    for (const [name, value] of Object.entries(node.attrs)) {
      if (name === "href") {
        if (value.startsWith("#")) localReference(value.slice(1));
        else {
          let url: URL;
          try { url = new URL(value); } catch { throw new Error("invalid SVG link"); }
          if (node.name !== "a" || url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.port) throw new Error("external SVG resource or link is forbidden");
        }
      } else if (name === "aria-labelledby" || name === "aria-describedby") {
        for (const id of value.split(/\s+/u)) localReference(id);
      } else if (/url\s*\(/iu.test(value)) {
        const match = /^url\(#([A-Za-z][A-Za-z0-9_-]*)\)$/u.exec(value);
        if (!match || !["fill", "stroke", "clip-path", "mask", "filter"].includes(name)) throw new Error("external or invalid SVG URL reference");
        localReference(match[1]!);
      } else if (/[\\]|(?:https?:|javascript:|data:)/iu.test(value) && !["xmlns", "aria-label"].includes(name)) throw new Error("forbidden SVG URL syntax");
    }
  }
  const styles = nodes.filter(node => node.name === "style");
  const motions = nodes.filter(node => MOTION.has(node.name));
  const animatedTargets = new Set(compiled?.applications.map(application => compiled.bindings.find(binding => binding.target === application.target)!.id) ?? []);
  const graphMemo = new Map<SceneXmlNode, boolean>();
  const visiting = new Set<SceneXmlNode>();
  const containsAnimated = (node: SceneXmlNode): boolean => {
    if (visiting.has(node)) throw new Error("cyclic SVG use reference");
    if (graphMemo.has(node)) return graphMemo.get(node)!;
    visiting.add(node);
    let animated = node.attrs.id !== undefined && animatedTargets.has(node.attrs.id);
    for (const child of node.children) animated = containsAnimated(child) || animated;
    if (node.name === "use" && node.attrs.href?.startsWith("#")) animated = containsAnimated(ids.get(node.attrs.href.slice(1))!) || animated;
    visiting.delete(node);
    graphMemo.set(node, animated);
    return animated;
  };
  for (const node of nodes.filter(node => node.name === "use")) {
    if (containsAnimated(node)) throw new Error("SVG use cannot clone animated motion targets");
  }
  if (!compiled) {
    if (styles.length || motions.length) throw new Error("unregistered scene motion or style");
    return;
  }
  if (styles.length !== (compiled.style ? 1 : 0) || styles.some(node => node.raw !== compiled.style || !root.children.includes(node))) throw new Error("scene compiler style is missing or altered");
  const expectedMotion: SceneXmlNode[] = [];
  for (const binding of compiled.bindings) {
    const wrapper = ids.get(binding.id);
    if (!wrapper || wrapper.name !== "g" || wrapper.attrs.class !== binding.className) throw new Error("scene motion binding is missing or altered");
    if (animatedTargets.has(binding.id)) {
      for (let ancestor = parents.get(wrapper); ancestor; ancestor = parents.get(ancestor)) {
        if (NON_FRAME_ELEMENTS.has(ancestor.name)) throw new Error("animated motion wrapper cannot occupy reusable SVG definitions");
      }
    }
    if (wrapper.attrs.transform !== undefined && !["translate(0 0)", "translate(0,0)", "matrix(1 0 0 1 0 0)"].includes(wrapper.attrs.transform)) throw new Error("motion wrapper requires identity transform");
    if (wrapper.attrs.opacity !== undefined && wrapper.attrs.opacity !== "1") throw new Error("motion wrapper requires base opacity 1");
    const children = wrapper.children.filter(node => MOTION.has(node.name));
    if (children.map(node => node.raw).join("") !== binding.children) throw new Error("scene compiler animation children are missing or altered");
    expectedMotion.push(...children);
  }
  if (motions.length !== expectedMotion.length || motions.some(node => !expectedMotion.includes(node))) throw new Error("unregistered scene animation");
  for (const binding of compiled.bindings) {
    if (nodes.filter(node => node.attrs.class?.split(/\s+/u).includes(binding.className)).length !== 1) throw new Error("scene motion class must bind exactly once");
  }
}
