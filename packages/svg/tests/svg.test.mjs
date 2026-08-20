import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeXml,
  formatNumber,
  renderActivityCard,
  renderLanguagesCard,
  renderProfileCard,
  renderProjectBoard,
  renderStreakCard,
  themes,
  truncateText,
} from "../dist/index.js";
import { aggregateLanguages } from "../../core/dist/index.js";

const injection = `<img src=x onerror="alert(1)"><script>alert(2)</script>&"'\u0000\u0008\ud800`;

function assertXml10(output) {
  for (const character of output) {
    const codePoint = character.codePointAt(0);
    assert.ok(
      codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff),
      `forbidden XML 1.0 character U+${codePoint.toString(16).toUpperCase()}`,
    );
  }
}

function assertSafeSvg(output) {
  assert.match(output, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" role="img"/);
  assert.match(output, /aria-label="[^"]+"/);
  assert.match(output, /<title>/);
  assert.match(output, /<desc>/);
  assert.doesNotMatch(output, /\bid=/);
  assert.match(output, /viewBox="0 0 \d+ \d+"/);
  assert.match(output, /<\/svg>$/);
  for (const forbidden of [/<script/i, /<foreignObject/i, /<style/i, /<image/i, /\bon[a-z]+\s*=\s*["']/i, /javascript:/i, /data:/i]) {
    assert.doesNotMatch(output, forbidden, `forbidden SVG construct matched: ${forbidden}`);
  }
  assertXml10(output);
  const bytes = Buffer.byteLength(output, "utf8");
  assert.ok(bytes < 30_000, `SVG exceeded 30KB budget (${bytes} UTF-8 bytes)`);
}

test("primitives are deterministic and safe", () => {
  assert.equal(escapeXml(`<>&"'`), "&lt;&gt;&amp;&quot;&apos;");
  assert.equal(escapeXml(`a\u0000b\u0008c\ud800d`), "a�b�c�d");
  assert.equal(truncateText("hello", 5), "hello");
  assert.equal(truncateText("hello world", 6), "hello…");
  assert.equal(truncateText("😀😀😀", 2), "😀…");
  assert.equal(formatNumber(1234), "1.2k");
  assert.equal(formatNumber(999_999), "1M");
  assert.equal(formatNumber(1_200_000), "1.2M");
  assert.equal(formatNumber(999_999_999), "1B");
  assert.equal(formatNumber(Number.NaN), "0");
  assert.deepEqual(Object.keys(themes), ["aurora", "midnight", "paper", "ember"]);
});

test("renderer defaults are specific and dimensions stay within safe bounds", () => {
  const profile = renderProfileCard({ name: "Ada", login: "ada", repositories: 1, followers: 2, following: 3 });
  const streak = renderStreakCard({ current: 1, longest: 2 });
  const activity = renderActivityCard({ days: [] });
  const languages = renderLanguagesCard({ languages: [] });
  const board = renderProjectBoard({ projects: [] });
  assert.match(profile, /<title>Ada profile<\/title><desc>GitHub profile for Ada\.<\/desc>/);
  assert.match(streak, /<title>Contribution streak<\/title><desc>Current and longest GitHub contribution streaks\.<\/desc>/);
  assert.match(activity, /<title>Contribution activity<\/title><desc>A compact contribution activity map/);
  assert.match(languages, /<title>Languages<\/title><desc>Programming languages used across GitHub repositories\.<\/desc>/);
  assert.match(board, /<title>Project signals<\/title><desc>Project lifecycle and CI signals/);
  const constrained = renderStreakCard({ current: 1, longest: 2 }, {
    width: 1, height: 1, title: "T".repeat(200), description: "D".repeat(300),
  });
  assert.match(constrained, /viewBox="0 0 420 150" width="420" height="150"/);
  assert.match(constrained, /<title>T{95}…<\/title>/);
  assert.match(constrained, /<desc>D{179}…<\/desc>/);
  const large = renderStreakCard({ current: 1, longest: 2 }, { width: 9_999, height: 9_999 });
  assert.match(large, /viewBox="0 0 1200 260" width="1200" height="260"/);
});

test("all renderers emit accessible safe SVG", () => {
  const profile = renderProfileCard({
    name: injection, login: injection, bio: injection, location: injection,
    website: "javascript:alert(1)", repositories: 12, followers: 4, following: 2,
  }, { title: injection, description: injection });
  const streak = renderStreakCard({ current: 21, longest: 44, total: 99, activeDays: 80, lastActive: injection });
  const days = Array.from({ length: 90 }, (_, index) => ({ date: `2026-08-${String((index % 28) + 1).padStart(2, "0")}`, count: index % 8 }));
  const activity = renderActivityCard({ days, total: 300, periodLabel: injection });
  const languages = renderLanguagesCard({ languages: [
    { name: injection, percentage: 66, color: `#123456" onload="alert(1)` },
    { name: "TypeScript", percentage: 34 },
  ] });
  const board = renderProjectBoard({ projects: [
    { name: injection, lifecycle: "active", ci: "passing", links: { repository: "https://example.com/repo", docs: "javascript:bad" } },
    { name: "Quiet project", lifecycle: "paused", ci: "stale" },
  ] });
  for (const output of [profile, streak, activity, languages, board]) assertSafeSvg(output);
  assert.match(profile, /&lt;img src=x onerror=/);
  assert.doesNotMatch(profile, /href=/);
  assert.doesNotMatch(languages, /onload=/);
  assert.doesNotMatch(board, /<a\b|href=/);
});

test("project boards remain summary-only when action URLs are present", () => {
  const board = renderProjectBoard({ projects: [{
    name: "Atlas", lifecycle: "active", ci: "passing",
    links: {
      repository: "https://github.com/example/atlas",
      docs: "https://example.com/docs",
      install: "https://example.com/install",
      download: "https://example.com/download",
    },
  }] });
  assert.match(board, /Atlas/);
  assert.match(board, /Active · CI Passing/);
  assert.doesNotMatch(board, /<a\b|href=|Repo|Docs|Install|Download/);
});

test("project boards report displayed and total project counts truthfully", () => {
  const board = renderProjectBoard({ projects: Array.from({ length: 8 }, (_, index) => ({
    name: `Project ${index + 1}`, lifecycle: "active", ci: "passing",
  })) });
  assert.match(board, />6 of 8 shown<\/text>/);
  assert.match(board, /Project 6/);
  assert.doesNotMatch(board, /Project 7|Project 8/);
});

test("credential-bearing URLs never enter public SVG output", () => {
  const profile = renderProfileCard({
    name: "Ada", login: "ada", repositories: 2, followers: 3, following: 4,
    website: "https://user:secret-token@example.com/private",
  });
  assert.doesNotMatch(profile, /href=|user|secret-token/);
});

test("language byte shares include omitted source languages and respect totalBytes", () => {
  const languages = [
    { name: "Primary", bytes: 80 },
    { name: "Secondary", bytes: 20 },
    ...Array.from({ length: 6 }, (_, index) => ({ name: `Visible ${index + 3}`, bytes: 0 })),
    { name: "Omitted ninth", bytes: 100 },
  ];
  const derivedTotal = renderLanguagesCard({ languages });
  assert.match(derivedTotal, />40%<\/text>/);
  assert.match(derivedTotal, />10%<\/text>/);
  assert.doesNotMatch(derivedTotal, />80%<\/text>|>20%<\/text>/);

  const suppliedTotal = renderLanguagesCard({ languages, totalBytes: 400 });
  assert.match(suppliedTotal, />20%<\/text>/);
  assert.match(suppliedTotal, />5%<\/text>/);
});

test("language renderers accept canonical core aggregates and only accept CSS hex lengths", () => {
  const canonical = aggregateLanguages([
    { repo: "owner/atlas", languages: { Rust: 80, TypeScript: 20 } },
  ]);
  const canonicalOutput = renderLanguagesCard(canonical);
  assert.match(canonicalOutput, />Rust</);
  assert.match(canonicalOutput, />TypeScript</);
  assert.match(canonicalOutput, />80%<\/text>/);
  const mixedOutput = renderLanguagesCard({ languages: [
    { name: "Rust", bytes: 80 }, { name: "TypeScript", percentage: 20 },
  ] });
  assert.match(mixedOutput, />Rust</);
  assert.match(mixedOutput, />20%<\/text>/);
  const output = renderLanguagesCard({ languages: [
    { name: "Three", percentage: 25, color: "#abc" },
    { name: "Four", percentage: 25, color: "#abcd" },
    { name: "Six", percentage: 25, color: "#abcdef" },
    { name: "Eight", percentage: 25, color: "#abcdef12" },
    { name: "Invalid five", percentage: 0, color: "#12345" },
    { name: "Invalid seven", percentage: 0, color: "#1234567" },
  ] });
  for (const color of ["#abc", "#abcd", "#abcdef", "#abcdef12"]) assert.match(output, new RegExp(`fill="${color}"`));
  assert.doesNotMatch(output, /#12345|#1234567/);
});

test("profile stars are source-backed and absent stars stay unavailable", () => {
  const absent = renderProfileCard({ name: "Ada", login: "ada", repositories: 2, followers: 3, following: 4 });
  const present = renderProfileCard({ name: "Ada", login: "ada", repositories: 2, followers: 3, following: 4, stars: 1_250 });
  assert.doesNotMatch(absent, /Stars/);
  assert.match(present, />1.3k<\/text><text[^>]*>Stars<\/text>/);
  assert.doesNotMatch(renderProfileCard({ name: "Ada", login: "ada", repositories: 2, followers: 3, following: 4, stars: Number.NaN }), /Stars/);
  assert.doesNotMatch(renderProjectBoard({ projects: [{ name: "Atlas", lifecycle: "active", ci: "passing", stars: Number.NaN }] }), /★/);
});

test("activity dates are valid, bounded, and full supported windows stay below 30KB", () => {
  const dates = (length) => Array.from({ length }, (_, index) => ({
    date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10), count: index % 9,
  }));
  const activity364 = renderActivityCard({ days: dates(364), periodLabel: "P".repeat(100) });
  const activity366 = renderActivityCard({ days: [
    { date: "2025-02-29", count: 99 },
    ...dates(366),
    { date: "not-a-date", count: 99 },
  ] });
  const adversarialDays = dates(366).map((day) => ({ ...day, count: 100000 }));
  const escapedOutputs = [
    ["ampersand", "&"], ["apostrophe", String.fromCharCode(39)], ["emoji", "😀"],
  ].map(([label, character]) => [label, renderActivityCard({ days: adversarialDays, periodLabel: character.repeat(32) }, {
    title: character.repeat(96), description: character.repeat(180),
  })]);
  for (const [label, output] of [
    ["364-day", activity364], ["366-day", activity366], ...escapedOutputs,
  ]) {
    const bytes = Buffer.byteLength(output, "utf8");
    assert.ok(bytes < 30_000, `${label} SVG exceeded budget (${bytes} UTF-8 bytes)`);
  }
  assert.match(activity366, /aria-label="[^"]*2026-01-01: 5 contributions/);
  assert.match(escapedOutputs[0][1], /aria-label="2025-01-01: 100,000 contributions/);
  assert.match(escapedOutputs[2][1], /aria-label="2025-01-01: 100,000 contributions/);
  assert.match(escapedOutputs[0][1], /2025-01-01: 100,000 contributions/);
  assert.doesNotMatch(activity366, /2025-02-29: 99 contributions|not-a-date/);
  assert.match(activity364, />P{31}…<\/text>/);
});

test("activity accessibility summary remains chronological while visual cells stay hidden", () => {
  const output = renderActivityCard({ days: [
    { date: "2026-08-19", count: 9 }, { date: "2026-08-18", count: 1 },
  ] });
  assert.match(output, /role="group" aria-label="2026-08-18: 1 contributions; 2026-08-19: 9 contributions"/);
  assert.ok(output.indexOf("2026-08-18: 1 contributions") < output.indexOf("2026-08-19: 9 contributions"));
  assert.match(output, /<g aria-hidden="true" fill=/);
});

test("missing profile and streak fields stay honestly unavailable", () => {
  const profile = renderProfileCard({
    name: "Ada", login: "ada", repositories: 2, followers: 3, following: 4,
  });
  assert.doesNotMatch(profile, /Building in public|one useful commit/);

  const unavailable = renderStreakCard({ current: 7, longest: 19 });
  assert.match(unavailable, /Total unavailable · Active days unavailable/);
  assert.doesNotMatch(unavailable, /Total 0|0 active days/);

  const partial = renderStreakCard({ current: 7, longest: 19, total: 42 });
  assert.match(partial, /Total 42 · Active days unavailable/);
});

test("minimum layouts keep optional content inside the viewBox and names fall back to login", () => {
  const profile = renderProfileCard({
    name: "   ", login: "@ada", bio: "Bio", location: "London",
    repositories: 2, followers: 3, following: 4,
  }, { height: 1 });
  assert.match(profile, /<title>ada profile<\/title>/);
  assert.match(profile, />ada<\/text>/);
  assert.match(profile, /y="136"/);
  assert.match(profile, /y="154"/);
  const streak = renderStreakCard({ current: 7, longest: 19, total: 42, activeDays: 4, lastActive: "2026-08-18" }, { height: 1 });
  assert.match(streak, /viewBox="0 0 720 150"/);
  assert.match(streak, /y="128"[^>]*>Last active 2026-08-18/);
  assert.doesNotMatch(streak, /y="153"[^>]*>Last active/);
});

test("project columns use normalized widths at fractional and non-finite breakpoints", () => {
  const projects = Array.from({ length: 2 }, (_, index) => ({ name: `Project ${index + 1}`, lifecycle: "active", ci: "passing" }));
  const twoColumns = renderProjectBoard({ projects }, { width: 619.6 });
  const oneColumn = renderProjectBoard({ projects }, { width: 619.4 });
  assert.match(twoColumns, /x="316/);
  assert.match(oneColumn, /x="24" y="140"/);
  assert.match(renderProjectBoard({ projects }, { width: Number.NaN }), /viewBox="0 0 720/);
});

test("rendering is a stable snapshot for identical presentation data", () => {
  const data = { current: 7, longest: 19, total: 401, activeDays: 80, lastActive: "2026-08-18" };
  const first = renderStreakCard(data, { theme: "paper", width: 640 });
  const second = renderStreakCard(data, { theme: "paper", width: 640 });
  assert.equal(first, second);
  assert.match(first, /fill="#f8fafc"/);
  assert.match(first, /fill="#0f766e"/);
});

test("multiple inline cards compose without duplicate accessibility identifiers", () => {
  const profile = renderProfileCard({
    name: "Ada", login: "ada", repositories: 2, followers: 3, following: 4,
  }, { title: "Ada profile", description: "Profile summary" });
  const streak = renderStreakCard({ current: 7, longest: 19 }, {
    title: "Ada streak", description: "Contribution streak summary",
  });
  const composed = `${profile}${streak}`;
  assert.equal((composed.match(/<svg\b/g) ?? []).length, 2);
  assert.doesNotMatch(composed, /\bid=/);
  assert.match(profile, /aria-label="Ada profile"/);
  assert.match(streak, /aria-label="Ada streak"/);
  assert.match(profile, /<title>Ada profile<\/title><desc>Profile summary<\/desc>/);
  assert.match(streak, /<title>Ada streak<\/title><desc>Contribution streak summary<\/desc>/);
});

test("labels expose signal state without depending on color", () => {
  const board = renderProjectBoard({ projects: [
    { name: "A", lifecycle: "active", ci: "passing" },
    { name: "B", lifecycle: "maintained", ci: "failing" },
    { name: "C", lifecycle: "paused", ci: "pending" },
    { name: "D", lifecycle: "archived", ci: "unavailable" },
    { name: "E", lifecycle: "experimental", ci: "unconfigured" },
    { name: "F", lifecycle: "active", ci: "stale" },
    { name: "G", lifecycle: "active", ci: "passing" },
  ] }, { theme: "midnight" });
  for (const label of ["Active", "Maintained", "Paused", "Archived", "Experimental", "Passing", "Failing", "Pending", "Unavailable", "Unconfigured", "Stale"]) {
    assert.match(board, new RegExp(label));
  }
  assert.match(renderActivityCard({ days: [{ date: "2026-08-18", count: 0 }, { date: "2026-08-19", count: 4 }] }), /aria-label="2026-08-18: 0 contributions/);
  assert.match(renderLanguagesCard({ languages: [{ name: "Rust", percentage: 100 }] }), /Rust/);
});
