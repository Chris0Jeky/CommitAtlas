from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement, found {count}: {old[:80]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")


def insert_before(path: str, marker: str, addition: str) -> None:
    replace_once(path, marker, addition + marker)


insert_before(
    "lib/svg-routes.test.ts",
    '\ntest("rejects unknown and duplicate SVG keys before query values are read", () => {',
    '''\n\ntest("accepts ambient and rejects cinematic across every hosted SVG query", () => {
  const routes: readonly {
    readonly parse: (parameters: URLSearchParams) => { readonly motion: string; readonly canonical: string };
    readonly base: string;
  }[] = [
    { parse: parseSvgProfileQuery, base: "user=octocat&demo=true&theme=aurora" },
    { parse: parseSvgStreakQuery, base: "user=octocat&demo=true&theme=aurora" },
    { parse: parseSvgLanguagesQuery, base: "user=octocat&demo=true&theme=aurora" },
    { parse: parseSvgActivityQuery, base: "user=octocat&demo=true&theme=aurora&days=365" },
    { parse: parseSvgAtlasQuery, base: "user=octocat&demo=true&theme=aurora&days=365&layout=wide" },
    { parse: parseSvgProjectsQuery, base: "owner=octocat&repos=atlas&states=atlas:active&demo=true&theme=aurora" },
  ];

  for (const { parse, base } of routes) {
    const ambient = parse(new URLSearchParams(`${base}&motion=ambient`));
    assert.equal(ambient.motion, "ambient");
    assert.match(ambient.canonical, /(?:^|&)motion=ambient(?:&|$)/);
    assert.throws(
      () => parse(new URLSearchParams(`${base}&motion=cinematic`)),
      /motion must be none, subtle, or ambient/,
    );
  }
});''',
)

route_test = Path("tests/hosted-motion-routes.test.ts")
if route_test.exists():
    raise RuntimeError(f"{route_test}: already exists")
route_test.write_text('''import assert from "node:assert/strict";
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

type Motion = "ambient" | "cinematic";
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
''', encoding="utf-8")

replace_once(
    "package.json",
    "tests/motion-probe-route.test.ts lib/http.test.ts",
    "tests/motion-probe-route.test.ts tests/hosted-motion-routes.test.ts lib/http.test.ts",
)

replace_once(
    "packages/svg/tests/svg.test.mjs",
    "  formatNumber,\n  renderContributionBreakdownCard,",
    "  formatNumber,\n  motionRenderMetadata,\n  renderContributionBreakdownCard,",
)
replace_once(
    "packages/svg/tests/svg.test.mjs",
    '  assert.deepEqual(Object.keys(themes), ["aurora", "midnight", "paper", "ember"]);\n',
    '''  assert.deepEqual(Object.keys(themes), ["aurora", "midnight", "paper", "ember"]);
  assert.deepEqual(motionRenderMetadata(undefined), { inlineStyles: false });
  assert.deepEqual(motionRenderMetadata("none"), { inlineStyles: false });
  assert.deepEqual(motionRenderMetadata("subtle"), { inlineStyles: true });
  assert.deepEqual(motionRenderMetadata("ambient"), { inlineStyles: true });
  assert.deepEqual(motionRenderMetadata("cinematic"), { inlineStyles: true });
''',
)
replace_once(
    "packages/svg/tests/svg.test.mjs",
    '''    const animated = render("subtle");
    assert.match(animated, /@keyframes card-enter/);''',
    '''    const animated = render("subtle");
    assert.equal(render("ambient"), animated);
    assert.equal(render("cinematic"), animated);
    assert.match(animated, /@keyframes card-enter/);''',
)
replace_once(
    "packages/svg/tests/svg.test.mjs",
    '''  const animatedAtlas = renderAtlasCard(data, { theme: "aurora", motion: "subtle" });
  const narrowAtlas = renderAtlasCard(data, { width: 420, motion: "none" });''',
    '''  const animatedAtlas = renderAtlasCard(data, { theme: "aurora", motion: "subtle" });
  const ambientAtlas = renderAtlasCard(data, { theme: "aurora", motion: "ambient" });
  const cinematicAtlas = renderAtlasCard(data, { theme: "aurora", motion: "cinematic" });
  const narrowAtlas = renderAtlasCard(data, { width: 420, motion: "none" });''',
)
replace_once(
    "packages/svg/tests/svg.test.mjs",
    '''  assertSafeSvg(staticAtlas);
  assertSafeSvg(animatedAtlas, { allowStyle: true });
  assertSafeSvg(narrowAtlas);''',
    '''  assertSafeSvg(staticAtlas);
  assertSafeSvg(animatedAtlas, { allowStyle: true });
  assert.equal(ambientAtlas, animatedAtlas);
  assert.equal(cinematicAtlas, animatedAtlas);
  assertSafeSvg(narrowAtlas);''',
)

insert_before(
    "packages/static/tests/static.test.mjs",
    '\ntest("accepts bounded opposite-scheme theme outputs and rejects ambiguous variants", () => {',
    '''\n\ntest("accepts all four motion profiles, keeps the still default, and rejects unknown values", () => {
  for (const motion of ["none", "subtle", "ambient", "cinematic"]) {
    assert.equal(parseStaticConfig({ ...rawConfig(), motion }).motion, motion);
  }
  const { motion: _motion, ...withoutMotion } = rawConfig();
  assert.equal(parseStaticConfig(withoutMotion).motion, "none");
  assert.throws(() => parseStaticConfig({ ...rawConfig(), motion: "warp" }), /invalid|option/i);
});''',
)

insert_before(
    "app/studio/studio-urls.test.ts",
    '\ntest("binds a successful origin to the exact route-affecting configuration", () => {',
    '''\n\ntest("emits ambient motion in hosted URLs and treats it as route-affecting configuration", () => {
  assert.equal(buildStudioRouteUrl("profile", {
    owner: "octocat",
    theme: "ember",
    demo: true,
    motion: "ambient",
  }), "/api/v1/cards/profile.svg?user=octocat&demo=true&theme=ember&motion=ambient");

  const subtle = buildStudioConfigurationKey({ owner: "octocat", theme: "ember", demo: true, motion: "subtle" });
  const ambient = buildStudioConfigurationKey({ owner: "octocat", theme: "ember", demo: true, motion: "ambient" });
  assert.notEqual(ambient, subtle);
});''',
)

insert_before(
    "app/studio/studio-markdown.test.ts",
    '\ntest("the pairing table agrees with the renderer it mirrors", () => {',
    '''\n\ntest("README Markdown carries the selected ambient profile through every emitted source", () => {
  const markdown = buildStudioMarkdown({
    baseUrl: "https://atlas.example",
    owner: "octocat",
    theme: "ember",
    demo: true,
    projects,
    selectedCards: new Set(["atlas", "profile"]),
    hasCurrentContributions: true,
    hasCurrentLanguages: true,
    motion: "ambient",
  });

  const urls = markdown.match(/https:\/\/atlas\.example[^\" >]+/g) ?? [];
  assert.ok(urls.length > 0);
  for (const url of urls) assert.match(url, /(?:\?|&)motion=ambient(?:&|$)/);
});''',
)

presentation = Path("app/studio/studio-presentation.test.ts")
presentation_text = presentation.read_text(encoding="utf-8")
addition = '''\n\ntest("Studio exposes exactly the three hosted motion profiles", () => {
  const source = readFileSync(new URL("./studio-client.tsx", import.meta.url), "utf8");
  for (const profile of ["none", "subtle", "ambient"]) {
    assert.match(source, new RegExp(`setMotion\\("${profile}"\\)`));
  }
  assert.doesNotMatch(source, /setMotion\("cinematic"\)/);
});
'''
if addition.strip() in presentation_text:
    raise RuntimeError(f"{presentation}: motion selector test already exists")
presentation.write_text(presentation_text.rstrip() + addition, encoding="utf-8")

replace_once(
    "lib/last-good.test.ts",
    '''  const otherRoute = new Request("https://example.test/api/v1/cards/streak.svg?theme=paper&user=octocat&demo=false&motion=none");

  assert.equal(await publicLastGoodKey(first), await publicLastGoodKey(reordered));''',
    '''  const otherRoute = new Request("https://example.test/api/v1/cards/streak.svg?theme=paper&user=octocat&demo=false&motion=none");
  const subtleMotion = new Request("https://example.test/api/v1/cards/profile.svg?theme=paper&user=octocat&demo=false&motion=subtle");
  const ambientMotion = new Request("https://example.test/api/v1/cards/profile.svg?theme=paper&user=octocat&demo=false&motion=ambient");

  assert.equal(await publicLastGoodKey(first), await publicLastGoodKey(reordered));''',
)
replace_once(
    "lib/last-good.test.ts",
    '''  assert.notEqual(await publicLastGoodKey(first), await publicLastGoodKey(otherRoute));
  assert.match(await publicLastGoodKey(first), /^public-last-good:v1:[a-f\\d]{64}$/);''',
    '''  assert.notEqual(await publicLastGoodKey(first), await publicLastGoodKey(otherRoute));
  assert.notEqual(await publicLastGoodKey(subtleMotion), await publicLastGoodKey(ambientMotion));
  assert.match(await publicLastGoodKey(first), /^public-last-good:v1:[a-f\\d]{64}$/);''',
)
