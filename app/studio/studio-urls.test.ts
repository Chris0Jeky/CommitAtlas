import assert from "node:assert/strict";
import test from "node:test";
import { parseLifecycleMap, parseRepositoryNames, parseWorkflowMap } from "@/lib/github/validation";
import {
  buildStudioConfigurationKey,
  buildStudioRouteUrl,
  isCopyableStudioOrigin,
  isStudioPreviewCurrent,
  resolveStudioBaseUrl,
  type StudioCardKind,
} from "./studio-urls";

test("copies embeds only from a deployed HTTPS Studio origin", () => {
  assert.equal(isCopyableStudioOrigin("https://commit-atlas.example"), true);
  assert.equal(isCopyableStudioOrigin("https://preview.commit-atlas.example"), true);
  assert.equal(isCopyableStudioOrigin("http://commit-atlas.example"), false);
  assert.equal(isCopyableStudioOrigin("http://localhost:3000"), false);
  assert.equal(isCopyableStudioOrigin("https://localhost:3000"), false);
  assert.equal(isCopyableStudioOrigin("http://127.0.0.1:3000"), false);
  assert.equal(isCopyableStudioOrigin("http://[::1]:3000"), false);
  assert.equal(isCopyableStudioOrigin("https://atlas.local"), false);
  assert.equal(isCopyableStudioOrigin("not a URL"), false);
});

const projects = [
  { repo: "alpha", lifecycle: "active", workflow: "ci file.yml" },
  { repo: " beta ", lifecycle: "planned", workflow: " docs.yml " },
  { repo: "gamma", lifecycle: "paused", workflow: "  " },
];

test("builds all eight shipped card paths", () => {
  const paths: Record<StudioCardKind, string> = {
    atlas: "/api/v1/cards/atlas.svg",
    profile: "/api/v1/cards/profile.svg",
    streak: "/api/v1/cards/streak.svg",
    breakdown: "/api/v1/cards/breakdown.svg",
    rhythm: "/api/v1/cards/rhythm.svg",
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
  assert.equal(json.searchParams.has("motion"), false);
  assert.equal(svg.searchParams.get("theme"), "paper");
  assert.equal(svg.searchParams.get("motion"), "none");
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
  assert.equal(activity.searchParams.get("motion"), "none");

  const atlas = new URL(`https://example.test${buildStudioRouteUrl("atlas", {
    owner: "octocat",
    theme: "ember",
    demo: true,
    days: 365,
    motion: "none",
    layout: "compact",
    projects,
  })}`);
  assert.equal(atlas.searchParams.get("user"), "octocat");
  assert.equal(atlas.searchParams.get("motion"), "none");
  assert.equal(atlas.searchParams.get("layout"), "compact");
  assert.equal(atlas.searchParams.get("repos"), "alpha,beta,gamma");

  const project = new URL(`https://example.test${buildStudioRouteUrl("projects", {
    owner: "octocat",
    theme: "paper",
    demo: true,
    projects: [{ repo: "alpha", lifecycle: "active" }],
  })}`);
  assert.equal(project.searchParams.get("theme"), "paper");
  assert.equal(project.searchParams.get("demo"), "true");
  assert.equal(project.searchParams.get("motion"), "none");
});

test("emits card URLs in the public route canonical order", () => {
  assert.equal(buildStudioRouteUrl("profile", {
    owner: "octocat",
    theme: "ember",
    demo: true,
    motion: "subtle",
  }), "/api/v1/cards/profile.svg?user=octocat&demo=true&theme=ember&motion=subtle");
  assert.equal(buildStudioRouteUrl("activity", {
    owner: "octocat",
    theme: "paper",
    demo: true,
    days: 90,
  }), "/api/v1/cards/activity.svg?user=octocat&demo=true&theme=paper&days=90&motion=none");
  assert.equal(buildStudioRouteUrl("breakdown", {
    owner: "octocat",
    theme: "paper",
    demo: true,
    days: 30,
  }), "/api/v1/cards/breakdown.svg?user=octocat&demo=true&theme=paper&days=30&motion=none");
  assert.equal(buildStudioRouteUrl("rhythm", {
    owner: "octocat",
    theme: "aurora",
    demo: false,
    days: 120,
  }), "/api/v1/cards/rhythm.svg?user=octocat&demo=false&theme=aurora&days=120&motion=none");
  assert.equal(buildStudioRouteUrl("atlas", {
    owner: "octocat",
    theme: "ember",
    demo: true,
    days: 365,
    motion: "none",
    layout: "compact",
  }), "/api/v1/cards/atlas.svg?user=octocat&demo=true&theme=ember&days=365&motion=none&layout=compact");
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
  assert.notEqual(key, buildStudioConfigurationKey({ ...baseline, motion: "none" }));
  assert.notEqual(key, buildStudioConfigurationKey({ ...baseline, layout: "compact" }));
  assert.notEqual(key, buildStudioConfigurationKey({
    ...baseline,
    projects: projects.map((project, index) => index === 0 ? { ...project, lifecycle: "paused" } : project),
  }));
  assert.notEqual(key, buildStudioConfigurationKey({
    ...baseline,
    projects: projects.map((project, index) => index === 0 ? { ...project, workflow: "other.yml" } : project),
  }));

  const validated = { key, origin: "https://atlas.example" };
  assert.equal(isStudioPreviewCurrent(key, validated), true);
  assert.equal(isStudioPreviewCurrent("changed", validated), false);
  assert.equal(isStudioPreviewCurrent(key, null), false);
  assert.equal(resolveStudioBaseUrl(key, validated, "https://placeholder.example"), "https://atlas.example");
  assert.equal(resolveStudioBaseUrl("changed", validated, "https://placeholder.example"), "https://placeholder.example");
});
