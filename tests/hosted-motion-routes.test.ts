import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { GET as getActivity } from "@/app/api/v1/cards/activity.svg/route";
import { GET as getAtlas } from "@/app/api/v1/cards/atlas.svg/route";
import { GET as getBreakdown } from "@/app/api/v1/cards/breakdown.svg/route";
import { GET as getLanguages } from "@/app/api/v1/cards/languages.svg/route";
import { GET as getProfile } from "@/app/api/v1/cards/profile.svg/route";
import { GET as getRhythm } from "@/app/api/v1/cards/rhythm.svg/route";
import { GET as getStreak } from "@/app/api/v1/cards/streak.svg/route";
import { GET as getProjects } from "@/app/api/v1/projects.svg/route";
import { GitHubClient } from "@/lib/github/client";
import { demoContributions, demoProfile } from "@/lib/github/demo";
import { withWorkerEnv } from "@/lib/runtime-env";
import type { ProjectBoardSnapshot } from "@commit-atlas/github";

type Motion = "none" | "ambient" | "cinematic";
type RouteGet = (request: Request) => Promise<Response>;

const routes: readonly {
  readonly name: string;
  readonly get: RouteGet;
  readonly query: (motion: Motion) => string;
}[] = [
  {
    name: "atlas",
    get: getAtlas,
    query: (motion) => `user=octocat&demo=true&theme=aurora&days=365&motion=${motion}&layout=wide`,
  },
  {
    name: "profile",
    get: getProfile,
    query: (motion) => `user=octocat&demo=true&theme=aurora&motion=${motion}`,
  },
  {
    name: "streak",
    get: getStreak,
    query: (motion) => `user=octocat&demo=true&theme=aurora&days=365&motion=${motion}`,
  },
  {
    name: "breakdown",
    get: getBreakdown,
    query: (motion) => `user=octocat&demo=true&theme=aurora&days=365&motion=${motion}`,
  },
  {
    name: "rhythm",
    get: getRhythm,
    query: (motion) => `user=octocat&demo=true&theme=aurora&days=365&motion=${motion}`,
  },
  {
    name: "activity",
    get: getActivity,
    query: (motion) => `user=octocat&demo=true&theme=aurora&days=365&motion=${motion}`,
  },
  {
    name: "languages",
    get: getLanguages,
    query: (motion) => `user=octocat&demo=true&theme=aurora&motion=${motion}`,
  },
  {
    name: "projects",
    get: getProjects,
    query: (motion) => `owner=octocat&repos=atlas&states=atlas%3Aactive&demo=true&theme=aurora&motion=${motion}`,
  },
];

test("every hosted SVG route accepts ambient and rejects cinematic before network access", async () => {
  await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
    for (const route of routes) {
      const none = await route.get(new Request(`https://example.test/api/v1/${route.name}?${route.query("none")}`));
      assert.equal(none.status, 200, `${route.name} none status`);
      assert.match(
        none.headers.get("content-security-policy") ?? "",
        /style-src 'none'/,
        `${route.name} none CSP`,
      );

      const ambient = await route.get(new Request(`https://example.test/api/v1/${route.name}?${route.query("ambient")}`));
      assert.equal(ambient.status, 200, `${route.name} ambient status`);
      assert.match(
        ambient.headers.get("content-security-policy") ?? "",
        /style-src 'unsafe-inline'/,
        `${route.name} ambient CSP`,
      );

      const cinematic = await route.get(new Request(`https://example.test/api/v1/${route.name}?${route.query("cinematic")}`));
      assert.equal(cinematic.status, 400, `${route.name} cinematic status`);
      const payload = await cinematic.json() as { error?: { message?: string } };
      assert.match(payload.error?.message ?? "", /motion must be none, subtle, or ambient/);
    }
  });
});

// Token-backed SVG cards derive publicData from the configured token, so the same
// route must answer private, no-store. Each route gets its own test; GitHubClient
// methods are mocked per test (restored automatically by node:test) so no network runs.
// Queries are each parser's canonical form, so a publicData:true mutation fails on
// the Cache-Control assertion rather than on a 308 canonical redirect.
const tokenRoutes: readonly { readonly name: string; readonly path: string; readonly get: RouteGet; readonly query: string }[] = [
  { name: "atlas", path: "cards/atlas.svg", get: getAtlas, query: "user=octocat&demo=false&theme=aurora&days=365&motion=none&layout=wide" },
  { name: "profile", path: "cards/profile.svg", get: getProfile, query: "user=octocat&demo=false&theme=aurora&motion=none" },
  { name: "streak", path: "cards/streak.svg", get: getStreak, query: "user=octocat&demo=false&theme=aurora&days=365&motion=none" },
  { name: "breakdown", path: "cards/breakdown.svg", get: getBreakdown, query: "user=octocat&demo=false&theme=aurora&days=365&motion=none" },
  { name: "rhythm", path: "cards/rhythm.svg", get: getRhythm, query: "user=octocat&demo=false&theme=aurora&days=365&motion=none" },
  { name: "activity", path: "cards/activity.svg", get: getActivity, query: "user=octocat&demo=false&theme=aurora&days=365&motion=none" },
  { name: "languages", path: "cards/languages.svg", get: getLanguages, query: "user=octocat&demo=false&theme=aurora&motion=none" },
  { name: "projects", path: "projects.svg", get: getProjects, query: "owner=octocat&repos=atlas&states=atlas%3Aactive&demo=false&theme=aurora&motion=none" },
];

function stubTokenBackedGitHub(t: TestContext): void {
  t.mock.method(GitHubClient.prototype, "fetchProfile", async (login: string) => demoProfile(login));
  t.mock.method(GitHubClient.prototype, "fetchContributions", async (login: string, days: number | "auto") =>
    demoContributions(login, days === "auto" ? 7 : days));
  t.mock.method(GitHubClient.prototype, "fetchProjects", async (owner: string): Promise<ProjectBoardSnapshot> => ({
    version: 1,
    owner,
    projects: [],
    freshness: { generatedAt: "2026-08-20T00:00:00.000Z", source: "github-rest", mode: "live" },
  }));
}

for (const route of tokenRoutes) {
  test(`${route.name}.svg is never marked publicly cacheable when a GitHub token is configured`, async (t) => {
    stubTokenBackedGitHub(t);
    await withWorkerEnv({ GITHUB_TOKEN: "test-token-not-real" }, async () => {
      const response = await route.get(new Request(`https://example.test/api/v1/${route.path}?${route.query}`));
      assert.equal(response.status, 200, `${route.name} token-backed status`);
      assert.equal(response.headers.get("cache-control"), "private, no-store", `${route.name} token-backed Cache-Control`);
    });
  });
}
