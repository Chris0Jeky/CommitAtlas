import test from "node:test";
import assert from "node:assert/strict";
import { renderDeliveryCard } from "../dist/index.js";
import { deliveryFixture, emptyDeliveryFixture } from "./delivery.fixture.mjs";

const injection = `<img src=x onerror="alert(1)"><script>alert(2)</script>&"'\u0000\u0008\ud800`;

function assertXml10(output) {
  for (const character of output) {
    const codePoint = character.codePointAt(0);
    assert.ok(
      codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff),
      `forbidden XML 1.0 character U+${codePoint.toString(16).toUpperCase()}`,
    );
  }
}

const XML_ENTITY = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/;
const XML_TAG = /^<(\/?)([A-Za-z][\w:.-]*)((?:\s+[A-Za-z][\w:.-]*\s*=\s*"[^"<]*")*)\s*(\/?)>/;

function assertWellFormedXml(output) {
  const stack = [];
  let index = 0;
  while (index < output.length) {
    const open = output.indexOf("<", index);
    const textRun = output.slice(index, open === -1 ? output.length : open);
    assert.doesNotMatch(textRun, />/, "unescaped '>' in text content");
    assert.doesNotMatch(textRun, XML_ENTITY, "unescaped '&' in text content");
    if (open === -1) break;
    const tag = XML_TAG.exec(output.slice(open));
    assert.ok(tag, `malformed tag at offset ${open}: ${JSON.stringify(output.slice(open, open + 90))}`);
    const [matched, closing, name, attributes, selfClosing] = tag;
    assert.doesNotMatch(attributes, XML_ENTITY, `unescaped '&' in <${name}> attributes`);
    if (closing) assert.equal(stack.pop(), name, `mismatched closing tag </${name}>`);
    else if (!selfClosing) stack.push(name);
    index = open + matched.length;
  }
  assert.deepEqual(stack, [], `unclosed elements: ${stack.join(", ")}`);
}

const GEOMETRY_ATTRIBUTE = /\s(stroke-dasharray|stroke-width|height|width|x1|y1|x2|y2|cx|cy|rx|x|y|r)="([^"]*)"/g;

function assertFiniteGeometry(output) {
  let inspected = 0;
  for (const [, name, value] of output.matchAll(GEOMETRY_ATTRIBUTE)) {
    for (const token of value.trim().split(/\s+/)) {
      assert.ok(Number.isFinite(Number(token)), `non-finite ${name} attribute value ${JSON.stringify(token)}`);
    }
    inspected += 1;
  }
  assert.ok(inspected > 0, "expected geometry attributes to inspect");
}

