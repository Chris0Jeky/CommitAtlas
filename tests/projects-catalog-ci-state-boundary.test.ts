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

test("project catalog rejects an out-of-contract CI state", () => {
  const snapshot: PortfolioSnapshot = assembleStaticPortfolio(
    demoProfile("octocat", NOW),
    demoContributions("octocat", 30, NOW),
    demoProjects(
      "octocat",
      ["atlas"],
      new Map([["atlas", "active"]]),
      new Map(),
      NOW,
    ),
  );
  const config = parseStaticConfig({
    version: 1,
    user: "octocat",
    outputDir: "assets/commitatlas",
    projects: [{ repo: "octocat/atlas", label: "Atlas", lifecycle: "active" }],
  });
  const ci = snapshot.projects!.projects[0]!.ci as unknown as { state: string };
  ci.state = "passing-by-typo";

  assert.throws(
    () => buildProjectCatalog(snapshot, config),
    /CI state is invalid/,
  );
});
