import { describe, expect, it } from "vitest";
import {
  aggregateLanguages,
  calculateActivitySeries,
  calculateCiState,
  calculateProjectState,
  calculateStreaks,
  parseContributionCalendar,
  parseManifest,
  parseOptions,
  parseRepo,
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

  it("rejects untrusted manifest links while retaining XML-like labels as plain data", () => {
    expect(parseManifest({ version: 1, projects: [{ repo: "owner/repo", label: "<b>plain</b>", lifecycle: "active", links: { docs: "https://github.com/owner/repo/docs" } }] }).projects[0]?.label).toBe("<b>plain</b>");
    expect(() => parseManifest({ version: 1, projects: [{ repo: "owner/repo", label: "repo", lifecycle: "active", links: { docs: "http://localhost/docs" } }] })).toThrow();
  });

  it("calculates current and longest UTC streaks across a leap day and a gap", () => {
    expect(calculateStreaks(calendar, { asOf: "2024-02-29" })).toMatchObject({ current: 2, longest: 2 });
    expect(calculateStreaks(calendar, { asOf: "2024-03-03" })).toMatchObject({ current: 1, longest: 2 });
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
    expect(() => calculateActivitySeries(calendar, { asOf: "2024-03-03", days: 367 })).toThrow();
  });

  it("labels language totals as repository bytes, not proficiency", () => {
    expect(aggregateLanguages([{ repo: "owner/a", languages: { TypeScript: 80, JavaScript: 20 } }, { repo: "owner/b", languages: { TypeScript: 20 } }])).toMatchObject({ basis: "repository-language-bytes", notProficiency: true, totalBytes: 120 });
  });

  it("keeps CI uncertainty explicit", () => {
    expect(calculateCiState({ available: true, configured: false }, "2024-03-03T00:00:00Z").state).toBe("unconfigured");
    expect(calculateCiState({ available: true, configured: true, conclusion: "success", updatedAt: "2024-02-20T00:00:00Z" }, "2024-03-03T00:00:00Z").state).toBe("stale");
    expect(calculateCiState({ available: false, configured: true }, "2024-03-03T00:00:00Z").state).toBe("unavailable");
    expect(calculateProjectState({ repo: "owner/repo", label: "Repo", lifecycle: "planned", links: {} }, { available: true, configured: false }, "2024-03-03T00:00:00Z")).toMatchObject({ lifecycle: "planned", ci: { state: "unconfigured" } });
  });

  it("canonicalizes and bounds option values", () => {
    expect(parseOptions({ theme: "light", days: "14", showTitle: "false" })).toEqual({ version: 1, theme: "light", locale: "en", showTitle: false, days: 14, limit: 6, staleAfterHours: 72 });
    expect(() => parseOptions({ days: 0 })).toThrow();
    expect(() => parseOptions({ unknown: "value" })).toThrow();
  });

  it("rejects duplicate contribution days", () => {
    expect(() => parseContributionCalendar({ version: 1, days: [{ date: "2024-02-29", count: 1 }, { date: "2024-02-29", count: 2 }] })).toThrow();
  });
});
