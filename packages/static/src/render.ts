import { calculateContributionMetrics, parseContributionCalendar } from "@commit-atlas/core";
import type {
  ContributionSnapshot,
  Freshness,
  PortfolioSnapshot,
  ProfileSnapshot,
  ProjectBoardSnapshot,
  ProjectSnapshot,
} from "@commit-atlas/github";
import {
  renderActivityCard,
  renderAtlasCard,
  renderCadenceCard,
  renderContributionBreakdownCard,
  renderLanguagesCard,
  renderProfileCard,
  renderProjectBoard,
  renderReleasesCard,
  renderRhythmCard,
  renderStreakCard,
  type AtlasCardData,
  type CardSource,
  type ProjectSignal,
} from "@commit-atlas/svg";
import type { StaticCardName, StaticConfig } from "./config.js";

export type StaticArtifactName = `${StaticCardName}.svg` | "atlas-compact.svg" | "atlas-wide.svg";
export type StaticSvgArtifacts = Readonly<Partial<Record<StaticArtifactName, string>>>;

function toCardSource(freshness: Freshness): CardSource {
  if (freshness.mode === "demo" || freshness.source === "synthetic-demo") return "synthetic-demo";
  return freshness.source === "github-profile-html" ? "public-profile" : "public-github";
}

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
  const dashboardWidth = config.layout === "compact" ? 480 : 860;
  const common = { theme: config.theme, motion: config.motion } as const;
  const { profile, contributions, metrics, projects } = snapshot;
  const lastActive = [...contributions.days].reverse().find((day) => day.count > 0)?.date;
  const artifacts: Partial<Record<StaticArtifactName, string>> = {};

  if (selected.has("atlas")) {
    const atlas = toAtlasCard(snapshot);
    artifacts["atlas.svg"] = renderAtlasCard(atlas, { ...common, width: dashboardWidth });
    if (config.responsiveAtlas) {
      const companion = config.layout === "compact" ? "atlas-wide.svg" : "atlas-compact.svg";
      const companionWidth = config.layout === "compact" ? 860 : 480;
      artifacts[companion] = renderAtlasCard(atlas, { ...common, width: companionWidth });
    }
  }
  if (selected.has("profile")) {
    artifacts["profile.svg"] = renderProfileCard({
      name: profile.name?.trim() || profile.login,
      login: profile.login,
      repositories: profile.publicRepositories,
      followers: profile.followers,
      following: profile.following,
      contributions: metrics.total,
      source: toCardSource(profile.freshness),
      ...(profile.repositoriesTruncated ? {} : { stars: profile.stars }),
    }, { ...common, width });
  }
  if (selected.has("streak")) {
    artifacts["streak.svg"] = renderStreakCard({
      current: metrics.streak.current,
      longest: metrics.streak.longest,
      windowDays: metrics.window.days,
      boundary: metrics.streak.boundary,
      total: metrics.total,
      activeDays: metrics.activeDays,
      source: toCardSource(contributions.freshness),
      ...(lastActive ? { lastActive } : {}),
    }, { ...common, width });
  }
  if (selected.has("activity")) {
    artifacts["activity.svg"] = renderActivityCard({
      days: contributions.days,
      total: metrics.total,
      periodLabel: `${metrics.window.from} → ${metrics.window.to}`,
      source: toCardSource(contributions.freshness),
    }, { ...common, width });
  }
  if (selected.has("breakdown")) {
    artifacts["breakdown.svg"] = renderContributionBreakdownCard({
      source: toCardSource(contributions.freshness),
      window: { from: metrics.window.from, to: metrics.window.to, days: metrics.window.days },
      breakdown: metrics.breakdown,
      basis: metrics.breakdownBasis,
    }, { ...common, width });
  }
  if (selected.has("rhythm")) {
    artifacts["rhythm.svg"] = renderRhythmCard({
      source: toCardSource(contributions.freshness),
      window: { from: metrics.window.from, to: metrics.window.to, days: metrics.window.days },
      activeDays: metrics.activeDays,
      density: metrics.density,
      currentStreak: metrics.streak.current,
      currentStreakBoundary: metrics.streak.boundary.current,
      trend: {
        buckets: metrics.trend.buckets.map((bucket) => bucket.total),
        recent28Days: metrics.trend.recent28Days,
        previous28Days: metrics.trend.previous28Days,
        changePercent: metrics.trend.changePercent,
        direction: metrics.trend.direction,
      },
      rhythm: metrics.rhythm,
    }, { ...common, width });
  }
  if (selected.has("languages")) {
    if (profile.repositoriesTruncated) throw new Error("Language distribution is unavailable for a truncated repository list");
    artifacts["languages.svg"] = renderLanguagesCard({
      source: toCardSource(profile.freshness),
      languages: profile.primaryLanguages.map((language) => ({ name: language.name, percentage: language.share })),
    }, { ...common, width });
  }
  if (selected.has("projects")) {
    artifacts["projects.svg"] = renderProjectBoard({
      source: toCardSource(projects?.freshness ?? snapshot.freshness),
      projects: (projects?.projects ?? []).map(toProjectSignal),
    }, { ...common, width: dashboardWidth });
  }
  if (selected.has("cadence")) {
    artifacts["cadence.svg"] = renderCadenceCard({
      source: toCardSource(contributions.freshness),
      days: contributions.days,
    }, { ...common, width });
  }
  if (selected.has("releases")) {
    const observed = projects?.projects ?? [];
    artifacts["releases.svg"] = renderReleasesCard({
      source: toCardSource(projects?.freshness ?? snapshot.freshness),
      releases: observed.flatMap((project) => project.release
        ? [{ project: project.name, tag: project.release.tag, publishedAt: project.release.publishedAt }]
        : []),
      projectsObserved: observed.length,
    }, { ...common, width });
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
    streakBoundary: metrics.streak.boundary,
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
      : project.lifecycle,
    ci: project.ci.state,
    stars: project.stars,
    ...(project.description ? { description: project.description } : {}),
    ...(project.release?.tag ? { version: project.release.tag } : {}),
    ...(project.pushedAt ? { updatedAt: project.pushedAt } : {}),
  };
}
