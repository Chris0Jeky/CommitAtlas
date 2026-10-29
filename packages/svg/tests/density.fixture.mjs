/** Synthetic annual calendar with every threshold and every special silhouette represented. */
export function densityDays(length = 365, countForDay = index => [0, 12, 86, 170, 201, 350, 680, 701, 1100, 1500, 1501, 2400][index % 12]) {
  return Array.from({ length }, (_, index) => ({
    date: new Date(Date.UTC(2026, 9, 29 - length + 1 + index)).toISOString().slice(0, 10),
    count: countForDay(index),
    level: index % 5,
  }));
}

export function densityAtlas(overrides = {}) {
  const activity = densityDays();
  return {
    profile: { name: "Calendar study", login: "synthetic", repositories: 24, followers: 312, stars: 487 },
    window: { from: "2024-10-30", to: "2026-10-29", days: 730 },
    total: 412800, activeDays: 690, density: 94.5, averagePerDay: 565.5,
    currentStreak: 542, longestStreak: 542, streakBasis: "returned-window",
    streakBoundary: { current: "closed", longest: "closed" },
    peakDay: { date: "2025-01-01", count: 9000 },
    breakdown: { commits: 340000, issues: 1800, pullRequests: 62000, reviews: 9000 },
    trend: { buckets: [30, 44, 39, 52, 61, 48, 73, 66, 82, 70, 88, 95], recent28Days: 19335, previous28Days: 17280, changePercent: 11.9, direction: "up" },
    rhythm: { score: 84, level: "relentless" },
    activity,
    languages: [{ name: "TypeScript", percentage: 55 }, { name: "Python", percentage: 30 }, { name: "Rust", percentage: 15 }],
    projects: { total: 6, passing: 4, attention: 1, unavailable: 1 },
    generatedAt: "2026-10-29T18:00:00.000Z", source: "synthetic-demo",
    ...overrides,
  };
}
