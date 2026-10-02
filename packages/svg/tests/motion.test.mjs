import { assertWellFormedXml } from "./scene-harness.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import * as svg from "../dist/index.js";

const options = { instanceNamespace: "slotA", sceneId: "survey", family: "scene", profile: "ambient", target: "github-readme" };
const plan = (overrides = {}) => new svg.MotionPlan({ ...options, ...overrides });
const applications = [
  { primitive: "enter", target: "title", decorative: false, params: { x: 0, y: 4 } },
  { primitive: "stagger", target: "column", decorative: false, params: { index: 3 } },
  { primitive: "breathe", target: "iris", decorative: true },
  { primitive: "scan", target: "marker", decorative: true, params: { x: 100 } },
  { primitive: "sweep", target: "beam", decorative: true, params: { x: 70 } },
  { primitive: "rotate", target: "ring", decorative: true, params: { cx: 20, cy: 30 } },
  { primitive: "orbit", target: "satellite", decorative: true },
  { primitive: "plot", target: "trace", decorative: false, params: { length: 100 } },
  { primitive: "flow", target: "particle", decorative: true, params: { points: [[0, 0], [40, 20]] } },
  { primitive: "twinkle", target: "star", decorative: true },
  { primitive: "pulse", target: "lamp", decorative: true, params: { state: "pending" } },
  { primitive: "acquisitionFailure", target: "needle", decorative: true },
];

function render(compiled) {
  return `<svg xmlns="http://www.w3.org/2000/svg">${compiled.style}${compiled.bindings.map(binding =>
    `<g id="${binding.id}" class="${binding.className}"><path d="M0 0L40 20"/>${binding.children}</g>`).join("")}</svg>`;
}

function stripMotion(output) {
  return output.replace(/<style>[\s\S]*?<\/style>/gu, "").replace(/<animate(?:Transform|Motion)?\b[^>]*\/>/gu, "");
}

test("motion compiler is available through the existing package entrypoint", () => {
  assert.equal(typeof svg.MotionPlan, "function");
  assert.deepEqual(svg.MOTION_PRIMITIVES, applications.map(app => app.primitive));
});

for (const backend of ["css", "smil"]) {
  for (const application of applications) {
    test(`${backend} ${application.primitive} emits well-formed, removable motion`, () => {
      const compiled = plan({ backend }).add(application).compile();
      const still = plan({ backend, profile: "none" }).add(application).compile();
      assertWellFormedXml(render(compiled));
      assert.equal(stripMotion(render(compiled)), render(still));
      assert.doesNotMatch(render(compiled), /\bboth\b|backwards|fill="freeze"/u);
      if (backend === "css" && application.primitive === "flow") {
        assert.deepEqual(compiled.unsupported, [{ target: "particle", primitive: "flow", reason: "CSS offset-path is not qualified for SVG images" }]);
        assert.deepEqual(compiled.counters, { animatedElements: 0, loopingGroups: 0, bytesAdded: 0 });
      } else {
        assert.equal(compiled.unsupported.length, 0);
        assert.equal(compiled.counters.animatedElements, 1);
        assert.ok(compiled.counters.bytesAdded > 0);
      }
      assert.deepEqual(still.counters, { animatedElements: 0, loopingGroups: 0, bytesAdded: 0 });
    });
  }

  test(`${backend} entrance preserves underlying geometry before and after its delay`, () => {
    const compiled = plan({ backend, profile: "subtle" }).add(applications[0]).compile();
    const output = render(compiled);
    assert.doesNotMatch(output, /opacity|scale|\bboth\b|backwards|fill="freeze"/u);
    if (backend === "css") {
      assert.match(output, /animation-delay:60ms/u);
      assert.match(output, /animation-fill-mode:none/u);
      assert.match(output, /from\{transform:translate\(0px,4px\)\}to\{transform:translate\(0px,0px\)\}/u);
    } else {
      assert.match(output, /begin="0.06s"/u);
      assert.match(output, /fill="remove"/u);
      assert.match(output, /values="0 4;0 0"/u);
    }
    assert.throws(() => plan({ backend }).add({ ...applications[0], params: { delayMs: 59 } }), /delay/u);
    assert.throws(() => plan({ backend, profile: "subtle" }).add({ ...applications[0], params: { durationMs: 601 } }), /600/u);
  });

  test(`${backend} README loops end at 45 seconds including delay, returning to base`, () => {
    const app = { ...applications[2], params: { durationMs: 4500, delayMs: 900 } };
    for (const profile of ["ambient", "cinematic"]) {
      const compiled = plan({ backend, profile }).add(app).compile();
      const output = render(compiled);
      if (backend === "css") {
        assert.match(output, /animation-iteration-count:9.8/u);
        assert.match(output, /animation-fill-mode:none/u);
        assert.equal(900 + 4500 * 9.8, 45000);
      } else {
        assert.match(output, /begin="0.9s"/u);
        assert.match(output, /repeatDur="44.1s"/u);
        assert.match(output, /fill="remove"/u);
      }
      assert.equal(stripMotion(output), render(plan({ backend, profile: "none" }).add(app).compile()));
    }
    for (const target of ["web", "studio"]) {
      const output = render(plan({ backend, target }).add(app).compile());
      assert.match(output, backend === "css" ? /animation-iteration-count:infinite/u : /repeatCount="indefinite"/u);
      assert.doesNotMatch(output, /repeatDur=/u);
    }
  });

  test(`${backend} M-series timings and origin coordinates survive compilation`, () => {
    const stagger = plan({ backend }).add(applications[1]).compile();
    const breathe = plan({ backend }).add({ ...applications[2], params: { cx: 20, cy: 30 } }).compile();
    const pulse = plan({ backend }).add(applications[10]).compile();
    const sweep = plan({ backend }).add(applications[4]).compile();
    assert.equal(stagger.applications[0].durationMs, 400);
    assert.equal(stagger.applications[0].delayMs, 60 + 3 * 14);
    assert.equal(breathe.applications[0].durationMs, 4500);
    assert.equal(pulse.applications[0].durationMs, 2400);
    assert.equal(sweep.applications[0].durationMs, 7000);
    assert.match(render(breathe), backend === "css" ? /transform-origin:20px 30px/u : /values="0 0;-0.9 -1.35;0 0"/u);
  });
}

