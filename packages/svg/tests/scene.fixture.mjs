import * as svg from "../dist/index.js";
import { demoContributions, demoProfile } from "../../github/dist/index.js";
import { calculateContributionMetrics } from "../../core/dist/index.js";

export function sceneInputs(overrides = {}) {
  const now = new Date("2026-01-07T00:00:00Z");
  const contributions = demoContributions("scene-demo", 7, now);
  return { snapshot: {
    version: 1, profile: demoProfile("scene-demo", now), contributions,
    metrics: calculateContributionMetrics(contributions.days, { commits: contributions.commits, issues: contributions.issues, pullRequests: contributions.pullRequests, reviews: contributions.reviews, days: 7, asOf: "2026-01-07" }),
    projects: null, freshness: { generatedAt: now.toISOString(), source: "synthetic-demo", mode: "demo" },
  }, ...overrides };
}
export const sceneContext = { theme: "aurora", pack: "survey", motion: "none", backend: "css", layout: "wide", instanceNamespace: "slotA", seed: "ignored-caller-seed" };

export function exampleScene(overrides = {}) {
  return {
    id: "example", family: "scene", budget: "scene",
    supportedPacks: ["orbital", "survey", "spectral", "terminal"], supportedMotion: ["none", "ambient", "cinematic"],
    buildModel(inputs) {
      if (inputs.snapshot.freshness.mode === "unavailable") return svg.sceneUnavailable("Synthetic observations unavailable");
      return { label: inputs.snapshot.profile.name, reading: inputs.snapshot.metrics.total, ...(inputs.lens ? { lens: { coverage: inputs.lens.coverage, privacyNote: inputs.lens.privacyNote } } : {}) };
    },
    accessibility(model) {
      return { title: `Example ${model.label}`, description: `${model.label}: ${model.reading} observations. Bar length represents observed count; blue ink is decorative; left to right position follows count; solid stroke marks observed data; entrance settles to base and ring motion is decorative.${model.lens ? ` DERIVED SIGNATURE · not a productivity score. ${svg.sceneLensDescription(model.lens)}` : ""}` };
    },
    render(model, context) {
      const accessibility = this.accessibility(model);
      const motion = svg.compileSceneMotion(context, [
        { primitive: "enter", target: "reading", decorative: false },
        { primitive: "breathe", target: "decoration", decorative: true, loopGroup: "example-loop" },
      ], { target: "github-readme" });
      const [reading, decoration] = motion.bindings;
      const paint = svg.sceneElementId(context, "paint");
      return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${svg.escapeXml(accessibility.title)}" viewBox="0 0 1600 100"><title>${svg.escapeXml(accessibility.title)}</title><desc>${svg.escapeXml(accessibility.description)}</desc>${motion.style}<defs><linearGradient id="${paint}"><stop offset="0" stop-color="#123456"/><stop offset="1" stop-color="#456789"/></linearGradient></defs><g id="${reading.id}" class="${reading.className}"><text x="10" y="20">${svg.escapeXml(model.label)}: ${model.reading}</text><rect class="${svg.sceneClassName(context, "bar")}" x="10" y="25" width="${model.reading}" height="4" fill="url(#${paint})"/>${reading.children}</g><g id="${decoration.id}" class="${decoration.className}" aria-hidden="true"><circle cx="200" cy="50" r="3"/>${decoration.children}</g>${model.lens ? `<text x="10" y="80">${svg.escapeXml(svg.sceneLensDescription(model.lens))}</text>` : ""}</svg>`;
    }, ...overrides,
  };
}

export function exampleFixtures(inputs = sceneInputs()) {
  const changed = structuredClone(inputs);
  changed.snapshot.metrics.total += 1;
  if (inputs.lens) changed.lens = inputs.lens;
  const unavailable = structuredClone(inputs);
  unavailable.snapshot.freshness.mode = "unavailable";
  if (inputs.lens) unavailable.lens = inputs.lens;
  return {
    ready: { inputs, readings: [String(inputs.snapshot.metrics.total), inputs.snapshot.profile.name], encodings: ["Bar length", "blue ink", "left to right position", "solid stroke", "entrance settles"], textFields: ["snapshot.profile.name", ...(inputs.lens ? ["lens.privacyNote", "lens.coverage.warnings.0"] : [])] },
    changed: { inputs: changed }, unavailable: { inputs: unavailable },
  };
}
