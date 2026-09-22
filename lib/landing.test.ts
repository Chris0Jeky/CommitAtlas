import assert from "node:assert/strict";
import test from "node:test";
import type { StudioCardKind } from "@/app/studio/studio-urls";
import {
  CARD_THEMES,
  LANDING_DAYS,
  LANDING_EVIDENCE_IDS,
  LANDING_OPTIONS,
  LANDING_OWNER,
  LANDING_PROJECTS,
  landingCardUrl,
  landingCompactAtlasUrl,
  landingSnapshot,
  landingThemedAtlasUrl,
  specimenCards,
} from "./landing";
import type { PortfolioSnapshot } from "./github/types";

function parseUrl(url: string): URL {
  return new URL(`https://example.test${url}`);
}

// The landing snapshot is deterministic synthetic data: resolving it here through the same
// guarded-fetch entry point the tests below use keeps every test on one shared snapshot.
const originalFetch = globalThis.fetch;
globalThis.fetch = (() => {
  throw new Error("landingSnapshot must not issue network requests in demo mode");
}) as typeof fetch;
let snapshot: PortfolioSnapshot;
try {
  snapshot = await landingSnapshot();
} finally {
  globalThis.fetch = originalFetch;
}

test("landing constants pin the demo configuration the URLs are built from", () => {
  assert.equal(LANDING_OWNER, "octocat");
  assert.equal(LANDING_DAYS, 365);
  assert.deepEqual([...LANDING_PROJECTS], [
    { repo: "Hello-World", lifecycle: "active" },
    { repo: "Spoon-Knife", lifecycle: "maintenance" },
  ]);
  assert.deepEqual({ ...LANDING_OPTIONS }, {
    owner: "octocat",
    theme: "ember",
    demo: true,
    days: 365,
    motion: "subtle",
    layout: "wide",
    projects: [
      { repo: "Hello-World", lifecycle: "active" },
      { repo: "Spoon-Knife", lifecycle: "maintenance" },
    ],
  });
});

test("landingCardUrl pins the default atlas route from LANDING_OPTIONS", () => {
  assert.equal(
    landingCardUrl("atlas"),
    "/api/v1/cards/atlas.svg?user=octocat&repos=Hello-World%2CSpoon-Knife"
      + "&states=Hello-World%3Aactive%2CSpoon-Knife%3Amaintenance"
      + "&demo=true&theme=ember&days=365&motion=subtle&layout=wide",
  );
  const parsed = parseUrl(landingCardUrl("atlas"));
  assert.equal(parsed.pathname, "/api/v1/cards/atlas.svg");
  assert.equal(parsed.searchParams.get("user"), "octocat");
  assert.equal(parsed.searchParams.get("repos"), "Hello-World,Spoon-Knife");
  assert.equal(parsed.searchParams.get("states"), "Hello-World:active,Spoon-Knife:maintenance");
  assert.equal(parsed.searchParams.get("demo"), "true");
  assert.equal(parsed.searchParams.get("theme"), "ember");
  assert.equal(parsed.searchParams.get("days"), "365");
  assert.equal(parsed.searchParams.get("motion"), "subtle");
  assert.equal(parsed.searchParams.get("layout"), "wide");
  assert.equal(parsed.searchParams.has("workflows"), false);
});

test("landingCardUrl honours a non-default options argument and serializes an empty project list", () => {
  const parsed = parseUrl(landingCardUrl("activity", {
    owner: "someone",
    theme: "paper",
    demo: false,
    days: 30,
  }));
  assert.equal(parsed.pathname, "/api/v1/cards/activity.svg");
  assert.equal(parsed.searchParams.get("user"), "someone");
  assert.equal(parsed.searchParams.get("theme"), "paper");
  assert.equal(parsed.searchParams.get("demo"), "false");
  assert.equal(parsed.searchParams.get("days"), "30");
  assert.equal(parsed.searchParams.get("motion"), "none");

  // Boundary: the projects card always carries repos and states, even for an explicit empty
  // project list (they serialize empty), and emits no workflows param without a named workflow.
  const bare = parseUrl(landingCardUrl("projects", {
    owner: "octocat",
    theme: "ember",
    demo: true,
    projects: [],
  }));
  assert.equal(bare.pathname, "/api/v1/projects.svg");
  assert.equal(bare.searchParams.get("repos"), "");
  assert.equal(bare.searchParams.get("states"), "");
  assert.equal(bare.searchParams.has("workflows"), false);
  assert.equal(bare.searchParams.get("owner"), "octocat");
});

