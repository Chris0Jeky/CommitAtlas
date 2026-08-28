import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeXml,
  formatNumber,
  renderContributionBreakdownCard,
  renderAtlasCard,
  renderActivityCard,
  renderCadenceCard,
  renderLanguagesCard,
  renderProfileCard,
  renderProjectBoard,
  renderReleasesCard,
  renderRhythmCard,
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

const XML_ENTITY = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/;
const XML_TAG = /^<(\/?)([A-Za-z][\w:.-]*)((?:\s+[A-Za-z][\w:.-]*\s*=\s*"[^"<]*")*)\s*(\/?)>/;

/**
 * Strict-enough XML well-formedness scan: every element opens and closes in order, every
 * attribute value is double-quoted and free of raw markup, and text content carries no
 * unescaped `<`, `>`, or bare `&`. Node has no bundled XML parser and this package takes no
 * runtime dependencies, so the scanner lives with the tests that need it.
 */
function assertWellFormedXml(output) {
  const stack = [];
  let index = 0;
  while (index < output.length) {
    const open = output.indexOf("<", index);
    const textRun = output.slice(index, open === -1 ? output.length : open);
    assert.doesNotMatch(textRun, />/, "unescaped '>' in text content");
    assert.doesNotMatch(textRun, XML_ENTITY, "unescaped '&' in text content");
    if (open === -1) break;
    const tag = XML_TAG.exec(output.slice(open));
    assert.ok(tag, `malformed tag at offset ${open}: ${JSON.stringify(output.slice(open, open + 90))}`);
    const [matched, closing, name, attributes, selfClosing] = tag;
    assert.doesNotMatch(attributes, XML_ENTITY, `unescaped '&' in <${name}> attributes`);
    if (closing) assert.equal(stack.pop(), name, `mismatched closing tag </${name}>`);
    else if (!selfClosing) stack.push(name);
    index = open + matched.length;
  }
  assert.deepEqual(stack, [], `unclosed elements: ${stack.join(", ")}`);
}

function assertSafeSvg(output, { allowStyle = false } = {}) {
  assert.match(output, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" role="img"/);
  assert.match(output, /aria-label="[^"]+"/);
  assert.match(output, /<title>/);
  assert.match(output, /<desc>/);
  assert.doesNotMatch(output, /\bid=/);
  assert.match(output, /viewBox="0 0 \d+ \d+"/);
  assert.match(output, /<\/svg>$/);
  const forbiddenPatterns = [/<script/i, /<foreignObject/i, /<image/i, /\bon[a-z]+\s*=\s*["']/i, /javascript:/i, /data:/i];
  if (!allowStyle) forbiddenPatterns.push(/<style/i);
  for (const forbidden of forbiddenPatterns) {
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
  assert.match(streak, /<title>Contribution streak<\/title><desc>Current and longest GitHub contribution streaks in the returned window\.<\/desc>/);
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

test("every standalone card supports subtle motion with a reduced-motion fallback", () => {
  const rhythm = {
    window: { from: "2026-01-01", to: "2026-02-25", days: 56 },
    activeDays: 20,
    density: 35.7,
    currentStreak: 3,
    currentStreakBoundary: "closed",
    trend: { buckets: [1, 2], recent28Days: 3, previous28Days: 2, changePercent: 50, direction: "up" },
    rhythm: { score: 42, level: "steady", basis: "70% active-day density (capped at 80%) + 30% current streak (capped at 30 days)" },
  };
  const renderers = [
    (motion) => renderProfileCard({ name: "Ada", login: "ada", repositories: 1, followers: 2, following: 3 }, { motion }),
    (motion) => renderStreakCard({ current: 1, longest: 2 }, { motion }),
    (motion) => renderActivityCard({ days: [{ date: "2026-02-25", count: 1 }] }, { motion }),
    (motion) => renderContributionBreakdownCard({
      window: rhythm.window,
      breakdown: { commits: 1, issues: 0, pullRequests: 0, reviews: 0 },
      basis: "exact-counts",
    }, { motion }),
    (motion) => renderRhythmCard(rhythm, { motion }),
    (motion) => renderLanguagesCard({ languages: [{ name: "TypeScript", percentage: 100 }] }, { motion }),
    (motion) => renderProjectBoard({ projects: [{ name: "Atlas", lifecycle: "active", ci: "passing" }] }, { motion }),
    (motion) => renderCadenceCard({ days: [{ date: "2026-02-25", count: 2 }] }, { motion }),
    (motion) => renderReleasesCard({ releases: [{ project: "Atlas", tag: "v1.0.0", publishedAt: "2026-02-25T12:00:00Z" }] }, { motion }),
  ];
  for (const render of renderers) {
    const animated = render("subtle");
    assert.match(animated, /@keyframes card-enter/);
    assert.match(animated, /prefers-reduced-motion:reduce/);
    // Renderers that never run CSS animations (SVG through <img>) must still show a finished card.
    assert.doesNotMatch(animated, /\bboth\b|backwards|from\{[^}]*opacity|from\{[^}]*scale/);
    assert.match(animated, /<g class="card-enter">/);
    assertSafeSvg(animated, { allowStyle: true });
    const still = render("none");
    assert.doesNotMatch(still, /<style>|@keyframes|animation:/);
    assertSafeSvg(still);
  }
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

test("all standalone cards disclose synthetic data visibly and accessibly while live cards omit it", () => {
  const synthetic = [
    renderProfileCard({
      name: "Demo", login: "demo", repositories: 1, followers: 2, following: 3,
      source: "synthetic-demo",
    }),
    renderStreakCard({ current: 4, longest: 9, source: "synthetic-demo" }),
    renderActivityCard({ days: [{ date: "2026-08-20", count: 3 }], source: "synthetic-demo" }),
    renderLanguagesCard({ languages: [{ name: "TypeScript", percentage: 100 }], source: "synthetic-demo" }),
    renderProjectBoard({
      projects: [{ name: "Atlas", lifecycle: "active", ci: "passing" }], source: "synthetic-demo",
    }),
  ];
  for (const output of synthetic) {
    assert.match(output, /aria-label="Synthetic demo: [^"]+"/);
    assert.match(output, /<title>Synthetic demo: [^<]+<\/title>/);
    assert.match(output, /<desc>Synthetic demonstration data, not live GitHub data\./);
    assert.match(output, />SYNTHETIC DEMO<\/text>/);
  }

  const live = [
    renderProfileCard({
      name: "Ada", login: "ada", repositories: 1, followers: 2, following: 3,
      source: "public-github",
    }),
    renderStreakCard({ current: 4, longest: 9, source: "public-profile" }),
    renderActivityCard({ days: [], source: "public-github" }),
    renderLanguagesCard({ languages: [], source: "public-github" }),
    renderProjectBoard({ projects: [], source: "public-github" }),
  ];
  for (const output of live) {
    assert.doesNotMatch(output, /SYNTHETIC DEMO|Synthetic demo:|Synthetic demonstration data/);
  }
});

test("streak cards distinguish boundary-open values from observed-window values", () => {
  const open = renderStreakCard({
    current: 365,
    longest: 365,
    windowDays: 365,
    boundary: { current: "open", longest: "open" },
    total: 900,
    activeDays: 365,
    lastActive: "2026-08-20",
  });
  assert.match(open, />365\+<\/text>/);
  assert.match(open, /Longest in 365-day window/);
  assert.match(open, /Earlier history is not observed|earlier history not observed/);
  assert.match(open, /Current streak: at least 365 days/);

  const closed = renderStreakCard({
    current: 42,
    longest: 61,
    windowDays: 365,
    boundary: { current: "closed", longest: "closed" },
  });
  assert.match(closed, />42<\/text>/);
  assert.doesNotMatch(closed, />42\+<\/text>/);
});

test("streak cards disclose when an open UTC day leaves the streak ending yesterday", () => {
  const output = renderStreakCard({
    current: 37,
    currentThrough: "2026-08-26",
    asOf: "2026-08-27",
    longest: 53,
    windowDays: 365,
    boundary: { current: "closed", longest: "closed" },
  });
  assert.match(output, /days · through 2026-08-26/);
  assert.match(output, /Current streak: 37 days through 2026-08-26/);
  assertSafeSvg(output);
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

test("project boards omit redundant shown counts when every project fits", () => {
  const board = renderProjectBoard({ projects: [
    { name: "Atlas", lifecycle: "active", ci: "passing" },
    { name: "Harbor", lifecycle: "maintained", ci: "stale" },
  ] });
  assert.doesNotMatch(board, /of 2 shown/);
});

test("atlas card composes density, breakdown, trend, bounded streak, and honest rhythm semantics", () => {
  const activity = Array.from({ length: 365 }, (_, index) => ({
    date: new Date(Date.UTC(2025, 8, 21 + index)).toISOString().slice(0, 10),
    count: index % 6,
    level: Math.min(4, index % 5),
  }));
  const data = {
    profile: { name: injection, login: "octocat", repositories: 24, followers: 312, stars: 487 },
    window: { from: activity[0].date, to: activity.at(-1).date, days: 365 },
    total: 912,
    activeDays: 286,
    density: 78.4,
    averagePerDay: 2.5,
    currentStreak: 30,
    longestStreak: 53,
    streakBasis: "returned-window",
    streakBoundary: { current: "open", longest: "open" },
    peakDay: { date: activity[11].date, count: 8 },
    breakdown: { commits: 740, issues: 18, pullRequests: 64, reviews: 90 },
    trend: { buckets: [30, 44, 39, 52, 61, 48, 73, 66, 82, 70, 88, 95], recent28Days: 335, previous28Days: 280, changePercent: 19.6, direction: "up" },
    rhythm: { score: 84, level: "relentless" },
    activity,
    languages: [{ name: "TypeScript", percentage: 55 }, { name: "Python", percentage: 30 }, { name: "Rust", percentage: 15 }],
    projects: { total: 6, passing: 4, attention: 1, unavailable: 1 },
    generatedAt: "2026-08-20T18:00:00.000Z",
    source: "public-github",
  };
  const staticAtlas = renderAtlasCard(data, { theme: "ember", motion: "none" });
  const animatedAtlas = renderAtlasCard(data, { theme: "aurora", motion: "subtle" });
  const narrowAtlas = renderAtlasCard(data, { width: 420, motion: "none" });

  assertSafeSvg(staticAtlas);
  assertSafeSvg(animatedAtlas, { allowStyle: true });
  assertSafeSvg(narrowAtlas);
  assert.match(staticAtlas, /CONTRIBUTION DENSITY/);
  assert.match(staticAtlas, /CONTRIBUTION MIX/);
  assert.match(staticAtlas, /Commits/);
  assert.match(staticAtlas, /Pull requests/);
  assert.match(staticAtlas, /RHYTHM/);
  assert.match(staticAtlas, /not a GitHub rank/);
  assert.match(staticAtlas, /longest streak is window-bounded/);
  assert.match(staticAtlas, />30\+d<\/text>/);
  assert.match(staticAtlas, /at least 30 day current streak/);
  assert.match(animatedAtlas, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(animatedAtlas, /@import|url\s*\(/i);
  // Chromium never runs CSS animations when the SVG arrives through <img> (GitHub's README
  // pipeline). Fill-mode "both"/"backwards" would pin such a renderer to the `from` state, so
  // motion must use fill-mode none (a delay keeps animating renderers from flashing), and no
  // keyframe may fade or collapse — a frozen `from` must still read as a finished card.
  assert.doesNotMatch(animatedAtlas, /from\{[^}]*opacity/);
  assert.doesNotMatch(animatedAtlas, /from\{[^}]*scale/);
  assert.doesNotMatch(animatedAtlas, /\bboth\b|backwards/);
  assert.match(narrowAtlas, /viewBox="0 0 420 570"/);

  const publicProfileAtlas = renderAtlasCard({
    ...data,
    breakdownBasis: "public-profile-percentages",
    breakdown: { commits: 77.8, issues: 6.7, pullRequests: 12.6, reviews: 2.9 },
  });
  assert.match(publicProfileAtlas, /02 \/\/ PROFILE MIX · NOT WINDOW-SCOPED/);
  assert.match(publicProfileAtlas, />77\.8%<\/text>/);
  assert.match(publicProfileAtlas, /Public profile activity percentage mix from calendar-year views, not scoped to this contribution window: 77\.8% commits/);
});

test("atlas heatmap uses GitHub weekday geometry and labels an open-day streak honestly", () => {
  const activity = [
    { date: "2026-08-20", count: 999, level: 1 },
    { date: "2026-08-21", count: 1, level: 4 },
    { date: "2026-08-22", count: 8, level: 2 },
    { date: "2026-08-23", count: 7, level: 3 },
  ];
  const output = renderAtlasCard(atlasFixture({
    activity,
    window: { from: "2026-08-20", to: "2026-08-23", days: 4 },
    currentStreak: 3,
    currentStreakThrough: "2026-08-22",
  }), { theme: "ember", motion: "none" });
  assert.match(output, /<path class="atlas-cell" fill="#5c2a17" d="M24 190h7v7H24Z"\/>/);
  assert.match(output, /<path class="atlas-cell" fill="#ff7a45" d="M24 199h7v7H24Z"\/>/);
  assert.match(output, /<path class="atlas-cell" fill="#97431f" d="M24 208h7v7H24Z"\/>/);
  assert.match(output, /<path class="atlas-cell" fill="#d05e2f" d="M33 154h7v7H33Z"\/>/);
  assert.match(output, />STREAK TO 08-22<\/text>/);
  assert.doesNotMatch(output, /\sx="-/);
  assert.match(output, /3 day current streak through 2026-08-22/);
  assertSafeSvg(output);
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
  assert.throws(() => renderLanguagesCard({ languages: [
    { name: "Rust", bytes: 80 }, { name: "TypeScript", percentage: 20 },
  ] }), /all bytes, all percentages, or canonical/);
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
  assert.doesNotMatch(renderProjectBoard({ projects: [{ name: "Atlas", lifecycle: "active", ci: "passing", stars: 0 }] }), /★/);
  assert.match(renderProjectBoard({ projects: [{ name: "Atlas", lifecycle: "active", ci: "passing", stars: 3 }] }), /★ 3/);
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
  assert.match(activity366, /<desc>[^<]*2026-01-01 5/);
  assert.match(escapedOutputs[0][1], /<desc>[^<]*2025-01-01 100,000/);
  assert.match(escapedOutputs[2][1], /<desc>[^<]*2025-01-01 100,000/);
  assert.match(escapedOutputs[0][1], /2025-01-01 100,000/);
  assert.doesNotMatch(activity366, /2025-02-29: 99 contributions|not-a-date/);
  // Still bounded — the label just follows the section numeral now.
  assert.match(activity364, />01 \/\/ P{31}…<\/text>/);
});

test("activity accessibility summary belongs to the outer SVG description", () => {
  const output = renderActivityCard({ days: [
    { date: "2026-08-19", count: 9 }, { date: "2026-08-18", count: 1 },
  ] });
  assert.match(output, /<desc>A compact contribution activity map with text labels for accessible status\. Contributions by date, chronologically: 2026-08-18 1; 2026-08-19 9<\/desc>/);
  assert.doesNotMatch(output, /<g role="group"/);
  assert.match(output, /2026-08-18 1; 2026-08-19 9/);
  assert.ok(output.indexOf("2026-08-18 1") < output.indexOf("2026-08-19 9"));
  assert.match(output, /<g aria-hidden="true"><path fill=/);
});

test("activity cells preserve chronological DOM order across alternating intensities", () => {
  const output = renderActivityCard({ days: [
    { date: "2026-08-21", count: 9 }, { date: "2026-08-18", count: 0 },
    { date: "2026-08-20", count: 5 }, { date: "2026-08-19", count: 1 },
  ] }, { theme: "midnight" });
  const paths = [...output.matchAll(/<path fill="([^"]+)" d="[^"]+"\/>/g)];
  assert.equal(paths.length, 4);
  assert.notEqual(paths[0][1], paths[1][1]);
  assert.notEqual(paths[1][1], paths[2][1]);
  assert.notEqual(paths[2][1], paths[3][1]);
  assert.match(output, /<desc>[^<]*Contributions by date, chronologically: 2026-08-18 0; 2026-08-19 1; 2026-08-20 5; 2026-08-21 9<\/desc>/);
  assert.ok(output.indexOf("2026-08-18 0") < output.indexOf("2026-08-19 1"));
  assert.ok(output.indexOf("2026-08-19 1") < output.indexOf("2026-08-20 5"));
  assert.ok(output.indexOf("2026-08-20 5") < output.indexOf("2026-08-21 9"));
});

test("activity cells use Sunday rows and preserve GitHub's supplied intensity levels", () => {
  const output = renderActivityCard({ days: [
    { date: "2026-08-20", count: 999, level: 1 },
    { date: "2026-08-21", count: 1, level: 4 },
    { date: "2026-08-22", count: 8, level: 2 },
    { date: "2026-08-23", count: 7, level: 3 },
  ] }, { theme: "ember" });
  // Thursday, Friday, and Saturday remain in the first week column. Sunday begins the next one.
  assert.match(output, /<path fill="#5c2a17" d="M40 118h11v11H40"\/>/);
  assert.match(output, /<path fill="#ff7a45" d="M40 131h11v11H40"\/>/);
  assert.match(output, /<path fill="#97431f" d="M40 144h11v11H40"\/>/);
  assert.match(output, /<path fill="#d05e2f" d="M53 66h11v11H53"\/>/);
  assertSafeSvg(output);
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
  assert.match(profile, /y="110"[^>]*>⌖ London/);
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
  assert.match(first, /fill="#dfe4c9"/);
  assert.match(first, /fill="#9c3d0d"/);
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
    { name: "E", lifecycle: "planned", ci: "unconfigured" },
    { name: "F", lifecycle: "active", ci: "stale" },
    { name: "G", lifecycle: "active", ci: "passing" },
  ] }, { theme: "midnight" });
  for (const label of ["Active", "Maintained", "Paused", "Archived", "Planned", "Passing", "Failing", "Pending", "Unavailable", "Unconfigured", "Stale"]) {
    assert.match(board, new RegExp(label));
  }
  assert.match(renderProjectBoard({ projects: [{ name: "Legacy", lifecycle: "experimental", ci: "unconfigured" }] }), /Experimental/);
  assert.match(renderActivityCard({ days: [{ date: "2026-08-18", count: 0 }, { date: "2026-08-19", count: 4 }] }), /<desc>[^<]*2026-08-18 0/);
  assert.match(renderLanguagesCard({ languages: [{ name: "Rust", percentage: 100 }] }), /Rust/);
});

test("breakdown card keeps exact counts and public percentages truthful", () => {
  const exact = renderContributionBreakdownCard({
    source: "public-github",
    window: { from: "2026-01-01", to: "2026-12-31", days: 365 },
    breakdown: { commits: 7, issues: 2, pullRequests: 1, reviews: 0 },
    basis: "exact-counts",
  });
  assert.match(exact, /viewBox="0 0 720 220"/);
  assert.match(exact, /EXACT COUNTS/);
  assert.match(exact, />7<\/text>/);
  assert.match(exact, /bars normalized to categorized total/);
  const percentages = renderContributionBreakdownCard({
    source: "public-profile",
    window: { from: "2026-01-01", to: "2026-12-31", days: 365 },
    breakdown: { commits: 62.5, issues: 12.5, pullRequests: 25, reviews: 0 },
    basis: "public-profile-percentages",
  });
  assert.match(percentages, /PUBLIC PROFILE %/);
  assert.match(percentages, /62\.5%/);
  assert.match(percentages, /GitHub profile activity mix · not window-scoped/);
  assert.match(percentages, /Annual profile-view percentages · exact window counts unavailable/);
  assert.match(percentages, /not scoped to the requested 365-day contribution-calendar window/);
  assert.match(percentages, /not scoped to the requested contribution-calendar window/);
  assert.doesNotMatch(percentages, /broken down by type for the selected window/);
  assert.doesNotMatch(percentages, /2026-01-01 → 2026-12-31/);
  assert.doesNotMatch(percentages, /Total 100|100 contributions/);
  assert.match(percentages, /width="275\.75" height="8" fill="#6cc6ff"/);
  assertSafeSvg(percentages);
});

test("rhythm card shows bounded streak semantics and honest trend states", () => {
  const data = {
    source: "public-github",
    window: { from: "2026-01-01", to: "2026-03-31", days: 90 },
    activeDays: 30,
    density: 33.3,
    currentStreak: 4,
    currentStreakBoundary: "open",
    trend: { buckets: [0, 1, 3, 2], recent28Days: 6, previous28Days: 3, changePercent: 100, direction: "up" },
    rhythm: { score: 44, level: "steady", basis: "70% active-day density (capped at 80%) + 30% current streak (capped at 30 days)" },
  };
  const wide = renderRhythmCard(data);
  assert.match(wide, /viewBox="0 0 720 220"/);
  assert.match(wide, /PERSONAL CONSISTENCY/);
  assert.match(wide, /at least 4 days · OPEN/);
  assert.match(wide, /\+100% vs prior 28 days/);
  assert.match(wide, /70% active-day density \(capped at 80%\) \+ 30% current streak \(capped at 30 days\)/);
  assert.match(wide, /COMMITATLAS CONSISTENCY · NOT A GITHUB RANK/);
  assert.match(wide, /<desc>[^<]*this is not a GitHub rank/);
  assertSafeSvg(wide);
  const compact = renderRhythmCard({ ...data, currentStreakBoundary: "closed", trend: { ...data.trend, direction: "unavailable", changePercent: null, previous28Days: null } }, { width: 480 });
  assert.match(compact, /viewBox="0 0 480 300"/);
  assert.match(compact, /Trend unavailable/);
  assert.match(compact, /Streak is bounded to this window/);
  assertSafeSvg(compact);

  const throughYesterday = renderRhythmCard({
    ...data,
    currentStreak: 3,
    currentStreakThrough: "2026-03-30",
  });
  assert.match(throughYesterday, /Current streak observed through 2026-03-30/);
  assert.match(throughYesterday, /Current streak: at least 3 days · OPEN through 2026-03-30/);
});

function renderedTextSizes(output) {
  return [...output.matchAll(/<text\b[^>]*\bfont-size="([\d.]+)"/g)].map((match) => Number(match[1]));
}

test("standalone cards keep meaningful visible text above the readability floor at compact widths", () => {
  const cards = [
    renderProfileCard({ name: "Ada Lovelace", login: "ada", repositories: 3, followers: 5 }, { width: 420, height: 190 }),
    renderStreakCard({ current: 4, longest: 12, lastActive: "2026-08-28" }, { width: 420, height: 150 }),
    renderActivityCard({ days: [{ date: "2026-08-28", count: 4 }] }, { width: 420 }),
    renderContributionBreakdownCard({
      window: { from: "2026-01-01", to: "2026-08-28", days: 240 },
      breakdown: { commits: 7, issues: 2, pullRequests: 1, reviews: 0 },
      basis: "exact-counts",
    }, { width: 420 }),
    renderRhythmCard(rhythmFixture(), { width: 480 }),
    renderLanguagesCard({ languages: [{ name: "TypeScript", percentage: 100 }] }, { width: 420 }),
    renderProjectBoard({ projects: [{ name: "Atlas", lifecycle: "active", ci: "passing", version: "v1.2.3", stars: 4 }] }, { width: 420 }),
    renderCadenceCard({ days: [{ date: "2026-08-24", count: 4 }, { date: "2026-08-28", count: 2 }] }, { width: 420 }),
    renderReleasesCard({ releases: [{ project: "Atlas", tag: "v1.2.3", publishedAt: "2026-08-28T12:00:00Z" }] }, { width: 420 }),
  ];
  for (const output of cards) {
    assertSafeSvg(output);
    const sizes = renderedTextSizes(output);
    assert.ok(sizes.length > 0, "expected visible text in representative card");
    assert.ok(Math.min(...sizes) >= 9.5, `visible text fell below 9.5px: ${sizes.join(", ")}`);
  }

  const compactRhythm = renderRhythmCard(rhythmFixture(), { width: 480, height: 1 });
  assert.match(compactRhythm, /viewBox="0 0 480 300"/);
  const compactCadence = renderCadenceCard({ days: [{ date: "2026-08-24", count: 4 }] }, { width: 420, height: 1 });
  assert.match(compactCadence, /viewBox="0 0 420 190"/);
  const compactReleases = renderReleasesCard({ releases: [{ project: "Atlas", tag: "v1.2.3", publishedAt: "2026-08-28T12:00:00Z" }] }, { width: 420, height: 1 });
  assert.match(compactReleases, /viewBox="0 0 420 156"/);
});

/** A lone surrogate is not a legal XML character; truncation must never split an astral pair. */
function assertNoLoneSurrogate(output) {
  assert.doesNotMatch(
    output,
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,
    "truncation split a surrogate pair",
  );
}

/** Derive window labels from the clock so a pinned date can never decay into a stale fixture. */
function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

const GEOMETRY_ATTRIBUTE = /\s(stroke-dasharray|stroke-width|height|width|x1|y1|x2|y2|cx|cy|rx|x|y|r)="([^"]*)"/g;

function assertFiniteGeometry(output) {
  let inspected = 0;
  for (const [, name, value] of output.matchAll(GEOMETRY_ATTRIBUTE)) {
    for (const token of value.trim().split(/\s+/)) {
      assert.ok(Number.isFinite(Number(token)), `non-finite ${name} attribute value ${JSON.stringify(token)}`);
    }
    inspected += 1;
  }
  assert.ok(inspected > 0, "expected geometry attributes to inspect");
}

const breakdownWindowBasis = { commits: 7, issues: 2, pullRequests: 1, reviews: 0 };

function rhythmFixture(overrides = {}) {
  return {
    source: "public-github",
    window: { from: isoDaysAgo(90), to: isoDaysAgo(0), days: 90 },
    activeDays: 30, density: 33.3, currentStreak: 4, currentStreakBoundary: "open",
    trend: { buckets: [0, 1, 3, 2], recent28Days: 6, previous28Days: 3, changePercent: 100, direction: "up" },
    rhythm: {
      score: 44, level: "steady",
      basis: "70% active-day density (capped at 80%) + 30% current streak (capped at 30 days)",
    },
    ...overrides,
  };
}

function atlasFixture(overrides = {}) {
  const activity = Array.from({ length: 365 }, (_, index) => ({
    date: isoDaysAgo(364 - index),
    count: index % 6,
    level: Math.min(4, index % 5),
  }));
  return {
    profile: { name: "Ada Lovelace", login: "octocat", repositories: 24, followers: 312, stars: 487 },
    window: { from: activity[0].date, to: activity.at(-1).date, days: 365 },
    total: 912, activeDays: 286, density: 78.4, averagePerDay: 2.5,
    currentStreak: 30, longestStreak: 53, streakBasis: "returned-window",
    streakBoundary: { current: "open", longest: "open" },
    peakDay: { date: activity[11].date, count: 8 },
    breakdown: { commits: 740, issues: 18, pullRequests: 64, reviews: 90 },
    trend: { buckets: [30, 44, 39, 52, 61, 48, 73, 66, 82, 70, 88, 95], recent28Days: 335, previous28Days: 280, changePercent: 19.6, direction: "up" },
    rhythm: { score: 84, level: "relentless" },
    activity,
    languages: [{ name: "TypeScript", percentage: 55 }, { name: "Python", percentage: 30 }],
    projects: { total: 6, passing: 4, attention: 1, unavailable: 1 },
    generatedAt: `${isoDaysAgo(0)}T18:00:00.000Z`,
    source: "public-github",
    ...overrides,
  };
}

test("insight cards bound hostile direct-caller text at the package boundary", () => {
  // Control characters, a lone surrogate, RTL override and zero-width space, then unbounded filler.
  const hostileProse = `${injection}\u202eRTL\u200bZWSP\u0001`;
  const overlong = `${hostileProse}${"A".repeat(50_000)}`;
  const breakdown = renderContributionBreakdownCard({
    source: "public-github",
    window: { from: overlong, to: overlong, days: 90 },
    breakdown: breakdownWindowBasis,
    basis: "exact-counts",
  });
  const rhythm = renderRhythmCard(rhythmFixture({
    window: { from: overlong, to: overlong, days: 90 },
    rhythm: { score: 44, level: overlong, basis: overlong },
  }));
  for (const output of [breakdown, rhythm]) {
    assertSafeSvg(output);
    assertWellFormedXml(output);
    assertFiniteGeometry(output);
    assert.doesNotMatch(output, /NaN|Infinity/);
    assert.doesNotMatch(output, /<foreignObject/i);
    assert.doesNotMatch(output, /A{200}/, "unbounded caller text reached the rendered card");
    assert.match(output, /…/, "truncation must stay visible instead of dropping text silently");
    // Far below the 30KB budget: the same inputs rendered over 100KB before the boundary clamp.
    assert.ok(Buffer.byteLength(output, "utf8") < 6_000, `bounded card grew to ${Buffer.byteLength(output, "utf8")} bytes`);
  }
  // Hostile text is escaped and kept, not dropped: the prefix survives truncation.
  assert.match(breakdown, /&lt;img src=x onerror=/);
  assert.match(rhythm, /&lt;IMG SRC=X ONERROR=&quot;ALE…/);
  // Valid adapter-shaped values stay verbatim, so bounding does not rewrite truthful labels.
  const valid = renderRhythmCard(rhythmFixture());
  assert.match(valid, /STEADY/);
  assert.match(valid, /70% active-day density \(capped at 80%\) \+ 30% current streak \(capped at 30 days\)/);
  assert.doesNotMatch(valid, /…/);
});

test("insight cards keep non-finite direct-caller numerics out of the rendered SVG", () => {
  const from = isoDaysAgo(90);
  const to = isoDaysAgo(0);
  for (const value of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
    const outputs = [
      renderContributionBreakdownCard({
        window: { from, to, days: value },
        breakdown: { commits: value, issues: value, pullRequests: value, reviews: value },
        basis: "exact-counts",
      }),
      renderContributionBreakdownCard({
        window: { from, to, days: value },
        breakdown: { commits: value, issues: value, pullRequests: 25, reviews: 0 },
        basis: "public-profile-percentages",
      }),
      renderRhythmCard(rhythmFixture({
        window: { from, to, days: value },
        activeDays: value, density: value, currentStreak: value,
        trend: { buckets: [value, value, 1], recent28Days: value, previous28Days: value, changePercent: value, direction: "up" },
        rhythm: { score: value, level: "steady", basis: "bounded basis" },
      })),
      renderRhythmCard(rhythmFixture({ trend: { buckets: [], recent28Days: value, previous28Days: null, changePercent: value, direction: "new" } })),
    ];
    for (const output of outputs) {
      assertSafeSvg(output);
      assertWellFormedXml(output);
      assertFiniteGeometry(output);
      assert.doesNotMatch(output, /NaN|Infinity/, `non-finite ${String(value)} leaked into the card`);
    }
  }
  // A non-enum rhythm level must not crash the renderer or emit an unbounded label.
  const coerced = renderRhythmCard(rhythmFixture({ rhythm: { score: 44, level: 42, basis: undefined } }));
  assertSafeSvg(coerced);
  assertWellFormedXml(coerced);
  assert.match(coerced, />42</);
  assert.doesNotMatch(coerced, /undefined/);
});

test("atlas card bounds hostile direct-caller text at the package boundary", () => {
  // Control characters, a lone surrogate, an astral emoji, then unbounded filler. Apostrophes
  // are the worst escape expansion (`&apos;`, 6 bytes per code point), so they prove the byte
  // budget holds even though `truncateText` bounds code points rather than escaped length.
  const hostile = `${injection}\u{1F600}\u202eRTL\u200bZWSP${"'".repeat(50_000)}`;
  const data = atlasFixture({
    profile: { name: hostile, login: hostile, repositories: 24, followers: 312, stars: 487 },
    window: { from: hostile, to: hostile, days: 365 },
    peakDay: { date: hostile, count: 8 },
    rhythm: { score: 84, level: hostile },
    languages: Array.from({ length: 5_000 }, () => ({ name: hostile, percentage: 12 })),
    generatedAt: hostile,
  });
  for (const width of [420, 860, 1_200]) {
    const output = renderAtlasCard(data, { width, title: hostile, description: hostile, motion: "none" });
    assertSafeSvg(output);
    assertWellFormedXml(output);
    assertFiniteGeometry(output);
    assertNoLoneSurrogate(output);
    assert.doesNotMatch(output, /NaN|Infinity/);
    assert.doesNotMatch(output, /<foreignObject/i);
    // 180 is the longest bound any single field carries (`MAX_DESCRIPTION_LENGTH`), so a longer
    // unbroken run means some field escaped its bound.
    assert.doesNotMatch(output, /(?:&apos;){181}/, "unbounded caller text reached the rendered card");
    // Far below the 30KB budget: a 50,000-character window label rendered over 100KB before this bound.
    const bytes = Buffer.byteLength(output, "utf8");
    assert.ok(bytes < 24_000, `bounded atlas card grew to ${bytes} bytes at width ${width}`);
  }
  // Truncation stays visible instead of dropping text silently.
  assert.match(renderAtlasCard(data, { motion: "none" }), /…/);
  // An astral code point survives truncation whole rather than being split.
  const astral = renderAtlasCard(atlasFixture({
    window: { from: "\u{1F600}".repeat(400), to: "\u{1F600}".repeat(400), days: 365 },
    rhythm: { score: 84, level: "\u{1F600}".repeat(400) },
  }), { motion: "none" });
  assertSafeSvg(astral);
  assertWellFormedXml(astral);
  assertNoLoneSurrogate(astral);
  // Valid adapter-shaped values stay verbatim, so bounding never rewrites a truthful label.
  const valid = renderAtlasCard(atlasFixture(), { motion: "none" });
  assert.match(valid, /RELENTLESS · PERSONAL CONSISTENCY/);
  assert.match(valid, new RegExp(`365D · ${isoDaysAgo(0)}`));
  assert.doesNotMatch(valid, /…/);
});

test("atlas card keeps non-finite direct-caller numerics out of the rendered SVG", () => {
  for (const value of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
    const outputs = [
      renderAtlasCard(atlasFixture({ window: { from: isoDaysAgo(364), to: isoDaysAgo(0), days: value } }), { motion: "none" }),
      renderAtlasCard(atlasFixture({ projects: { total: value, passing: value, attention: value, unavailable: value } }), { motion: "none" }),
      renderAtlasCard(atlasFixture({ projects: { total: 6, passing: 4, attention: value, unavailable: 1 } }), { motion: "none" }),
      renderAtlasCard(atlasFixture({
        trend: { buckets: [value, 1, value], recent28Days: value, previous28Days: value, changePercent: value, direction: "up" },
      }), { motion: "none" }),
      renderAtlasCard(atlasFixture({
        total: value, activeDays: value, density: value, averagePerDay: value,
        currentStreak: value, longestStreak: value,
        peakDay: { date: isoDaysAgo(30), count: value },
        breakdown: { commits: value, issues: value, pullRequests: value, reviews: value },
        rhythm: { score: value, level: "steady" },
        profile: { name: "Ada", login: "ada", repositories: value, followers: value, stars: value },
        languages: [{ name: "TypeScript", percentage: value }],
      }), { width: 420, motion: "subtle" }),
    ];
    for (const output of outputs) {
      assertSafeSvg(output, { allowStyle: true });
      assertWellFormedXml(output);
      assertFiniteGeometry(output);
      assert.doesNotMatch(output, /NaN|Infinity/, `non-finite ${String(value)} leaked into the atlas card`);
    }
  }
  // An unknown project tally is reported as unknown, never as a zeroed-out healthy one.
  const unknownProjects = renderAtlasCard(atlasFixture({ projects: { total: 6, passing: Number.NaN, attention: 1, unavailable: 1 } }), { motion: "none" });
  assert.match(unknownProjects, /Project health unavailable/);
  assert.doesNotMatch(unknownProjects, /CI passing/);
  // A negative count is impossible, so it is an unknown signal too — and a more dangerous one than
  // NaN, because `finite()` clamps it to a plausible zero. Without this bound,
  // `{ total: 6, passing: 6, attention: -1, unavailable: 0 }` rendered as
  // `6/6 CI passing · 0 attention · 0 unavailable` in the muted healthy style.
  for (const key of ["total", "passing", "attention", "unavailable"]) {
    const negative = renderAtlasCard(
      atlasFixture({ projects: { total: 6, passing: 6, attention: 0, unavailable: 0, [key]: -1 } }),
      { motion: "none" },
    );
    assert.match(negative, /Project health unavailable/, `negative ${key} was not reported as unknown`);
    assert.doesNotMatch(negative, /CI passing/, `negative ${key} still rendered a confident tally`);
    assertSafeSvg(negative, { allowStyle: true });
    assertWellFormedXml(negative);
    assertFiniteGeometry(negative);
  }
  // An unknown trend change is reported as unknown too.
  const unknownTrend = renderAtlasCard(atlasFixture({
    trend: { buckets: [1, 2, 3], recent28Days: 12, previous28Days: 9, changePercent: Number.POSITIVE_INFINITY, direction: "up" },
  }), { motion: "none" });
  assert.match(unknownTrend, /trend change unavailable/);
  // A non-enum rhythm level must not crash the renderer.
  const coerced = renderAtlasCard(atlasFixture({ rhythm: { score: 44, level: 42 } }), { motion: "none" });
  assertSafeSvg(coerced);
  assertWellFormedXml(coerced);
  assert.match(coerced, /42 · PERSONAL CONSISTENCY/);
  assert.doesNotMatch(coerced, /undefined/);
});

test("ratio geometry stays finite for huge direct-caller numerics", () => {
  for (const value of [Number.MAX_VALUE, 3.8e306]) {
    const outputs = [
      renderRhythmCard(rhythmFixture({ trend: { buckets: [value, 1], recent28Days: value, previous28Days: 1, changePercent: 0, direction: "flat" } })),
      renderContributionBreakdownCard({
        window: { from: "2026-01-01", to: "2026-01-31", days: 31 },
        breakdown: { commits: value, issues: 1, pullRequests: 1, reviews: 1 }, basis: "exact-counts",
      }),
      renderAtlasCard(atlasFixture({
        breakdown: { commits: value, issues: 1, pullRequests: 1, reviews: 1 },
        trend: { buckets: [value, 1], recent28Days: value, previous28Days: 1, changePercent: 0, direction: "flat" },
      }), { motion: "none" }),
    ];
    for (const output of outputs) {
      assertSafeSvg(output);
      assertWellFormedXml(output);
      assertFiniteGeometry(output);
      assert.doesNotMatch(output, /NaN|Infinity/, `huge finite ${value} leaked into the SVG`);
    }
  }
});

test("atlas card bounds the momentum strip like the rhythm card does", () => {
  const bars = (output) => (output.match(/<rect class="atlas-bar"/g) ?? []).length;
  // Four breakdown bars plus one bar per rendered trend bucket.
  assert.equal(bars(renderAtlasCard(atlasFixture(), { motion: "none" })), 16);
  // `@commit-atlas/core` caps `trendWeeks` at 16, so 16 buckets still render one bar each.
  assert.equal(bars(renderAtlasCard(atlasFixture({
    trend: { buckets: Array.from({ length: 16 }, (_, index) => index + 1), recent28Days: 335, previous28Days: 280, changePercent: 19.6, direction: "up" },
  }), { motion: "none" })), 20);
  const flooded = renderAtlasCard(atlasFixture({
    trend: { buckets: Array.from({ length: 50_000 }, (_, index) => (index % 9) + 1), recent28Days: 335, previous28Days: 280, changePercent: 19.6, direction: "up" },
  }), { motion: "none" });
  assert.equal(bars(flooded), 30, "the momentum strip must stay bounded");
  assertSafeSvg(flooded);
  assertWellFormedXml(flooded);
  assertFiniteGeometry(flooded);
  // An empty bucket array still renders the four breakdown bars and nothing else.
  assert.equal(bars(renderAtlasCard(atlasFixture({
    trend: { buckets: [], recent28Days: 0, previous28Days: null, changePercent: null, direction: "unavailable" },
  }), { motion: "none" })), 4);
});

test("the density ramp is one hue, ordered, and never borrows a mix colour", () => {
  // The defect this redesign exists to fix: levels 2-4 were `accent`, `positive` and `warning`,
  // the same three colours the contribution mix printed one panel to the right, so a square's
  // colour named a category it did not mean. Underneath that, hue carries no order at all.
  const channel = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const luminance = (hex) => {
    const v = Number.parseInt(hex.slice(1), 16);
    return 0.2126 * channel((v >> 16) & 255) + 0.7152 * channel((v >> 8) & 255) + 0.0722 * channel(v & 255);
  };

  for (const [name, theme] of Object.entries(themes)) {
    assert.equal(theme.density.length, 4, `${name} ramp must have four steps`);

    // Monotonic, in whichever direction the ground demands: brighter on dark, darker on light.
    const steps = [theme.socket, ...theme.density].map(luminance);
    const direction = steps.at(-1) > steps[0] ? 1 : -1;
    assert.equal(
      direction === 1 ? theme.scheme === "dark" : theme.scheme === "light",
      true,
      `${name}: a ${theme.scheme} card must read "more" as ${theme.scheme === "dark" ? "brighter" : "darker"}`,
    );
    for (let i = 1; i < steps.length; i += 1) {
      assert.ok((steps[i] - steps[i - 1]) * direction > 0, `${name} ramp reverses at step ${i}`);
      const ratio = Math.max(steps[i], steps[i - 1]) / Math.max(Math.min(steps[i], steps[i - 1]), 0.0008);
      // The separation floor is what makes the scale survive greyscale and colour blindness.
      assert.ok(ratio >= 1.25, `${name} step ${i} separates by only ${ratio.toFixed(2)}x`);
    }

    // And no step may collide with the ink the mix is drawn in, or with a status colour.
    for (const step of theme.density) {
      assert.notEqual(step, theme.mixInk, `${name}: a density step is the mix ink`);
      assert.notEqual(step, theme.positive, `${name}: a density step is the passing colour`);
      assert.notEqual(step, theme.warning, `${name}: a density step is the warning colour`);
      assert.notEqual(step, theme.negative, `${name}: a density step is the failing colour`);
    }
    assert.notEqual(theme.socket, theme.density[0], `${name}: the empty socket is the faintest active step`);
  }
});

test("every theme declares a partner in the opposite colour scheme", () => {
  // What makes the <picture> pair possible. A theme whose partner shares its scheme would serve
  // the same card to both readers and quietly reintroduce the defect.
  for (const [name, theme] of Object.entries(themes)) {
    const partner = themes[theme.pair];
    assert.ok(partner, `${name} names an unknown partner: ${theme.pair}`);
    assert.notEqual(partner.scheme, theme.scheme, `${name} and ${theme.pair} are both ${theme.scheme}`);
  }
});

test("the mix is one ink, so it cannot compete with the density grid", () => {
  const breakdown = renderContributionBreakdownCard({
    breakdown: { commits: 80, issues: 20, pullRequests: 40, reviews: 60 },
    basis: "exact-counts",
    window: { from: "2026-01-01", to: "2026-12-31", days: 365 },
  }, { theme: "ember", width: 640 });

  // Four filled bars, every one of them the same colour.
  // `x` is a computed float, not an integer — the first version of this pattern required
  // \d+ and matched nothing, which reported a defect that was not there.
  const fills = [...breakdown.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="8" fill="(#[0-9a-f]{6})"\/>/g)]
    .map((match) => match[1])
    .filter((fill) => fill !== themes.ember.track);
  assert.ok(fills.length >= 4, `expected four filled mix bars, saw ${fills.length}`);
  assert.equal(new Set(fills).size, 1, `the mix uses ${new Set(fills).size} inks; it must use one`);
  assert.equal(fills[0], themes.ember.mixInk);
});

test("a non-finite contribution level renders as the empty socket, never the strongest step", () => {
  // The same inversion the web surface had: indexing a ramp with NaN must not fall through to
  // the maximum. An unreadable signal shown as the busiest day is the one thing this forbids.
  const withBadLevels = renderActivityCard({
    days: [
      { date: "2026-01-01", count: 0 },
      { date: "2026-01-02", count: 5 },
      { date: "2026-01-03", count: Number.NaN },
    ],
    periodLabel: "ACTIVITY",
  }, { theme: "ember" });
  assertSafeSvg(withBadLevels);
  assert.doesNotMatch(withBadLevels, /fill="undefined"|fill="NaN"/);
  assert.match(withBadLevels, new RegExp(`fill="${themes.ember.socket}"`));
});

test("cadence card computes Monday-first weekday shares and names the busiest day", () => {
  // 2026-02-23 is a Monday, 2026-02-25 a Wednesday, 2026-03-01 a Sunday.
  const output = renderCadenceCard({
    days: [
      { date: "2026-02-23", count: 2 },
      { date: "2026-02-25", count: 6 },
      { date: "2026-03-01", count: 2 },
      { date: "not-a-date", count: 50 },
      { date: "2026-02-24", count: Number.NaN },
      { date: "2026-02-26", count: -3 },
    ],
  });
  assertSafeSvg(output);
  assert.match(output, /Wednesday carries 60%/);
  for (const label of ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]) assert.match(output, new RegExp(`>${label}<`));
  assert.match(output, />60%</);
  assert.match(output, /SHARE OF 10 CONTRIBUTIONS · UTC DAY BOUNDARIES · WINDOW-SCOPED/);
  // Exactly one bar carries the accent ink: the busiest weekday.
  const accents = output.match(new RegExp(`<rect[^>]*rx="3" fill="${themes.aurora.accent}"`, "g")) ?? [];
  assert.equal(accents.length, 1);
});

test("cadence footer stays inside the panel at the supported 420px width", () => {
  const output = renderCadenceCard({ days: [{ date: "2026-02-25", count: 10 }] }, { width: 420 });
  assertSafeSvg(output);
  assert.match(output, /SHARE OF 10 CONTRIBUTIONS · UTC · WINDOW-SCOPED/);
  assert.doesNotMatch(output, /UTC DAY BOUNDARIES/);
  const footer = output.match(/<text x="34" y="198"[^>]*font-size="9\.5"[^>]*letter-spacing="0\.76"[^>]*>([^<]+)<\/text>/);
  assert.ok(footer, "expected the compact cadence footer text");
  // The mono stack's conservative 0.6em advance plus letter spacing must remain inside
  // the panel's right edge (420 - 16); the old 62-character footer estimated beyond it.
  const characters = [...footer[1]];
  const estimatedRight = 34 + characters.length * 9.5 * 0.6 + Math.max(0, characters.length - 1) * 0.76;
  assert.ok(estimatedRight <= 404, `cadence footer extends past panel: ${estimatedRight}`);
});

test("cadence card accents every tied busiest day and names the tie", () => {
  const output = renderCadenceCard({
    days: [
      { date: "2026-02-23", count: 2 },
      { date: "2026-02-25", count: 2 },
      { date: "2026-02-27", count: 1 },
    ],
  });
  assertSafeSvg(output);
  assert.match(output, /Busiest days: Monday, Wednesday carry 40%/);
  assert.match(output, /Busiest days: Monday, Wednesday at 40%/);
  const accents = output.match(new RegExp(`<rect[^>]*rx="3" fill="${themes.aurora.accent}"`, "g")) ?? [];
  assert.equal(accents.length, 2);
});

test("cadence card bounds compact tie labels while keeping the full accessible tie", () => {
  const fourWay = renderCadenceCard({
    days: [
      { date: "2026-02-23", count: 1 },
      { date: "2026-02-24", count: 1 },
      { date: "2026-02-25", count: 1 },
      { date: "2026-02-26", count: 1 },
    ],
  }, { width: 420 });
  assertSafeSvg(fourWay);
  assert.match(fourWay, /Busiest: 4-way tie · 25%/);
  assert.match(fourWay, /<desc>[^<]*Busiest days: Monday, Tuesday, Wednesday, Thursday at 25%/);
  assert.equal((fourWay.match(new RegExp(`<rect[^>]*rx="3" fill="${themes.aurora.accent}"`, "g")) ?? []).length, 4);

  const sevenWay = renderCadenceCard({
    days: Array.from({ length: 7 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 1, 23 + index)).toISOString().slice(0, 10), count: 1,
    })),
  }, { width: 420 });
  assertSafeSvg(sevenWay);
  assert.match(sevenWay, /Busiest: 7-way tie · 14\.3%/);
  assert.match(sevenWay, /<desc>[^<]*Busiest days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday at 14\.3%/);
  assert.equal((sevenWay.match(new RegExp(`<rect[^>]*rx="3" fill="${themes.aurora.accent}"`, "g")) ?? []).length, 7);
});

test("cadence card states an empty window honestly and survives hostile and huge input", () => {
  const empty = renderCadenceCard({ days: [] });
  assertSafeSvg(empty);
  assert.match(empty, /No contributions observed in this window/);
  assert.doesNotMatch(empty, />MON</);
  const zero = renderCadenceCard({ days: [{ date: "2026-02-25", count: 0 }] });
  assert.match(zero, /No contributions observed in this window/);
  const fullYear = Array.from({ length: 400 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 7, 1 + index)).toISOString().slice(0, 10);
    return { date, count: (index * 37) % 90 };
  });
  const large = renderCadenceCard({ days: fullYear }, { theme: "paper", motion: "subtle" });
  assertSafeSvg(large, { allowStyle: true });
  assertWellFormedXml(large);
  const bytes = Buffer.byteLength(large, "utf8");
  assert.ok(bytes < 30_000, `cadence SVG exceeded budget (${bytes} UTF-8 bytes)`);
});

