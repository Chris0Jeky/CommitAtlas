import assert from "node:assert/strict";
import test from "node:test";
import { buildStudioRouteUrl, type StudioCardKind } from "./studio-urls";

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
