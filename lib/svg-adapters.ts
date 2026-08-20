import {
  calculateActivitySeries,
  calculateStreaks,
  parseContributionCalendar,
  type ContributionCalendar,
} from "@/packages/core/src/index";
import type {
  ActivityCardData,
  CardSource,
  LanguagesCardData,
  ProfileCardData,
  ProjectBoardData,
  ProjectSignal,
  StreakCardData,
} from "@/packages/svg/src/index";
import { toSvgCiState, toSvgLifecycle } from "./github/adapters";
import { GitHubApiError } from "./github/client";
import type {
  ContributionSnapshot,
  Freshness,
  ProfileSnapshot,
  ProjectBoardSnapshot,
  ProjectSnapshot,
} from "./github/types";

function toCardSource(freshness: Freshness): CardSource {
  if (freshness.mode === "demo" || freshness.source === "synthetic-demo") return "synthetic-demo";
  return freshness.source === "github-profile-html" ? "public-profile" : "public-github";
}

/** Convert the public profile contract without fabricating contribution data. */
export function toProfileCard(snapshot: ProfileSnapshot): ProfileCardData {
  return {
    name: snapshot.name?.trim() || snapshot.login,
    login: snapshot.login,
    repositories: snapshot.publicRepositories,
    followers: snapshot.followers,
    following: snapshot.following,
    source: toCardSource(snapshot.freshness),
    ...(snapshot.repositoriesTruncated ? {} : { stars: snapshot.stars }),
  };
}

/**
 * Parse and sort the validated contribution calendar once for both cards.
 * Keeping this at the adapter boundary makes out-of-order input deterministic
 * and ensures the latest valid UTC day, rather than the wall clock, is the
 * source of truth for streak and activity calculations.
 */
export function contributionCalendar(snapshot: ContributionSnapshot): ContributionCalendar {
  try {
    return parseContributionCalendar({ version: 1, days: snapshot.days });
  } catch {
    throw new GitHubApiError("invalid_response", "GitHub returned an invalid contribution calendar");
  }
}

export function toStreakCard(snapshot: ContributionSnapshot, expectedDays: number): StreakCardData {
  const calendar = contributionCalendar(snapshot);
  const asOf = latestContributionDate(calendar);
  const window = completeContributionWindow(calendar, asOf, expectedDays);
  const summary = calculateStreaks(window, { asOf });
  const total = window.days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = window.days.filter((day) => day.count > 0).length;
  const lastActive = [...window.days].reverse().find((day) => day.count > 0)?.date;
  return {
    current: summary.current,
    longest: summary.longest,
    windowDays: expectedDays,
    boundary: summary.boundary,
    total,
    activeDays,
    lastActive,
    source: toCardSource(snapshot.freshness),
  };
}

export function toActivityCard(snapshot: ContributionSnapshot, days: number): ActivityCardData {
  const calendar = contributionCalendar(snapshot);
  const asOf = latestContributionDate(calendar);
  const window = completeContributionWindow(calendar, asOf, days);
  const series = calculateActivitySeries(window, { asOf, days });
  return {
    days: series.points.map(({ date, count }) => ({ date, count })),
    total: series.total,
    periodLabel: `${series.from} → ${series.to}`,
    source: toCardSource(snapshot.freshness),
  };
}

/** Profile language signals are a repository-count distribution, not proficiency. */
export function toLanguagesCard(snapshot: ProfileSnapshot): LanguagesCardData {
  if (snapshot.repositoriesTruncated) {
    throw new GitHubApiError(
      "invalid_response",
      "GitHub returned a truncated repository list; language distribution is unavailable",
    );
  }
  return {
    source: toCardSource(snapshot.freshness),
    languages: snapshot.primaryLanguages.map((language) => ({
      name: language.name,
      percentage: language.share,
    })),
  };
}

export function toProjectBoard(snapshot: ProjectBoardSnapshot): ProjectBoardData {
  return { source: toCardSource(snapshot.freshness), projects: snapshot.projects.map(toProjectSignal) };
}

function toProjectSignal(project: ProjectSnapshot): ProjectSignal {
  const signal: ProjectSignal = {
    name: project.name,
    lifecycle: toSvgLifecycle(project.lifecycle),
    ci: toSvgCiState(project.ci.state),
    stars: project.stars,
    ...(project.description ? { description: project.description } : {}),
    ...(project.release?.tag ? { version: project.release.tag } : {}),
    ...(project.pushedAt ? { updatedAt: project.pushedAt } : {}),
  };
  // Project actions deliberately stay in HTML; README SVGs are portable
  // summaries and must not imply interactive install/download controls.
  return signal;
}

function latestContributionDate(calendar: ContributionCalendar): string {
  const latest = calendar.days.at(-1)?.date;
  if (!latest) throw new GitHubApiError("invalid_response", "GitHub returned an empty contribution calendar");
  return latest;
}

function completeContributionWindow(
  calendar: ContributionCalendar,
  asOf: string,
  expectedDays: number,
): ContributionCalendar {
  if (!Number.isInteger(expectedDays) || expectedDays < 1 || expectedDays > 366) {
    throw new GitHubApiError("invalid_response", "CommitAtlas received an invalid contribution window");
  }
  const available = new Set(calendar.days.map((day) => day.date));
  const first = shiftUtcDate(asOf, -(expectedDays - 1));
  for (let offset = 0; offset < expectedDays; offset += 1) {
    if (!available.has(shiftUtcDate(first, offset))) {
      throw new GitHubApiError("invalid_response", "GitHub returned an incomplete contribution window");
    }
  }
  return {
    version: calendar.version,
    days: calendar.days.filter((day) => day.date >= first && day.date <= asOf),
  };
}

function shiftUtcDate(date: string, offset: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}