test("landingCompactAtlasUrl pins the compact layout and nothing else changes", () => {
  assert.equal(
    landingCompactAtlasUrl(),
    "/api/v1/cards/atlas.svg?user=octocat&repos=Hello-World%2CSpoon-Knife"
      + "&states=Hello-World%3Aactive%2CSpoon-Knife%3Amaintenance"
      + "&demo=true&theme=ember&days=365&motion=subtle&layout=compact",
  );
  const compact = parseUrl(landingCompactAtlasUrl());
  const wide = parseUrl(landingCardUrl("atlas"));
  assert.equal(compact.pathname, "/api/v1/cards/atlas.svg");
  assert.equal(compact.searchParams.get("layout"), "compact");
  for (const key of ["user", "repos", "states", "demo", "theme", "days", "motion"] as const) {
    assert.equal(compact.searchParams.get(key), wide.searchParams.get(key), `${key} drifted between layouts`);
  }
});

test("landingThemedAtlasUrl swaps in a non-default theme and keeps the landing configuration", () => {
  assert.equal(
    landingThemedAtlasUrl("paper"),
    "/api/v1/cards/atlas.svg?user=octocat&repos=Hello-World%2CSpoon-Knife"
      + "&states=Hello-World%3Aactive%2CSpoon-Knife%3Amaintenance"
      + "&demo=true&theme=paper&days=365&motion=subtle&layout=wide",
  );
  const parsed = parseUrl(landingThemedAtlasUrl("midnight"));
  assert.equal(parsed.pathname, "/api/v1/cards/atlas.svg");
  assert.equal(parsed.searchParams.get("theme"), "midnight");
  assert.equal(parsed.searchParams.get("user"), "octocat");
  assert.equal(parsed.searchParams.get("repos"), "Hello-World,Spoon-Knife");
  assert.equal(parsed.searchParams.get("demo"), "true");
  assert.equal(parsed.searchParams.get("days"), "365");
  assert.equal(parsed.searchParams.get("layout"), "wide");

  // Boundary: an empty theme is passed through as an empty param rather than falling back.
  const empty = parseUrl(landingThemedAtlasUrl(""));
  assert.equal(empty.searchParams.get("theme"), "");
  assert.equal(empty.searchParams.has("theme"), true);
});

test("landingSnapshot resolves in demo mode without any network request", async () => {
  const guardedFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error("network disabled");
  }) as typeof fetch;
  try {
    const fresh = await landingSnapshot();
    assert.equal(calls, 0, "demo mode issued a network request");
    assert.equal(fresh.freshness.mode, "demo");
    assert.equal(fresh.freshness.source, "synthetic-demo");
  } finally {
    globalThis.fetch = guardedFetch;
  }
  assert.equal(snapshot.profile.login, "octocat");
  assert.equal(snapshot.contributions.days.length, 365);
  assert.equal(snapshot.freshness.mode, "demo");
});

test("landingSnapshot projects follow LANDING_PROJECTS in order and never report passing", () => {
  const projects = snapshot.projects?.projects ?? [];
  assert.equal(projects.length, 2);
  assert.deepEqual(projects.map((project) => project.repo), ["octocat/Hello-World", "octocat/Spoon-Knife"]);
  assert.deepEqual(projects.map((project) => project.lifecycle), ["active", "maintenance"]);
  for (const project of projects) {
    assert.equal(project.ci.state, "unconfigured", `${project.repo} must stay unconfigured without a named workflow`);
    assert.equal(project.ci.workflow, null, `${project.repo} must have no named workflow`);
    assert.equal(project.ci.checkedAt, null, `${project.repo} must carry no CI observation timestamp`);
  }
  assert.equal(projects.filter((project) => project.ci.state === "passing").length, 0);
  assert.deepEqual(
    projects.map((project) => project.ci.state),
    ["unconfigured", "unconfigured"],
  );
});

