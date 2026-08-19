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
  assert.ok(output.length < 30_000, `SVG exceeded 30KB budget (${output.length})`);
}

test("primitives are deterministic and safe", () => {
  assert.equal(escapeXml(`<>&"'`), "&lt;&gt;&amp;&quot;&apos;");
  assert.equal(escapeXml(`a\u0000b\u0008c\ud800d`), "a�b�c�d");
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
  assert.match(renderActivityCard({ days: [{ date: "2026-08-18", count: 0 }, { date: "2026-08-19", count: 4 }] }), /2026-08-18: 0 contributions/);
  assert.match(renderLanguagesCard({ languages: [{ name: "Rust", percentage: 100 }] }), /Rust/);
});
