import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { calculateContributionMetrics } from "@commit-atlas/core";
import {
  codeSpan,
  generateStaticFromSnapshot,
  loadStaticConfig,
  parseStaticConfig,
  renderProjectCatalogArtifacts,
  renderStaticArtifacts,
  resolveContainedPath,
} from "../dist/index.js";

const generatedAt = "2026-08-20T12:00:00.000Z";
/** A legal git ref name that `boundedText` trims away to nothing, unlike an ASCII space. */
const NON_BREAKING_SPACE = "\u00a0";

test("validates one contained config and rejects ambiguous projects or card selections", () => {
  const parsed = config();
  assert.equal(parsed.user, "octocat");
  assert.equal(parsed.cards.length, 8);
  assert.equal(parsed.responsiveAtlas, false);
  assert.equal(parsed.projects[0].repo, "octocat/atlas");
  assert.throws(() => parseStaticConfig({ ...rawConfig(), unknown: true }), /unrecognized_keys/i);
  assert.throws(() => parseStaticConfig({ ...rawConfig(), outputDir: "../outside" }), /contained relative path/);
  assert.throws(() => parseStaticConfig({ ...rawConfig(), cards: ["atlas", "atlas"] }), /duplicates/);
  assert.throws(() => parseStaticConfig({ ...rawConfig(), cards: ["profile"], responsiveAtlas: true }), /requires atlas/);
  assert.throws(() => parseStaticConfig({
    ...rawConfig(),
    projects: [{ ...rawConfig().projects[0], repo: "another/atlas" }],
  }), /owned by the configured user/);
});

test("renders wide and compact Atlas variants from one snapshot", () => {
  const rendered = renderStaticArtifacts(snapshot(), parseStaticConfig({
    ...rawConfig(),
    cards: ["atlas"],
    responsiveAtlas: true,
  }));
  assert.deepEqual(Object.keys(rendered).sort(), ["atlas-compact.svg", "atlas.svg"]);
  assert.match(rendered["atlas.svg"], /viewBox="0 0 860 380"/);
  assert.match(rendered["atlas-compact.svg"], /viewBox="0 0 480 570"/);
  const wideDescription = rendered["atlas.svg"].match(/<desc>(.*?)<\/desc>/s)?.[1];
  const compactDescription = rendered["atlas-compact.svg"].match(/<desc>(.*?)<\/desc>/s)?.[1];
  assert.equal(compactDescription, wideDescription);
});

test("loads only a tracked, non-symlinked repository config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-config-"));
  try {
    await promisify(execFile)("git", ["init"], { cwd: root, windowsHide: true });
    await writeFile(path.join(root, ".commitatlas.json"), `${JSON.stringify(rawConfig(), null, 2)}\n`);
    await assert.rejects(loadStaticConfig(root), /tracked/);
    await promisify(execFile)("git", ["add", ".commitatlas.json"], { cwd: root, windowsHide: true });
    const loaded = await loadStaticConfig(root);
    assert.equal(loaded.config.user, "octocat");
    await assert.rejects(resolveContainedPath(root, "..\\escape", { mustExist: false, label: "output" }), /inside/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("renders all rich widgets deterministically from one snapshot", () => {
  const first = renderStaticArtifacts(snapshot(), config());
  const second = renderStaticArtifacts(snapshot(), config());
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), [
    "activity.svg", "atlas.svg", "breakdown.svg", "languages.svg", "profile.svg", "projects.svg", "rhythm.svg", "streak.svg",
  ]);
  assert.match(first["atlas.svg"], /PUBLIC PROFILE VIEW/);
  assert.match(first["atlas.svg"], /PUBLIC PROFILE MIX · NOT WINDOW-SCOPED/);
  assert.match(first["atlas.svg"], /CONTRIBUTION DENSITY/);
  assert.match(first["atlas.svg"], /RHYTHM/);
  assert.match(first["breakdown.svg"], /PUBLIC PROFILE %/);
  assert.match(first["breakdown.svg"], /Annual profile-view percentages · exact window counts unavailable/);
  assert.match(first["breakdown.svg"], /not scoped to the requested contribution-calendar window/);
  assert.match(first["rhythm.svg"], /PERSONAL CONSISTENCY/);
  assert.match(first["rhythm.svg"], /not a GitHub rank/);
  for (const svg of Object.values(first)) {
    assert.match(svg, /^<svg/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|<image\b/i);
    assert.doesNotMatch(svg, /SYNTHETIC DEMO|Synthetic demo:|Synthetic demonstration data/);
  }
});

