import type {
  CiState as CoreCiState,
  ContributionMetrics,
  ProjectLifecycle as CoreProjectLifecycle,
} from "@/packages/core/src/index";

export type DataMode = "live" | "demo" | "partial" | "unavailable";

/** Core owns the lifecycle vocabulary; GitHub only supplies observations. */
export type ProjectLifecycle = CoreProjectLifecycle;

export interface Freshness {
  generatedAt: string;
  source: "github-rest" | "github-graphql" | "synthetic-demo";
  mode: DataMode;
}

export interface LanguageSignal {
  name: string;
  repositories: number;
  share: number;
}

export interface ProfileSnapshot {
  version: 1;
  login: string;
  name: string | null;
  profileUrl: string;
  publicRepositories: number;
  followers: number;
  following: number;
  stars: number;
  forks: number;
  primaryLanguages: LanguageSignal[];
  latestPushAt: string | null;
  repositoriesTruncated: boolean;
  freshness: Freshness;
}

export interface ContributionDay {
  date: string;
  count: number;
  /** GitHub's normalized contribution intensity, from none (0) to highest (4). */
  level?: number;
}

export interface ContributionSnapshot {
  version: 1;
  login: string;
  totalContributions: number;
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
  days: ContributionDay[];
  freshness: Freshness;
}

/** A user-declared GitHub Actions workflow filename or numeric identity. */
export type ProjectWorkflow = string;

export interface ProjectCiSignal {
  state: CoreCiState;
  label: string;
  workflow: ProjectWorkflow | null;
  url: string | null;
  checkedAt: string | null;
  headSha: string | null;
}

export interface ProjectReleaseSignal {
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
  download: { name: string; url: string } | null;
}

export interface ProjectSnapshot {
  repo: string;
  name: string;
  description: string | null;
  sourceUrl: string;
  websiteUrl: string | null;
  lifecycle: ProjectLifecycle;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string | null;
  license: string | null;
  ci: ProjectCiSignal;
  release: ProjectReleaseSignal | null;
}

export interface ProjectBoardSnapshot {
  version: 1;
  owner: string;
  projects: ProjectSnapshot[];
  freshness: Freshness;
}

export interface PortfolioSnapshot {
  version: 1;
  profile: ProfileSnapshot;
  contributions: ContributionSnapshot;
  metrics: ContributionMetrics;
  projects: ProjectBoardSnapshot | null;
  freshness: Freshness;
}
