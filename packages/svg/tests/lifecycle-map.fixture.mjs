export const OBSERVED_AT = "2026-01-17T12:00:00.000Z";
export function project(name, lifecycle = "active", state = "passing", releaseState = "none") {
  return {
    repo: `scene-demo/${name.toLowerCase()}`, name, description: null,
    sourceUrl: `https://github.com/scene-demo/${name.toLowerCase()}`, websiteUrl: null,
    lifecycle, primaryLanguage: null, stars: 0, forks: 0, openIssuesAndPullRequests: 0,
    pushedAt: null, license: null,
    ci: { state, label: state, workflow: state === "unconfigured" ? null : "ci.yml", url: null,
      checkedAt: state === "unconfigured" || state === "unavailable" ? null : "2026-01-17T10:00:00Z", headSha: null },
    releaseState, release: releaseState === "published" ? {
      tag: "v1.0.0", name: "Release", url: `https://github.com/scene-demo/${name.toLowerCase()}/releases/tag/v1`,
      publishedAt: "2026-01-16T09:00:00Z", download: null,
    } : null,
  };
}
export function inputs(projects = [
  project("Alpha", "planned", "passing"), project("Bravo", "active", "pending", "published"),
  project("Charlie", "maintained", "unavailable", "unavailable"),
  project("Delta", "paused", "unconfigured"), project("Echo", "archived", "failing"),
]) {
  return { snapshot: {
    version: 1, freshness: { generatedAt: OBSERVED_AT, source: "synthetic-demo", mode: "demo" },
    projects: { version: 1, owner: "scene-demo", projects,
      freshness: { generatedAt: OBSERVED_AT, source: "synthetic-demo", mode: "demo" } },
  } };
}
export function live(value = inputs()) {
  value.snapshot.freshness.source = "github-rest"; value.snapshot.freshness.mode = "live";
  value.snapshot.projects.freshness.source = "github-rest"; value.snapshot.projects.freshness.mode = "live";
  return value;
}
