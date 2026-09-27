import assert from "node:assert/strict";
import test from "node:test";
import { landingThemedAtlasUrl } from "./landing";

test("landingThemedAtlasUrl rejects blank or unshipped theme ids", () => {
  for (const theme of ["", "neon"]) {
    assert.throws(
      () => landingThemedAtlasUrl(theme),
      /landing theme must be a shipped card theme/,
    );
  }
});