test("propagates synthetic source truth to every standalone static card", () => {
  const base = snapshot();
  const demoFreshness = { generatedAt, source: "synthetic-demo", mode: "demo" };
  const rendered = renderStaticArtifacts({
    ...base,
    profile: { ...base.profile, freshness: demoFreshness },
    contributions: { ...base.contributions, freshness: demoFreshness },
    projects: { ...base.projects, freshness: demoFreshness },
    freshness: demoFreshness,
  }, config());
  for (const name of ["profile.svg", "streak.svg", "activity.svg", "breakdown.svg", "rhythm.svg", "languages.svg", "projects.svg"]) {
    const svg = rendered[name];
    assert.match(svg, />SYNTHETIC DEMO<\/text>/, name);
    assert.match(svg, /<title>Synthetic demo:/, name);
    assert.match(svg, /<desc>Synthetic demonstration data, not live GitHub data\./, name);
  }
});

test("preserves the declared planned lifecycle in static project SVGs", () => {
  const base = snapshot();
  const rendered = renderStaticArtifacts({
    ...base,
    projects: {
      ...base.projects,
      projects: base.projects.projects.map((project) => ({ ...project, lifecycle: "planned" })),
    },
  }, config());
  assert.match(rendered["projects.svg"], /Planned · CI Passing/);
  assert.doesNotMatch(rendered["projects.svg"], /Experimental/);
});

test("renders a truthful deterministic catalog from observed and explicitly configured links", () => {
  const catalogConfig = parseStaticConfig({
    ...rawConfig(),
    projects: [{
      ...rawConfig().projects[0],
      links: {
        docs: "https://docs.github.com/en/repositories",
        install: "https://www.npmjs.com/package/atlas",
        download: "https://github.com/octocat/atlas/releases",
      },
    }],
  });
  const richSnapshot = {
    ...snapshot(),
    projects: {
      ...snapshot().projects,
      projects: [{
        ...snapshot().projects.projects[0],
        websiteUrl: "https://atlas.example.com",
        ci: { ...snapshot().projects.projects[0].ci, url: "https://github.com/octocat/atlas/actions/runs/42" },
        release: {
          tag: "v1.2.3",
          name: "Atlas 1.2.3",
          url: "https://github.com/octocat/atlas/releases/tag/v1.2.3",
          publishedAt: generatedAt,
          download: { name: "atlas.zip", url: "https://github.com/octocat/atlas/releases/download/v1.2.3/atlas.zip" },
        },
      }],
    },
  };
  const first = renderProjectCatalogArtifacts(richSnapshot, catalogConfig);
  const second = renderProjectCatalogArtifacts(richSnapshot, catalogConfig);
  assert.deepEqual(first, second);
  const parsed = JSON.parse(first["projects.json"]);
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.projects[0].actions.map((action) => [action.kind, action.origin]), [
    ["source", "snapshot"], ["website", "snapshot"], ["ci", "snapshot"], ["release", "snapshot"],
    ["release-download", "snapshot"], ["docs", "config"], ["install", "config"], ["download", "config"],
  ]);
  assert.match(first["projects.md"], /\[Docs\]\(https:\/\/docs.github.com\/en\/repositories\)/);
  assert.match(first["projects.md"], /2 open issues\/PRs/);
  assert.doesNotMatch(first["projects.md"], /#readme|\/docs\/|releases\/latest/);
});