test("backend defaults and budgets carry their provisional evidence status", () => {
  assert.deepEqual(svg.MOTION_BACKEND_DEFAULTS, { "github-readme": "smil", web: "css", studio: "css" });
  assert.equal(svg.MOTION_DEFAULTS_PROVISIONAL, true);
  assert.equal(svg.MOTION_BUDGETS_PROVISIONAL, true);
  assert.deepEqual(svg.MOTION_BUDGETS, {
    instrument: { bytes: 30000, animatedElements: 24, loopingGroups: 3 },
    map: { bytes: 80 * 1024, animatedElements: 64, loopingGroups: 6 },
    scene: { bytes: 120 * 1024, animatedElements: 96, loopingGroups: 6 },
  });
  for (const [family, budgetClass] of [["instrument", "instrument"], ["map", "map"], ["signature", "map"], ["finding", "map"], ["scene", "scene"], ["hero", "scene"]]) {
    assert.equal(plan({ family }).compile().budgetClass, budgetClass);
  }
});

test("a scene may select a stricter budget without raising its family's default limits", () => {
  assert.equal(plan({ family: "signature", budgetClass: "instrument" }).compile().budgetClass, "instrument");
  assert.equal(plan({ family: "scene", budgetClass: "map" }).compile().budgetClass, "map");
  assert.throws(() => plan({ family: "instrument", budgetClass: "scene" }), /budget class/u);
  assert.throws(() => plan({ budgetClass: "wrong" }), /budget class/u);
  assert.throws(() => plan({ profile: "cinematic", budgetClass: "instrument" }), /cinematic/u);
  const builder = plan({ family: "signature", budgetClass: "instrument" });
  for (let index = 0; index < 25; index++) builder.add({ ...applications[0], target: `t${index}` });
  assert.throws(() => builder.compile(), /animated element budget/u);
});

test("budget class defaults only on omission or undefined and rejects null/coercible values", () => {
  for (const budgetClass of [null, { toString: () => "scene" }, "", 0, false]) {
    assert.throws(() => plan({ budgetClass }), /budget class/u);
  }
  assert.equal(plan().compile().budgetClass, "scene");
  assert.equal(plan({ budgetClass: undefined }).compile().budgetClass, "scene");
  assert.equal(plan({ budgetClass: "scene" }).compile().budgetClass, "scene");
  assert.equal(plan({ family: "signature", budgetClass: "instrument" }).compile().budgetClass, "instrument");
});

