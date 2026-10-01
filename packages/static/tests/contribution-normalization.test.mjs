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