test("fails closed for unsafe observed URLs and control-bearing labels while escaping Markdown text", () => {
  const base = snapshot();
  assert.throws(() => renderProjectCatalogArtifacts({
    ...base,
    projects: { ...base.projects, projects: [{ ...base.projects.projects[0], sourceUrl: "https://user:pass@github.com/octocat/atlas" }] },
  }, config()), /safe HTTPS URL/);
  const escapedConfig = parseStaticConfig({
    ...rawConfig(),
    projects: [{ ...rawConfig().projects[0], label: "Atlas [stable]" }],
  });
  assert.match(renderProjectCatalogArtifacts(base, escapedConfig)["projects.md"], /## Atlas \\\[stable\\\]/);
  const controlConfig = parseStaticConfig({
    ...rawConfig(),
    projects: [{ ...rawConfig().projects[0], label: "Atlas\nstable" }],
  });
  assert.throws(() => renderProjectCatalogArtifacts(base, controlConfig), /invalid or overlong text/);
});

test("writes selected SVGs and a hash manifest while preserving unrelated siblings", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-output-"));
  try {
    const selected = parseStaticConfig({
      ...rawConfig(),
      cards: ["atlas", "projects"],
      responsiveAtlas: true,
    });
    const output = path.join(root, "assets", "commitatlas");
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "keep.txt"), "belongs to caller\n");
    const first = await generateStaticFromSnapshot({ root, config: selected, snapshot: snapshot() });
    const second = await generateStaticFromSnapshot({ root, config: selected, snapshot: snapshot() });
    assert.equal(first.written, true);
    assert.deepEqual(first.manifest, second.manifest);
    assert.deepEqual((await readdir(output)).sort(), [
      "atlas-compact.svg", "atlas.svg", "keep.txt", "manifest.json", "projects.json", "projects.md", "projects.svg",
    ]);
    assert.equal(await readFile(path.join(output, "keep.txt"), "utf8"), "belongs to caller\n");
    const manifest = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
    assert.equal(manifest.artifacts.length, 5);
    assert.ok(manifest.artifacts.every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256)));
    for (const artifact of manifest.artifacts) {
      const body = await readFile(path.join(output, artifact.path));
      assert.equal(body.byteLength, artifact.bytes);
      assert.equal(createHash("sha256").update(body).digest("hex"), artifact.sha256);
    }

    const switched = parseStaticConfig({
      ...rawConfig(),
      cards: ["atlas"],
      layout: "compact",
      responsiveAtlas: true,
    });
    await generateStaticFromSnapshot({ root, config: switched, snapshot: snapshot() });
    assert.deepEqual((await readdir(output)).sort(), ["atlas-wide.svg", "atlas.svg", "keep.txt", "manifest.json"]);

    const narrowed = parseStaticConfig({ ...rawConfig(), cards: ["atlas"], layout: "compact" });
    await generateStaticFromSnapshot({ root, config: narrowed, snapshot: snapshot() });
    assert.deepEqual((await readdir(output)).sort(), ["atlas.svg", "keep.txt", "manifest.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("wraps untrusted release tags and workflow names in delimiter-safe code spans", () => {
  const hostileTags = [
    "v1.0-`code`",
    "v2 ``` x ` y",
    "`leading",
    "trailing`",
    "``",
    "a` [pwned](https://evil.example) `b",
    "v3 | piped",
  ];
  for (const tag of hostileTags) {
    const md = renderProjectCatalogArtifacts(withRelease(tag), config())["projects.md"];
    const line = markdownLine(md, "- **Release:**");
    assert.deepEqual(scanCodeSpans(line).map((span) => span.content), [tag], `tag ${JSON.stringify(tag)}`);
    assert.doesNotMatch(outsideCodeSpans(line), /\]\(|`/, `tag ${JSON.stringify(tag)} escaped its code span`);
  }

  const hostileWorkflow = "ci`x`|`` evil.yml";
  const workflowConfig = parseStaticConfig({
    ...rawConfig(),
    projects: [{ ...rawConfig().projects[0], workflow: hostileWorkflow }],
  });
  const base = snapshot();
  const md = renderProjectCatalogArtifacts({
    ...base,
    projects: {
      ...base.projects,
      projects: [{ ...base.projects.projects[0], ci: { ...base.projects.projects[0].ci, workflow: hostileWorkflow } }],
    },
  }, workflowConfig)["projects.md"];
  const ciLine = markdownLine(md, "- **CI:**");
  assert.deepEqual(scanCodeSpans(ciLine).map((span) => span.content), [hostileWorkflow]);
  assert.doesNotMatch(outsideCodeSpans(ciLine), /`/);

  assert.equal(codeSpan("plain"), "`plain`");
  assert.equal(codeSpan("has ` one"), "``has ` one``");
  assert.equal(codeSpan("`edge`"), "`` `edge` ``");
  assert.throws(() => codeSpan(""), /empty value as a Markdown code span/);

  // The spec's "entirely spaces" exemption is U+0020 only. trim() also strips tab and NBSP, which
  // would skip the padding here and lose a space at each end when the reader applies the rule.
  assert.equal(codeSpan(" \t "), "`  \t  `");
  assert.deepEqual(scanCodeSpans(codeSpan(" \t ")).map((span) => span.content), [" \t "]);
  assert.equal(codeSpan(" "), "` `");
  assert.equal(codeSpan(NON_BREAKING_SPACE), "`\u00a0`");
  assert.equal(codeSpan("   "), "`   `");

  // A tag of nothing but non-ASCII whitespace trims to empty: drop the parenthetical, do not throw.
  const blank = renderProjectCatalogArtifacts(withRelease(NON_BREAKING_SPACE), config())["projects.md"];
  assert.equal(markdownLine(blank, "- **Release:**"), "- **Release:** Atlas release");
  assert.equal(JSON.parse(renderProjectCatalogArtifacts(withRelease(NON_BREAKING_SPACE), config())["projects.json"]).projects[0].release.tag, "");
});

test("emits no Markdown table rows, so a pipe can never break a cell", () => {
  const hostile = withRelease("v4 | x");
  const md = renderProjectCatalogArtifacts({
    ...hostile,
    projects: {
      ...hostile.projects,
      projects: [{ ...hostile.projects.projects[0], description: "Ships | fast | always" }],
    },
  }, config())["projects.md"];
  for (const line of md.split("\n")) {
    assert.doesNotMatch(line, /^\s*\|/, `table row emitted: ${line}`);
    assert.doesNotMatch(line, /^\s{0,3}\|?[\s:-]*-{3,}[\s:|-]*$/, `table delimiter row emitted: ${line}`);
    assert.doesNotMatch(outsideCodeSpans(line).replaceAll("\\|", ""), /\|/, `unescaped pipe outside a code span: ${line}`);
  }
  assert.match(md, /Ships \\\| fast \\\| always/);
});

test("names every non-GitHub destination without dropping legitimate project websites", () => {
  const linked = parseStaticConfig({
    ...rawConfig(),
    projects: [{
      ...rawConfig().projects[0],
      links: {
        docs: "https://docs.github.com/en/repositories",
        install: "https://www.npmjs.com/package/atlas",
      },
    }],
  });
  const base = snapshot();
  const rendered = renderProjectCatalogArtifacts({
    ...base,
    projects: {
      ...base.projects,
      projects: [{
        ...base.projects.projects[0],
        websiteUrl: "https://atlas.example.com/docs",
        ci: { ...base.projects.projects[0].ci, url: "https://github.com/octocat/atlas/actions/runs/42" },
      }],
    },
  }, linked);
  const actions = JSON.parse(rendered["projects.json"]).projects[0].actions;
  assert.deepEqual(actions.map((action) => [action.kind, action.host, action.external]), [
    ["source", "github.com", false],
    ["website", "atlas.example.com", true],
    ["ci", "github.com", false],
    ["docs", "docs.github.com", false],
    ["install", "www.npmjs.com", true],
  ]);
  const md = rendered["projects.md"];
  assert.match(md, /- \[Website\]\(https:\/\/atlas\.example\.com\/docs\) — observed · external host `atlas\.example\.com`/);
  assert.match(md, /- \[Install\]\(https:\/\/www\.npmjs\.com\/package\/atlas\) — configured · external host `www\.npmjs\.com`/);
  assert.match(md, /- \[Source\]\(https:\/\/github\.com\/octocat\/atlas\) — observed\n/);
  assert.doesNotMatch(md, /- \[CI\][^\n]*external host/);

  // Configured links are restricted, not merely disclosed: a project's own domain never parses.
  assert.throws(() => parseStaticConfig({
    ...rawConfig(),
    projects: [{ ...rawConfig().projects[0], links: { docs: "https://atlas.example.com/docs" } }],
  }), /allowed host/);

  const lookalike = renderProjectCatalogArtifacts({
    ...base,
    projects: {
      ...base.projects,
      projects: [{ ...base.projects.projects[0], websiteUrl: "https://github.com.evil.example/octocat/atlas" }],
    },
  }, config());
  const website = JSON.parse(lookalike["projects.json"]).projects[0].actions.find((action) => action.kind === "website");
  assert.deepEqual([website.host, website.external], ["github.com.evil.example", true]);
  assert.match(lookalike["projects.md"], /external host `github\.com\.evil\.example`/);

  // The rule is about the hostname, not who authored what it serves. A Pages hostname is chosen by
  // its owner, so it is disclosed; a release asset on a fixed GitHub hostname is not, even though
  // the binary behind it is entirely owner-supplied.
  const pages = renderProjectCatalogArtifacts({
    ...base,
    projects: {
      ...base.projects,
      projects: [{
        ...base.projects.projects[0],
        websiteUrl: "https://octocat.github.io/atlas",
        release: {
          tag: "v1",
          name: "Atlas 1",
          url: "https://github.com/octocat/atlas/releases/tag/v1",
          publishedAt: generatedAt,
          download: { name: "atlas.zip", url: "https://objects.githubusercontent.com/octocat/atlas.zip" },
        },
      }],
    },
  }, config());
  const classified = JSON.parse(pages["projects.json"]).projects[0].actions
    .map((action) => [action.kind, action.host, action.external]);
  assert.deepEqual(classified, [
    ["source", "github.com", false],
    ["website", "octocat.github.io", true],
    ["release", "github.com", false],
    ["release-download", "objects.githubusercontent.com", false],
    ["docs", "github.com", false],
  ]);
  assert.match(pages["projects.md"], /- \[Website\][^\n]*external host `octocat\.github\.io`/);
  assert.doesNotMatch(pages["projects.md"], /- \[Release download\][^\n]*external host/);
});

test("never removes a projects catalog file CommitAtlas did not write", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-owned-"));
  try {
    const output = path.join(root, "assets", "commitatlas");
    await mkdir(output, { recursive: true });
    const preExistingJson = '{"mine":true}\n';
    const preExistingMarkdown = "# my own project notes\n";
    await writeFile(path.join(output, "projects.json"), preExistingJson);
    await writeFile(path.join(output, "projects.md"), preExistingMarkdown);

    const withoutCatalog = parseStaticConfig({ ...rawConfig(), cards: ["atlas"] });
    await generateStaticFromSnapshot({ root, config: withoutCatalog, snapshot: snapshot() });
    assert.deepEqual((await readdir(output)).sort(), ["atlas.svg", "manifest.json", "projects.json", "projects.md"]);
    assert.equal(await readFile(path.join(output, "projects.json"), "utf8"), preExistingJson);
    assert.equal(await readFile(path.join(output, "projects.md"), "utf8"), preExistingMarkdown);

    const withCatalog = parseStaticConfig({ ...rawConfig(), cards: ["atlas", "projects"] });
    await generateStaticFromSnapshot({ root, config: withCatalog, snapshot: snapshot() });
    assert.notEqual(await readFile(path.join(output, "projects.json"), "utf8"), preExistingJson);
    await generateStaticFromSnapshot({ root, config: withoutCatalog, snapshot: snapshot() });
    assert.deepEqual((await readdir(output)).sort(), ["atlas.svg", "manifest.json"]);

    await writeFile(path.join(output, "projects.md"), preExistingMarkdown);
    await writeFile(path.join(output, "manifest.json"), "not json at all\n");
    await generateStaticFromSnapshot({ root, config: withoutCatalog, snapshot: snapshot() });
    assert.equal(await readFile(path.join(output, "projects.md"), "utf8"), preExistingMarkdown);

    await generateStaticFromSnapshot({ root, config: withCatalog, snapshot: snapshot() });
    await writeFile(path.join(output, "manifest.json"), `${JSON.stringify({
      version: 1,
      generator: "SomethingElse",
      artifacts: [{ path: "projects.md" }],
    })}\n`);
    await generateStaticFromSnapshot({ root, config: withoutCatalog, snapshot: snapshot() });
    assert.ok((await readdir(output)).includes("projects.md"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps the ownership record recoverable when cleanup is interrupted", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commitatlas-resume-"));
  try {
    const output = path.join(root, "assets", "commitatlas");
    await mkdir(output, { recursive: true });
    const withCatalog = parseStaticConfig({ ...rawConfig(), cards: ["atlas", "projects"] });
    const withoutCatalog = parseStaticConfig({ ...rawConfig(), cards: ["atlas"] });
    await generateStaticFromSnapshot({ root, config: withCatalog, snapshot: snapshot() });
    const ownedManifest = await readFile(path.join(output, "manifest.json"), "utf8");

    // Interrupt cleanup for real: a non-recursive rm over a directory throws, so the run aborts
    // partway through stale collection. The manifest must still be the one that records ownership.
    await rm(path.join(output, "projects.md"), { force: true });
    await mkdir(path.join(output, "projects.md"));
    await writeFile(path.join(output, "projects.md", "blocker.txt"), "makes rm throw\n");
    await assert.rejects(generateStaticFromSnapshot({ root, config: withoutCatalog, snapshot: snapshot() }));
    assert.equal(await readFile(path.join(output, "manifest.json"), "utf8"), ownedManifest);

    // A crash anywhere in that window leaves the same state, so the next good run finishes the job.
    await rm(path.join(output, "projects.md"), { recursive: true, force: true });
    await writeFile(path.join(output, "projects.md"), "stale catalog CommitAtlas wrote\n");
    await generateStaticFromSnapshot({ root, config: withoutCatalog, snapshot: snapshot() });
    assert.deepEqual((await readdir(output)).sort(), ["atlas.svg", "manifest.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function withRelease(tag) {
  const base = snapshot();
  return {
    ...base,
    projects: {
      ...base.projects,
      projects: [{
        ...base.projects.projects[0],
        release: {
          tag,
          name: "Atlas release",
          url: "https://github.com/octocat/atlas/releases/tag/latest",
          publishedAt: generatedAt,
          download: null,
        },
      }],
    },
  };
}

function markdownLine(markdown, prefix) {
  const line = markdown.split("\n").find((candidate) => candidate.startsWith(prefix));
  assert.ok(line, `no line starting with ${prefix}`);
  return line;
}

/**
 * Independent CommonMark 0.31 §6.1 code-span scanner, written from the spec rather than from the
 * renderer: an opening backtick run is closed by the next run of exactly the same length, and a
 * single U+0020 is stripped from each end when the content begins and ends with one without
 * consisting entirely of them. An opener with no matching closer is literal text.
 *
 * Limitation: this scans one raw line for backticks only. A real parser resolves link destinations
 * before code spans, so a backtick smuggled into a URL as `%60` looks line-destroying here while
 * rendering correctly in practice. That direction is a false positive, never a false negative, so
 * the scanner stays sound for what these tests assert.
 */
function scanCodeSpans(line) {
  const runs = [...line.matchAll(/`+/g)];
  const spans = [];
  let index = 0;
  while (index < runs.length) {
    const open = runs[index];
    let closing = index + 1;
    while (closing < runs.length && runs[closing][0].length !== open[0].length) closing += 1;
    if (closing >= runs.length) {
      index += 1;
      continue;
    }
    const close = runs[closing];
    let content = line.slice(open.index + open[0].length, close.index);
    if (content.startsWith(" ") && content.endsWith(" ") && !/^ *$/.test(content)) content = content.slice(1, -1);
    spans.push({ content, start: open.index, end: close.index + close[0].length });
    index = closing + 1;
  }
  return spans;
}

function outsideCodeSpans(line) {
  let remainder = "";
  let cursor = 0;
  for (const span of scanCodeSpans(line)) {
    remainder += line.slice(cursor, span.start);
    cursor = span.end;
  }
  return remainder + line.slice(cursor);
}

function rawConfig() {
  return {
    version: 1,
    user: "OctoCat",
    theme: "ember",
    days: 365,
    motion: "subtle",
    layout: "wide",
    outputDir: "assets/commitatlas",
    projects: [{
      repo: "OctoCat/atlas",
      label: "Atlas",
      lifecycle: "active",
      workflow: "ci.yml",
      links: { docs: "https://github.com/octocat/atlas#readme" },
    }],
  };
}

function config() {
  return parseStaticConfig(rawConfig());
}

function snapshot() {
  const days = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 7, 21 + index)).toISOString().slice(0, 10);
    const count = index % 5;
    return { date, count, level: count };
  });
  const contributions = {
    version: 1,
    login: "octocat",
    totalContributions: days.reduce((sum, day) => sum + day.count, 0),
    commits: 78,
    issues: 7,
    pullRequests: 12,
    reviews: 3,
    breakdownBasis: "public-profile-percentages",
    days,
    freshness: { generatedAt, source: "github-profile-html", mode: "live" },
  };
  const metrics = calculateContributionMetrics({ version: 1, days }, {
    asOf: days.at(-1).date,
    days: days.length,
    commits: contributions.commits,
    issues: contributions.issues,
    pullRequests: contributions.pullRequests,
    reviews: contributions.reviews,
    breakdownBasis: contributions.breakdownBasis,
  });
  return {
    version: 1,
    profile: {
      version: 1,
      login: "octocat",
      name: "The Octocat",
      profileUrl: "https://github.com/octocat",
      publicRepositories: 24,
      followers: 312,
      following: 48,
      stars: 487,
      forks: 96,
      primaryLanguages: [
        { name: "TypeScript", repositories: 9, share: 60 },
        { name: "Python", repositories: 6, share: 40 },
      ],
      latestPushAt: generatedAt,
      repositoriesTruncated: false,
      freshness: { generatedAt, source: "github-rest", mode: "live" },
    },
    contributions,
    metrics,
    projects: {
      version: 1,
      owner: "octocat",
      projects: [{
        repo: "octocat/atlas",
        name: "atlas",
        description: "Maps public GitHub signals.",
        sourceUrl: "https://github.com/octocat/atlas",
        websiteUrl: null,
        lifecycle: "active",
        primaryLanguage: "TypeScript",
        stars: 42,
        forks: 8,
        openIssues: 2,
        pushedAt: generatedAt,
        license: "GPL-3.0-only",
        ci: { state: "passing", label: "Passing", workflow: "ci.yml", url: null, checkedAt: generatedAt, headSha: null },
        release: null,
      }],
      freshness: { generatedAt, source: "github-rest", mode: "live" },
    },
    freshness: { generatedAt, source: "github-profile-html", mode: "live" },
  };
}
