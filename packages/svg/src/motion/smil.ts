import type { CompiledMotionApplication, MotionPlanOptions } from "./types.js";
import { activeLoopMs, motionNumber as n } from "./types.js";

export function encodeSmilMotion(app: CompiledMotionApplication, options: MotionPlanOptions): string {
  const v = app.values;
  const active = activeLoopMs(app, options);
  const timing = `begin="${n(app.delayMs / 1000)}s" dur="${n(app.durationMs / 1000)}s" fill="remove"` +
    (app.looping ? ` repeatCount="indefinite"${active === undefined ? "" : ` repeatDur="${n(active / 1000)}s"`}` : "");
  const node = (element: string, attrs: string, suffix = "") => `<${element} id="${app.animationId}${suffix}" ${attrs} ${timing}/>`;
  const transform = (type: string, values: string, extra = "", suffix = "") =>
    node("animateTransform", `attributeName="transform" type="${type}" values="${values}"${extra}`, suffix);
  const spline = (curve: string, segments: number) => ` calcMode="spline" keyTimes="${Array.from({ length: segments + 1 }, (_, index) => n(index / segments)).join(";")}" keySplines="${Array(segments).fill(curve).join(";")}"`;
  switch (app.primitive) {
    case "enter": case "stagger":
      return transform("translate", `${n(v.x)} ${n(v.y)};0 0`, spline("0 0 .58 1", 1));
    case "scan": case "sweep":
      return transform("translate", `0 0;${n(v.x)} ${n(v.y)}`);
    case "rotate": case "orbit":
      return transform("rotate", `0 ${n(v.cx)} ${n(v.cy)};360 ${n(v.cx)} ${n(v.cy)}`);
    case "breathe": {
      const ease = spline(".42 0 .58 1", 2);
      // T(c * (1-s)) S(s) scales about c in user coordinates, matching CSS transform-origin.
      const compensation = transform("translate", `0 0;${n(v.cx * (1 - v.scale))} ${n(v.cy * (1 - v.scale))};0 0`, ease, "-origin");
      return compensation + transform("scale", `1;${n(v.scale)};1`, ` additive="sum"${ease}`);
    }
    case "plot":
      return node("animate", `attributeName="stroke-dashoffset" values="${n(v.length)};0"${spline(".4 0 .2 1", 1)}`);
    case "flow":
      return node("animateMotion", `path="${v.points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${n(x)} ${n(y)}`).join(" ")}" calcMode="linear"`);
    case "pulse": case "twinkle":
      return node("animate", `attributeName="opacity" values="1;${n(v.minOpacity)};1"${spline(".42 0 .58 1", 2)}`);
    case "acquisitionFailure":
      return transform("rotate", [0, 45, 20, 60, 0].map(angle => `${angle} ${n(v.cx)} ${n(v.cy)}`).join(";"));
  }
}