function assertSafeDeliverySvg(output, { allowStyle = false } = {}) {
  assert.match(output, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" role="img"/);
  assert.match(output, /aria-label="[^"]+"/);
  assert.match(output, /<title>/);
  assert.match(output, /<desc>/);
  assert.doesNotMatch(output, /\bid=/);
  assert.match(output, /viewBox="0 0 \d+ \d+"/);
  assert.match(output, /<\/svg>$/);
  const forbiddenPatterns = [/<script/i, /<foreignObject/i, /<image/i, /\bon[a-z]+\s*=\s*["']/i, /javascript:/i, /data:/i];
  if (!allowStyle) forbiddenPatterns.push(/<style/i);
  for (const forbidden of forbiddenPatterns) {
    assert.doesNotMatch(output, forbidden, `forbidden SVG construct matched: ${forbidden}`);
  }
  assertXml10(output);
  assertWellFormedXml(output);
  assertFiniteGeometry(output);
  const bytes = Buffer.byteLength(output, "utf8");
  assert.ok(bytes < 30_000, `delivery SVG exceeded 30KB budget (${bytes} UTF-8 bytes)`);
}

function assertReadableFloor(output) {
  const sizes = [...output.matchAll(/font-size="([0-9.]+)"/g)].map((match) => Number(match[1]));
  assert.ok(sizes.length > 0, "expected visible text in the delivery card");
  assert.ok(Math.min(...sizes) >= 9.5, `delivery text fell below 9.5px: ${sizes.join(", ")}`);
}

test("delivery card presents the focal rate, comparison, supporting evidence, and non-claim accessibly", () => {
  const output = renderDeliveryCard(deliveryFixture(), { theme: "ember", width: 860, motion: "none" });
  assertSafeDeliverySvg(output);
  assert.match(output, /<title>Delivery evidence for Chris0Jeky<\/title>/);
  assert.match(output, /aria-label="Delivery evidence for Chris0Jeky"/);
  assert.match(output, /DELIVERY EVIDENCE/);
  assert.match(output, />12\.0</);
  assert.match(output, /PRS \/ WEEK/);
  assert.match(output, /5\.5× DATED BENCHMARK/);
  assert.match(output, /90\.9%/);
  assert.match(output, /88\.0%/);
  assert.match(output, />10 OPEN</);
  assert.match(output, /0\.83 merge-weeks at 7d rate/);
  assert.match(output, /100\.0%/);
  assert.match(output, /2 CONFIGURED PUBLIC REPOS/);
  assert.match(output, /2026-09-15 → 2026-09-21/);
  assert.match(output, /14→12 · 12\.0\/wk/);
  assert.match(output, /50→44 · 10\.3\/wk/);
  assert.match(output, /88→72 · 5\.6\/wk/);
  assert.match(output, /120→100 · 1\.9\/wk/);
  assert.match(output, /LIFETIME 120 AUTHORED · 100 MERGED · 110 CLOSED · 10 OPEN · 4 DRAFTS/);
  assert.match(output, /BENCHMARK JELLYFISH RESEARCH · 2\.2\/WK · 2026-03-17/);
  assert.match(output, /GITHUB GRAPHQL · 15 QUERIES · REFRESHED 2026-09-21/);
  assert.match(output, /ACTIVITY FLOW · NOT QUALITY OR IMPACT/);
  const desc = output.match(/<desc>([\s\S]*)<\/desc>/)[1];
  assert.match(desc, /12\.0 merged pull requests per week during 2026-09-15 → 2026-09-21/);
  assert.match(desc, /5\.5 times the dated Jellyfish high-AI-adoption organisations reference/);
  assert.match(desc, /More than 700 companies/);
  assert.match(desc, /not a global percentile/);
  assert.match(desc, /not a measure of code quality/);
  assert.match(desc, /jellyfish\.co\/newsroom/);
  assert.match(desc, /Chris0Jeky\/CommitAtlas, Chris0Jeky\/Taskdeck/);
  assert.match(desc, /activity flow, not quality or impact/);
});

test("delivery card supports dark/light themes and the compact layout", () => {
  const wide = renderDeliveryCard(deliveryFixture(), { theme: "paper", width: 860, motion: "none" });
  const compact = renderDeliveryCard(deliveryFixture(), { theme: "paper", width: 480, motion: "none" });
  assertSafeDeliverySvg(wide);
  assertSafeDeliverySvg(compact);
  assert.match(wide, /viewBox="0 0 860 400"/);
  assert.match(compact, /viewBox="0 0 480 580"/);
  assert.match(wide, /#dfe4c9/);
  assert.match(compact, /#dfe4c9/);
  for (const output of [wide, compact]) {
    assert.match(output, />12\.0</);
    assert.match(output, /5\.5× DATED BENCHMARK/);
    assert.match(output, /ACTIVITY FLOW · NOT QUALITY OR IMPACT/);
    assertReadableFloor(output);
  }
  const dark = renderDeliveryCard(deliveryFixture(), { theme: "midnight", width: 860, motion: "none" });
  assertSafeDeliverySvg(dark);
  assert.notEqual(dark, wide);
  assert.match(dark, /#05070d/);
  assert.match(dark, /#d9caff/);
});

test("delivery card renders unknown ratios without NaN or Infinity", () => {
  const output = renderDeliveryCard(emptyDeliveryFixture(), { theme: "aurora", width: 860, motion: "none" });
  assertSafeDeliverySvg(output);
  assert.match(output, /UNAVAILABLE/);
  assert.match(output, />0\.0</);
  assert.match(output, /0\.0× DATED BENCHMARK/);
  assert.match(output, /merge-weeks unavailable/);
  assert.match(output, /LIFETIME 0 AUTHORED · 0 MERGED · 0 CLOSED · 0 OPEN/);
  assert.doesNotMatch(output, /NaN|Infinity/);
  assert.match(output, /<desc>[^<]*unavailable/);
});

test("delivery card states missing windows as unknown and requires the focal week", () => {
  const snapshot = structuredClone(deliveryFixture());
  snapshot.windows = snapshot.windows.filter(({ days }) => days !== 30);
  snapshot.lifetime.open = Number.NaN;
  const output = renderDeliveryCard(snapshot, { theme: "aurora", width: 860, motion: "none" });
  assertSafeDeliverySvg(output);
  assert.match(output, /30D · UNKNOWN/);
  assert.match(output, /not observed/);
  assert.match(output, />UNKNOWN</);
  assert.match(output, /0\.83 merge-weeks at 7d rate/);
  assert.doesNotMatch(output, /NaN|Infinity/);
  assert.throws(
    () => renderDeliveryCard({ ...snapshot, windows: [] }, { theme: "aurora" }),
    /requires a 7-day window/,
  );
});

test("delivery card escapes hostile benchmark and login text and bounds overlong input", () => {
  // Hostile values ride a clone past evidence validation: the package boundary, not the
  // collector, is what must contain them.
  const snapshot = structuredClone(deliveryFixture());
  snapshot.login = `Chris0Jeky${"A".repeat(500)}`;
  snapshot.benchmark = { ...snapshot.benchmark, label: injection, population: "A & B < C" };
  snapshot.scope = {
    kind: "configured-public-repositories",
    repositories: [injection, `Chris0Jeky/${"B".repeat(500)}`],
  };
  const hostile = renderDeliveryCard(snapshot, { theme: "midnight", width: 860, motion: "none" });
  assertSafeDeliverySvg(hostile);
  assert.match(hostile, /&lt;script&gt;/);
  assert.match(hostile, /&lt;img src=x onerror=/);
  assert.doesNotMatch(hostile, /<script>/);
  assert.match(hostile, /A &amp; B &lt; C/);
  assert.doesNotMatch(hostile, /A{200}|B{200}/, "unbounded caller text reached the rendered card");
  assert.match(hostile, /…/, "truncation must stay visible instead of dropping text silently");
  const narrow = renderDeliveryCard(snapshot, { theme: "aurora", width: 420, motion: "none" });
  assertSafeDeliverySvg(narrow);
  assertReadableFloor(narrow);
});

test("delivery card keeps non-finite direct-caller numerics out of the rendered SVG", () => {
  for (const value of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN, -5]) {
    const snapshot = structuredClone(deliveryFixture());
    snapshot.lifetime = { authored: value, merged: value, closed: value, closedWithoutMerge: value, open: value, drafts: value };
    snapshot.derived = {
      resolvedMergeConversion: value,
      integrationBalance30: value,
      wipMergeWeeks: value,
      topTwoConcentration30: value,
      topSixConcentration30: value,
      benchmarkMultiple7: value,
    };
    snapshot.windows = snapshot.windows.map((window) => ({ ...window, opened: value, merged: value, mergedPerWeek: value }));
    snapshot.source = { provider: "github-graphql", metric: "pull-request-search-counts", queryCount: value };
    const output = renderDeliveryCard(snapshot, { theme: "aurora", width: 860, motion: "none" });
    assertSafeDeliverySvg(output);
    assert.doesNotMatch(output, /NaN|Infinity/, `non-finite ${String(value)} leaked into the card`);
    assert.match(output, /UNKNOWN|UNAVAILABLE/);
  }
});

test("delivery card supports frozen-motion-safe subtle motion", () => {
  const animated = renderDeliveryCard(deliveryFixture(), { theme: "aurora", width: 860, motion: "subtle" });
  assert.match(animated, /@keyframes card-enter/);
  assert.match(animated, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(animated, /\bboth\b|backwards|from\{[^}]*opacity|from\{[^}]*scale/);
  assert.match(animated, /<g class="card-enter">/);
  assertSafeDeliverySvg(animated, { allowStyle: true });
  const still = renderDeliveryCard(deliveryFixture(), { theme: "aurora", width: 860, motion: "none" });
  assert.doesNotMatch(still, /<style>|@keyframes|animation:/);
  assertSafeDeliverySvg(still);
});

test("delivery card never claims productivity, quality, effort, or impact", () => {
  const wide = renderDeliveryCard(deliveryFixture(), { theme: "aurora", width: 860, motion: "none" });
  const compact = renderDeliveryCard(deliveryFixture(), { theme: "paper", width: 480, motion: "none" });
  const empty = renderDeliveryCard(emptyDeliveryFixture(), { theme: "midnight", width: 860, motion: "none" });
  for (const output of [wide, compact, empty]) {
    assert.doesNotMatch(output, /productiv/i);
    assert.doesNotMatch(output, /velocit/i);
    assert.doesNotMatch(output, /efficien/i);
    assert.doesNotMatch(output, /outperform/i);
    assert.doesNotMatch(output, /above average/i);
    assert.doesNotMatch(output, /top performer/i);
    assert.doesNotMatch(output, /throughput is[^.]*success/i);
  }
});

test("delivery integration balance above 100% is never silently capped", () => {
  const snapshot = structuredClone(deliveryFixture());
  snapshot.derived = { ...snapshot.derived, integrationBalance30: 1.5 };
  const output = renderDeliveryCard(snapshot, { theme: "aurora", width: 860, motion: "none" });
  assertSafeDeliverySvg(output);
  assert.match(output, /150\.0%/);
});