test("namespaces are deterministic and unambiguous across inline instances", () => {
  const compile = overrides => plan(overrides).add(applications[0]).compile();
  assert.deepEqual(compile({}), compile({}));
  const compiled = [compile({ instanceNamespace: "a-b", sceneId: "c" }), compile({ instanceNamespace: "a", sceneId: "b-c" }), compile({ instanceNamespace: "slotB" })];
  const names = compiled.flatMap(item => [item.bindings[0].id, item.bindings[0].className, item.applications[0].animationId]);
  assert.equal(new Set(names).size, names.length);
  for (const value of ["", "9slot", "evil\"/><script>", "a".repeat(33), "a.b"]) {
    assert.throws(() => plan({ instanceNamespace: value }), /namespace/u);
  }
  assert.throws(() => plan({ sceneId: "a b" }), /scene/u);
  assert.throws(() => plan().add({ ...applications[0], target: "evil#id" }), /target/u);
});

test("opacity and scale require decoration; pending and scene-only rules fail closed", () => {
  for (const primitive of ["breathe", "pulse", "twinkle"]) {
    const application = applications.find(app => app.primitive === primitive);
    assert.throws(() => plan().add({ ...application, decorative: false }), /decorative/u);
  }
  for (const state of [undefined, "healthy", "unavailable", "failed"]) {
    assert.throws(() => plan().add({ ...applications[10], params: { state } }), /pending/u);
  }
  assert.throws(() => plan({ family: "instrument" }).add(applications[9]), /scene/u);
  assert.throws(() => plan({ profile: "subtle" }).add(applications[2]), /subtle/u);
  assert.throws(() => plan().add({ ...applications[9], params: { minOpacity: 0.34 } }), /0.35/u);
});

test("reading wrappers only translate or draw their already-visible trace", () => {
  for (const primitive of ["rotate", "orbit", "acquisitionFailure", "flow"]) {
    const application = applications.find(app => app.primitive === primitive);
    assert.throws(() => plan().add({ ...application, decorative: false }), /decorative/u);
  }
});

test("cinematic is confined to the scene/hero budget class", () => {
  for (const family of ["instrument", "map", "signature", "finding"]) {
    assert.throws(() => plan({ family, profile: "cinematic" }), /cinematic/u);
  }
  for (const family of ["scene", "hero"]) {
    assert.doesNotThrow(() => plan({ family, profile: "cinematic" }));
  }
});

test("parameters are closed, numeric, bounded and owned by the plan", () => {
  for (const params of [{ durationMs: NaN }, { x: Infinity }, { delayMs: -1 }, { durationMs: 0 }, { opacity: 0 }, { easing: "evil" }, { y: "0);color:red" }]) {
    assert.throws(() => plan().add({ ...applications[0], params }), /parameter|finite|duration|delay/u);
  }
  assert.throws(() => plan().add({ ...applications[8], params: { points: "M0 0" } }), /points/u);
  assert.throws(() => plan().add({ ...applications[8], params: { points: [[0, 0], [NaN, 1]] } }), /finite/u);
  assert.throws(() => plan({ backend: "wrong" }), /backend/u);
  assert.throws(() => plan({ target: "wrong" }), /target/u);
  assert.throws(() => plan({ profile: "wrong" }), /profile/u);
  const source = { ...applications[0], params: { x: 1, y: 2 } };
  const builder = plan({ backend: "css" }).add(source);
  const expected = builder.compile();
  source.params.y = 900;
  assert.deepEqual(builder.compile(), expected);
  assert.throws(() => plan().add({ ...applications[0], decorative: "false" }), /decorative/u);
});

test("runtime enums reject coercible objects", () => {
  for (const [key, text] of [["profile", "ambient"], ["target", "web"], ["family", "scene"]]) {
    assert.throws(() => plan({ [key]: { toString: () => text } }), /invalid/u);
  }
});

test("flow coordinates cannot be absent", () => {
  const sparse = Array(2);
  sparse[1] = 1;
  for (const points of [[[0, 0], [undefined, 1]], [[0, 0], sparse], [[0, 0], [1, undefined]]]) {
    assert.throws(() => plan().add({ ...applications[8], params: { points } }), /points/u);
  }
});

test("getters are rejected and nested points are owned by the plan", () => {
  assert.throws(() => plan().add({ ...applications[0], params: { get x() { throw new Error("getter executed"); } } }), /accessors/u);
  const points = [[0, 0], [40, 20]];
  const builder = plan().add({ ...applications[8], params: { points } });
  const expected = builder.compile();
  points[1][0] = 999;
  assert.deepEqual(builder.compile(), expected);
  assert.throws(() => plan().add({ ...applications[1], params: { index: 95, staggerMs: 1000 } }), /README/u);
});

