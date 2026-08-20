import assert from "node:assert/strict";
import test from "node:test";
import { assemblePortfolioSnapshot, toAtlasCard } from "./portfolio";
import type { ContributionSnapshot, ProfileSnapshot, ProjectBoardSnapshot } from "./github/types";

const generatedAt = "2026-08-20T12:00:00.000Z";
const profile: ProfileSnapshot = {
  version: 1,
  login: "octocat",
  name: "The Octocat",
  profileUrl: "https://github.com/octocat",
  publicRepositories: 4,
  followers: 10,
  following: 2,
  stars: 18,
  forks: 3,
  primaryLanguages: [{ name: "TypeScript", repositories: 3, share: 75 }],
  latestPushAt: generatedAt,
  repositoriesTruncated: false,
  freshness: { generatedAt, source: "github-rest", mode: "live" },
};

const contributions: ContributionSnapshot = {
  version: 1,
  login: "octocat",
  totalContributions: 7,
  commits: 5,
  issues: 1,
  pullRequests: 1,
  reviews: 2,
  breakdownBasis: "exact-counts",
  days: [
    { date: "2026-08-18", count: 2, level: 2 },
    { date: "2026-08-19", count: 0, level: 0 },
    { date: "2026-08-20", count: 5, level: 4 },
  ],
  freshness: { generatedAt, source: "github-graphql", mode: "live" },
};

const projects: ProjectBoardSnapshot = {
  version: 1,
  owner: "octocat",
  projects: [
    {
      repo: "octocat/atlas", name: "atlas", description: null,
      sourceUrl: "https://github.com/octocat/atlas", websiteUrl: null,
      lifecycle: "active", primaryLanguage: "TypeScript", stars: 2, forks: 0,
      openIssues: 0, pushedAt: generatedAt, license: "GPL-3.0-only",
      ci: { state: "passing", label: "Passing", workflow: "ci.yml", url: null, checkedAt: generatedAt, headSha: null },
      release: null,
    },
    {
      repo: "octocat/quiet", name: "quiet", description: null,
      sourceUrl: "https://github.com/octocat/quiet", websiteUrl: null,
      lifecycle: "maintenance", primaryLanguage: "Python", stars: 0, forks: 0,
      openIssues: 0, pushedAt: generatedAt, license: null,
      ci: { state: "unconfigured", label: "Not configured", workflow: null, url: null, checkedAt: null, headSha: null },
      release: null,
    },
  ],
  freshness: { generatedAt, source: "github-rest", mode: "live" },
};

test("assembles one canonical portfolio snapshot and rich atlas input", () => {
  const snapshot = assemblePortfolioSnapshot(profile, contributions, projects);
  const atlas = toAtlasCard(snapshot);

  assert.equal(snapshot.metrics.window.complete, true);
  assert.equal(snapshot.metrics.density, 66.7);
  assert.deepEqual(atlas.breakdown, { commits: 5, issues: 1, pullRequests: 1, reviews: 2 });
  assert.deepEqual(atlas.activity.map(({ level }) => level), [2, 0, 4]);
  assert.deepEqual(atlas.projects, { total: 2, passing: 1, attention: 0, unavailable: 1 });
  assert.equal(atlas.streakBasis, "returned-window");
  assert.deepEqual(atlas.streakBoundary, { current: "closed", longest: "open" });
  assert.equal(atlas.source, "public-github");
});

test("rejects mixed-user and incomplete portfolio sources", () => {
  assert.throws(
    () => assemblePortfolioSnapshot(profile, { ...contributions, login: "other" }),
    /different GitHub users/,
  );
  assert.throws(
    () => assemblePortfolioSnapshot(profile, {
      ...contributions,
      days: [contributions.days[0]!, contributions.days[2]!],
    }),
    /incomplete contribution window/,
  );
});