test("specimenCards returns one entry per card with unique ids and the exact url each card uses", () => {
  const cards = specimenCards(snapshot);
  assert.equal(cards.length, 8);
  assert.deepEqual(
    cards.map((card) => card.kind),
    ["atlas", "profile", "streak", "breakdown", "rhythm", "activity", "languages", "projects"] as StudioCardKind[],
  );
  assert.deepEqual(
    cards.map((card) => card.number),
    ["CARD 01", "CARD 02", "CARD 03", "CARD 04", "CARD 05", "CARD 06", "CARD 07", "CARD 08"],
  );
  assert.equal(new Set(cards.map((card) => card.number)).size, cards.length, "two cards share a specimen number");
  assert.equal(new Set(cards.map((card) => card.kind)).size, cards.length, "two cards share a card kind");
  for (const card of cards) {
    assert.notEqual(card.name.trim(), "", `${card.number} has a blank name`);
    assert.notEqual(card.title.trim(), "", `${card.number} has a blank title`);
  }

  const expectedPaths: Record<StudioCardKind, string> = {
    atlas: "/api/v1/cards/atlas.svg",
    profile: "/api/v1/cards/profile.svg",
    streak: "/api/v1/cards/streak.svg",
    breakdown: "/api/v1/cards/breakdown.svg",
    rhythm: "/api/v1/cards/rhythm.svg",
    activity: "/api/v1/cards/activity.svg",
    languages: "/api/v1/cards/languages.svg",
    projects: "/api/v1/projects.svg",
  };
  for (const card of cards) {
    // The specimen tray wires the compact plate to the compact atlas route and every other
    // plate to its own kind route; pin that rule and the route each plate resolves to.
    const url = card.compact === true ? landingCompactAtlasUrl() : landingCardUrl(card.kind);
    assert.equal(parseUrl(url).pathname, expectedPaths[card.kind], `${card.number} resolves to the wrong route`);
  }
  const compact = cards.filter((card) => card.compact === true);
  assert.deepEqual(compact.map((card) => card.kind), ["atlas"]);
  assert.equal(
    landingCompactAtlasUrl(),
    "/api/v1/cards/atlas.svg?user=octocat&repos=Hello-World%2CSpoon-Knife"
      + "&states=Hello-World%3Aactive%2CSpoon-Knife%3Amaintenance"
      + "&demo=true&theme=ember&days=365&motion=subtle&layout=compact",
  );
  assert.equal(
    landingCardUrl("projects"),
    "/api/v1/projects.svg?owner=octocat&repos=Hello-World%2CSpoon-Knife"
      + "&states=Hello-World%3Aactive%2CSpoon-Knife%3Amaintenance&demo=true&theme=ember&motion=subtle",
  );
  assert.equal(
    landingCardUrl("profile"),
    "/api/v1/cards/profile.svg?user=octocat&demo=true&theme=ember&motion=subtle",
  );
});

test("specimenCards prints the demo readings and survives a boardless snapshot", () => {
  const cards = specimenCards(snapshot);
  const byKind = new Map(cards.map((card) => [card.kind, card] as const));
  assert.equal(byKind.get("profile")?.note, "24 REPOS · 312 FOLLOWERS · 487 STARS");
  assert.equal(byKind.get("rhythm")?.note, "72/100 · NOT A RANK");
  assert.equal(byKind.get("projects")?.note, "SIX HEALTH STATES · UNKNOWN ≠ FINE");
  assert.deepEqual([byKind.get("atlas")?.width, byKind.get("atlas")?.height], [480, 570]);
  assert.deepEqual([byKind.get("profile")?.width, byKind.get("profile")?.height], [720, 190]);

  // Boundary: with no declared board the tray still plates all eight cards from profile/metrics.
  const boardless: PortfolioSnapshot = { ...snapshot, projects: null };
  const again = specimenCards(boardless);
  assert.equal(again.length, 8);
  assert.deepEqual(again.map((card) => card.number), cards.map((card) => card.number));
  assert.equal(again.find((card) => card.kind === "profile")?.note, "24 REPOS · 312 FOLLOWERS · 487 STARS");
});

test("CARD_THEMES pins the four shipped themes with no duplicate ids", () => {
  assert.deepEqual(CARD_THEMES.map((theme) => theme.id), ["aurora", "midnight", "paper", "ember"]);
  assert.equal(new Set(CARD_THEMES.map((theme) => theme.id)).size, CARD_THEMES.length);
  assert.deepEqual(CARD_THEMES.map((theme) => theme.ground), ["#09131f", "#05070d", "#e8ecd6", "#0d1117"]);
  for (const theme of CARD_THEMES) {
    assert.notEqual(theme.id.trim(), "", "a card theme has a blank id");
    assert.notEqual(theme.label.trim(), "", `${theme.id} has a blank label`);
    assert.match(theme.ground, /^#[0-9a-f]{6}$/i, `${theme.id} has a malformed ground`);
  }
  // Boundary: only the light README theme opts into the light chassis.
  assert.deepEqual(CARD_THEMES.filter((theme) => theme.light === true).map((theme) => theme.id), ["paper"]);
  assert.equal(CARD_THEMES.find((theme) => theme.id === "ember")?.label, "EMBER · #0D1117 · DEFAULT");
});

test("LANDING_EVIDENCE_IDS pins the wired evidence list with no duplicates", () => {
  assert.deepEqual([...LANDING_EVIDENCE_IDS], [
    "contributions",
    "active-days",
    "density",
    "average-per-day",
    "momentum",
    "momentum-change",
    "rhythm",
    "rhythm-level",
    "mix",
    "ci-passing",
  ]);
  assert.equal(new Set(LANDING_EVIDENCE_IDS).size, LANDING_EVIDENCE_IDS.length, "two evidence ids collide");
  for (const id of LANDING_EVIDENCE_IDS) {
    assert.notEqual(id.trim(), "", "an evidence id is blank");
  }
  // Boundary: the CI record is wired even though the demo board reports zero passing.
  assert.equal(LANDING_EVIDENCE_IDS.includes("ci-passing"), true);
});