test("multiple effects on one wrapper count once, but conflicting properties reject", () => {
  const builder = plan({ backend: "smil" }).add({ ...applications[2], target: "decoration", loopGroup: "texture" }).add({ ...applications[9], target: "decoration", loopGroup: "texture" });
  const compiled = builder.compile();
  assert.equal(compiled.bindings.length, 1);
  assert.equal(compiled.counters.animatedElements, 1);
  assert.equal(compiled.counters.loopingGroups, 1);
  assert.equal(compiled.counters.bytesAdded, Buffer.byteLength(compiled.style + compiled.bindings.map(item => item.children).join(""), "utf8"));
  assert.throws(() => builder.add({ ...applications[5], target: "decoration" }), /conflict/u);
  assert.throws(() => builder.add({ ...applications[0], target: "decoration" }), /decorative/u);
});

test("all three budget axes enforce the selected class at the exact boundary", () => {
  const builder = plan({ family: "instrument", backend: "css" }).add(applications[0]);
  const added = builder.compile().counters.bytesAdded;
  assert.doesNotThrow(() => builder.compile({ baseBytes: 29999 - added }));
  assert.throws(() => builder.compile({ baseBytes: 30000 - added }), /byte budget/u);
  assert.throws(() => builder.compile({ baseBytes: -1 }), /baseBytes/u);
  const tooMany = plan({ family: "instrument" });
  for (let index = 0; index < 25; index++) tooMany.add({ ...applications[0], target: `t${index}` });
  assert.throws(() => tooMany.compile(), /animated element budget/u);
  const tooManyLoops = plan({ family: "instrument" });
  for (let index = 0; index < 4; index++) tooManyLoops.add({ ...applications[2], target: `t${index}` });
  assert.throws(() => tooManyLoops.compile(), /looping group budget/u);
});

test("reduced-motion and CSP metadata describe each emitted backend", () => {
  const css = plan({ backend: "css" }).add(applications[2]).compile();
  assert.match(css.style, /@media \(prefers-reduced-motion:reduce\)/u);
  assert.match(css.style, /animation:none!important/u);
  assert.equal(css.inlineStyles, true);
  assert.equal(css.reducedMotion, "css-media-query");
  const smil = plan({ backend: "smil" }).add(applications[2]).compile();
  assert.equal(smil.inlineStyles, false);
  assert.equal(smil.reducedMotion, "none-twin-required");
  assert.equal(plan({ profile: "none" }).add(applications[2]).compile().reducedMotion, "not-needed");
});

test("CSS combines distinct properties and shares loop groups across target wrappers", () => {
  const compiled = plan({ backend: "css" })
    .add({ ...applications[2], target: "decoration", loopGroup: "texture" })
    .add({ ...applications[9], target: "decoration", loopGroup: "texture" })
    .add({ ...applications[4], target: "beam", loopGroup: "texture" }).compile();
  assert.equal(compiled.counters.animatedElements, 2);
  assert.equal(compiled.counters.loopingGroups, 1);
  assert.equal(compiled.counters.bytesAdded, Buffer.byteLength(compiled.style, "utf8"));
  assert.match(compiled.style, /animation-duration:4500ms,7000ms/u);
  assert.match(compiled.style, /animation-delay:0ms,0ms/u);
  assert.match(compiled.style, /animation-name:[^;,]+,[^;]+;/u);
});

test("map and scene permit their inclusive byte limits and exact animated-element cap", () => {
  for (const [family, bytes, elements] of [["map", 80 * 1024, 64], ["scene", 120 * 1024, 96]]) {
    const builder = plan({ family, backend: "css" });
    for (let index = 0; index < elements; index++) builder.add({ ...applications[0], target: `t${index}` });
    const added = builder.compile().counters.bytesAdded;
    assert.doesNotThrow(() => builder.compile({ baseBytes: bytes - added }));
    assert.throws(() => builder.compile({ baseBytes: bytes - added + 1 }), /byte budget/u);
    builder.add({ ...applications[0], target: "extra" });
    assert.throws(() => builder.compile(), /animated element budget/u);
  }
});

