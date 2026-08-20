import { calculateContributionMetrics, parseContributionCalendar } from "@commit-atlas/core";
import type {
  ContributionSnapshot,
  PortfolioSnapshot,
  ProfileSnapshot,
  ProjectBoardSnapshot,
  ProjectSnapshot,
} from "@commit-atlas/github";
import {
  renderActivityCard,
  renderAtlasCard,
  renderLanguagesCard,
  renderProfileCard,
  renderProjectBoard,
  renderStreakCard,
  type AtlasCardData,
  type ProjectSignal,
} from "@commit-atlas/svg";
import type { StaticCardName, StaticConfig } from "./config.js";

export type StaticSvgArtifacts = Readonly<Partial<Record<`${StaticCardName}.svg`, string>>>;

export function assembleStaticPortfolio(
  profile: ProfileSnapshot,
  contributions: ContributionSnapshot,
  projects: ProjectBoardSnapshot,
): PortfolioSnapshot {
  if (profile.login.toLowerCase() !== contributions.login.toLowerCase()) {
    throw new Error("Portfolio sources refer to different GitHub users");
  }
  const calendar = parseContributionCalendar({ version: 1, days: contributions.days });
  const asOf = calendar.days.at(-1)?.date;
  if (!asOf) throw new Error("GitHub returned an empty contribution calendar");
  const metrics = calculateContributionMetrics(calendar, {
    asOf,
    days: calendar.days.length,
    commits: contributions.commits,
    issues: contributions.issues,
    pullRequests: contributions.pullRequests,
    reviews: contributions.reviews,
    breakdownBasis: contributions.breakdownBasis,
  });
  if (!metrics.window.complete) throw new Error("GitHub returned an incomplete contribution window");
  return {
    version: 1,
    profile,
    contributions,
    metrics,
    projects,
    freshness: {
      generatedAt: contributions.freshness.generatedAt,
      source: contributions.freshness.source,
      mode: contributions.freshness.mode,
    },
  };
}

export function renderStaticArtifacts(snapshot: PortfolioSnapshot, config: StaticConfig): StaticSvgArtifacts {
  const selected = new Set(config.cards);
  const width = config.layout === "compact" ? 480 : 720;
  const wideWidth = config.layout === "compact" ? 480 : 860;
  const common = { theme: config.theme, motion: config.motion } as const;
  const { profile, contributions, metrics, projects } = snapshot;
  const lastActive = [...contributions.days].reverse().find((day) => day.count > 0)?.date;
  const artifacts: Partial<Record<`${StaticCardName}.svg`, string>> = {};

  if (selected.has("atlas")) {
    artifacts["atlas.svg"] = renderAtlasCard(toAtlasCard(snapshot), { ...common, width: wideWidth });
  }
  if (selected.has("profile")) {
    artifacts["profile.svg"] = renderProfileCard({
      name: profile.name?.trim() || profile.login,
      login: profile.login,
      repositories: profile.publicRepositories,
      followers: profile.followers,
      following: profile.following,
      contributions: metrics.total,
      ...(profile.repositoriesTruncated ? {} : { stars: profile.stars }),
    }, { ...common, width });
  }
  if (selected.has("streak")) {
    artifacts["streak.svg"] = renderStreakCard({
      current: metrics.streak.current,
      longest: metrics.streak.longest,
      total: metrics.total,
      activeDays: metrics.activeDays,
      ...(lastActive ? { lastActive } : {}),
    }, { ...common, width });
  }
  if (selected.has("activity")) {
    artifacts["activity.svg"] = renderActivityCard({
      days: contributions.days,
      total: metrics.total,
      periodLabel: `${metrics.window.from} → ${metrics.window.to}`,
    }, { ...common, width });
  }
  if (selected.has("languages")) {
    if (profile.repositoriesTruncated) throw new Error("Language distribution is unavailable for a truncated repository list");
    artifacts["languages.svg"] = renderLanguagesCard({
      languages: profile.primaryLanguages.map((language) => ({ name: language.name, percentage: language.share })),
    }, { ...common, width });
  }
  if (selected.has("projects")) {
    artifacts["projects.svg"] = renderProjectBoard({
      projects: (projects?.projects ?? []).map(toProjectSignal),
    }, { ...common, width: wideWidth });
  }
  return artifacts;
}

function toAtlasCard(snapshot: PortfolioSnapshot): AtlasCardData {
  const { profile, contributions, metrics, projects } = snapshot;
  const projectStates = projects?.projects ?? [];
  return {
    profile: {
      name: profile.name?.trim() || profile.login,
      login: profile.login,
      repositories: profile.publicRepositories,
      followers: profile.followers,
      ...(profile.repositoriesTruncated ? {} : { stars: profile.stars }),
    },
    window: { from: metrics.window.from, to: metrics.window.to, days: metrics.window.days },
    total: metrics.total,
    activeDays: metrics.activeDays,
    density: metrics.density,
    averagePerDay: metrics.averagePerDay,
    currentStreak: metrics.streak.current,
    longestStreak: metrics.streak.longest,
    streakBasis: metrics.streak.basis,
    peakDay: metrics.peakDay,
    breakdown: metrics.breakdown,
    breakdownBasis: metrics.breakdownBasis,
    trend: {
      buckets: metrics.trend.buckets.map((bucket) => bucket.total),
      recent28Days: metrics.trend.recent28Days,
      previous28Days: metrics.trend.previous28Days,
      changePercent: metrics.trend.changePercent,
      direction: metrics.trend.direction,
    },
    rhythm: metrics.rhythm,
    activity: contributions.days,
    ...(profile.repositoriesTruncated ? {} : {
      languages: profile.primaryLanguages.map((language) => ({ name: language.name, percentage: language.share })),
    }),
    projects: {
      total: projectStates.length,
      passing: projectStates.filter((project) => project.ci.state === "passing").length,
      attention: projectStates.filter((project) => ["failing", "pending", "stale"].includes(project.ci.state)).length,
      unavailable: projectStates.filter((project) => ["unavailable", "unconfigured"].includes(project.ci.state)).length,
    },
    generatedAt: snapshot.freshness.generatedAt,
    source: snapshot.freshness.source === "github-profile-html" ? "public-profile" : "public-github",
  };
}

function toProjectSignal(project: ProjectSnapshot): ProjectSignal {
  return {
    name: project.name,
    lifecycle: project.lifecycle === "maintenance" ? "maintained"
      : project.lifecycle === "planned" ? "experimental"
        : project.lifecycle,
    ci: project.ci.state,
    stars: project.stars,
    ...(project.description ? { description: project.description } : {}),
    ...(project.release?.tag ? { version: project.release.tag } : {}),
    ...(project.pushedAt ? { updatedAt: project.pushedAt } : {}),
  };
}
