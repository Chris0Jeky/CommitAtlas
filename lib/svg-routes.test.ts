import assert from "node:assert/strict";
import test from "node:test";
import { encodeWorkflowMapComponent } from "./github/workflow-map";
import {
  parseActivityDays,
  parseAtlasLayout,
  parseMotion,
  parseSvgAtlasQuery,
  parseSvgActivityQuery,
  parseSvgLanguagesQuery,
  parseSvgProfileQuery,
  parseSvgProjectsQuery,
  parseSvgStreakQuery,
  parseTheme,
} from "./svg-routes";

test("accepts every SVG theme and defaults omitted theme to aurora", () => {
  assert.equal(parseTheme(null), "aurora");
  for (const theme of ["aurora", "midnight", "paper", "ember"] as const) {
    assert.equal(parseTheme(theme), theme);
  }
});

test("rejects invalid, non-ASCII, and empty themes", () => {
  for (const theme of ["", "Aurora", "aurora ", "áurora", "neon"]) {
    assert.throws(() => parseTheme(theme), /theme/);
  }
});

test("accepts the inclusive ASCII activity day boundaries and defaults to 365", () => {
  assert.equal(parseActivityDays(null), 365);
  assert.equal(parseActivityDays("7"), 7);
  assert.equal(parseActivityDays("365"), 365);
});

test("rejects signs, decimals, non-ASCII digits, and out-of-range activity days", () => {
  for (const value of ["6", "366", "+7", "-1", "7.0", "０７", "٧", "0070"]) {
    assert.throws(() => parseActivityDays(value), /days/);
  }
});

test("parses a canonical atlas query with optional project health and motion", () => {
  const query = parseSvgAtlasQuery(new URLSearchParams(
    "user=octocat&repos=atlas,quiet&states=atlas:active,quiet:maintenance&workflows=atlas:ci.yml&days=365&theme=ember&motion=none&layout=compact&demo=true",
  ));
  assert.deepEqual(query.projects, [
    { repository: "atlas", lifecycle: "active", workflow: "ci.yml" },
    { repository: "quiet", lifecycle: "maintenance", workflow: null },
  ]);
  assert.equal(query.motion, "none");
  assert.equal(query.layout, "compact");
  assert.equal(query.canonical, "user=octocat&repos=atlas%2Cquiet&states=atlas%3Aactive%2Cquiet%3Amaintenance&workflows=atlas%3Aci.yml&demo=true&theme=ember&days=365&motion=none&layout=compact");
  assert.equal(parseMotion(null), "subtle");
  assert.equal(parseAtlasLayout(null), "wide");
  assert.throws(() => parseMotion("fast"), /motion/);
  assert.throws(() => parseAtlasLayout("fluid"), /layout/);
  assert.throws(() => parseSvgAtlasQuery(new URLSearchParams("user=octocat&states=atlas:active")), /require repos/);
});

test("parses profile, streak, activity, and language contracts with canonical ordering", () => {
  const profile = parseSvgProfileQuery(new URLSearchParams("theme=paper&demo=true&user=octocat"));
  assert.deepEqual(profile, { user: "octocat", demo: true, theme: "paper", canonical: "user=octocat&demo=true&theme=paper" });
  assert.deepEqual(parseSvgStreakQuery(new URLSearchParams("user=octocat")), {
    user: "octocat", demo: false, theme: "aurora", canonical: "user=octocat&demo=false&theme=aurora",
  });
  assert.deepEqual(parseSvgLanguagesQuery(new URLSearchParams("user=octocat&theme=ember")), {
    user: "octocat", demo: false, theme: "ember", canonical: "user=octocat&demo=false&theme=ember",
  });
  assert.deepEqual(parseSvgActivityQuery(new URLSearchParams("days=7&user=octocat&demo=false&theme=midnight")), {
    user: "octocat", demo: false, theme: "midnight", days: 7,
    canonical: "user=octocat&demo=false&theme=midnight&days=7",
  });
});

test("rejects unknown and duplicate SVG keys before query values are read", () => {
  for (const query of [
    "user=octocat&unknown=x",
    "user=octocat&user=other",
    "user=octocat&theme=aurora&theme=paper",
  ]) {
    assert.throws(() => parseSvgProfileQuery(new URLSearchParams(query)), /unknown|duplicate/);
  }
  assert.throws(() => parseSvgActivityQuery(new URLSearchParams("user=octocat&days=7&days=8")), /duplicate/);
});

test("preserves project order and aligns explicit lifecycle and optional workflow values", () => {
  const query = parseSvgProjectsQuery(new URLSearchParams(
    "theme=ember&demo=true&owner=acme&repos=Beta,alpha&states=alpha:planned,Beta:active&workflows=alpha:release.yml",
  ));
  assert.deepEqual(query.repos, ["Beta", "alpha"]);
  assert.deepEqual(query.projects, [
    { repository: "Beta", lifecycle: "active", workflow: null },
    { repository: "alpha", lifecycle: "planned", workflow: "release.yml" },
  ]);
  assert.equal(query.canonical, "owner=acme&repos=Beta%2Calpha&states=Beta%3Aactive%2Calpha%3Aplanned&workflows=alpha%3Arelease.yml&demo=true&theme=ember");
});

test("canonicalizes escaped workflow delimiters without semantic collisions", () => {
  const workflow = "ci,release:nightly.yml";
  const query = parseSvgProjectsQuery(new URLSearchParams({
    owner: "acme",
    repos: "alpha",
    states: "alpha:active",
    workflows: `alpha:${encodeWorkflowMapComponent(workflow)}`,
    demo: "true",
    theme: "paper",
  }));
  assert.equal(query.workflows.get("alpha"), workflow);
  assert.equal(query.canonical, "owner=acme&repos=alpha&states=alpha%3Aactive&workflows=alpha%3Aci%252Crelease%253Anightly.yml&demo=true&theme=paper");
});

test("requires exact project inputs and rejects invalid workflow identities", () => {
  assert.throws(() => parseSvgProjectsQuery(new URLSearchParams("owner=acme&repos=alpha&states=alpha:active&workflows=other:ci.yml")), /requested repositories/);
  assert.throws(() => parseSvgProjectsQuery(new URLSearchParams("owner=acme&repos=alpha&states=alpha:active&workflows=alpha:ci.yml&workflows=alpha:docs.yml")), /duplicate/);
  for (const workflow of ["", ".", "..", ".github/../ci.yml", "ci.yml\u0000"]) {
    assert.throws(() => parseSvgProjectsQuery(new URLSearchParams(`owner=acme&repos=alpha&states=alpha:active&workflows=alpha:${encodeURIComponent(workflow)}`)), /invalid/);
  }
});
