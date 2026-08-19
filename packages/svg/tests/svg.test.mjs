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
} from "../src/index.ts";

const injection = `<img src=x onerror="alert(1)"><script>alert(2)</script>&"'`;

function assertSafeSvg(output) {
  assert.match(output, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" role="img"/);
  assert.match(output, /aria-labelledby="title desc"/);
  assert.match(output, /<title id="title">/);
  assert.match(output, /<desc id="desc">/);
  assert.match(output, /viewBox="0 0 \d+ \d+"/);
  assert.match(output, /<\/svg>$/);
  for (const forbidden of [/<script/i, /<foreignObject/i, /<style/i, /<image/i, /<(?:svg|rect|text|a|circle|line|path)\b[^>]*\bon[a-z]+\s*=/i, /javascript:/i, /data:/i]) {
    assert.doesNotMatch(output, forbidden, `forbidden SVG construct matched: ${forbidden}`);
  }
  assert.ok(output.length < 30_000, `SVG exceeded 30KB budget (${output.length})`);
}

test("primitives are deterministic and safe", () => {
  assert.equal(escapeXml(`<>&\"'`), "&lt;&gt;&amp;&quot;&apos;");
  assert.equal(truncateText("hello", 5), "hello");
  assert.equal(truncateText("hello world", 6), "hello…");
  assert.equal(truncateText("😀😀😀", 2), "😀…");
  assert.equal(formatNumber(1234), "1.2k");
  assert.equal(formatNumber(1_200_000), "1.2M");
  assert.equal(formatNumber(Number.NaN), "0");
  assert.deepEqual(Object.keys(themes), ["aurora", "midnight", "paper", "ember"]);
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
    { name: injection, percentage: 66, color: `#123456\" onload=\"alert(1)` },
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
  assert.match(board, /href="https:\/\/example\.com\/repo"/);
});

test("rendering is a stable snapshot for identical presentation data", () => {
  const data = { current: 7, longest: 19, total: 401, activeDays: 80, lastActive: "2026-08-18" };
  const first = renderStreakCard(data, { theme: "paper", width: 640 });
  const second = renderStreakCard(data, { theme: "paper", width: 640 });
  assert.equal(first, second);
  assert.match(first, /fill="#f8fafc"/);
  assert.match(first, /fill="#0f766e"/);
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
  assert.match(renderActivityCard({ days: [{ date: "2026-08-18", count: 0 }, { date: "2026-08-19", count: 4 }] }), /2026-08-18: 0 contributions/);
  assert.match(renderLanguagesCard({ languages: [{ name: "Rust", percentage: 100 }] }), /Rust/);
});
