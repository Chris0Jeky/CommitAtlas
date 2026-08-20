import assert from "node:assert/strict";
import test from "node:test";
import { buildStudioMarkdown, STUDIO_CARD_KINDS } from "./studio-markdown";

const projects = [{ repo: "atlas", lifecycle: "active", workflow: "ci.yml" }];
const selectedCards = new Set(STUDIO_CARD_KINDS);

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

  assert.deepEqual(markdown.split("\n").map((line) => line.match(/CommitAtlas (\w+)/)?.[1]), [
    "Profile",
    "Languages",
    "Projects",
  ]);
  assert.doesNotMatch(markdown, /streak\.svg|activity\.svg/);
});

test("synthetic Markdown restores all six retained selections", () => {
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

  assert.equal(markdown.split("\n").length, 6);
  assert.match(markdown, /atlas\.svg/);
  assert.match(markdown, /streak\.svg/);
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

  assert.equal(markdown.split("\n").length, 5);
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

  assert.deepEqual(markdown.split("\n").map((line) => line.match(/CommitAtlas (\w+)/)?.[1]), [
    "Atlas",
    "Profile",
    "Streak",
    "Activity",
    "Projects",
  ]);
  assert.doesNotMatch(markdown, /languages\.svg/);
});
