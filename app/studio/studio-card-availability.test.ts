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
    unresolvedRefreshKeys: new Set<string>(),
    contributionsPresent: true,
  }), true);
  assert.equal(hasCurrentLiveContributions({
    demo: false,
    currentConfigurationKey: "changed",
    validatedConfigurationKey: "previous",
    unresolvedRefreshKeys: new Set<string>(),
    contributionsPresent: true,
  }), false);
  assert.equal(hasCurrentLiveContributions({
    demo: true,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKeys: new Set<string>(),
    contributionsPresent: true,
  }), false);
});

test("uses language data only from a complete current live profile", () => {
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKeys: new Set<string>(),
    repositoriesTruncated: false,
  }), true);
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKeys: new Set<string>(),
    repositoriesTruncated: true,
  }), false);
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "changed",
    validatedConfigurationKey: "previous",
    unresolvedRefreshKeys: new Set<string>(),
    repositoriesTruncated: false,
  }), false);
  assert.equal(hasCurrentLiveLanguages({
    demo: true,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKeys: new Set<string>(),
    repositoriesTruncated: false,
  }), false);
});

test("treats an unresolved refresh of the current configuration as unconfirmed", () => {
  assert.equal(isStudioRefreshUnresolved({
    currentConfigurationKey: "current",
    unresolvedRefreshKeys: new Set(["current"]),
  }), true);
  assert.equal(isStudioRefreshUnresolved({
    currentConfigurationKey: "current",
    unresolvedRefreshKeys: new Set<string>(),
  }), false);
  // An unresolved run for a configuration the user has since edited away from
  // is already covered by the validated-key mismatch, not by this flag.
  assert.equal(isStudioRefreshUnresolved({
    currentConfigurationKey: "current",
    unresolvedRefreshKeys: new Set(["previous"]),
  }), false);
});

test("tracks every unconfirmed configuration, not just the newest run", () => {
  // A later run elsewhere must not make an earlier unconfirmed configuration
  // look settled once the user navigates back to it.
  const unresolved = new Set(["first", "second"]);
  assert.equal(isStudioRefreshUnresolved({ currentConfigurationKey: "first", unresolvedRefreshKeys: unresolved }), true);
  assert.equal(isStudioRefreshUnresolved({ currentConfigurationKey: "second", unresolvedRefreshKeys: unresolved }), true);
  assert.equal(isStudioRefreshUnresolved({ currentConfigurationKey: "third", unresolvedRefreshKeys: unresolved }), false);
});

test("withholds live evidence while a same-key refresh is unresolved", () => {
  assert.equal(hasCurrentLiveContributions({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKeys: new Set(["current"]),
    contributionsPresent: true,
  }), false);
  assert.equal(hasCurrentLiveLanguages({
    demo: false,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKeys: new Set(["current"]),
    repositoriesTruncated: false,
  }), false);
});

// A guard, not coverage of the unresolved-evidence change: isStudioCardAvailable
// short-circuits on `demo`, so this holds with or without that change.
test("keeps synthetic availability independent of an unresolved refresh", () => {
  const evidence = resolveStudioLiveEvidence({
    demo: true,
    currentConfigurationKey: "current",
    validatedConfigurationKey: "current",
    unresolvedRefreshKeys: new Set(["current"]),
    contributionsPresent: true,
    repositoriesTruncated: false,
  });
  assert.equal(evidence.refreshUnresolved, true);
  assert.deepEqual(
    kinds.filter((kind) => isStudioCardAvailable(kind, { demo: true, ...evidence })),
    kinds,
  );
});
