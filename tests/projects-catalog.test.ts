import assert from "node:assert/strict";
import test from "node:test";
import {
  PROJECT_CATALOG_VERSION,
  assembleStaticPortfolio,
  buildProjectCatalog,
  codeSpan,
  parseStaticConfig,
  renderProjectCatalogArtifacts,
  type StaticConfig,
} from "@commit-atlas/static";
import {
  demoContributions,
  demoProfile,
  demoProjects,
  type PortfolioSnapshot,
  type ProjectLifecycle,
} from "@commit-atlas/github";

const NOW = new Date("2026-08-20T12:00:00.000Z");

function demoSnapshot(
  repos: readonly string[] = ["atlas", "quiet"],
  lifecycles: Record<string, ProjectLifecycle> = { atlas: "active", quiet: "maintenance" },
): PortfolioSnapshot {
  const profile = demoProfile("octocat", NOW);
  const contributions = demoContributions("octocat", 30, NOW);
  const board = demoProjects(
    "octocat",
    repos,
    new Map(Object.entries(lifecycles)),
    new Map(),
    NOW,
  );
  return assembleStaticPortfolio(profile, contributions, board);
}

function catalogConfig(
  entries: ReadonlyArray<{ repo: string; label: string; lifecycle: ProjectLifecycle }> = [
    { repo: "octocat/atlas", label: "Atlas", lifecycle: "active" },
    { repo: "octocat/quiet", label: "Quiet", lifecycle: "maintenance" },
  ],
): StaticConfig {
  return parseStaticConfig({
    version: 1,
    user: "octocat",
    outputDir: "assets/commitatlas",
    projects: entries.map((entry) => ({ ...entry })),
  });
}

test("codeSpan wraps a plain value in single backticks", () => {
  assert.equal(codeSpan("plain"), "`plain`");
});

test("codeSpan lengthens the fence around a value containing one backtick", () => {
  assert.equal(codeSpan("has ` one"), "``has ` one``");
});

test("codeSpan lengthens the fence past a run of backticks", () => {
  assert.equal(codeSpan("a `` b"), "```a `` b```");
});

test("codeSpan pads a value starting or ending with a backtick", () => {
  assert.equal(codeSpan("`edge`"), "`` `edge` ``");
  assert.equal(codeSpan("`leading"), "`` `leading ``");
});

test("codeSpan keeps a pipe or newline inside a single-backtick span", () => {
  assert.equal(codeSpan("a|b"), "`a|b`");
  assert.equal(codeSpan("a\nb"), "`a\nb`");
});

test("codeSpan rejects an empty value", () => {
  assert.throws(() => codeSpan(""), /empty value as a Markdown code span/);
});

test("buildProjectCatalog pins version, generator, source, user and configured order", () => {
  const snapshot = demoSnapshot();
  const catalog = buildProjectCatalog(snapshot, catalogConfig());

  assert.equal(catalog.version, PROJECT_CATALOG_VERSION);
  assert.equal(catalog.version, 2);
  assert.equal(catalog.generator, "CommitAtlas");
  assert.equal(catalog.source, "github-public-rest");
  assert.equal(catalog.user, "octocat");
  assert.equal(catalog.generatedAt, "2026-08-20T12:00:00.000Z");
  assert.deepEqual(
    catalog.projects.map((project) => project.repo),
    ["octocat/atlas", "octocat/quiet"],
  );

  const reversed = buildProjectCatalog(
    snapshot,
    catalogConfig([
      { repo: "octocat/quiet", label: "Quiet", lifecycle: "maintenance" },
      { repo: "octocat/atlas", label: "Atlas", lifecycle: "active" },
    ]),
  );
  assert.deepEqual(
    reversed.projects.map((project) => project.repo),
    ["octocat/quiet", "octocat/atlas"],
  );
});

test("buildProjectCatalog never represents unconfigured or unavailable CI as passing", () => {
  const snapshot = demoSnapshot();
  const config = catalogConfig();
  const mutated: PortfolioSnapshot = structuredClone(snapshot);
  mutated.projects!.projects[0]!.ci = {
    ...mutated.projects!.projects[0]!.ci,
    state: "unconfigured",
    label: "Not configured",
  };
  mutated.projects!.projects[1]!.ci = {
    ...mutated.projects!.projects[1]!.ci,
    state: "unavailable",
    label: "CI unavailable",
  };

  const catalog = buildProjectCatalog(mutated, config);
  assert.deepEqual(
    catalog.projects.map((project) => project.ci.state),
    ["unconfigured", "unavailable"],
  );
  for (const entry of catalog.projects) {
    assert.notEqual(entry.ci.state, "passing");
  }

  const md = renderProjectCatalogArtifacts(mutated, config)["projects.md"];
  const ciLines = md.split("\n").filter((line) => line.startsWith("- **CI:**"));
  assert.equal(ciLines.length, 2);
  for (const line of ciLines) {
    assert.doesNotMatch(line, /Passing/);
  }
});

test("buildProjectCatalog fails closed without a public project snapshot", () => {
  const snapshot = demoSnapshot();
  assert.throws(
    () => buildProjectCatalog({ ...snapshot, projects: null }, catalogConfig()),
    /public project snapshot/,
  );
});

test("renderProjectCatalogArtifacts JSON parses back to exactly buildProjectCatalog's result", () => {
  const snapshot = demoSnapshot();
  const config = catalogConfig();
  const artifacts = renderProjectCatalogArtifacts(snapshot, config);

  assert.deepEqual(Object.keys(artifacts).sort(), ["projects.json", "projects.md"]);
  assert.deepEqual(JSON.parse(artifacts["projects.json"]), buildProjectCatalog(snapshot, config));
});

test("renderProjectCatalogArtifacts Markdown names every configured project", () => {
  const md = renderProjectCatalogArtifacts(demoSnapshot(), catalogConfig())["projects.md"];

  assert.match(md, /^## Atlas$/m);
  assert.match(md, /^## Quiet$/m);
});

test("renderProjectCatalogArtifacts requires the projects card", () => {
  const snapshot = demoSnapshot();
  const withoutProjects: StaticConfig = { ...catalogConfig(), cards: ["atlas"] };
  assert.throws(
    () => renderProjectCatalogArtifacts(snapshot, withoutProjects),
    /requires projects in cards/,
  );
});
