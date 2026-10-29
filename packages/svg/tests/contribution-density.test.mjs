import test from "node:test";
import assert from "node:assert/strict";
import * as svg from "../dist/index.js";
import { contributionDensity, contributionGlyph, contributionShape, CONTRIBUTION_GLYPHS, CONTRIBUTION_DENSITY_PALETTES } from "../dist/density.js";
import { parseSceneXml } from "../dist/scene-svg.js";
import { densityDays, densityAtlas } from "./density.fixture.mjs";

const stripMotion = value => value.replace(/<style>[\s\S]*?<\/style>/gu, "").replace(/<animate(?:Transform|Motion)?\b[^>]*\/>/gu, "");
const cells = output => parseSceneXml(output).nodes.filter(node => node.attrs.class === "atlas-cell" || node.attrs.class === "activity-cell");
const cellCount = output => cells(output).reduce((count, node) => count + Number(node.attrs["data-cell-count"]), 0);

test("absolute bands distinguish all endpoints, independent of upstream intensity", () => {
  for (const [count, band, step] of [[0, "zero", 0], [1, "copper", 0], [200, "copper", 3], [201, "gold", 0], [700, "gold", 3], [701, "violet", 0], [1500, "violet", 3], [1501, "special", 0]]) {
    const reading = contributionDensity(count, "2026-10-29");
    assert.equal(reading.band, band); assert.equal(reading.step, step);
  }
  for (const count of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(contributionDensity(count, "2026-10-29").band, "unavailable");
  const days = [200, 201, 700, 701, 1500, 1501].map((count, index) => ({ date: `2026-10-${index + 10}`, count, level: 0 }));
  const output = svg.renderActivityCard({ days });
  for (const band of ["copper", "gold", "violet", "special"]) assert.match(output, new RegExp(`data-density-band="${band}"`));
  for (const label of ["1–200", "201–700", "701–1500", "1501+"]) assert.ok(output.includes(label));
});

test("special silhouettes are selected once by date and remain stable across themes/count changes", () => {
  const dates = densityDays(365, () => 1501);
  assert.deepEqual(new Set(dates.map(day => contributionGlyph(day.date))), new Set(CONTRIBUTION_GLYPHS));
  for (const day of dates) assert.equal(contributionDensity(1501, day.date).glyph, contributionDensity(999999, day.date).glyph);
  const data = { days: dates, source: "synthetic-demo" };
  assert.equal(svg.renderActivityCard(data, { theme: "ember" }), svg.renderActivityCard(data, { theme: "ember" }));
  const getNames = output => cells(output).map(cell => cell.attrs["data-glyph"]).filter(Boolean).sort();
  assert.deepEqual(getNames(svg.renderActivityCard(data, { theme: "paper" })), getNames(svg.renderActivityCard(data, { theme: "ember" })));
});

test("annual geometry includes the last observed day without truncating history statistics", () => {
  const history = densityDays(731, () => 1700);
  const activity = svg.renderActivityCard({ days: history });
  const atlas = svg.renderAtlasCard(densityAtlas({ activity: history, currentStreak: 730, longestStreak: 730 }));
  for (const output of [activity, atlas]) {
    assert.equal(cellCount(output), 365);
    assert.match(output, /2025-10-30/);
    assert.match(output, /2026-10-29/);
    assert.doesNotMatch(output, /2025-10-29 1,700/);
  }
  assert.match(atlas, /2025-10: 30=1700, 31=1700/);
  assert.match(atlas, /2026-10: 01=1700[\s\S]*29=1700/);
  assert.match(atlas, />730d<\/text>/);
  assert.match(atlas, /OBSERVED HISTORY/);
  assert.match(atlas, /620,500/);
});

test("the annual cap is a date span and never pads missing observations with zeroes", () => {
  const days = [{ date: "2024-01-01", count: 8 }, { date: "2026-10-01", count: 4 }, { date: "2026-10-29", count: 9 }];
  const output = svg.renderActivityCard({ days });
  assert.equal(cellCount(output), 2);
  assert.doesNotMatch(output, /2024-01-01 8/);
  assert.match(output, /2 observed days/);
});

test("cropping cannot promote an unknown total or incomplete annual calendar into an exact total", () => {
  const days = densityDays(731, () => 1);
  days.at(-1).count = Number.NaN;
  for (const total of [undefined, Number.NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1, 731]) {
    const output = svg.renderActivityCard({ days, ...(total === undefined ? {} : { total }) });
    assert.match(output, />Total unavailable<\/text>/);
    assert.doesNotMatch(output, />364 contributions<\/text>/);
  }
  for (const total of [Number.NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.match(svg.renderActivityCard({ days: densityDays(2, () => 1), total }), />Total unavailable<\/text>/);
  }
});

test("an unsafe sum of individually valid counts is unavailable rather than an imprecise total", () => {
  for (const days of [densityDays(2, () => Number.MAX_SAFE_INTEGER), densityDays(731, index => index >= 729 ? Number.MAX_SAFE_INTEGER : 0)]) {
    const output = svg.renderActivityCard({ days });
    assert.match(output, />Total unavailable<\/text>/);
    assert.doesNotMatch(output, />[^<]*B contributions<\/text>/);
  }
});

test("prebuilt silhouettes stay within every supported pixel cell", () => {
  for (const size of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) for (const reading of [contributionDensity(200, "2026-01-01"), contributionDensity(700, "2026-01-01"), contributionDensity(1500, "2026-01-01"), ...CONTRIBUTION_GLYPHS.map(glyph => ({ band: "special", step: 0, glyph }))]) {
    const tokens = contributionShape(reading, size).match(/[a-z]|-?(?:\d*\.)?\d+/gu);
    let x = 0; let y = 0; let startX = 0; let startY = 0; let command;
    while (tokens.length) {
      if (/^[a-z]$/u.test(tokens[0])) command = tokens.shift();
      if (command === "z") { x = startX; y = startY; command = undefined; continue; }
      const first = Number(tokens.shift());
      if (command === "h") x += first;
      else if (command === "v") y += first;
      else if (command === "m" || command === "l") {
        x += first; y += Number(tokens.shift());
        if (command === "m") { startX = x; startY = y; command = "l"; }
      } else assert.fail(`unsupported shape command ${command}`);
      assert.ok(x >= 0 && x <= size && y >= 0 && y <= size, `${reading.glyph ?? reading.band}/${size}: (${x},${y})`);
    }
  }
});

for (const kind of ["atlas", "activity"]) for (const backend of ["smil", "css"]) test(`${kind} ${backend} ambient moves bounded decorative groups and strips to the exact still twin`, () => {
  const render = options => kind === "atlas" ? svg.renderAtlasCard(densityAtlas(), options) : svg.renderActivityCard({ days: densityDays(), source: "synthetic-demo" }, options);
  const options = { theme: "ember", motionBackend: backend, instanceNamespace: "densityTest" };
  const ambient = render({ ...options, motion: "ambient" });
  const none = render({ ...options, motion: "none" });
  assert.notEqual(ambient, none);
  assert.equal(stripMotion(ambient), none);
  assert.deepEqual(svg.measureCardMotion(ambient, kind), { bytes: Buffer.byteLength(ambient), animatedElements: kind === "atlas" ? 3 : 2, loopingGroups: kind === "atlas" ? 3 : 2 });
  assert.equal(svg.measureCardMotion(none, kind).animatedElements, 0);
  const document = parseSceneXml(ambient);
  const moving = document.nodes.filter(node => /-element-(scan|ornament|beam)$/u.test(node.attrs.id ?? ""));
  assert.equal(moving.length, kind === "atlas" ? 3 : 2);
  assert.ok(moving.every(node => node.attrs["aria-hidden"] === "true"));
  assert.ok(moving.every(node => !/<text|data-density-band/u.test(node.raw)));
  if (backend === "smil") { assert.match(ambient, /repeatDur="45s"/); assert.doesNotMatch(ambient, /<style/); }
  else { assert.match(ambient, /prefers-reduced-motion:reduce/); assert.doesNotMatch(ambient, /animation-iteration-count:infinite/); }
  assert.equal(svg.motionRenderMetadata("ambient", ambient).inlineStyles, backend === "css");
  assert.throws(() => svg.measureCardMotion(ambient.replace(backend === "smil" ? 'dur="5.6s"' : "5600ms", backend === "smil" ? 'dur="56s"' : "56000ms"), kind), /motion|stylesheet|contract/u);
  assert.throws(() => svg.measureCardMotion(ambient.replace("</svg>", `<use href="#${moving[0].attrs.id}"/></svg>`), kind), /motion/u);
});

test("stale, unavailable, empty, and unobserved density cards remain entirely still", () => {
  for (const dataState of ["stale", "unavailable"]) for (const motion of ["subtle", "ambient", "cinematic"]) for (const motionBackend of ["smil", "css"]) {
    for (const output of [svg.renderAtlasCard(densityAtlas({ dataState }), { motion, motionBackend }), svg.renderActivityCard({ days: densityDays(), dataState }, { motion, motionBackend })]) assert.doesNotMatch(output, /<style>|<animate/u);
  }
  for (const days of [[], densityDays(14, () => NaN), densityDays(14, () => 0)]) {
    for (const output of [svg.renderAtlasCard(densityAtlas({ activity: days }), { motion: "ambient" }), svg.renderActivityCard({ days }, { motion: "ambient" })]) assert.doesNotMatch(output, /<animate|@keyframes/u);
  }
});

test("all density bands keep contrast and ordered shades on light and dark cards", () => {
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(byte => parseInt(byte, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  for (const theme of Object.values(svg.themes)) for (const band of ["copper", "gold", "violet"]) {
    const values = CONTRIBUTION_DENSITY_PALETTES[theme.scheme][band].map(luminance);
    const background = luminance(theme.surface);
    for (let i = 0; i < values.length; i++) {
      assert.ok((Math.max(values[i], background) + .05) / (Math.min(values[i], background) + .05) >= 3, `${theme.scheme} ${band} ${i} contrast`);
      if (i) assert.ok(theme.scheme === "dark" ? values[i] > values[i - 1] : values[i] < values[i - 1]);
    }
  }
});

test("a full year of any band or glyph stays inside the instrument byte budget", () => {
  for (const width of [420, 480, 620, 860, 1200]) for (const count of [0, 200, 700, 1500, 999999]) {
    const days = densityDays(365, () => count);
    for (const output of [svg.renderAtlasCard(densityAtlas({ activity: days }), { width, motion: "ambient" }), svg.renderActivityCard({ days }, { width, motion: "ambient" })]) {
      assert.ok(Buffer.byteLength(output) < 30000, `${width}px / ${count} count: ${Buffer.byteLength(output)} bytes`);
      assert.equal(cellCount(output), 365);
      assert.doesNotMatch(output, /<script|<image|<foreignObject|https?:\/\/(?!www\.w3\.org)/u);
    }
  }
});
