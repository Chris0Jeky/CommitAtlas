import assert from "node:assert/strict";
import test from "node:test";
import { parseLifecycleMap, parseRepositoryNames, parseWorkflowMap } from "@/lib/github/validation";
import {
  buildStudioConfigurationKey,
  buildStudioRouteUrl,
  resolveStudioBaseUrl,
  type StudioCardKind,
} from "./studio-urls";

const projects = [
  { repo: "alpha", lifecycle: "active", workflow: "ci file.yml" },
  { repo: " beta ", lifecycle: "planned", workflow: " docs.yml " },
  { repo: "gamma", lifecycle: "paused", workflow: "  " },
];

test("builds all five shipped card paths", () => {
  const paths: Record<StudioCardKind, string> = {
    profile: "/api/v1/cards/profile.svg",
    streak: "/api/v1/cards/streak.svg",
    activity: "/api/v1/cards/activity.svg",
    languages: "/api/v1/cards/languages.svg",
    projects: "/api/v1/projects.svg",
  };

  for (const [kind, expectedPath] of Object.entries(paths) as [StudioCardKind, string][]) {
    const url = buildStudioRouteUrl(kind, { owner: "octocat", theme: "ember", demo: true, projects });
    assert.equal(new URL(`https://example.test${url}`).pathname, expectedPath);
  }
});

test("uses separate JSON and SVG project route paths", () => {
  const options = { owner: "octocat", theme: "paper", demo: false, projects };
  const json = new URL(`https://example.test${buildStudioRouteUrl("projects", options, "json")}`);
  const svg = new URL(`https://example.test${buildStudioRouteUrl("projects", options, "svg")}`);
  assert.equal(json.pathname, "/api/v1/projects");
  assert.equal(svg.pathname, "/api/v1/projects.svg");
  assert.equal(json.searchParams.has("theme"), false);
  assert.equal(svg.searchParams.get("theme"), "paper");
});

test("propagates only aligned, nonblank workflows with URL encoding", () => {
  const url = buildStudioRouteUrl("projects", { owner: "octocat", theme: "ember", demo: true, projects });
  const parsed = new URL(`https://example.test${url}`);
  assert.equal(parsed.searchParams.get("workflows"), "alpha:ci file.yml,beta:docs.yml");
  assert.match(url, /workflows=alpha%3Aci\+file\.yml%2Cbeta%3Adocs\.yml/);
});

test("round-trips workflow identities containing map delimiters", () => {
  const url = buildStudioRouteUrl("projects", {
    owner: "octocat",
    theme: "ember",
    demo: true,
    projects: [{ repo: "alpha", lifecycle: "active", workflow: "ci,release:nightly.yml" }],
  });
  const value = new URL(`https://example.test${url}`).searchParams.get("workflows");
  assert.equal(value, "alpha:ci%2Crelease%3Anightly.yml");
  assert.equal(parseWorkflowMap(value, ["alpha"]).get("alpha"), "ci,release:nightly.yml");
});

test("keeps the full six-project UI contract parseable by the receiving route", () => {
  const longProjects = Array.from({ length: 6 }, (_, index) => ({
    repo: `${String.fromCharCode(97 + index)}${"x".repeat(99)}`,
    lifecycle: "maintenance",
    workflow: "ci,release.yml",
  }));
  const url = new URL(`https://example.test${buildStudioRouteUrl("projects", {
    owner: "octocat",
    theme: "ember",
    demo: true,
    projects: longProjects,
  })}`);
  const repositories = parseRepositoryNames(url.searchParams.get("repos"));
  assert.equal(parseLifecycleMap(url.searchParams.get("states"), repositories).size, 6);
  assert.equal(parseWorkflowMap(url.searchParams.get("workflows"), repositories).size, 6);
});

test("omits workflows when every configured workflow is blank", () => {
  const url = buildStudioRouteUrl("projects", {
    owner: "octocat",
    theme: "midnight",
    demo: false,
    projects: [{ repo: "alpha", lifecycle: "active", workflow: " " }],
  });
  assert.equal(new URL(`https://example.test${url}`).searchParams.has("workflows"), false);
});

test("preserves user, theme, days, and demo query semantics", () => {
  const activity = new URL(`https://example.test${buildStudioRouteUrl("activity", {
    owner: "octocat",
    theme: "aurora",
    demo: false,
    days: 120,
  })}`);
  assert.equal(activity.searchParams.get("user"), "octocat");
  assert.equal(activity.searchParams.get("theme"), "aurora");
  assert.equal(activity.searchParams.get("days"), "120");
  assert.equal(activity.searchParams.get("demo"), "false");

  const project = new URL(`https://example.test${buildStudioRouteUrl("projects", {
    owner: "octocat",
    theme: "paper",
    demo: true,
    projects: [{ repo: "alpha", lifecycle: "active" }],
  })}`);
  assert.equal(project.searchParams.get("theme"), "paper");
  assert.equal(project.searchParams.get("demo"), "true");
});

test("binds a successful origin to the exact route-affecting configuration", () => {
  const baseline = { owner: " Octocat ", theme: "ember", demo: true, projects };
  const key = buildStudioConfigurationKey(baseline);

  assert.equal(key, buildStudioConfigurationKey({
    ...baseline,
    owner: "octocat",
    projects: projects.map((project) => ({ ...project, repo: project.repo.trim() })),
  }));
  assert.notEqual(key, buildStudioConfigurationKey({ ...baseline, owner: "other" }));
  assert.notEqual(key, buildStudioConfigurationKey({ ...baseline, theme: "paper" }));
  assert.notEqual(key, buildStudioConfigurationKey({ ...baseline, demo: false }));
  assert.notEqual(key, buildStudioConfigurationKey({
    ...baseline,
    projects: projects.map((project, index) => index === 0 ? { ...project, lifecycle: "paused" } : project),
  }));
  assert.notEqual(key, buildStudioConfigurationKey({
    ...baseline,
    projects: projects.map((project, index) => index === 0 ? { ...project, workflow: "other.yml" } : project),
  }));

  const validated = { key, origin: "https://atlas.example" };
  assert.equal(resolveStudioBaseUrl(key, validated, "https://placeholder.example"), "https://atlas.example");
  assert.equal(resolveStudioBaseUrl("changed", validated, "https://placeholder.example"), "https://placeholder.example");
});
