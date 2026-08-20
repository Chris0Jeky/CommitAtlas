import assert from "node:assert/strict";
import test from "node:test";
import type {
  ContributionSnapshot,
  ProfileSnapshot,
  ProjectBoardSnapshot,
} from "./github/types";
import { GitHubApiError } from "./github/client";
import {
  contributionCalendar,
  toActivityCard,
  toLanguagesCard,
  toProfileCard,
  toProjectBoard,
  toStreakCard,
} from "./svg-adapters";

const freshness = { generatedAt: "2026-08-20T00:00:00.000Z", source: "synthetic-demo" as const, mode: "demo" as const };

function contributions(days: ContributionSnapshot["days"]): ContributionSnapshot {
  return {
    version: 1,
    login: "octocat",
    totalContributions: days.reduce((sum, day) => sum + day.count, 0),
    commits: 0,
    issues: 0,
    pullRequests: 0,
    reviews: 0,
    days,
    freshness,
  };
}

test("profile adapter falls back to login and preserves source-backed stars", () => {
  const snapshot: ProfileSnapshot = {
    version: 1,
    login: "octocat",
    name: null,
    profileUrl: "https://github.com/octocat",
    publicRepositories: 2,
    followers: 3,
    following: 4,
    stars: 17,
    forks: 5,
    primaryLanguages: [],
    latestPushAt: null,
    repositoriesTruncated: false,
    freshness,
  };
  assert.deepEqual(toProfileCard(snapshot), {
    name: "octocat", login: "octocat", repositories: 2, followers: 3, following: 4, stars: 17,
  });
});

test("contribution adapters sort leap-day input and use its latest UTC day as as-of", () => {
  const snapshot = contributions([
    { date: "2024-03-02", count: 3 },
    { date: "2024-02-29", count: 1 },
    { date: "2024-02-24", count: 10 },
    { date: "2024-02-25", count: 0 },
    { date: "2024-03-01", count: 0 },
    { date: "2024-02-28", count: 1 },
    { date: "2024-02-27", count: 0 },
    { date: "2024-02-26", count: 0 },
  ]);
  assert.deepEqual(toStreakCard(snapshot, 7), {
    current: 1, longest: 2, total: 5, activeDays: 3, lastActive: "2024-03-02",
  });
  const activity = toActivityCard(snapshot, 7);
  assert.equal(activity.periodLabel, "2024-02-25 → 2024-03-02");
  assert.deepEqual(activity.days.slice(-4), [
    { date: "2024-02-28", count: 1 },
    { date: "2024-02-29", count: 1 },
    { date: "2024-03-01", count: 0 },
    { date: "2024-03-02", count: 3 },
  ]);
});

test("an explicit all-zero calendar renders a zero streak rather than becoming unavailable", () => {
  const snapshot = contributions([
    { date: "2026-08-13", count: 0 },
    { date: "2026-08-14", count: 0 },
    { date: "2026-08-15", count: 0 },
    { date: "2026-08-16", count: 0 },
    { date: "2026-08-17", count: 0 },
    { date: "2026-08-18", count: 0 },
    { date: "2026-08-19", count: 0 },
  ]);
  assert.deepEqual(toStreakCard(snapshot, 7), {
    current: 0, longest: 0, total: 0, activeDays: 0, lastActive: undefined,
  });
});

test("short or gapped contribution windows fail closed instead of being zero-filled", () => {
  const incomplete = contributions([
    { date: "2024-02-25", count: 0 },
    { date: "2024-02-26", count: 0 },
    { date: "2024-02-27", count: 0 },
    { date: "2024-02-29", count: 1 },
    { date: "2024-03-01", count: 0 },
    { date: "2024-03-02", count: 3 },
  ]);
  for (const build of [
    () => toStreakCard(incomplete, 7),
    () => toActivityCard(incomplete, 7),
  ]) {
    assert.throws(build, (error: unknown) => error instanceof GitHubApiError && error.code === "invalid_response");
  }
});

test("invalid or duplicate contribution days fail as bounded upstream data errors", () => {
  assert.throws(
    () => contributionCalendar(contributions([
      { date: "2026-08-19", count: 1 },
      { date: "2026-08-19", count: 2 },
    ])),
    (error: unknown) => error instanceof GitHubApiError && error.code === "invalid_response",
  );
  assert.throws(
    () => contributionCalendar(contributions([])),
    (error: unknown) => error instanceof GitHubApiError && error.code === "invalid_response",
  );
});

test("language and project adapters preserve explicit semantics and omit SVG actions", () => {
  const profile: ProfileSnapshot = {
    version: 1,
    login: "octocat",
    name: "Octocat",
    profileUrl: "https://github.com/octocat",
    publicRepositories: 3,
    followers: 1,
    following: 2,
    stars: 0,
    forks: 0,
    primaryLanguages: [{ name: "TypeScript", repositories: 2, share: 66.7 }],
    latestPushAt: null,
    repositoriesTruncated: false,
    freshness,
  };
  assert.deepEqual(toLanguagesCard(profile), { languages: [{ name: "TypeScript", percentage: 66.7 }] });

  const board: ProjectBoardSnapshot = {
    version: 1,
    owner: "acme",
    projects: [{
      repo: "acme/atlas",
      name: "atlas",
      description: null,
      sourceUrl: "https://github.com/acme/atlas",
      websiteUrl: null,
      lifecycle: "planned",
      primaryLanguage: "TypeScript",
      stars: 2,
      forks: 0,
      openIssues: 0,
      pushedAt: null,
      license: null,
      ci: { state: "unavailable", label: "CI unavailable", workflow: null, url: null, checkedAt: null, headSha: null },
      release: null,
    }],
    freshness,
  };
  assert.deepEqual(toProjectBoard(board), {
    projects: [{ name: "atlas", lifecycle: "experimental", ci: "unavailable", stars: 2 }],
  });
});

test("truncated profile repositories never render partial stars or language distributions", () => {
  const truncated: ProfileSnapshot = {
    version: 1,
    login: "octocat",
    name: "Octocat",
    profileUrl: "https://github.com/octocat",
    publicRepositories: 101,
    followers: 1,
    following: 2,
    stars: 999,
    forks: 0,
    primaryLanguages: [{ name: "TypeScript", repositories: 100, share: 100 }],
    latestPushAt: null,
    repositoriesTruncated: true,
    freshness,
  };
  assert.equal("stars" in toProfileCard(truncated), false);
  assert.throws(
    () => toLanguagesCard(truncated),
    (error: unknown) => error instanceof GitHubApiError && error.code === "invalid_response",
  );
});
