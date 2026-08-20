import type {
  ContributionSnapshot,
  ProfileSnapshot,
  ProjectBoardSnapshot,
  ProjectLifecycle,
  ProjectWorkflow,
} from "./types";

export function demoProfile(login: string, now = new Date()): ProfileSnapshot {
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
    latestPushAt: now.toISOString(),
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
    };
  });
  return {
    version: 1,
    login,
    totalContributions: days.reduce((sum, day) => sum + day.count, 0),
    commits: 284,
    issues: 23,
    pullRequests: 61,
    reviews: 74,
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
        openIssues: index * 2,
        pushedAt: now.toISOString(),
        license: "GPL-3.0-only",
        ci: {
          state: configuredCi?.state ?? "unconfigured",
          label: configuredCi?.label ?? "Not configured",
          workflow,
          url: null,
          checkedAt: workflow ? now.toISOString() : null,
          headSha: null,
        },
        release: index === 0
          ? {
              tag: "v0.1.0",
              name: "Foundation",
              url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases/tag/v0.1.0`,
              publishedAt: now.toISOString(),
              download: null,
            }
          : null,
      };
    }),
    freshness: { generatedAt: now.toISOString(), source: "synthetic-demo", mode: "demo" },
  };
}

function lifecycleFor(name: string, lifecycles: ReadonlyMap<string, ProjectLifecycle>): ProjectLifecycle {
  const lifecycle = lifecycles.get(name.toLowerCase());
  if (!lifecycle) throw new Error("Every project requires an explicit core lifecycle");
  return lifecycle;
}
