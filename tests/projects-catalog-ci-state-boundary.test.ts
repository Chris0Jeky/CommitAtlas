import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleStaticPortfolio,
  buildProjectCatalog,
  parseStaticConfig,
} from "@commit-atlas/static";
import {
  demoContributions,
  demoProfile,
  demoProjects,
  type PortfolioSnapshot,
} from "@commit-atlas/github";

const NOW = new Date("2026-08-20T12:00:00.000Z");
const VALID_CI_STATES = [
  "unavailable",
  "unconfigured",
  "stale",
  "passing",
  "failing",
  "pending",
] as const;

function fixture(): {
  snapshot: PortfolioSnapshot;
  config: ReturnType<typeof parseStaticConfig>;
} {
  return {
    snapshot: assembleStaticPortfolio(
      demoProfile("octocat", NOW),
      demoContributions("octocat", 30, NOW),
      demoProjects(
        "octocat",
        ["atlas"],
        new Map([["atlas", "active"]]),
        new Map(),
        NOW,
      ),
    ),
    config: parseStaticConfig({
      version: 1,
      user: "octocat",
      outputDir: "assets/commitatlas",
      projects: [{ repo: "octocat/atlas", label: "Atlas", lifecycle: "active" }],
    }),
  };
}

test("project catalog rejects an out-of-contract CI state", () => {
  const { snapshot, config } = fixture();
  const ci = snapshot.projects!.projects[0]!.ci as unknown as { state: string };
  ci.state = "passing-by-typo";

  assert.throws(
    () => buildProjectCatalog(snapshot, config),
    /CI state is invalid/,
  );
});

test("project catalog preserves every state in the closed CI vocabulary", () => {
  for (const state of VALID_CI_STATES) {
    const { snapshot, config } = fixture();
    const ci = snapshot.projects!.projects[0]!.ci as unknown as { state: string };
    ci.state = state;
    assert.equal(buildProjectCatalog(snapshot, config).projects[0]!.ci.state, state);
  }
});
