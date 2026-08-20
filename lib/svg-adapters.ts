import {
  calculateActivitySeries,
  calculateStreaks,
  parseContributionCalendar,
  type ContributionCalendar,
} from "@/packages/core/src/index";
import type {
  ActivityCardData,
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
  ProfileSnapshot,
  ProjectBoardSnapshot,
  ProjectSnapshot,
} from "./github/types";

/** Convert the public profile contract without fabricating contribution data. */
export function toProfileCard(snapshot: ProfileSnapshot): ProfileCardData {
  return {
    name: snapshot.name?.trim() || snapshot.login,
    login: snapshot.login,
    repositories: snapshot.publicRepositories,
    followers: snapshot.followers,
    following: snapshot.following,
    stars: snapshot.stars,
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

export function toStreakCard(snapshot: ContributionSnapshot): StreakCardData {
  const calendar = contributionCalendar(snapshot);
  const asOf = latestContributionDate(calendar);
  const summary = calculateStreaks(calendar, { asOf });
  const total = calendar.days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = calendar.days.filter((day) => day.count > 0).length;
  const lastActive = [...calendar.days].reverse().find((day) => day.count > 0)?.date;
  return {
    current: summary.current,
    longest: summary.longest,
    total,
    activeDays,
    lastActive,
  };
}

export function toActivityCard(snapshot: ContributionSnapshot, days: number): ActivityCardData {
  const calendar = contributionCalendar(snapshot);
  const asOf = latestContributionDate(calendar);
  const series = calculateActivitySeries(calendar, { asOf, days });
  return {
    days: series.points.map(({ date, count }) => ({ date, count })),
    total: series.total,
    periodLabel: `${series.from} → ${series.to}`,
  };
}

/** Profile language signals are a repository-count distribution, not proficiency. */
export function toLanguagesCard(snapshot: ProfileSnapshot): LanguagesCardData {
  return {
    languages: snapshot.primaryLanguages.map((language) => ({
      name: language.name,
      percentage: language.share,
    })),
  };
}

export function toProjectBoard(snapshot: ProjectBoardSnapshot): ProjectBoardData {
  return { projects: snapshot.projects.map(toProjectSignal) };
}

function toProjectSignal(project: ProjectSnapshot): ProjectSignal {
  const signal: ProjectSignal = {
    name: project.name,
    lifecycle: toSvgLifecycle(project.lifecycle),
    ci: toSvgCiState(project.ci.state),
    stars: project.stars,
  };
  if (project.description) signal.description = project.description;
  if (project.release?.tag) signal.version = project.release.tag;
  if (project.pushedAt) signal.updatedAt = project.pushedAt;
  // Project actions deliberately stay in HTML; README SVGs are portable
  // summaries and must not imply interactive install/download controls.
  return signal;
}

function latestContributionDate(calendar: ContributionCalendar): string {
  const latest = calendar.days.at(-1)?.date;
  if (!latest) throw new Error("Contribution calendar has no valid days");
  return latest;
}
