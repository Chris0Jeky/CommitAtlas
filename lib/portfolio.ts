import {
  calculateContributionMetrics,
  parseContributionCalendar,
} from "@/packages/core/src/index";
import { GitHubClient, GitHubApiError } from "./github/client";
import { demoContributions, demoProfile, demoProjects } from "./github/demo";
import type {
  PortfolioSnapshot,
  ProfileSnapshot,
  ContributionSnapshot,
  ProjectBoardSnapshot,
  ProjectLifecycle,
  ProjectWorkflow,
} from "./github/types";
import type { AtlasCardData } from "@/packages/svg/src/index";

export interface PortfolioRequest {
  user: string;
  days: number;
  demo: boolean;
  token?: string;
  repositories?: readonly string[];
  lifecycles?: ReadonlyMap<string, ProjectLifecycle>;
  workflows?: ReadonlyMap<string, ProjectWorkflow>;
}

export async function fetchPortfolioSnapshot(request: PortfolioRequest): Promise<PortfolioSnapshot> {
  const repositories = request.repositories ?? [];
  const lifecycles = request.lifecycles ?? new Map<string, ProjectLifecycle>();
  const workflows = request.workflows ?? new Map<string, ProjectWorkflow>();
  if (request.demo) {
    const now = new Date();
    return assemblePortfolioSnapshot(
      demoProfile(request.user, now),
      demoContributions(request.user, request.days, now),
      repositories.length > 0 ? demoProjects(request.user, repositories, lifecycles, workflows, now) : null,
    );
  }

  const client = new GitHubClient({ token: request.token });
  const [profile, contributions, projects] = await Promise.all([
    client.fetchProfile(request.user),
    client.fetchContributions(request.user, request.days),
    repositories.length > 0
      ? client.fetchProjects(request.user, repositories, lifecycles, workflows)
      : Promise.resolve(null),
  ]);
  return assemblePortfolioSnapshot(profile, contributions, projects);
}

export function assemblePortfolioSnapshot(
  profile: ProfileSnapshot,
  contributions: ContributionSnapshot,
  projects: ProjectBoardSnapshot | null = null,
): PortfolioSnapshot {
  if (profile.login.toLowerCase() !== contributions.login.toLowerCase()) {
    throw new GitHubApiError("invalid_response", "Portfolio sources refer to different GitHub users");
  }
  const calendar = parseContributionCalendar({ version: 1, days: contributions.days });
  const asOf = calendar.days.at(-1)?.date;
  if (!asOf) throw new GitHubApiError("invalid_response", "GitHub returned an empty contribution calendar");
  const metrics = calculateContributionMetrics(calendar, {
    asOf,
    days: calendar.days.length,
    commits: contributions.commits,
    issues: contributions.issues,
    pullRequests: contributions.pullRequests,
    reviews: contributions.reviews,
    breakdownBasis: contributions.breakdownBasis,
  });
  if (!metrics.window.complete) {
    throw new GitHubApiError("invalid_response", "GitHub returned an incomplete contribution window");
  }
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

export function toAtlasCard(snapshot: PortfolioSnapshot): AtlasCardData {
  const { profile, contributions, metrics, projects } = snapshot;
  const projectStates = projects?.projects ?? [];
  const passing = projectStates.filter((project) => project.ci.state === "passing").length;
  const attention = projectStates.filter((project) => project.ci.state === "failing" || project.ci.state === "pending" || project.ci.state === "stale").length;
  const unavailable = projectStates.filter((project) => project.ci.state === "unavailable" || project.ci.state === "unconfigured").length;
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
    ...(projects ? { projects: { total: projectStates.length, passing, attention, unavailable } } : {}),
    generatedAt: snapshot.freshness.generatedAt,
    source: snapshot.freshness.mode === "demo" ? "synthetic-demo" : "public-github",
  };
}
