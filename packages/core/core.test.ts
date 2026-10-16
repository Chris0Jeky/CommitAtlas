import { describe, expect, it } from "vitest";
import {
  aggregateLanguages,
  calculateActivitySeries,
  calculateCiState,
  calculateContributionMetrics,
  calculateProjectState,
  calculateStreaks,
  parseContributionCalendar,
  parseHandle,
  parseManifest,
  parseOptions,
  parseRepo,
  parseRepositorySlug,
  resolveAutoWindow,
} from "./src/index.js";

const calendar = {
  version: 1 as const,
  days: [
    { date: "2024-02-28", count: 1, level: 1 },
    { date: "2024-02-29", count: 2, level: 2 },
    { date: "2024-03-01", count: 0, level: 0 },
    { date: "2024-03-03", count: 1, level: 1 },
  ],
};

describe("core contracts", () => {
  it("canonicalizes GitHub handles and repository owners", () => {
    expect(parseRepo({ version: 1, owner: "Chris0Jeky", name: "CommitAtlas" })).toEqual({ version: 1, owner: "chris0jeky", name: "CommitAtlas" });
    expect(() => parseRepo({ version: 1, owner: "bad owner", name: "repo" })).toThrow();
  });

  it("shares one repository validator and allows dot-prefixed names", () => {
    expect(parseRepo({ version: 1, owner: "owner", name: ".github" }).name).toBe(".github");
    expect(parseRepositorySlug("Owner/.github")).toBe("owner/.github");
    expect(parseManifest({ version: 1, projects: [{ repo: "Owner/.github", label: "GitHub metadata", lifecycle: "active", links: {} }] }).projects[0]?.repo).toBe("owner/.github");
    expect(() => parseRepo({ version: 1, owner: "owner", name: "." })).toThrow();
    expect(() => parseRepo({ version: 1, owner: "owner", name: ".." })).toThrow();
    expect(() => parseRepositorySlug("owner/.")).toThrow();
    expect(() => parseRepositorySlug("owner/..")).toThrow();
    expect(() => aggregateLanguages([{ repo: "owner/.", languages: {} }])).toThrow();
  });

  it("rejects untrusted manifest links while retaining XML-like labels as plain data", () => {
    expect(parseManifest({ version: 1, projects: [{ repo: "owner/repo", label: "<b>plain</b>", lifecycle: "active", links: { docs: "https://github.com/owner/repo/docs" } }] }).projects[0]?.label).toBe("<b>plain</b>");
    expect(() => parseManifest({ version: 1, projects: [{ repo: "owner/repo", label: "repo", lifecycle: "active", links: { docs: "http://localhost/docs" } }] })).toThrow();
  });

  it("rejects duplicate manifest repositories after full-slug normalization", () => {
    expect(() => parseManifest({
      version: 1,
      projects: [
        { repo: "  Owner/Repo  ", label: "first", lifecycle: "active", links: {} },
        { repo: "owner/repo", label: "second", lifecycle: "active", links: {} },
      ],
    })).toThrow("Duplicate repository");
  });

  it("rejects unsafe workflow identities while retaining valid filename and numeric forms", () => {
    const manifest = (workflow: string) => ({
      version: 1 as const,
      projects: [{ repo: "owner/repo", label: "repo", lifecycle: "active" as const, workflow, links: {} }],
    });

    for (const workflow of [".", "..", ".github/../ci.yml", ".github\\..\\ci.yml", "ci\u0000.yml", "ci\n.yml", "ci\u007f.yml"]) {
      expect(() => parseManifest(manifest(workflow)), workflow).toThrow();
    }

    for (const workflow of ["  ci.yml  ", "12345", ".github/workflows/build.yml", ".github\\workflows\\build.yml", "encoded-%2e%2e.yml"]) {
      expect(parseManifest(manifest(workflow)).projects[0]?.workflow).toBe(workflow.trim());
    }
  });

  it("rejects empty workflow identities at parse time", () => {
    const manifest = (workflow: string) => ({
      version: 1 as const,
      projects: [{ repo: "owner/repo", label: "repo", lifecycle: "active" as const, workflow, links: {} }],
    });

    for (const workflow of ["", "   "]) {
      expect(() => parseManifest(manifest(workflow)), JSON.stringify(workflow)).toThrow();
    }
  });

  it("calculates current and longest UTC streaks across a leap day and a gap", () => {
    expect(calculateStreaks(calendar, { asOf: "2024-02-29" })).toMatchObject({
      current: 2,
      currentThrough: "2024-02-29",
      longest: 2,
    });
    expect(calculateStreaks(calendar, { asOf: "2024-03-03" })).toMatchObject({
      current: 1,
      currentThrough: "2024-03-03",
      longest: 2,
    });
  });

  it("keeps yesterday's streak current while the observed as-of day is still inactive", () => {
    const openDay = [
      { date: "2024-03-01", count: 1, level: 1 },
      { date: "2024-03-02", count: 1, level: 1 },
      { date: "2024-03-03", count: 0, level: 0 },
    ];
    expect(calculateStreaks(openDay, { asOf: "2024-03-03", currentDay: "open" })).toMatchObject({
      current: 2,
      currentThrough: "2024-03-02",
      longest: 2,
    });
    expect(calculateStreaks(openDay, { asOf: "2024-03-03" })).toMatchObject({
      current: 0,
      currentThrough: null,
    });

    const brokenBeforeToday = [
      { date: "2024-03-01", count: 1, level: 1 },
      { date: "2024-03-02", count: 0, level: 0 },
      { date: "2024-03-03", count: 0, level: 0 },
    ];
    expect(calculateStreaks(brokenBeforeToday, { asOf: "2024-03-03", currentDay: "open" })).toMatchObject({
      current: 0,
      currentThrough: null,
      longest: 1,
    });

    expect(calculateStreaks(openDay.slice(0, 2), { asOf: "2024-03-03", currentDay: "open" })).toMatchObject({
      current: 0,
      currentThrough: null,
    });
  });

  it("discloses streaks that can continue before the returned boundary", () => {
    const allActive = [
      { date: "2024-03-01", count: 1, level: 1 },
      { date: "2024-03-02", count: 1, level: 1 },
      { date: "2024-03-03", count: 1, level: 1 },
    ];
    expect(calculateStreaks(allActive, { asOf: "2024-03-03" })).toMatchObject({
      current: 3,
      longest: 3,
      boundary: { current: "open", longest: "open" },
    });

    const boundaryRunOnly = [
      { date: "2024-03-01", count: 1, level: 1 },
      { date: "2024-03-02", count: 0, level: 0 },
      { date: "2024-03-03", count: 1, level: 1 },
    ];
    expect(calculateStreaks(boundaryRunOnly, { asOf: "2024-03-03" })).toMatchObject({
      current: 1,
      longest: 1,
      boundary: { current: "closed", longest: "open" },
    });

    const closed = [{ date: "2024-03-01", count: 0, level: 0 }, ...allActive.slice(1)];
    expect(calculateStreaks(closed, { asOf: "2024-03-03" })).toMatchObject({
      current: 2,
      longest: 2,
      boundary: { current: "closed", longest: "closed" },
    });
  });

  it("excludes future dates from current and longest streaks", () => {
    const calendarWithFutureRun = {
      version: 1 as const,
      days: [
        { date: "2024-02-27", count: 1, level: 1 },
        { date: "2024-02-28", count: 1, level: 1 },
        { date: "2024-03-01", count: 1, level: 1 },
        { date: "2024-03-02", count: 1, level: 1 },
        { date: "2024-03-03", count: 1, level: 1 },
        { date: "2024-03-04", count: 1, level: 1 },
      ],
    };

    expect(calculateStreaks(calendarWithFutureRun, { asOf: "2024-02-28" })).toMatchObject({ current: 2, longest: 2 });
  });

  it("bounds activity and fills missing dates deterministically", () => {
    const series = calculateActivitySeries(calendar, { asOf: "2024-03-03", days: 5 });
    expect(series.from).toBe("2024-02-28");
    expect(series.points.map((point) => point.date)).toEqual(["2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02", "2024-03-03"]);
    expect(series.points[3]?.count).toBe(0);
    expect(() => calculateActivitySeries(calendar, { asOf: "2024-03-03", days: 732 })).toThrow();
    expect(calculateActivitySeries(calendar, { asOf: "2024-03-03", days: 731 }).points).toHaveLength(731);
  });

  it("resolves automatic windows from the earliest active day", () => {
    const history = (length: number, activeFrom: number) => Array.from({ length }, (_, index) => ({
      date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10),
      count: index < activeFrom ? 0 : 1,
    }));
    expect(resolveAutoWindow(history(731, 231))).toBe(500);
    expect(resolveAutoWindow(history(731, 728))).toBe(7);
    expect(resolveAutoWindow(history(731, 0))).toBe(731);
    expect(resolveAutoWindow(history(731, 731))).toBe(731);
    expect(resolveAutoWindow(history(100, 0))).toBe(100);
    expect(resolveAutoWindow(history(50, 50))).toBe(50);
    expect(resolveAutoWindow([...history(731, 231)].reverse())).toBe(500);
    expect(() => resolveAutoWindow([])).toThrow("empty calendar");
  });

  it("rejects automatic windows with invalid dates", () => {
    expect(() => resolveAutoWindow([{ date: "not-a-date", count: 1 }])).toThrow();
  });

  it("derives a transparent contribution summary without claiming a global rank", () => {
    const days = Array.from({ length: 84 }, (_, index) => ({
      date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10),
      count: index % 4 === 0 ? 0 : index % 7 + 1,
      level: index % 4 === 0 ? 0 : 2,
    }));
    const metrics = calculateContributionMetrics(days, {
      asOf: "2024-03-24",
      days: 84,
      commits: 120,
      issues: 8,
      pullRequests: 14,
      reviews: 22,
      trendWeeks: 12,
    });

    expect(metrics.window).toEqual({
      from: "2024-01-01",
      to: "2024-03-24",
      days: 84,
      observedDays: 84,
      complete: true,
    });
    expect(metrics.activeDays).toBe(63);
    expect(metrics.density).toBe(75);
    expect(metrics.breakdown).toEqual({ commits: 120, issues: 8, pullRequests: 14, reviews: 22 });
    expect(metrics.trend.buckets).toHaveLength(12);
    expect(metrics.rhythm.score).toBeGreaterThanOrEqual(0);
    expect(metrics.rhythm.score).toBeLessThanOrEqual(100);
    expect(metrics.rhythm.basis).toContain("active-day density");
    expect(metrics).not.toHaveProperty("globalRank");
    expect(metrics).not.toHaveProperty("percentile");
  });

  it("distinguishes exact integer counts from public profile activity percentages", () => {
    const day = [{ date: "2024-03-03", count: 1, level: 1 }];
    const percentages = calculateContributionMetrics(day, {
      asOf: "2024-03-03",
      days: 1,
      commits: 77.8,
      issues: 6.7,
      pullRequests: 12.6,
      reviews: 2.9,
      breakdownBasis: "public-profile-percentages",
    });
    expect(percentages.breakdownBasis).toBe("public-profile-percentages");
    expect(percentages.breakdown.commits).toBe(77.8);
    expect(() => calculateContributionMetrics(day, {
      asOf: "2024-03-03",
      days: 1,
      commits: 1.5,
      issues: 0,
      pullRequests: 0,
      reviews: 0,
      breakdownBasis: "exact-counts",
    })).toThrow("safe integers");
  });

  it("reports incomplete contribution coverage instead of silently treating missing days as observed zeroes", () => {
    const metrics = calculateContributionMetrics(calendar, {
      asOf: "2024-03-03",
      days: 5,
      commits: 3,
      issues: 0,
      pullRequests: 0,
      reviews: 0,
    });

    expect(metrics.window).toMatchObject({ observedDays: 4, complete: false });
    expect(metrics.total).toBe(4);
  });

  it("bounds the longest streak to the requested metrics window", () => {
    const days = Array.from({ length: 10 }, (_, index) => ({
      date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10),
      count: index < 6 || index >= 8 ? 1 : 0,
      level: index < 6 || index >= 8 ? 1 : 0,
    }));
    const metrics = calculateContributionMetrics(days, {
      asOf: "2024-01-10",
      days: 4,
      commits: 2,
      issues: 0,
      pullRequests: 0,
      reviews: 0,
    });

    expect(metrics.streak).toMatchObject({ current: 2, longest: 2, basis: "returned-window" });
  });

  it("labels language totals as repository bytes, not proficiency", () => {
    expect(aggregateLanguages([{ repo: "owner/a", languages: { TypeScript: 80, JavaScript: 20 } }, { repo: "owner/b", languages: { TypeScript: 20 } }])).toMatchObject({ basis: "repository-language-bytes", notProficiency: true, totalBytes: 120 });
  });

  it("rejects duplicate language repositories case-insensitively", () => {
    expect(() => aggregateLanguages([
      { repo: "Owner/Repo", languages: { TypeScript: 80 } },
      { repo: "owner/repo", languages: { TypeScript: 20 } },
    ])).toThrow("Duplicate repository");
  });

  it("keeps CI uncertainty explicit", () => {
    expect(calculateCiState({ available: true, configured: false }, "2024-03-03T00:00:00Z").state).toBe("unconfigured");
    expect(calculateCiState({ available: true, configured: true, conclusion: "success", updatedAt: "2024-02-20T00:00:00Z" }, "2024-03-03T00:00:00Z").state).toBe("stale");
    expect(calculateCiState({ available: false, configured: true }, "2024-03-03T00:00:00Z").state).toBe("unavailable");
    expect(calculateProjectState({ repo: "owner/repo", label: "Repo", lifecycle: "planned", links: {} }, { available: true, configured: false }, "2024-03-03T00:00:00Z")).toMatchObject({ lifecycle: "planned", ci: { state: "unconfigured" } });
  });

  it("does not treat future CI observations as fresh", () => {
    const now = "2024-03-03T00:00:00Z";
    const success = { available: true, configured: true, conclusion: "success" as const };

    expect(calculateCiState({ ...success, updatedAt: now }, now)).toMatchObject({ state: "passing" });
    expect(calculateCiState({ ...success, updatedAt: "2024-03-03T00:00:01Z" }, now)).toMatchObject({ state: "unavailable", reason: "CI observation is dated in the future" });
    expect(calculateCiState({ ...success, updatedAt: "2024-03-02T23:59:59Z" }, now)).toMatchObject({ state: "passing" });
  });

  it("maps failing, pending, and unknown CI conclusions without treating them as passing", () => {
    const now = "2024-03-03T00:00:00Z";
    const fresh = { available: true, configured: true, updatedAt: "2024-03-02T00:00:00Z" };
    for (const conclusion of ["failure", "cancelled", "timed_out"] as const) {
      expect(calculateCiState({ ...fresh, conclusion }, now)).toMatchObject({ state: "failing", reason: "CI is failing" });
    }
    for (const conclusion of ["in_progress", "queued"] as const) {
      expect(calculateCiState({ ...fresh, conclusion }, now)).toMatchObject({ state: "pending", reason: "CI is pending" });
    }
    for (const conclusion of ["neutral", "action_required"] as const) {
      expect(calculateCiState({ ...fresh, conclusion }, now)).toMatchObject({ state: "unavailable", reason: "CI conclusion is unknown" });
    }
    expect(calculateCiState(fresh, now)).toMatchObject({ state: "unavailable", reason: "CI conclusion is unknown" });
  });

  it("canonicalizes and bounds option values", () => {
    expect(parseOptions({ theme: "light", days: "14", showTitle: "false" })).toEqual({ version: 1, theme: "light", locale: "en", showTitle: false, days: 14, limit: 6, staleAfterHours: 72 });
    expect(() => parseOptions({ days: 0 })).toThrow();
    expect(() => parseOptions({ unknown: "value" })).toThrow();
  });

  it("rejects duplicate contribution days", () => {
    expect(() => parseContributionCalendar({ version: 1, days: [{ date: "2024-02-29", count: 1 }, { date: "2024-02-29", count: 2 }] })).toThrow();
  });

  it("rejects empty raw calendars while preserving explicit zero-contribution days", () => {
    expect(() => calculateStreaks([], { asOf: "2024-03-03" })).toThrow();
    expect(() => calculateStreaks({ version: 1, days: [] }, { asOf: "2024-03-03" })).toThrow();

    const zeroDay = [{ date: "2024-03-03", count: 0, level: 0 }];
    expect(calculateStreaks(zeroDay, { asOf: "2024-03-03" })).toMatchObject({ current: 0, longest: 0 });
    expect(calculateActivitySeries(zeroDay, { asOf: "2024-03-03", days: 1 })).toMatchObject({ total: 0, points: [{ date: "2024-03-03", count: 0, level: 0 }] });
  });

  function daysEnding(asOf: string, length: number, countAt: (indexFromStart: number) => number) {
    const end = Date.parse(`${asOf}T00:00:00.000Z`);
    return Array.from({ length }, (_, index) => {
      const date = new Date(end - (length - 1 - index) * 86_400_000).toISOString().slice(0, 10);
      const count = countAt(index);
      return { date, count, level: count > 0 ? 1 : 0 };
    });
  }

  function metricsFor(asOf: string, counts: readonly number[]) {
    return calculateContributionMetrics(daysEnding(asOf, counts.length, (index) => counts[index] ?? 0), {
      asOf,
      days: counts.length,
      commits: 0,
      issues: 0,
      pullRequests: 0,
      reviews: 0,
    });
  }

  it("sums the two 28-day windows and names the direction from those sums", () => {
    const up = metricsFor("2024-03-25", [...Array(28).fill(1), ...Array(28).fill(2)]);
    expect(up.trend.recent28Days).toBe(56);
    expect(up.trend.previous28Days).toBe(28);
    expect(up.trend.direction).toBe("up");
    expect(up.trend.changePercent).toBe(100);

    const down = metricsFor("2024-03-25", [...Array(28).fill(4), ...Array(28).fill(1)]);
    expect(down.trend.recent28Days).toBe(28);
    expect(down.trend.previous28Days).toBe(112);
    expect(down.trend.direction).toBe("down");
    expect(down.trend.changePercent).toBe(-75);

    const flat = metricsFor("2024-03-25", Array(56).fill(1));
    expect(flat.trend.direction).toBe("flat");
    expect(flat.trend.changePercent).toBe(0);

    const fresh = metricsFor("2024-03-25", [...Array(28).fill(0), ...Array(28).fill(3)]);
    expect(fresh.trend.previous28Days).toBe(0);
    expect(fresh.trend.recent28Days).toBe(84);
    expect(fresh.trend.direction).toBe("new");
    expect(fresh.trend.changePercent).toBeNull();

    const quiet = metricsFor("2024-03-25", Array(56).fill(0));
    expect(quiet.trend.direction).toBe("flat");
    expect(quiet.trend.changePercent).toBeNull();

    const short = metricsFor("2024-03-25", Array(20).fill(1));
    expect(short.trend.previous28Days).toBeNull();
    expect(short.trend.recent28Days).toBe(20);
    expect(short.trend.direction).toBe("unavailable");
    expect(short.trend.changePercent).toBeNull();
  });

  it("caps rhythm at the published density and streak ceilings and keeps the level thresholds", () => {
    expect(metricsFor("2024-03-25", Array(10).fill(0)).rhythm).toMatchObject({ score: 0, level: "starting" });

    const dense = metricsFor("2024-03-25", Array(10).fill(1));
    expect(dense.density).toBe(100);
    expect(dense.streak.current).toBe(10);
    expect(dense.rhythm).toMatchObject({ score: 80, level: "relentless" });

    const longStreak = metricsFor("2024-03-25", [...Array(40).fill(0), ...Array(40).fill(1)]);
    expect(longStreak.density).toBe(50);
    expect(longStreak.streak.current).toBe(40);
    expect(longStreak.rhythm).toMatchObject({ score: 74, level: "strong" });

    const scoreForActiveDays = (active: number) => metricsFor("2024-03-25", [...Array(active).fill(1), ...Array(100 - active).fill(0)]).rhythm;
    expect(scoreForActiveDays(22)).toMatchObject({ score: 19, level: "starting" });
    expect(scoreForActiveDays(23)).toMatchObject({ score: 20, level: "building" });
    expect(scoreForActiveDays(45)).toMatchObject({ score: 39, level: "building" });
    expect(scoreForActiveDays(46)).toMatchObject({ score: 40, level: "steady" });
    expect(scoreForActiveDays(67)).toMatchObject({ score: 59, level: "steady" });
    expect(scoreForActiveDays(69)).toMatchObject({ score: 60, level: "strong" });
    // Trailing zeros keep the current streak at 0. Past the 80% density ceiling the density term stays 70.
    expect(scoreForActiveDays(90)).toMatchObject({ score: 70, level: "strong" });
    expect(scoreForActiveDays(91)).toMatchObject({ score: 70, level: "strong" });

    const atDensityCeiling = (streak: number) => {
      const counts = Array(100).fill(0);
      for (let index = 0; index < 80 - streak; index += 1) counts[index] = 1;
      for (let index = 0; index < streak; index += 1) counts[100 - streak + index] = 1;
      return metricsFor("2024-03-25", counts);
    };
    expect(atDensityCeiling(9)).toMatchObject({ density: 80, streak: { current: 9 }, rhythm: { score: 79, level: "strong" } });
    expect(atDensityCeiling(10)).toMatchObject({ density: 80, streak: { current: 10 }, rhythm: { score: 80, level: "relentless" } });
  });

  it("keeps repository name case and lowercases only the owner", () => {
    expect(parseRepositorySlug("Owner/RepoName")).toBe("owner/RepoName");
  });

  it("lowercases a valid handle and rejects a handle the pattern excludes", () => {
    expect(parseHandle({ version: 1, handle: "Chris0Jeky" })).toEqual({ version: 1, handle: "chris0jeky" });
    expect(() => parseHandle({ version: 1, handle: "-bad" })).toThrow();
  });

  it("accepts only credential-free https links on the allowlist", () => {
    const project = (docs: string) => ({
      version: 1,
      projects: [{ repo: "owner/repo", label: "One", lifecycle: "active", links: { docs } }],
    });
    expect(parseManifest(project("https://github.com/owner/repo")).projects[0]?.links.docs).toBe("https://github.com/owner/repo");
    expect(parseManifest(project("https://GitHub.com/owner/repo")).projects[0]?.links.docs).toBe("https://GitHub.com/owner/repo");
    expect(() => parseManifest(project("http://github.com/owner/repo"))).toThrow();
    expect(() => parseManifest(project("https://example.com/docs"))).toThrow();
    expect(() => parseManifest(project("https://user:pass@github.com/owner/repo"))).toThrow();
  });

  it("rejects calendar-impossible dates and sorts a calendar before returning it", () => {
    expect(() => parseContributionCalendar({ version: 1, days: [{ date: "2024-02-30", count: 1, level: 0 }] })).toThrow();
    expect(() => parseContributionCalendar({ version: 1, days: [{ date: "2023-02-29", count: 1, level: 0 }] })).toThrow();
    expect(parseContributionCalendar({ version: 1, days: [{ date: "2024-02-29", count: 1, level: 0 }] }).days[0]?.date).toBe("2024-02-29");
    expect(parseContributionCalendar({
      version: 1,
      days: [
        { date: "2024-03-03", count: 1, level: 0 },
        { date: "2024-03-01", count: 2, level: 1 },
      ],
    }).days.map((day) => day.date)).toEqual(["2024-03-01", "2024-03-03"]);
  });

  it("reports the earliest peak day when counts tie", () => {
    expect(metricsFor("2024-03-03", [2, 5, 5]).peakDay).toEqual({ date: "2024-03-02", count: 5 });
    expect(metricsFor("2024-03-03", [5, 1, 9]).peakDay).toEqual({ date: "2024-03-03", count: 9 });
  });

  it("uses staleAfterHours instead of always applying the 72 hour default", () => {
    const now = "2024-03-25T12:00:00.000Z";
    const observation = {
      available: true,
      configured: true,
      conclusion: "success" as const,
      updatedAt: "2024-03-25T09:00:00.000Z",
    };
    expect(calculateCiState(observation, now).state).toBe("passing");
    expect(calculateCiState(observation, now, 1).state).toBe("stale");
    expect(() => calculateCiState(observation, now, 0)).toThrow(/staleAfterHours/);
    expect(() => calculateCiState(observation, now, 8761)).toThrow(/staleAfterHours/);
  });
});
