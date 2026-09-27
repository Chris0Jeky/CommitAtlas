import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudioConfigurationKey,
  buildStudioRouteUrl,
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

test("case-equivalent Studio configurations emit byte-identical URLs", () => {
  assert.equal(buildStudioConfigurationKey(mixedCase), buildStudioConfigurationKey(lowerCase));

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
    assert.equal(
      buildStudioRouteUrl(kind, mixedCase),
      buildStudioRouteUrl(kind, lowerCase),
      `${kind} changed despite an equivalent validation key`,
    );
  }
  assert.equal(
    buildStudioRouteUrl("projects", mixedCase, "json"),
    buildStudioRouteUrl("projects", lowerCase, "json"),
    "the project JSON URL changed despite an equivalent validation key",
  );
});
