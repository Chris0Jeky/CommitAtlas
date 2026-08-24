import assert from "node:assert/strict";
import test from "node:test";
import { buildStudioMarkdown, isLightCardTheme, STUDIO_CARD_KINDS, THEME_PAIRS } from "./studio-markdown";
import { themes } from "@commit-atlas/svg";

const projects = [{ repo: "atlas", lifecycle: "active", workflow: "ci.yml" }];
const selectedCards = new Set(STUDIO_CARD_KINDS);

/**
 * One entry per card.
 *
 * Each card is now a `<picture>` block rather than one line, so counting lines counts markup.
 * These helpers count *cards*, which is what every assertion here actually means.
 */
const cards = (markdown: string): string[] => markdown.split("\n\n").filter((block) => block.trim() !== "");
const cardNames = (markdown: string): (string | undefined)[] =>
  cards(markdown).map((block) => block.match(/CommitAtlas (\w+)/)?.[1]);

test("live Markdown omits unavailable contribution cards exactly", () => {
  const markdown = buildStudioMarkdown({
    baseUrl: "https://atlas.example",
    owner: "octocat",
    theme: "ember",
    demo: false,
    projects,
    selectedCards,
    hasCurrentContributions: false,
    hasCurrentLanguages: true,
  });

  assert.deepEqual(cardNames(markdown), [
    "Profile",
    "Languages",
    "Projects",
  ]);
  assert.doesNotMatch(markdown, /streak\.svg|breakdown\.svg|rhythm\.svg|activity\.svg/);
});

test("synthetic Markdown restores all eight retained selections", () => {
  const markdown = buildStudioMarkdown({
    baseUrl: "https://atlas.example",
    owner: "octocat",
    theme: "paper",
    demo: true,
    projects,
    selectedCards,
    hasCurrentContributions: false,
    hasCurrentLanguages: false,
  });

  assert.equal(cards(markdown).length, 8);
  assert.match(markdown, /atlas\.svg/);
  assert.match(markdown, /streak\.svg/);
  assert.match(markdown, /breakdown\.svg/);
  assert.match(markdown, /rhythm\.svg/);
  assert.match(markdown, /activity\.svg/);
});

test("project Markdown remains absent without a declared repository", () => {
  const markdown = buildStudioMarkdown({
    baseUrl: "https://atlas.example",
    owner: "octocat",
    theme: "ember",
    demo: true,
    projects: [],
    selectedCards,
    hasCurrentContributions: true,
    hasCurrentLanguages: true,
  });

  assert.equal(cards(markdown).length, 7);
  assert.doesNotMatch(markdown, /projects\.svg/);
});

test("live Markdown omits a Languages URL backed by truncated repositories", () => {
  const markdown = buildStudioMarkdown({
    baseUrl: "https://atlas.example",
    owner: "octocat",
    theme: "ember",
    demo: false,
    projects,
    selectedCards,
    hasCurrentContributions: true,
    hasCurrentLanguages: false,
  });

  assert.deepEqual(cardNames(markdown), [
    "Atlas",
    "Profile",
    "Streak",
    "Breakdown",
    "Rhythm",
    "Activity",
    "Projects",
  ]);
  assert.doesNotMatch(markdown, /languages\.svg/);
});

test("each card ships as a dark/light pair, so no reader gets the wrong one", () => {
  // Every card carries an opaque background of its own, so a bare `![](…)` is a bet that the
  // reader's colour scheme matches the single theme it names — and it loses that bet for
  // everyone on the other scheme. GitHub honours <picture> with prefers-color-scheme.
  const markdown = buildStudioMarkdown({
    baseUrl: "https://atlas.example",
    owner: "octocat",
    theme: "ember",
    demo: true,
    projects,
    selectedCards: new Set(["atlas"]),
    hasCurrentContributions: true,
    hasCurrentLanguages: true,
  });

  assert.match(markdown, /^<picture>/);
  assert.match(markdown, /<source media="\(prefers-color-scheme: dark\)" srcset="[^"]*theme=ember[^"]*">/);
  assert.match(markdown, /<source media="\(prefers-color-scheme: light\)" srcset="[^"]*theme=paper[^"]*">/);
  // The fallback names the theme the user actually chose, for renderers without <picture>.
  assert.match(markdown, /<img alt="CommitAtlas Atlas" src="[^"]*theme=ember[^"]*">/);
  assert.match(markdown, /<\/picture>$/);
});

test("choosing the light theme inverts the pair rather than dropping it", () => {
  const markdown = buildStudioMarkdown({
    baseUrl: "https://atlas.example",
    owner: "octocat",
    theme: "paper",
    demo: true,
    projects,
    selectedCards: new Set(["atlas"]),
    hasCurrentContributions: true,
    hasCurrentLanguages: true,
  });

  // Light stays on the light source and the dark partner fills the dark one — the selected theme
  // must never end up serving the scheme it was not drawn for.
  assert.match(markdown, /<source media="\(prefers-color-scheme: light\)" srcset="[^"]*theme=paper[^"]*">/);
  assert.match(markdown, /<source media="\(prefers-color-scheme: dark\)" srcset="[^"]*theme=ember[^"]*">/);
  assert.match(markdown, /<img alt="CommitAtlas Atlas" src="[^"]*theme=paper[^"]*">/);
});

test("the pairing table agrees with the renderer it mirrors", () => {
  // `THEME_PAIRS` is restated here rather than imported so the client bundle does not pull in
  // every card renderer to read four strings. This is what keeps the copy honest.
  for (const [name, theme] of Object.entries(themes)) {
    assert.equal(THEME_PAIRS[name], theme.pair, `${name} pairs differently in the two tables`);
    assert.equal(isLightCardTheme(name), theme.scheme === "light", `${name} disagrees on its scheme`);
  }
  assert.deepEqual(Object.keys(THEME_PAIRS).sort(), Object.keys(themes).sort());
});
