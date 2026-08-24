import type {
  ContributionSnapshot,
  ProfileSnapshot,
  ProjectBoardSnapshot,
  ProjectLifecycle,
  ProjectWorkflow,
} from "./types.js";

export interface DemoContributionBreakdown {
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
}

const DEMO_BREAKDOWN_WEIGHTS = [
  ["commits", 64],
  ["issues", 5],
  ["pullRequests", 14],
  ["reviews", 17],
] as const satisfies ReadonlyArray<readonly [keyof DemoContributionBreakdown, number]>;

/** Allocate a synthetic activity total without rounding drift or unsafe intermediate products. */
export function demoContributionBreakdown(total: number): DemoContributionBreakdown {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError("Demo contribution totals must be non-negative safe integers");
  }
  if (total === 0) {
    return { commits: 0, issues: 0, pullRequests: 0, reviews: 0 };
  }

  const quotient = Math.floor(total / 100);
  const remainder = total % 100;
  const allocations = DEMO_BREAKDOWN_WEIGHTS.map(([key, weight], order) => {
    const weightedRemainder = remainder * weight;
    return {
      key,
      order,
      value: quotient * weight + Math.floor(weightedRemainder / 100),
      remainder: weightedRemainder % 100,
    };
  });
  const assigned = allocations.reduce((sum, allocation) => sum + allocation.value, 0);
  const leftover = total - assigned;

  allocations.sort((left, right) => right.remainder - left.remainder || left.order - right.order);
  const result: DemoContributionBreakdown = { commits: 0, issues: 0, pullRequests: 0, reviews: 0 };
  for (const allocation of allocations) {
    result[allocation.key] = allocation.value;
  }
  for (let index = 0; index < leftover; index += 1) {
    result[allocations[index]!.key] += 1;
  }
  return result;
}

/** Deterministic-shaped synthetic data for previews and offline examples. */
export function demoProfile(login: string, now = new Date()): ProfileSnapshot {
  const stableTimestamp = utcDayTimestamp(now);
  return {
    version: 1,
    login,
    name: "Synthetic preview",
    profileUrl: `https://github.com/${encodeURIComponent(login)}`,
    publicRepositories: 24,
    followers: 312,
    following: 48,
    stars: 487,
    forks: 96,
    primaryLanguages: [
      { name: "TypeScript", repositories: 9, share: 45 },
      { name: "Python", repositories: 6, share: 30 },
      { name: "Rust", repositories: 3, share: 15 },
      { name: "CSS", repositories: 2, share: 10 },
    ],
    latestPushAt: stableTimestamp,
    repositoriesTruncated: false,
    freshness: { generatedAt: now.toISOString(), source: "synthetic-demo", mode: "demo" },
  };
}

export function demoContributions(login: string, requestedDays = 365, now = new Date()): ContributionSnapshot {
  const dayCount = Math.min(Math.max(requestedDays, 7), 365);
  const days = Array.from({ length: dayCount }, (_, offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - (dayCount - 1 - offset));
    return {
      date: date.toISOString().slice(0, 10),
      count: (offset * 7 + Math.floor(offset / 9)) % 8,
      level: Math.min(4, Math.ceil(((offset * 7 + Math.floor(offset / 9)) % 8) / 2)),
    };
  });
  const totalContributions = days.reduce((sum, day) => sum + day.count, 0);
  const breakdown = demoContributionBreakdown(totalContributions);
  return {
    version: 1,
    login,
    totalContributions,
    ...breakdown,
    breakdownBasis: "exact-counts",
    days,
    freshness: { generatedAt: now.toISOString(), source: "synthetic-demo", mode: "demo" },
  };
}

export function demoProjects(
  owner: string,
  repositories: readonly string[],
  lifecycles: ReadonlyMap<string, ProjectLifecycle>,
  workflows: ReadonlyMap<string, ProjectWorkflow> = new Map(),
  now = new Date(),
): ProjectBoardSnapshot {
  const stableTimestamp = utcDayTimestamp(now);
  const configuredCiStates = [
    { state: "passing", label: "Passing" },
    { state: "pending", label: "Pending" },
    { state: "stale", label: "Stale result" },
    { state: "failing", label: "Failing" },
    { state: "unavailable", label: "CI unavailable" },
  ] as const;
  return {
    version: 1,
    owner,
    projects: repositories.map((name, index) => {
      const workflow = workflows.get(name.toLowerCase()) ?? null;
      const configuredCi = workflow ? configuredCiStates[index % configuredCiStates.length]! : null;
      return {
        repo: `${owner}/${name}`,
        name,
        description: "Synthetic project data for the CommitAtlas preview.",
        sourceUrl: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
        websiteUrl: null,
        lifecycle: lifecycleFor(name, lifecycles),
        primaryLanguage: ["TypeScript", "Python", "Rust"][index % 3],
        stars: 42 - index * 3,
        forks: 8 + index,
        openIssuesAndPullRequests: index * 2,
        pushedAt: stableTimestamp,
        license: "GPL-3.0-only",
        ci: {
          state: configuredCi?.state ?? "unconfigured",
          label: configuredCi?.label ?? "Not configured",
          workflow,
          url: null,
          checkedAt: workflow ? stableTimestamp : null,
          headSha: null,
        },
        release: index === 0
          ? {
              tag: "v0.1.0",
              name: "Foundation",
              url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases/tag/v0.1.0`,
              publishedAt: stableTimestamp,
              download: null,
            }
          : null,
      };
    }),
    freshness: { generatedAt: now.toISOString(), source: "synthetic-demo", mode: "demo" },
  };
}

function utcDayTimestamp(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function lifecycleFor(name: string, lifecycles: ReadonlyMap<string, ProjectLifecycle>): ProjectLifecycle {
  const lifecycle = lifecycles.get(name.toLowerCase());
  if (!lifecycle) throw new Error("Every project requires an explicit core lifecycle");
  return lifecycle;
}
