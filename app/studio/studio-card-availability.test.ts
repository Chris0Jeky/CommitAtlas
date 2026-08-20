import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCurrentLiveContributions,
  hasCurrentLiveLanguages,
  isStudioCardAvailable,
} from "./studio-card-availability";
import type { StudioCardKind } from "./studio-urls";

const kinds: StudioCardKind[] = ["profile", "streak", "activity", "languages", "projects"];

test("keeps all five cards available in synthetic mode", () => {
  assert.deepEqual(
    kinds.filter((kind) => isStudioCardAvailable(kind, {
      demo: true,
      hasCurrentContributions: false,
      hasCurrentLanguages: false,
    })),
    kinds,
  );
});

test("omits only contribution-backed cards from an unavailable live preview", () => {
  assert.deepEqual(
    kinds.filter((kind) => isStudioCardAvailable(kind, {
      demo: false,
      hasCurrentContributions: false,
      hasCurrentLanguages: true,
    })),
    ["profile", "languages", "projects"],
  );
});

test("restores contribution-backed cards after a successful live contribution preview", () => {
  assert.deepEqual(
    kinds.filter((kind) => isStudioCardAvailable(kind, {
      demo: false,
      hasCurrentContributions: true,
      hasCurrentLanguages: true,
    })),
    kinds,
  );
});

test("omits Languages when a live preview has only a truncated repository list", () => {
  assert.deepEqual(
    kinds.filter((kind) => isStudioCardAvailable(kind, {
      demo: false,
      hasCurrentContributions: true,
      hasCurrentLanguages: false,
    })),
    ["profile", "streak", "activity", "projects"],
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

test("uses language data only from a complete current live profile", () => {
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    repositoriesTruncated: false,
  }), true);
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    repositoriesTruncated: true,
  }), false);
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "changed",
    validatedConfigurationKey: "previous",
    repositoriesTruncated: false,
  }), false);
  assert.equal(hasCurrentLiveLanguages({
    demo: true,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    repositoriesTruncated: false,
  }), false);
});
