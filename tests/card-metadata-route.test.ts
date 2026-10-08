import assert from "node:assert/strict";
import test from "node:test";
import * as svg from "@/packages/svg/src/index";
import { buildStudioRouteUrl, type StudioCardKind } from "@/app/studio/studio-urls";
import { withWorkerEnv } from "@/lib/runtime-env";
import { GET as atlas } from "@/app/api/v1/cards/atlas.svg/route";
import { GET as profile } from "@/app/api/v1/cards/profile.svg/route";
import { GET as streak } from "@/app/api/v1/cards/streak.svg/route";
import { GET as activity } from "@/app/api/v1/cards/activity.svg/route";
import { GET as breakdown } from "@/app/api/v1/cards/breakdown.svg/route";
import { GET as rhythm } from "@/app/api/v1/cards/rhythm.svg/route";
import { GET as languages } from "@/app/api/v1/cards/languages.svg/route";
import { GET as projects } from "@/app/api/v1/projects.svg/route";

const routes = { atlas, profile, streak, activity, breakdown, rhythm, languages, projects };
const header = "x-commitatlas-card-metadata";
for (const kind of Object.keys(routes) as StudioCardKind[]) for (const motion of ["none", "subtle", "ambient"] as const) {
  test(`${kind}/${motion} receipt matches the canonical image and its 304`, async () => {
    await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
      const url = `https://example.test${buildStudioRouteUrl(kind, {
        owner: "octocat", theme: "ember", demo: true, motion, days: 365,
        projects: [{ repo: "atlas", lifecycle: "active" }],
      })}`;
      const response = await routes[kind](new Request(url));
      assert.equal(response.status, 200, "Studio URL must not redirect");
      const body = await response.text();
      const metadata = JSON.parse(response.headers.get(header) ?? "null");
      assert.ok(metadata, "missing card renderer receipt");
      assert.equal(metadata.version, 1); assert.equal(metadata.card, kind);
      assert.equal(metadata.bytes, new TextEncoder().encode(body).length);
      assert.equal(metadata.state, "ready");
      assert.equal(metadata.loopingGroups, 0, "legacy cards have no loops");
      assert.equal(metadata.animatedElements > 0, motion !== "none");
      assert.match(response.headers.get("access-control-expose-headers") ?? "", /X-CommitAtlas-Card-Metadata/i);
      const conditional = await routes[kind](new Request(url, { headers: { "if-none-match": response.headers.get("etag")! } }));
      assert.equal(conditional.status, 304);
      assert.deepEqual(JSON.parse(conditional.headers.get(header)!), metadata);
      assert.equal(await conditional.text(), "");
    });
  });
}
test("counter measurement recognizes exact legacy sheets rather than counting text or duplicate selectors", () => {
  assert.equal(typeof svg.measureCardMotion, "function", "card measurement export is missing");
  const body = svg.renderProfileCard({ login: "demo", name: "animate animation: card-enter é", repositories: 1, followers: 2, following: 3 }, { motion: "ambient" });
  assert.deepEqual(svg.measureCardMotion(body, "profile"), { bytes: new TextEncoder().encode(body).length, animatedElements: 1, loopingGroups: 0 });
  const still = body.replace(/<style>[\s\S]*?<\/style>/u, "");
  assert.equal(svg.measureCardMotion(still, "profile").animatedElements, 0);
  assert.throws(() => svg.measureCardMotion(body.replace(".38s", "3s"), "profile"), /motion.*contract|stylesheet/i);
  assert.throws(() => svg.measureCardMotion(body.replace("</svg>", '<animate attributeName="opacity"/></svg>'), "profile"), /motion.*contract|unsupported/i);
});


test("metadata is additive: still/animated body, cache policy, ETag and CSP are unchanged", async () => {
  const { cardSvgResponse } = await import("@/lib/card-response");
  const { svgResponse } = await import("@/lib/http");
  const request = new Request("https://example.test/api/v1/cards/profile.svg");
  for (const motion of ["none", "subtle", "ambient"] as const) for (const theme of Object.keys(svg.themes) as svg.ThemeName[]) {
    const body = svg.renderProfileCard({ login: "test", name: "Test", repositories: 1, followers: 2, following: 3 }, { motion, theme });
    const options = { edgeSeconds: 900, publicData: false, inlineStyles: motion !== "none" };
    const existing = await svgResponse(request, body, options);
    const enriched = await cardSvgResponse(request, body, options, "profile", "live");
    assert.equal(await enriched.text(), await existing.text());
    for (const name of ["etag", "cache-control", "content-type", "content-security-policy", "x-content-type-options"])
      assert.equal(enriched.headers.get(name), existing.headers.get(name));
  }
});
test("source state, not user text, controls freshness approval", async () => {
  const { cardSvgResponse } = await import("@/lib/card-response");
  const body = svg.renderProfileCard({ login: "demo", name: "STALE SNAPSHOT unavailable", repositories: 1, followers: 2, following: 3 });
  for (const [mode, state] of [["live", "ready"], ["demo", "ready"], ["partial", "partial"], ["stale", "stale"], ["unavailable", "unavailable"], ["unknown", "unavailable"]]) {
    const response = await cardSvgResponse(new Request("https://example.test/card"), body, { publicData: true, edgeSeconds: 300 }, "profile", mode!);
    assert.equal(JSON.parse(response.headers.get(header)!).state, state);
  }
});
test("invalid requests and canonical redirects do not carry a card receipt", async () => {
  for (const query of ["user=octocat&demo=true&motion=cinematic", "user=octocat&demo=true", "user=octocat&demo=true&nonsense=1"]) {
    const response = await profile(new Request(`https://example.test/api/v1/cards/profile.svg?${query}`));
    assert.ok([308, 400].includes(response.status)); assert.equal(response.headers.has(header), false);
  }
});
test("Atlas counts batched geometry once, never days or matching selectors separately", async () => {
  const { fetchPortfolioSnapshot, toAtlasCard } = await import("@/lib/portfolio");
  const { parseSceneXml } = await import("@/packages/svg/src/scene-svg");
  const data = toAtlasCard(await fetchPortfolioSnapshot({ user: "octocat", demo: true, days: 730, token: "" }));
  for (const width of [480, 860]) {
    const body = svg.renderAtlasCard(data, { motion: "ambient", width });
    const expected = parseSceneXml(body).nodes.filter(node => /(?:^|\s)(?:atlas-enter|atlas-cell|atlas-bar)(?:$|\s)/u.test(node.attrs.class ?? "")).length;
    assert.equal(svg.measureCardMotion(body, "atlas").animatedElements, expected);
    assert.ok(expected > 7 && expected < 96);
  }
});
