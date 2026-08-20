import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  activityBarPercent,
  buildStudioGalleryCards,
  contributionMetricLabel,
  contributionWindowLabel,
  findProjectDraft,
  safeProjectActionUrl,
  starterCiPresentation,
  studioSourceLabel,
  visibleProfileStars,
} from "./studio-presentation";

test("starter CI never invents a healthy state", () => {
  assert.deepEqual(starterCiPresentation("  "), {
    label: "Not configured",
    tone: "muted",
    workflowLabel: "Not configured",
  });
  assert.deepEqual(starterCiPresentation(" ci.yml "), {
    label: "Preview required",
    tone: "muted",
    workflowLabel: "ci.yml",
  });
});

test("zero contribution days have no positive activity bar", () => {
  assert.equal(activityBarPercent(0, 8), 0);
  assert.equal(activityBarPercent(1, 8), 12.5);
  assert.equal(activityBarPercent(1, 100), 8);
  assert.equal(activityBarPercent(8, 8), 100);
});

test("contribution labels distinguish the total and activity windows", () => {
  assert.equal(contributionMetricLabel(120), "Contributions · 120d");
  assert.equal(contributionMetricLabel(null), "Contributions");
  assert.equal(contributionWindowLabel(120, 28), "28-day activity · 120-day total");
});

test("truncated repository profiles never expose partial star totals", () => {
  assert.equal(visibleProfileStars(999, true), null);
  assert.equal(visibleProfileStars(17, false), 17);
});

test("draft matching normalizes repository whitespace and case", () => {
  const drafts = [{ repo: " beta ", docs: "https://github.com/acme/beta" }];
  assert.equal(findProjectDraft(drafts, "Beta"), drafts[0]);
});

test("project actions use the shared host and credential boundary", () => {
  assert.equal(safeProjectActionUrl(" https://github.com/acme/atlas/docs "), "https://github.com/acme/atlas/docs");
  assert.equal(safeProjectActionUrl("https://docs.github.com/en/actions"), "https://docs.github.com/en/actions");
  assert.equal(safeProjectActionUrl("https://attacker.example/package"), null);
  assert.equal(safeProjectActionUrl("https://github.com.attacker.example/package"), null);
  assert.equal(safeProjectActionUrl("http://github.com/acme/atlas"), null);
  assert.equal(safeProjectActionUrl("https://token@github.com/acme/atlas"), null);
  assert.equal(safeProjectActionUrl("not a URL"), null);
});

test("gallery exposes only selected, currently available cards", () => {
  const selectedCards = new Set([
    "atlas",
    "profile",
    "streak",
    "breakdown",
    "rhythm",
    "activity",
    "languages",
    "projects",
  ] as const);
  const cards = buildStudioGalleryCards({
    selectedCards,
    availability: { demo: false, hasCurrentContributions: false, hasCurrentLanguages: true },
    projectCount: 3,
  });

  assert.deepEqual(cards.map((card) => card.kind), ["profile", "languages", "projects"]);
  assert.equal(cards.find((card) => card.kind === "projects")?.dimensions, "720 × 248");
  assert.equal(cards.find((card) => card.kind === "profile")?.compact, true);
});

test("gallery pairs the two insight cards with truthful presentation metadata", () => {
  const cards = buildStudioGalleryCards({
    selectedCards: new Set([
      "atlas",
      "profile",
      "streak",
      "breakdown",
      "rhythm",
      "activity",
      "languages",
      "projects",
    ] as const),
    availability: { demo: true, hasCurrentContributions: false, hasCurrentLanguages: false },
    projectCount: 2,
  });

  assert.deepEqual(cards.map((card) => card.kind), [
    "atlas",
    "profile",
    "streak",
    "breakdown",
    "rhythm",
    "activity",
    "languages",
    "projects",
  ]);
  assert.deepEqual(cards.map((card) => card.span), ["full", "half", "half", "half", "half", "full", "half", "half"]);
  assert.equal(cards.find((card) => card.kind === "breakdown")?.dimensions, "720 × 220");
  assert.match(cards.find((card) => card.kind === "breakdown")?.purpose ?? "", /exact categorized counts.*public-profile percentages/i);
  assert.match(cards.find((card) => card.kind === "rhythm")?.purpose ?? "", /transparent personal consistency.*not a GitHub rank/i);
});

test("gallery selection and empty projects independently remove their previews", () => {
  const cards = buildStudioGalleryCards({
    selectedCards: new Set(["atlas", "projects"] as const),
    availability: { demo: true, hasCurrentContributions: false, hasCurrentLanguages: false },
    projectCount: 0,
  });

  assert.deepEqual(cards.map((card) => card.kind), ["atlas"]);
  assert.equal(cards[0]?.span, "full");
});

test("gallery source labels do not overstate unknown provenance", () => {
  assert.equal(studioSourceLabel("synthetic-demo"), "Synthetic demo");
  assert.equal(studioSourceLabel("public-profile"), "Public profile");
  assert.equal(studioSourceLabel("github-profile-html"), "Public profile");
  assert.equal(studioSourceLabel("public-github"), "Public GitHub");
  assert.equal(studioSourceLabel("github-rest"), "Public GitHub");
  assert.equal(studioSourceLabel("github-graphql"), "Public GitHub");
  assert.equal(studioSourceLabel("unexpected"), "Source unavailable");
});

test("Studio text inputs retain an explicit keyboard focus treatment", () => {
  const css = readFileSync(new URL("../globals.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.handle-form input:focus-visible, \.text-field input:focus-visible \{ outline: 2px solid var\(--gold\); outline-offset: -4px; \}/,
  );
  assert.match(css, /\.handle-form > div:focus-within, \.text-field:focus-within \{ border-color:/);
});
