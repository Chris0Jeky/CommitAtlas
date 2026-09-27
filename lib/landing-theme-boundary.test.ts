import assert from "node:assert/strict";
import test from "node:test";
import { landingThemedAtlasUrl } from "./landing";

test("landingThemedAtlasUrl rejects blank or unshipped theme ids", () => {
  for (const theme of ["", "neon"]) {
    assert.throws(
      () => landingThemedAtlasUrl(theme as never),
      /landing theme must be a shipped card theme/,
    );
  }
});

test("landingThemedAtlasUrl preserves every shipped theme", () => {
  for (const theme of ["aurora", "midnight", "paper", "ember"] as const) {
    const url = new URL(`https://example.test${landingThemedAtlasUrl(theme)}`);
    assert.equal(url.pathname, "/api/v1/cards/atlas.svg");
    assert.equal(url.searchParams.get("theme"), theme);
    assert.equal(url.searchParams.get("user"), "octocat");
    assert.equal(url.searchParams.get("demo"), "true");
    assert.equal(url.searchParams.get("days"), "365");
    assert.equal(url.searchParams.get("motion"), "subtle");
    assert.equal(url.searchParams.get("layout"), "wide");
  }
});
