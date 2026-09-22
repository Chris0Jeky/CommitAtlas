import assert from "node:assert/strict";
import test from "node:test";
import { GET as getActivity } from "@/app/api/v1/cards/activity.svg/route";
import { GET as getAtlas } from "@/app/api/v1/cards/atlas.svg/route";
import { GET as getBreakdown } from "@/app/api/v1/cards/breakdown.svg/route";
import { GET as getLanguages } from "@/app/api/v1/cards/languages.svg/route";
import { GET as getProfile } from "@/app/api/v1/cards/profile.svg/route";
import { GET as getRhythm } from "@/app/api/v1/cards/rhythm.svg/route";
import { GET as getStreak } from "@/app/api/v1/cards/streak.svg/route";
import { GET as getProjects } from "@/app/api/v1/projects.svg/route";
import { withWorkerEnv } from "@/lib/runtime-env";

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
    query: (motion) => `user=octocat&demo=true&theme=aurora&motion=${motion}`,
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
