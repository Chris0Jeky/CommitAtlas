import assert from "node:assert/strict";
import test from "node:test";
import { demoContributions, demoProfile, demoProjects } from "@commit-atlas/github";
import {
  assembleStaticPortfolio,
  parseStaticConfig,
  renderStaticArtifacts,
} from "../dist/index.js";

const NOW = new Date("2026-08-20T12:00:00.000Z");

const staticConfig = parseStaticConfig({
  version: 1,
  user: "octocat",
  theme: "ember",
  days: 84,
  motion: "none",
  layout: "wide",
  outputDir: "assets/commitatlas",
  cards: ["atlas", "streak", "activity", "cadence"],
  projects: [{
    repo: "octocat/atlas",
    label: "Atlas",
    lifecycle: "active",
    workflow: "ci.yml",
  }],
});

test("static assembly exposes the same validated calendar order used for metrics", () => {
  const profile = demoProfile("octocat", NOW);
  const contributions = demoContributions("octocat", 84, NOW);
  const projects = demoProjects(
    "octocat",
    ["atlas"],
    new Map([["atlas", "active"]]),
    new Map([["atlas", "ci.yml"]]),
    NOW,
  );

  const ordered = assembleStaticPortfolio(profile, contributions, projects);
  const reversed = assembleStaticPortfolio(profile, {
    ...contributions,
    days: [...contributions.days].reverse(),
  }, projects);

  assert.deepEqual(reversed.contributions.days, ordered.contributions.days);
  assert.deepEqual(
    renderStaticArtifacts(reversed, staticConfig),
    renderStaticArtifacts(ordered, staticConfig),
  );
});

test("static calendars show one observed year while streak cards retain the full history", () => {
  const now = new Date("2024-03-02T12:00:00.000Z");
  const days = Array.from({ length: 731 }, (_, index) => ({
    date: new Date(Date.UTC(2024, 2, 2 - (730 - index))).toISOString().slice(0, 10),
    count: index === 0 ? 0 : 1,
    level: index === 0 ? 0 : 2,
  }));
  const contributions = {
    ...demoContributions("octocat", "auto", now),
    totalContributions: 730,
    commits: 730, issues: 0, pullRequests: 0, reviews: 0,
    days: [...days].reverse(),
  };
  const snapshot = assembleStaticPortfolio(
    demoProfile("octocat", now), contributions, demoProjects("octocat", [], new Map(), new Map(), now),
  );
  const artifacts = renderStaticArtifacts(snapshot, {
    ...staticConfig, days: "auto", cards: ["atlas", "streak", "activity"], responsiveAtlas: true,
  });

  assert.equal(snapshot.contributions.days.length, 731);
  assert.equal(snapshot.metrics.window.days, 731);
  assert.equal(snapshot.metrics.streak.current, 730);
  assert.equal(snapshot.metrics.streak.longest, 730);
  assert.match(artifacts["activity.svg"], /365 contributions/);
  assert.match(artifacts["activity.svg"], /2023-03-04 → 2024-03-02/);
  assert.doesNotMatch(artifacts["activity.svg"], /2023-03-03/);
  assert.match(artifacts["streak.svg"], /Longest observed in the 731-day window: 730 days/);
  for (const name of ["atlas.svg", "atlas-compact.svg"]) {
    assert.match(artifacts[name], /730d/);
    assert.match(artifacts[name], /2023-03-04/);
  }
});
