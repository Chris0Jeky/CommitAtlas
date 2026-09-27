import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, truncateText } from "../dist/index.js";

test("canonicalJson rejects symbol-keyed object data", () => {
  const hidden = Symbol("hidden");
  const value = { visible: 1 };
  value[hidden] = 2;

  assert.throws(() => canonicalJson(value), /symbol keys/u);
});

test("truncateText handles the one-character boundary without splitting Unicode", () => {
  assert.equal(truncateText("hello", 1), "…");
  assert.equal(truncateText("😀a", 1), "…");
  assert.equal(truncateText("😀", 1), "😀");
});
