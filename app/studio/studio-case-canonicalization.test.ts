import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudioConfigurationKey,
  buildStudioRouteUrl,
  isStudioPreviewCurrent,
  type StudioCardKind,
  type StudioRouteOptions,
} from "./studio-urls";

const mixedCase: StudioRouteOptions = {
  owner: "OctoCat",
  theme: "ember",
  demo: false,
  days: 365,
  motion: "subtle",
  layout: "wide",
  projects: [{ repo: "Hello-World", lifecycle: "active", workflow: "CI.yml" }],
};

const lowerCase: StudioRouteOptions = {
  ...mixedCase,
  owner: "octocat",
  projects: [{ repo: "hello-world", lifecycle: "active", workflow: "CI.yml" }],
};

test("case-only Studio edits require fresh validation for their changed URLs", () => {
  const mixedKey = buildStudioConfigurationKey(mixedCase);
  const lowerKey = buildStudioConfigurationKey(lowerCase);
  assert.notEqual(mixedKey, lowerKey);
  assert.equal(isStudioPreviewCurrent(lowerKey, { key: mixedKey }), false);

  const kinds: readonly StudioCardKind[] = [
    "atlas",
    "profile",
    "streak",
    "breakdown",
    "rhythm",
    "activity",
    "languages",
    "projects",
  ];
  for (const kind of kinds) {
    assert.notEqual(
      buildStudioRouteUrl(kind, mixedCase),
      buildStudioRouteUrl(kind, lowerCase),
      `${kind} URL did not reflect its case-only identity edit`,
    );
  }
  assert.notEqual(
    buildStudioRouteUrl("projects", mixedCase, "json"),
    buildStudioRouteUrl("projects", lowerCase, "json"),
  );
});

test("Studio route identity trims surrounding whitespace consistently", () => {
  const spaced: StudioRouteOptions = {
    ...lowerCase,
    owner: " octocat ",
    projects: [{ repo: " hello-world ", lifecycle: "active", workflow: " CI.yml " }],
  };
  assert.equal(buildStudioConfigurationKey(spaced), buildStudioConfigurationKey(lowerCase));
  assert.equal(buildStudioRouteUrl("atlas", spaced), buildStudioRouteUrl("atlas", lowerCase));
});