test("cadence card normalizes overflowing finite totals without false zero ties", () => {
  const output = renderCadenceCard({
    days: [
      { date: "2026-02-23", count: Number.MAX_VALUE },
      { date: "2026-02-24", count: Number.MAX_VALUE },
      { date: "2026-02-25", count: 0 },
    ],
  }, { width: 420 });
  assertSafeSvg(output);
  assertWellFormedXml(output);
  assertFiniteGeometry(output);
  assert.doesNotMatch(output, /NaN|Infinity/);
  assert.match(output, /NORMALIZED FINITE COUNTS/);
  assert.match(output, /Finite contribution counts were normalized to avoid total overflow/);
  assert.match(output, /Busiest: 2-way tie · 50%/);
  assert.equal((output.match(new RegExp(`<rect[^>]*rx="3" fill="${themes.aurora.accent}"`, "g")) ?? []).length, 2);
});

test("releases card sorts newest first, caps at six, drops malformed entries, and states absence", () => {
  const output = renderReleasesCard({
    releases: [
      { project: "Older", tag: "v0.1.0", publishedAt: "2026-01-05T09:00:00Z" },
      { project: "Newest", tag: "v0.0.1", publishedAt: "2026-01-01T09:00:00Z" },
      { project: "Newest", tag: "v2.0.0", publishedAt: "2026-08-01T09:00:00Z" },
      { project: "Middle", tag: "v1.0.0", publishedAt: "2026-04-20T09:00:00.123Z" },
      { project: "", tag: "v9.9.9", publishedAt: "2026-08-02T09:00:00Z" },
      { project: "BadDate", tag: "v9.9.9", publishedAt: "yesterday" },
      { project: "BadDay", tag: "v9.9.9", publishedAt: "2026-02-30T09:00:00Z" },
      { project: "BadClock", tag: "v9.9.9", publishedAt: "2026-02-28T99:00:00Z" },
    ],
    projectsObserved: 6,
  });
  assertSafeSvg(output);
  const dates = output.match(/>\d{4}-\d{2}-\d{2}</g) ?? [];
  assert.deepEqual(dates, [">2026-08-01<", ">2026-04-20<", ">2026-01-05<"]);
  assert.match(output, />Newest</);
  assert.doesNotMatch(output, /BadDate|BadDay|BadClock|v9\.9\.9|v0\.0\.1/);
  assert.match(output, /3 OF 6 OBSERVED PROJECTS HAVE NO PUBLISHED RELEASE/);
  const capped = renderReleasesCard({
    releases: Array.from({ length: 9 }, (_, index) => ({
      project: `Project ${index}`, tag: `v0.${index}.0`, publishedAt: `2026-03-0${index + 1}T09:00:00Z`,
    })),
    projectsObserved: 9,
  });
  assert.equal((capped.match(/>\d{4}-\d{2}-\d{2}</g) ?? []).length, 6);
  // A release cut by the display cap still exists: the card says "shown", never "no release".
  assert.match(capped, />6 of 9 shown</);
  assert.doesNotMatch(capped, /NO PUBLISHED RELEASE/);
  // A caller-supplied height can never clip rows: the minimum scales with the rows drawn.
  const squeezed = renderReleasesCard({
    releases: Array.from({ length: 6 }, (_, index) => ({
      project: `Project ${index}`, tag: `v0.${index}.0`, publishedAt: `2026-03-0${index + 1}T09:00:00Z`,
    })),
  }, { height: 150, width: 420 });
  assert.match(squeezed, /viewBox="0 0 420 326"/);
  assertSafeSvg(squeezed);
  // Fractional seconds order chronologically, not lexically: ".5Z" is later than the same second.
  const fractional = renderReleasesCard({
    releases: [
      { project: "Whole", tag: "v1.0.0", publishedAt: "2026-05-01T00:00:00Z" },
      { project: "Fraction", tag: "v1.0.1", publishedAt: "2026-05-01T00:00:00.500Z" },
    ],
  });
  assert.ok(fractional.indexOf(">Fraction<") < fractional.indexOf(">Whole<"));
  const empty = renderReleasesCard({ releases: [], projectsObserved: 4 });
  assertSafeSvg(empty);
  assert.match(empty, /No published releases observed for the curated projects/);
  assert.match(empty, /4 OF 4 OBSERVED PROJECTS HAVE NO PUBLISHED RELEASE/);
  assert.match(empty, /<desc>[^<]*No published releases were observed for 4 observed curated projects\./i);
  const unavailable = renderReleasesCard({ releases: [], projectsObserved: 0, projectsUnavailable: 4 });
  assertSafeSvg(unavailable);
  assert.match(unavailable, /Release evidence unavailable/);
  assert.match(unavailable, /4 of 4 curated projects were not observed/);
  assert.match(unavailable, /4 OF 4 RELEASE LOOKUPS UNAVAILABLE/);
  assert.doesNotMatch(unavailable, /No published releases observed for the curated projects/);
  assert.match(unavailable, /<desc>[^<]*unavailable for all 4 curated projects\./i);
  const mixedEmpty = renderReleasesCard({ releases: [], projectsObserved: 3, projectsUnavailable: 1 });
  assertSafeSvg(mixedEmpty);
  assert.match(mixedEmpty, /No published releases in observed projects/);
  assert.match(mixedEmpty, /1 of 4 release lookups unavailable/);
  assert.match(mixedEmpty, /3 OF 3 OBSERVED PROJECTS HAVE NO PUBLISHED RELEASE · 1 OF 4 RELEASE LOOKUPS UNAVAILABLE/);
  const hostile = renderReleasesCard({
    releases: [{ project: injection, tag: injection, publishedAt: "2026-08-01T09:00:00Z" }],
  });
  assertSafeSvg(hostile);
  assertWellFormedXml(hostile);
  assertWellFormedXml(renderCadenceCard({ days: [{ date: "2026-02-25", count: 3 }] }, { title: injection, description: injection }));
});

test("releases card deduplicates a large adversarial list within its output/time budget", () => {
  const releases = Array.from({ length: 20_000 }, (_, index) => ({
    project: `Project ${index}`,
    tag: `v${index}.0.0`,
    // Equal timestamps force the dedup pass to inspect every distinct project rather than
    // allowing an accidental early match to hide a quadratic scan.
    publishedAt: "2026-08-01T09:00:00Z",
  }));
  const started = performance.now();
  const output = renderReleasesCard({ releases, projectsObserved: releases.length }, { width: 420 });
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 2_000, `large release list exceeded render budget (${elapsed.toFixed(1)}ms)`);
  assertSafeSvg(output);
  assertWellFormedXml(output);
  assert.equal((output.match(/>2026-08-01</g) ?? []).length, 6);
  assert.match(output, />6 of 20000 shown</);
});
