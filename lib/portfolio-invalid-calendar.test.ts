import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import { assemblePortfolioSnapshot } from "./portfolio";
import { GitHubApiError } from "./github/client";
import type { ContributionSnapshot, ProfileSnapshot } from "./github/types";

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

const validContributions: ContributionSnapshot = {
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

test("malformed contribution calendar throws bounded invalid_response", () => {
  const malformed: ContributionSnapshot = {
    ...validContributions,
    days: [{ date: "2026-13-45", count: 1 } as unknown as ContributionSnapshot["days"][number]],
  };
  try {
    assemblePortfolioSnapshot(profile, malformed);
    assert.fail("expected assemblePortfolioSnapshot to throw");
  } catch (error) {
    assert.ok(error instanceof GitHubApiError, `expected GitHubApiError, got ${String(error)}`);
    assert.equal(error.code, "invalid_response");
    assert.ok(!(error instanceof ZodError), "expected bounded error, not raw ZodError");
  }
});

test("valid contribution calendar still assembles", () => {
  const snapshot = assemblePortfolioSnapshot(profile, validContributions);
  assert.equal(snapshot.metrics.window.complete, true);
  assert.equal(snapshot.profile.login, "octocat");
});
