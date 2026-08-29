import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures", "motion-probes");
const probes = {
  "css-enter.svg": ["@keyframes enter", "animation: enter", "READABLE AT ZERO"],
  "css-breathe.svg": ["@keyframes breathe", "animation: breathe", "72"],
  "css-plot.svg": ["@keyframes plot", "stroke-dashoffset", "TRACE PRESENT AT ZERO"],
  "css-from-state-control.svg": ["@keyframes reveal", "both", "STATIC BASELINE IS READABLE"],
  "smil-transform.svg": ["animateTransform", "COMPASS IS PRESENT AT ZERO"],
  "smil-plot.svg": ["<animate", "stroke-dashoffset", "TRACE PRESENT AT ZERO"],
  "smil-animate-motion.svg": ["animateMotion", "ROUTE IS PRESENT AT ZERO"],
  "css-offset-path.svg": ["offset-path", "offset-distance", "ROUTE IS PRESENT AT ZERO"],
  "reduced-motion-control.svg": ["REDUCED MOTION", "STATIC SOURCE SELECTED"],
};

test("motion probes remain synthetic, single-effect fixtures with a readable frame zero", async () => {
  for (const [file, expectations] of Object.entries(probes)) {
    const svg = await readFile(path.join(fixtureDirectory, file), "utf8");
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<title id="title">/);
    assert.match(svg, /<desc id="desc">/);
    for (const expected of expectations) assert.ok(svg.includes(expected), `${file} must include ${expected}`);
  }
});

test("fixture index supports both image embedding paths and declares the reduced-motion source", async () => {
  const index = await readFile(path.join(fixtureDirectory, "index.html"), "utf8");
  assert.match(index, /embed === "img"/);
  assert.match(index, /<picture>/);
  assert.match(index, /prefers-color-scheme: dark/);
  assert.match(index, /prefers-reduced-motion: reduce/);
});
