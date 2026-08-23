import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCurrentLiveContributions,
  hasCurrentLiveLanguages,
  isStudioCardAvailable,
  isStudioRefreshUnresolved,
  resolveStudioLiveEvidence,
} from "./studio-card-availability";
import type { StudioCardKind } from "./studio-urls";

const kinds: StudioCardKind[] = [
  "atlas",
  "profile",
  "streak",
  "breakdown",
  "rhythm",
  "activity",
  "languages",
  "projects",
];

test("keeps all eight cards available in synthetic mode", () => {
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
    ["atlas", "profile", "streak", "breakdown", "rhythm", "activity", "projects"],
  );
});

test("never reuses contribution evidence after the live configuration changes", () => {
  assert.equal(hasCurrentLiveContributions({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKey: null,
    contributionsPresent: true,
  }), true);
  assert.equal(hasCurrentLiveContributions({
    demo: false,
    currentConfigurationKey: "changed",
    validatedConfigurationKey: "previous",
    unresolvedRefreshKey: null,
    contributionsPresent: true,
  }), false);
  assert.equal(hasCurrentLiveContributions({
    demo: true,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKey: null,
    contributionsPresent: true,
  }), false);
});

test("uses language data only from a complete current live profile", () => {
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKey: null,
    repositoriesTruncated: false,
  }), true);
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKey: null,
    repositoriesTruncated: true,
  }), false);
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "changed",
    validatedConfigurationKey: "previous",
    unresolvedRefreshKey: null,
    repositoriesTruncated: false,
  }), false);
  assert.equal(hasCurrentLiveLanguages({
    demo: true,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKey: null,
    repositoriesTruncated: false,
  }), false);
});

test("treats an unresolved refresh of the current configuration as unconfirmed", () => {
  assert.equal(isStudioRefreshUnresolved({
    currentConfigurationKey: "current",
    unresolvedRefreshKey: "current",
  }), true);
  assert.equal(isStudioRefreshUnresolved({
    currentConfigurationKey: "current",
    unresolvedRefreshKey: null,
  }), false);
  // An unresolved run for a configuration the user has since edited away from
  // is already covered by the validated-key mismatch, not by this flag.
  assert.equal(isStudioRefreshUnresolved({
    currentConfigurationKey: "current",
    unresolvedRefreshKey: "previous",
  }), false);
});

test("withholds live evidence while a same-key refresh is unresolved", () => {
  assert.equal(hasCurrentLiveContributions({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKey: "current",
    contributionsPresent: true,
  }), false);
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKey: "current",
    repositoriesTruncated: false,
  }), false);
});

test("keeps synthetic availability independent of an unresolved refresh", () => {
  const evidence = resolveStudioLiveEvidence({
    demo: true,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKey: "current",
    contributionsPresent: true,
    repositoriesTruncated: false,
  });
  assert.equal(evidence.refreshUnresolved, true);
  assert.deepEqual(
    kinds.filter((kind) => isStudioCardAvailable(kind, { demo: true, ...evidence })),
    kinds,
  );
});
