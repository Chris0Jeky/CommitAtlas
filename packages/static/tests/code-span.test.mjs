import assert from "node:assert/strict";
import test from "node:test";
import { codeSpan } from "../dist/index.js";

// CommonMark 0.31.2 section 6.1 normalizes line endings before its padding rule.
// These are direct public-helper inputs; catalog fields already reject controls.
test("code spans normalize LF, CRLF and CR before selecting padding", () => {
  for (const ending of ["\n", "\r\n", "\r"]) {
    assert.equal(codeSpan(`a${ending}b`), "`a b`");
    assert.equal(codeSpan(`${ending}foo${ending}`), "`  foo  `");
    assert.equal(codeSpan(` ${ending} `), "`   `");
    assert.equal(codeSpan(ending), "` `");
    assert.equal(codeSpan(`\`${ending}\``), "`` ` ` ``");
  }
});

test("direct helper text cannot introduce block boundaries outside its code span", () => {
  const value = "a`\n\n# injected\r\n[link](https://example.invalid)\r`b";
  const rendered = codeSpan(value);
  assert.equal(rendered, "``a`  # injected [link](https://example.invalid) `b``");
  assert.doesNotMatch(rendered, /[\r\n]/);
  assert.equal(codeSpan(" \t "), "`  \t  `");
  assert.equal(codeSpan("\u00a0"), "`\u00a0`");
  assert.throws(() => codeSpan(""), /empty value/);
});
