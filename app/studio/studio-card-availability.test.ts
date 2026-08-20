import assert from "node:assert/strict";
import test from "node:test";
import { hasCurrentLiveContributions, isStudioCardAvailable } from "./studio-card-availability";
import type { StudioCardKind } from "./studio-urls";

const kinds: StudioCardKind[] = ["profile", "streak", "activity", "languages", "projects"];

test("keeps all five cards available in synthetic mode", () => {
  assert.deepEqual(
    kinds.filter((kind) => isStudioCardAvailable(kind, { demo: true, hasCurrentContributions: false })),
    kinds,
  );
});

test("omits only contribution-backed cards from an unavailable live preview", () => {
  assert.deepEqual(
    kinds.filter((kind) => isStudioCardAvailable(kind, { demo: false, hasCurrentContributions: false })),
    ["profile", "languages", "projects"],
  );
});

test("restores contribution-backed cards after a successful live contribution preview", () => {
  assert.deepEqual(
    kinds.filter((kind) => isStudioCardAvailable(kind, { demo: false, hasCurrentContributions: true })),
    kinds,
  );
});

test("never reuses contribution evidence after the live configuration changes", () => {
  assert.equal(hasCurrentLiveContributions({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    contributionsPresent: true,
  }), true);
  assert.equal(hasCurrentLiveContributions({
    demo: false,
    currentConfigurationKey: "changed",
    validatedConfigurationKey: "previous",
    contributionsPresent: true,
  }), false);
  assert.equal(hasCurrentLiveContributions({
    demo: true,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    contributionsPresent: true,
  }), false);
});
