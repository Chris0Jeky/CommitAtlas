import assert from "node:assert/strict";
import test from "node:test";

import { JSON_LD_GRAPH, serializeJsonLd } from "./structured-data";

/** The literal six characters a JSON escape is, built so no source-level escaping can collapse it. */
const ESCAPE_SEQUENCE = String.fromCharCode(92) + "u003c";

/**
 * The escape in `serializeJsonLd` cannot be covered by asserting on the rendered page.
 *
 * Today's graph contains no `<`, so deleting the escape produces byte-identical output and every
 * page-level assertion still passes — an adversarial review confirmed exactly that against an
 * earlier version of these tests. The control only becomes observable when a hostile value is fed
 * through it, which is why the serializer is exported as a pure function.
 */
test("a hostile value cannot close the surrounding script element", () => {
  const payload = "</script><script>alert(1)</script>";
  const serialized = serializeJsonLd({ featureList: [payload] });

  // The literal sequence that would end the element early must not survive, in any casing.
  assert.doesNotMatch(serialized, /<\/script/i);
  // Nor may an opening tag, an HTML comment, or a CDATA terminator.
  assert.doesNotMatch(serialized, /<script/i);
  assert.doesNotMatch(serialized, /<!--/);
  // The strongest form: no unescaped `<` at all. This is the invariant the escape actually provides.
  assert.doesNotMatch(serialized, /</);

  // And the escape must not corrupt the data — a JSON parser reads the original value back.
  assert.deepEqual(JSON.parse(serialized), { featureList: [payload] });
});

test("the escape survives every context a `<` can appear in", () => {
  for (const value of [
    { key: "<" },
    { "<key>": "value" },
    { nested: { deep: ["<", "</script>"] } },
    { unicode: "<" },
    // A value already containing the six-character escape sequence must round-trip unharmed.
    { literal: ESCAPE_SEQUENCE, alsoRaw: ESCAPE_SEQUENCE + "<" },
  ]) {
    const serialized = serializeJsonLd(value);
    assert.doesNotMatch(serialized, /</, `an unescaped < survived for ${JSON.stringify(value)}`);
    assert.deepEqual(JSON.parse(serialized), value);
  }
});

test("the real graph serializes to valid JSON with no angle brackets", () => {
  const serialized = serializeJsonLd(JSON_LD_GRAPH);
  assert.doesNotMatch(serialized, /</);
  const parsed = JSON.parse(serialized);
  assert.equal(parsed["@context"], "https://schema.org");
  assert.deepEqual(parsed["@graph"].map((node: { "@type": string }) => node["@type"]), [
    "SoftwareApplication",
    "WebSite",
  ]);
});

test("the graph claims no rating or review it cannot evidence", () => {
  for (const node of JSON_LD_GRAPH["@graph"] as Record<string, unknown>[]) {
    assert.equal(node.aggregateRating, undefined);
    assert.equal(node.review, undefined);
    assert.equal(node.ratingValue, undefined);
  }
});
