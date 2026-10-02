import type { CompiledMotionApplication, MotionPlanOptions } from "./types.js";
import { activeLoopMs, motionNumber as n } from "./types.js";

export const CSS_UNSUPPORTED = Object.freeze({ flow: "CSS offset-path is not qualified for SVG images" });

export interface CssMotionEncoding {
  readonly keyframes: string;
  readonly origin?: string;
  readonly timing: string;
}

export function encodeCssMotion(app: CompiledMotionApplication, options: MotionPlanOptions): CssMotionEncoding {
  const v = app.values;
  let frames: string;
  let origin: string | undefined;
  let easing = "linear";
  switch (app.primitive) {
    case "enter": case "stagger":
      frames = `from{transform:translate(${n(v.x)}px,${n(v.y)}px)}to{transform:translate(0px,0px)}`;
      easing = "cubic-bezier(0,0,.58,1)";
      break;
    case "scan": case "sweep":
      frames = `from{transform:translate(0px,0px)}to{transform:translate(${n(v.x)}px,${n(v.y)}px)}`;
      break;
    case "breathe":
      frames = `0%,100%{transform:scale(1)}50%{transform:scale(${n(v.scale)})}`;
      origin = `${n(v.cx)}px ${n(v.cy)}px`;
      easing = "cubic-bezier(.42,0,.58,1)";
      break;
    case "rotate": case "orbit":
      frames = "from{transform:rotate(0deg)}to{transform:rotate(360deg)}";
      origin = `${n(v.cx)}px ${n(v.cy)}px`;
      break;
    case "plot":
      frames = `from{stroke-dashoffset:${n(v.length)}}to{stroke-dashoffset:0}`;
      easing = "cubic-bezier(.4,0,.2,1)";
      break;
    case "pulse": case "twinkle":
      frames = `0%,100%{opacity:1}50%{opacity:${n(v.minOpacity)}}`;
      easing = "cubic-bezier(.42,0,.58,1)";
      break;
    case "acquisitionFailure":
      frames = "0%,100%{transform:rotate(0deg)}25%{transform:rotate(45deg)}50%{transform:rotate(20deg)}75%{transform:rotate(60deg)}";
      origin = `${n(v.cx)}px ${n(v.cy)}px`;
      break;
    case "flow": throw new Error("CSS flow is unsupported");
  }
  const active = activeLoopMs(app, options);
  const iterations = app.looping ? active === undefined ? "infinite" : String(active / app.durationMs) : "1";
  return { keyframes: `@keyframes ${app.animationId}{${frames}}`, origin,
    timing: `${app.animationId}|${app.durationMs}ms|${app.delayMs}ms|${easing}|${iterations}` };
}

/** Emit lists together so independent properties on a wrapper cannot overwrite one another. */
export function cssTargetRule(className: string, encodings: readonly CssMotionEncoding[]): string {
  const timings = encodings.map(encoding => encoding.timing.split("|"));
  const origin = encodings.find(encoding => encoding.origin !== undefined)?.origin;
  return `.${className}{${origin === undefined ? "" : `transform-box:view-box;transform-origin:${origin};`}` +
    ["animation-name", "animation-duration", "animation-delay", "animation-timing-function", "animation-iteration-count"]
      .map((property, index) => `${property}:${timings.map(timing => timing[index]).join(",")};`).join("") +
    "animation-fill-mode:none}";
}
