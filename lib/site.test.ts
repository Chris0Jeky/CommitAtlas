import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SITE_ORIGIN, resolveSiteOrigin } from "./site";

/**
 * The canonical origin is deployment configuration, so the resolver is the whole trust boundary.
 * A malformed value here does not break one link — it corrupts every canonical URL, every sitemap
 * entry, and the JSON-LD `url` at the same time, so anything it cannot parse confidently must fall
 * back rather than be half-honoured.
 */
test("an unset or blank origin uses the project default", () => {
  for (const value of [undefined, "", "   ", "\t\n"]) {
    assert.equal(resolveSiteOrigin(value), DEFAULT_SITE_ORIGIN);
  }
});

test("a well-formed https origin is honoured, with surrounding whitespace tolerated", () => {
  assert.equal(resolveSiteOrigin("https://atlas.example.com"), "https://atlas.example.com");
  assert.equal(resolveSiteOrigin("  https://atlas.example.com  "), "https://atlas.example.com");
  // A trailing slash is the origin, not a path, and must not be refused.
  assert.equal(resolveSiteOrigin("https://atlas.example.com/"), "https://atlas.example.com");
  // A fork's own workers.dev subdomain is the case this exists for.
  assert.equal(
    resolveSiteOrigin("https://commit-atlas.someone-else.workers.dev"),
    "https://commit-atlas.someone-else.workers.dev",
  );
  // A non-default port is part of the origin and is preserved.
  assert.equal(resolveSiteOrigin("https://atlas.example.com:8443"), "https://atlas.example.com:8443");
});

test("anything that is not a bare https origin falls back rather than emitting a broken canonical", () => {
  for (const value of [
    "http://atlas.example.com", // plaintext: every canonical link would downgrade the site
    "ftp://atlas.example.com",
    "javascript:alert(1)",
    "atlas.example.com", // no scheme at all
    "https://atlas.example.com/base", // `new URL(...).origin` would silently discard the path
    "https://atlas.example.com/?utm=1",
    "https://atlas.example.com/#top",
    "not a url",
    "https://",
    "https://[malformed",
  ]) {
    assert.equal(resolveSiteOrigin(value), DEFAULT_SITE_ORIGIN, `should have fallen back: ${value}`);
  }
});

test("the resolved origin is always usable as a URL base", () => {
  for (const value of [undefined, "https://atlas.example.com", "http://insecure.example.com", "junk"]) {
    const origin = resolveSiteOrigin(value);
    assert.doesNotThrow(() => new URL("/studio", origin));
    assert.equal(new URL("/studio", origin).href, `${origin}/studio`);
    assert.ok(origin.startsWith("https://"));
    assert.doesNotMatch(origin, /\/$/, "an origin with a trailing slash would produce doubled paths");
  }
});