test("encoders retain serialized timings and nonzero rotation centers", () => {
  for (const backend of ["css", "smil"]) {
    for (const [primitive, ms] of [["stagger", 400], ["breathe", 4500], ["pulse", 2400], ["sweep", 7000]]) {
      const compiled = plan({ backend }).add(applications.find(app => app.primitive === primitive)).compile();
      assert.ok(render(compiled).includes(backend === "css" ? `animation-duration:${ms}ms` : `dur="${ms / 1000}s"`));
    }
    for (const primitive of ["rotate", "orbit", "acquisitionFailure"]) {
      const compiled = plan({ backend }).add({ primitive, target: "needle", decorative: true, params: { cx: 20, cy: 30 } }).compile();
      assert.match(render(compiled), backend === "css" ? /transform-origin:20px 30px/u : /values="0 20 30;/u);
    }
  }
});

for (const backend of ["css", "smil"]) {
  test(`${backend} scan holds discrete positions while sweep stays continuous`, () => {
    const scan = params => plan({ backend }).add({ primitive: "scan", target: "marker", decorative: true, params }).compile();
    const defaultScan = scan();
    assert.match(render(defaultScan), backend === "css"
      ? /animation-timing-function:steps\(2,end\);/u
      : /values="0 0;50 0;100 0" calcMode="discrete" keyTimes="0;0.5;1"/u);
    assert.equal(defaultScan.applications[0].values.steps, 2);
    const compiled = scan({ x: 80, y: -20, steps: 4 });
    const output = render(compiled);
    if (backend === "css") {
      assert.match(output, /animation-timing-function:steps\(4,end\);/u);
      assert.match(output, /from\{transform:translate\(0px,0px\)\}to\{transform:translate\(80px,-20px\)\}/u);
    } else {
      assert.match(output, /values="0 0;20 -5;40 -10;60 -15;80 -20" calcMode="discrete" keyTimes="0;0.25;0.5;0.75;1"/u);
      const times = /keyTimes="([^"]+)"/u.exec(output)[1].split(";").map(Number);
      const positions = /values="([^"]+)"/u.exec(output)[1].split(";").map(value => value.split(" ").map(Number));
      for (const [time, expected] of [[0, [0, 0]], [0.249, [0, 0]], [0.25, [20, -5]], [0.749, [40, -10]], [0.75, [60, -15]], [1, [80, -20]]]) {
        assert.deepEqual(positions[times.findLastIndex(start => start <= time)], expected);
      }
    }
    assertXml(output);
    assert.equal(stripMotion(output), render(plan({ backend, profile: "none" }).add({ primitive: "scan", target: "marker", decorative: true, params: { x: 80, y: -20, steps: 4 } }).compile()));
    assert.equal(compiled.counters.bytesAdded, Buffer.byteLength(compiled.style + compiled.bindings[0].children, "utf8"));
    const sweep = render(plan({ backend }).add(applications[4]).compile());
    assert.match(sweep, backend === "css" ? /animation-timing-function:linear;/u : /values="0 0;70 0"/u);
    assert.doesNotMatch(sweep, /steps\(|calcMode="discrete"|keyTimes=/u);
  });
}

test("scan steps are a closed bounded integer parameter", () => {
  for (const steps of [1, 2, 96]) {
    for (const backend of ["css", "smil"]) {
      const compiled = plan({ backend }).add({ ...applications[3], params: { steps } }).compile();
      assert.equal(compiled.applications[0].values.steps, steps);
      if (backend === "smil") {
        assert.equal(/values="([^"]+)"/u.exec(compiled.bindings[0].children)[1].split(";").length, steps + 1);
        assert.equal(/keyTimes="([^"]+)"/u.exec(compiled.bindings[0].children)[1].split(";").length, steps + 1);
      }
    }
  }
  for (const steps of [0, -1, 97, 2.5, NaN, Infinity, null, "2", { toString: () => "2" }]) {
    assert.throws(() => plan().add({ ...applications[3], params: { steps } }), /steps/u);
  }
  assert.throws(() => plan().add({ ...applications[4], params: { steps: 2 } }), /unknown/u);
});

test("SMIL flow follows the plot spline across the whole numeric path", () => {
  const compiled = plan({ backend: "smil" })
    .add({ primitive: "plot", target: "trace", decorative: false, params: { length: 110, delayMs: 900 } })
    .add({ primitive: "flow", target: "particle", decorative: true, params: { points: [[0, 0], [10, 0], [10, 100]], delayMs: 900 } }).compile();
  const [plot, flow] = compiled.bindings.map(binding => binding.children);
  for (const output of [plot, flow]) {
    assert.match(output, /calcMode="spline" keyTimes="0;1" keySplines="\.4 0 \.2 1"/u);
    assert.match(output, /begin="0.9s" dur="9s" fill="remove" repeatCount="indefinite" repeatDur="44.1s"/u);
  }
  assert.match(flow, /path="M0 0 L10 0 L10 100" keyPoints="0;1"/u);
  assert.doesNotMatch(flow, /calcMode="linear"/u);
  assertXml(render(compiled));
  assert.equal(compiled.counters.bytesAdded, Buffer.byteLength(plot + flow, "utf8"));
  const unsupported = plan({ backend: "css" }).add(applications[8]).compile();
  assert.equal(unsupported.unsupported.length, 1);
  assert.equal(unsupported.counters.bytesAdded, 0);
});
