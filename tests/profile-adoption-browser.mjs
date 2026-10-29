/** Scoped #144 evidence for the real public profile. This is not the #113 transport matrix. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createFreshOutputDirectory, decodePng, pixelDifference, motionPixelThreshold, sha256 } from "./motion-probes/capture.mjs";

const REPOSITORY = "Chris0Jeky/Chris0Jeky";
const PAGE = "https://github.com/Chris0Jeky";
const API = `https://api.github.com/repos/${REPOSITORY}`;
const TARGET_FILE = new URL("./fixtures/profile-adoption-target.json", import.meta.url);
const BROWSERS = { chromium: "143.0.7499.4", firefox: "144.0.2" };
const VIEWPORT = { width: 1280, height: 1200 };
const FRAME_TIMES = [0, 2000, 6000];
const MAXIMUM_LATE_MS = 1000;
const TARGETS = [
  { name: "beacon", normal: "scene-identity-beacon.svg", still: "scene-identity-beacon.still.svg" },
  { name: "atlas", normal: "atlas.svg", still: "atlas-still.svg" },
  { name: "coverage", normal: "scene-evidence-coverage.svg", still: "scene-evidence-coverage.still.svg" },
  { name: "terrain", normal: "scene-activity-terrain.svg", still: "scene-activity-terrain.still.svg" },
];
const SAFE_HEADERS = new Set(["content-type", "content-length", "cache-control", "etag", "last-modified", "age", "vary", "location", "x-cache"]);
const fullHash = (value) => typeof value === "string" && value.length === 64 && /^[a-f0-9]+$/.test(value);
const commitHash = (value) => typeof value === "string" && value.length === 40 && /^[a-f0-9]+$/.test(value);

export function validateTarget(value) {
  assert.ok(value && !Array.isArray(value) && typeof value === "object", "target must be an object");
  assert.deepEqual(Object.keys(value).sort(), ["profileCommit", "refreshRunId", "version"], "unknown or missing target field");
  assert.equal(value.version, 1, "unsupported target version");
  assert.ok(commitHash(value.profileCommit), "target profile commit must be a reviewed full SHA; placeholders cannot run");
  assert.ok(typeof value.refreshRunId === "string" && /^[1-9][0-9]{0,19}$/.test(value.refreshRunId), "target refresh run must be an exact positive decimal string");
  return { version: 1, profileCommit: value.profileCommit, refreshRunId: value.refreshRunId };
}

export function validateManifestPair(primary, light) {
  const artifacts = new Map();
  for (const [index, manifest] of [primary, light].entries()) {
    assert.ok(manifest && manifest.version === 1 && manifest.generator === "CommitAtlas" &&
      manifest.user === "Chris0Jeky" && manifest.source === "github-public-profile", "unexpected manifest identity");
    assert.ok(typeof manifest.generatedAt === "string" && Number.isFinite(Date.parse(manifest.generatedAt)) &&
      new Date(manifest.generatedAt).toISOString() === manifest.generatedAt, "invalid snapshot timestamp");
    const window = manifest.window;
    assert.ok(window && Number.isSafeInteger(window.days) && window.days >= 1 && window.days <= 731, "invalid snapshot window");
    for (const day of [window.from, window.to]) assert.ok(typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
      Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day, "invalid snapshot date");
    assert.equal((Date.parse(window.to) - Date.parse(window.from)) / 86400000 + 1, window.days, "inconsistent snapshot window");
    assert.equal(window.to, manifest.generatedAt.slice(0, 10), "snapshot day differs from its generation time");
    assert.ok(Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0 && manifest.artifacts.length <= 96, "invalid manifest artifact count");
    const seen = new Set();
    for (const item of manifest.artifacts) {
      assert.ok(item && typeof item.path === "string" && item.path.length <= 64 &&
        /^[a-z0-9][a-z0-9.-]*\.(?:svg|json|md)$/.test(item.path) && !item.path.includes(".."), "unsafe manifest artifact path");
      assert.ok(!seen.has(item.path), "duplicate manifest artifact path");
      seen.add(item.path);
      assert.ok(fullHash(item.sha256), "invalid manifest artifact hash");
      assert.ok(Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= 128 * 1024, "invalid manifest artifact bytes");
      const relative = `assets/commitatlas/${index ? "light/" : ""}${item.path}`;
      artifacts.set(relative, { ...item, path: relative });
    }
  }
  assert.equal(light.generatedAt, primary.generatedAt, "paired snapshot times differ");
  assert.deepEqual(light.window, primary.window, "paired snapshot windows differ");
  assert.deepEqual(light.artifacts.map(a => a.path).sort(), primary.artifacts.map(a => a.path).sort(), "paired snapshot inventories differ");
  return { generatedAt: primary.generatedAt, window: primary.window, artifacts };
}

export function validateAssetUrl(value, artifact, profileCommit, fingerprint = true) {
  let url;
  try { url = new URL(value); } catch { throw new Error("image source URL must be absolute HTTPS"); }
  assert.ok(url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash && url.href === value, "image source URL must be canonical HTTPS");
  const refs = ["main", "refs/heads/main", profileCommit];
  const paths = refs.map(ref => `/${REPOSITORY}/${url.hostname === "github.com" ? "raw/" : ""}${ref}/${artifact.path}`);
  assert.ok(["github.com", "raw.githubusercontent.com"].includes(url.hostname) && paths.includes(url.pathname), "image source URL names an unexpected owner or artifact");
  const expected = `?v=${artifact.sha256.slice(0, 16)}`;
  assert.ok(url.search === expected || !fingerprint && url.search === "", "image source fingerprint does not match its manifest artifact");
  return value;
}

function xmlText(value = "") {
  return value.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-f]+|[0-9]+);/gi, entity => {
    const named = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
    return named[entity.toLowerCase()] ?? String.fromCodePoint(entity[2].toLowerCase() === "x" ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1)));
  });
}

export function inspectSvg(bytes, artifact, reduced) {
  assert.equal(bytes.length, artifact.bytes, "received SVG bytes differ from the manifest");
  assert.equal(sha256(bytes), artifact.sha256, "received SVG hash differs from the manifest");
  const svg = bytes.toString("utf8");
  assert.ok(svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"), "expected an SVG document");
  const box = /<svg\b[^>]*\bviewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(svg);
  assert.ok(box && Number(box[1]) > 0 && Number(box[2]) > 0, "SVG has no bounded viewBox");
  assert.doesNotMatch(svg, /<script\b|<foreignObject\b|<image\b/i, "unexpected external SVG content");
  const hasMotion = /<(?:animate|animateTransform|animateMotion)\b|@keyframes\b/i.test(svg);
  if (reduced) assert.doesNotMatch(svg, /<(?:animate|animateTransform|animateMotion|set|style)\b|@keyframes\b/i, "still source contains motion or styles");
  const title = xmlText(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/.exec(svg)?.[1]);
  const description = xmlText(/<desc(?:\s[^>]*)?>([\s\S]*?)<\/desc>/.exec(svg)?.[1]);
  const unavailable = /\bunavailable\b/i.test(title);
  assert.ok(!unavailable || !hasMotion, "unavailable source must not emit motion");
  const visibleText = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(match => xmlText(match[1]));
  const signals = visibleText.filter(text => /\b(?:UNAVAILABLE|STALE|PARTIAL|UNVERIFIED|NOT OBSERVED|NOT CONFIGURED|NOT REQUESTED)\b/.test(text));
  const projectBodies = [...svg.matchAll(/<g\b[^>]*\bid="[^"]*-body([0-9]+)"/g)].map(match => match[1]).sort();
  return { width: Number(box[1]), height: Number(box[2]), title, description, visibleText, projectBodies, signals, unavailable, hasMotion };
}

/** Static fallback evidence is recordable, but it cannot complete this known profile adoption. */
export function validateAdoptionSource(name, source, media, snapshot) {
  assert.equal(source.unavailable, false, `${name} is unavailable; final profile adoption cannot be accepted`);
  assert.ok(TARGETS.some(target => target.name === name), "unknown profile target identity");
  const readings = new Set(source.visibleText.map(text => text.replace(/\s+/g, " ").trim()));
  const requireReadings = values => {
    for (const reading of values) assert.ok(readings.has(reading), `${name} is missing required reading: ${reading}`);
  };
  if (name === "beacon") {
    const visible = source.visibleText.join(" ").replace(/\s+/g, " ");
    assert.ok(visible.includes("Cristian (Chris) Tcaci"), "Beacon must display the expected named header");
    for (const project of ["Local Asset Studio", "NavSentinel", "Alibi"]) {
      assert.ok(visible.includes(project), `Beacon must display the expected ${project} signal`);
    }
    assert.deepEqual(source.projectBodies, ["0", "1", "2"], "Beacon requires three observed project bodies, not unmatched labels");
  } else {
    assert.ok(snapshot?.window && typeof snapshot.generatedAt === "string", `${name} readings require the pinned snapshot`);
    const { window, generatedAt } = snapshot;
    if (name === "atlas") {
      assert.match(source.title, /^(?:(?:Partial|Stale) snapshot: )?CommitAtlas developer atlas$/, "Atlas title must identify the expected renderer");
      requireReadings(["@Chris0Jeky", `OBSERVED HISTORY · ${window.days}D`, "01 // CONTRIBUTION CALENDAR", "CURRENT STREAK", "LONGEST IN HISTORY"]);
      assert.ok(source.description.includes(`Observed history ${window.from} to ${window.to}:`), "Atlas history window differs from the pinned snapshot");
      const displayFrom = new Date(Date.parse(window.to) - (Math.min(365, window.days) - 1) * 86400000).toISOString().slice(0, 10);
      assert.ok(source.description.includes(`Displayed calendar ${displayFrom} to ${window.to},`), "Atlas displayed window differs from the annual reading");
      assert.ok([...readings].some(text => text.startsWith(`Generated ${generatedAt} ·`)), "Atlas generation reading differs from the pinned snapshot");
    } else if (name === "coverage") {
      assert.equal(source.title, "Evidence coverage", "Coverage title must identify the expected renderer");
      requireReadings(["SCOPE / 07", "PUBLIC PROFILE VIEW", "ACTIVITY MIX", "CI", "RELEASES", "LINE CHANGES", "PRIVATE ACTIVITY", "SNAPSHOT"]);
      assert.ok(readings.has("PUBLIC SNAPSHOT") || readings.has("STALE SNAPSHOT"), "Coverage must identify its public snapshot reading");
      assert.ok(source.description.includes("Bar length records coverage, not performance"), "Coverage must retain its reading definition");
      const calendar = [...readings].map(text => /^(\d+) OF (\d+) DAYS OBSERVED$/.exec(text)).find(Boolean);
      assert.ok(calendar && Number(calendar[2]) === window.days && Number(calendar[1]) <= window.days,
        "Coverage calendar reading differs from the pinned snapshot window");
    } else {
      assert.equal(source.title, "Activity terrain", "Terrain title must identify the expected renderer");
      requireReadings(["TERRAIN / 01", "PUBLIC SNAPSHOT", "TOTAL", "PEAK WEEK", "QUIET RUN", "CURRENT STREAK",
        `UTC ${window.from} TO ${window.to}`, `CAPTURED ${generatedAt}`, "SOURCE GITHUB-PROFILE-HTML / OBSERVED CALENDAR",
        "ACTIVITY COUNTS ARE NOT A QUALITY OR IMPACT SCORE"]);
      assert.ok(source.description.includes(`UTC window ${window.from} to ${window.to}.`), "Terrain window differs from the pinned snapshot");
      assert.ok(source.description.includes(`Source github-profile-html; captured ${generatedAt}.`), "Terrain source/capture reading differs from the pinned snapshot");
    }
  }
  if (media === "ambient" && ["beacon", "atlas", "coverage"].includes(name)) {
    assert.equal(source.hasMotion, true, `${name} must emit supported ambient motion for this adoption`);
  }
}

export function validateImageState(state, { artifact, profileCommit, source, viewport, expectedWidth, previous }) {
  assert.ok(state.sameNode && state.connected, "capture target must remain the same DOM image");
  assert.ok(state.visible, "capture target must be visible");
  const selected = new URL(state.currentSrc);
  if (selected.hostname === "camo.githubusercontent.com") {
    assert.ok(selected.protocol === "https:" && !selected.username && !selected.password && !selected.hash, "unsafe proxy source URL");
    assert.ok(state.canonical, "proxy source must retain canonical source metadata");
    validateAssetUrl(state.canonical, artifact, profileCommit);
  } else validateAssetUrl(state.currentSrc, artifact, profileCommit);
  assert.ok([state.naturalWidth, state.naturalHeight, state.width, state.height].every(n => Number.isFinite(n) && n > 0), "image must decode positive geometry");
  const article = state.article;
  assert.ok(article && [article.x, article.width, article.paddingLeft, article.paddingRight, article.borderLeft, article.borderRight, article.contentWidth]
    .every(Number.isFinite), "image must be inside a measured README article");
  assert.ok([article.paddingLeft, article.paddingRight, article.borderLeft, article.borderRight].every(n => n >= 0) &&
    article.x >= 0 && article.width > 0 && article.x + article.width <= viewport.width && article.contentWidth > 0,
  "README article must have bounded positive content width");
  assert.ok(Math.abs(article.contentWidth - (article.width - article.paddingLeft - article.paddingRight - article.borderLeft - article.borderRight)) < 0.01,
    "README article content width must exclude observed padding and borders");
  const ratio = source.width / source.height;
  assert.ok(Number.isSafeInteger(expectedWidth) && expectedWidth > 0 && expectedWidth <= viewport.width, "pinned README needs a valid image width");
  assert.ok(Math.abs(state.width - Math.min(expectedWidth, article.contentWidth)) <= 1, "rendered image width differs from the responsive README width");
  assert.ok(Math.abs(state.width - state.height * ratio) <= 1, "rendered image aspect differs from the source");
  const contentLeft = article.x + article.paddingLeft + article.borderLeft;
  assert.ok(state.x >= contentLeft - 1 && state.x + state.width <= contentLeft + article.contentWidth + 1,
    "image must remain inside the README article content");
  assert.ok([state.x, state.y].every(Number.isFinite) && state.x >= 0 && state.y >= 0 &&
    state.x + state.width <= viewport.width && state.y + state.height <= viewport.height, "image geometry must fit the profile viewport");
  assert.ok([state.scrollX, state.scrollY].every(n => Number.isFinite(n) && n >= 0), "image capture must record a valid scroll position");
  if (previous) {
    assert.equal(state.currentSrc, previous.currentSrc, "image source changed during capture");
    for (const field of ["x", "y", "width", "height"]) assert.ok(Math.abs(state[field] - previous[field]) < 0.01, "image geometry moved during capture");
    for (const field of ["scrollX", "scrollY"]) assert.ok(Math.abs(state[field] - previous[field]) < 0.01, "page scroll moved during capture");
    for (const field of ["x", "width", "paddingLeft", "paddingRight", "borderLeft", "borderRight", "contentWidth"]) {
      assert.ok(Math.abs(article[field] - previous.article[field]) < 0.01, "README article geometry moved during capture");
    }
  }
}

export function validateFrameTiming(frame, requestedMs) {
  assert.ok(frame.requestedMs === requestedMs && Number.isFinite(frame.beforeMs) && Number.isFinite(frame.afterMs) &&
    frame.beforeMs >= requestedMs && frame.afterMs >= frame.beforeMs, "invalid frame timing interval");
  assert.ok(frame.afterMs - requestedMs <= MAXIMUM_LATE_MS, "frame is too late for its observation interval");
}

export function evaluatePlayback(images, source, reduced) {
  assert.ok(images.length >= 2, "motion evidence requires at least two decoded frames");
  assert.ok(!reduced || !source.hasMotion, "reduced source must be a still artifact");
  const differences = images.slice(1).map((image, index) => pixelDifference(images[index], image));
  if (source.hasMotion) {
    assert.ok(differences.some(delta => delta.changedPixels >= motionPixelThreshold.changedPixels &&
      delta.totalChannelDelta >= motionPixelThreshold.totalChannelDelta), "source emits supported motion but no visible motion was measured");
    return { verdict: "visible-motion", differences };
  }
  assert.ok(differences.every(delta => delta.changedPixels === 0 && delta.totalChannelDelta === 0), "static/still source changed pixels");
  return { verdict: reduced ? "static-reduced-source" : "static-source", differences };
}

function canonicalTime(value, label) {
  assert.ok(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value), `${label} must be a canonical UTC timestamp`);
  const time = Date.parse(value), normalized = value.length === 20 ? value.slice(0, -1) + ".000Z" : value;
  assert.ok(Number.isFinite(time) && new Date(time).toISOString() === normalized, `${label} must be a real canonical UTC timestamp`);
  return time;
}

export function validateRefreshRun(target, run, comparison) {
  assert.ok(String(run.id) === target.refreshRunId && run.repository?.full_name === REPOSITORY &&
    run.status === "completed" && run.conclusion === "success" && run.path === ".github/workflows/commitatlas.yml" &&
    run.head_branch === "main" && commitHash(run.head_sha), "expected a successful main profile refresh run");
  const startedAt = canonicalTime(run.run_started_at, "refresh run_started_at"), updatedAt = canonicalTime(run.updated_at, "refresh updated_at");
  assert.ok(startedAt <= updatedAt, "refresh run timestamp interval is reversed");
  assert.equal(comparison.status, "ahead", "compare must contain the new refresh commit");
  for (const [field, value] of Object.entries({ ahead_by: 1, behind_by: 0, total_commits: 1 })) {
    assert.equal(comparison[field], value, `compare ${field} must describe exactly one direct refresh commit`);
  }
  assert.equal(comparison.merge_base_commit?.sha, run.head_sha, "compare merge base must equal the refresh head");
  assert.ok(Array.isArray(comparison.commits) && comparison.commits.length === 1, "compare must expose exactly one target commit");
  const commit = comparison.commits[0];
  assert.equal(commit.sha, target.profileCommit, "compare commit must equal the reviewed profile target");
  assert.ok(Array.isArray(commit.parents), "compare target commit must expose its parents");
  assert.deepEqual(commit.parents.map(parent => parent?.sha), [run.head_sha], "target commit must have exactly the refresh head as its parent");
  return { relationship: "one-direct-refresh-commit", targetCommit: commit.sha, targetParent: run.head_sha,
    aheadBy: comparison.ahead_by, behindBy: comparison.behind_by, totalCommits: comparison.total_commits,
    runStartedAt: run.run_started_at, updatedAt: run.updated_at };
}

export function validateSnapshotRefresh(generatedAt, refresh) {
  const timestamp = canonicalTime(generatedAt, "snapshot generatedAt");
  assert.ok(timestamp >= canonicalTime(refresh.runStartedAt, "refresh run_started_at") &&
    timestamp <= canonicalTime(refresh.updatedAt, "refresh updated_at"), "snapshot must have been generated within the exact successful refresh interval");
  return { generatedAt, runStartedAt: refresh.runStartedAt, runUpdatedAt: refresh.updatedAt };
}

export function validateProfileHead(ref, target) {
  assert.equal(ref.object?.sha, target.profileCommit, "live profile main commit drifted from the reviewed target");
}

async function remoteBytes(url, maximum) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "CommitAtlas-profile-adoption-evidence" }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `public evidence request failed: ${url}`);
  const reader = response.body.getReader(), parts = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      assert.ok(length <= maximum, "public evidence response exceeded its byte bound");
      parts.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(parts);
}
const remoteJson = async (url, maximum = 1024 * 1024) => JSON.parse((await remoteBytes(url, maximum)).toString("utf8"));

function attribute(tag, name) {
  const match = new RegExp(`(?:\\s|^)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match ? xmlText(match[1] ?? match[2]) : null;
}

async function pinnedSources(target, outputDirectory) {
  const raw = `https://raw.githubusercontent.com/${REPOSITORY}/${target.profileCommit}/`;
  const files = ["README.md", "assets/commitatlas/manifest.json", "assets/commitatlas/light/manifest.json"];
  const bytes = await Promise.all(files.map(file => remoteBytes(raw + file, file === "README.md" ? 1000000 : 64 * 1024)));
  const paired = validateManifestPair(JSON.parse(bytes[1]), JSON.parse(bytes[2]));
  const readme = bytes[0].toString("utf8");
  await mkdir(path.join(outputDirectory, "sources"));
  const sourceFiles = [];
  for (const [index, file] of files.entries()) {
    const saved = `sources/${index === 0 ? "README.md" : index === 1 ? "manifest.json" : "light-manifest.json"}`;
    await writeFile(path.join(outputDirectory, saved), bytes[index]);
    sourceFiles.push({ originalPath: file, file: saved, sha256: sha256(bytes[index]), bytes: bytes[index].length });
  }
  const targets = TARGETS.map(spec => {
    const matching = [...readme.matchAll(/<img\b[^>]*>/gi)].filter(match => attribute(match[0], "src")?.split("?")[0] === `./assets/commitatlas/${spec.normal}`);
    assert.equal(matching.length, 1, `pinned README must contain one ${spec.name} image`);
    const alt = attribute(matching[0][0], "alt");
    assert.ok(alt && alt.length <= 1000, "pinned profile image needs a bounded alt");
    const width = attribute(matching[0][0], "width");
    assert.ok(typeof width === "string" && /^[1-9][0-9]{0,3}$/.test(width), "pinned profile image needs an explicit pixel width");
    const expectedWidth = Number(width);
    assert.ok(expectedWidth <= VIEWPORT.width, "pinned profile image exceeds the desktop viewport");
    const versions = {};
    for (const media of ["ambient", "reduce"]) {
      const artifactPath = `assets/commitatlas/${media === "reduce" ? spec.still : spec.normal}`;
      const artifact = paired.artifacts.get(artifactPath);
      assert.ok(artifact, `missing selected manifest artifact: ${artifactPath}`);
      assert.ok(readme.includes(`./${artifactPath}?v=${artifact.sha256.slice(0, 16)}`), `pinned README lacks the selected fingerprint: ${artifactPath}`);
      versions[media] = artifact;
    }
    return { ...spec, alt, expectedWidth, versions };
  });
  const sources = new Map();
  await Promise.all(targets.flatMap(spec => Object.entries(spec.versions).map(async ([media, artifact]) => {
    const body = await remoteBytes(raw + artifact.path, 128 * 1024);
    const source = inspectSvg(body, artifact, media === "reduce");
    const file = `sources/${path.basename(artifact.path)}`;
    await writeFile(path.join(outputDirectory, file), body);
    sources.set(artifact.path, { artifact, source, file });
  })));
  return { targets, sources, sourceFiles, generatedAt: paired.generatedAt, window: paired.window };
}

function readImageState(image, { token, anchor } = {}) {
  const box = image.getBoundingClientRect(), style = getComputedStyle(image);
  const enclosingArticle = image.closest("article.markdown-body");
  let article = null;
  if (enclosingArticle) {
    const box = enclosingArticle.getBoundingClientRect(), style = getComputedStyle(enclosingArticle);
    const paddingLeft = parseFloat(style.paddingLeft), paddingRight = parseFloat(style.paddingRight);
    const borderLeft = parseFloat(style.borderLeftWidth), borderRight = parseFloat(style.borderRightWidth);
    article = { x: box.x, width: box.width, paddingLeft, paddingRight, borderLeft, borderRight,
      contentWidth: box.width - paddingLeft - paddingRight - borderLeft - borderRight };
  }
  const selectedSource = [...(image.closest("picture")?.querySelectorAll("source") ?? [])]
    .find(source => !source.media || matchMedia(source.media).matches);
  return { sameNode: image.__commitAtlasProfileTarget === token, connected: image.isConnected,
    visible: style.visibility === "visible" && style.display !== "none" && image.getClientRects().length > 0,
    currentSrc: image.currentSrc, canonical: selectedSource?.getAttribute("data-canonical-srcset") ?? selectedSource?.getAttribute("data-canonical-src") ?? image.getAttribute("data-canonical-src"),
    sources: [...(image.closest("picture")?.querySelectorAll("source") ?? [])].map(source => ({ media: source.media, srcset: source.srcset, matches: !source.media || matchMedia(source.media).matches })),
    naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
    x: box.x, y: box.y, width: box.width, height: box.height,
    article, scrollX: window.scrollX, scrollY: window.scrollY,
    observedMs: anchor === undefined ? null : performance.now() - anchor };
}

async function locateTarget(page, spec) {
  const locator = page.getByAltText(spec.alt, { exact: true });
  await locator.waitFor({ state: "attached", timeout: 20000 });
  assert.equal(await locator.count(), 1, "profile image must have a unique DOM identity");
  const details = page.locator("details").filter({ has: locator });
  if (await details.count()) {
    assert.equal(await details.count(), 1, "profile target has ambiguous details ancestors");
    if (await details.getAttribute("open") === null) await details.locator("summary").first().click();
  }
  await locator.evaluate(image => image.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
  await page.waitForFunction(alt => {
    const matches = [...document.images].filter(image => image.alt === alt);
    return matches.length === 1 && matches[0].isConnected && matches[0].getBoundingClientRect().width > 0 && getComputedStyle(matches[0]).visibility === "visible";
  }, spec.alt, { timeout: 20000 });
  return locator;
}

function verifyPage(page) {
  const url = new URL(page.url());
  assert.ok(url.origin === "https://github.com" && ["/Chris0Jeky", "/Chris0Jeky/"].includes(url.pathname) && !url.search && !url.hash,
    "navigation must remain on the actual public profile");
}

export async function observeSelectedResponse(responses, currentSrc, artifact, profileCommit, reduced, chain) {
  assert.ok(Array.isArray(chain) && chain.length === 0, "response receipt requires a fresh attached chain");
  let response = responses.get(currentSrc);
  assert.ok(response, "selected image response was not observed by this browser context");
  const seen = new Set();
  while (response) {
    assert.ok(!seen.has(response.url()), "image redirect chain repeated a URL");
    seen.add(response.url());
    const record = { url: response.url(), status: response.status(), headers: [] };
    chain.push(record);
    record.headers = (await response.headersArray()).filter(header => SAFE_HEADERS.has(header.name.toLowerCase()));
    const finished = await response.finished();
    if (finished) record.failure = finished.message ?? String(finished);
    assert.equal(finished, null, "selected image response did not finish");
    const next = response.request().redirectedTo();
    if (next) {
      assert.ok(response.status() >= 300 && response.status() < 400, "invalid image redirect status");
      response = responses.get(next.url());
      assert.ok(response, "missing image redirect response");
      continue;
    }
    assert.equal(response.status(), 200, "final selected image response must be successful");
    assert.match(response.headers()["content-type"] ?? "", /^image\/svg\+xml(?:;|$)/i, "final response is not SVG");
    const body = await response.body();
    Object.assign(record, { bytes: body.length, sha256: sha256(body) });
    if (new URL(response.url()).hostname !== "camo.githubusercontent.com") validateAssetUrl(response.url(), artifact, profileCommit, false);
    inspectSvg(body, artifact, reduced);
    record.verified = true;
    break;
  }
  return chain;
}

const contextOptions = media => ({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: "dark",
  reducedMotion: media === "reduce" ? "reduce" : "no-preference", serviceWorkers: "block" });

async function captureRow(browser, spec, media, pinned, target, directory, row) {
  const expected = pinned.sources.get(spec.versions[media].path);
  const checks = { artifact: expected.artifact, profileCommit: target.profileCommit, source: expected.source, viewport: VIEWPORT, expectedWidth: spec.expectedWidth };
  row.source = { ...expected, snapshotGeneratedAt: pinned.generatedAt, expectedDisplayWidth: spec.expectedWidth };
  // Discovery identifies the browser-selected URL. The timed context below holds that exact
  // network request, then continues it unchanged after the actual profile DOM image is ready.
  const discovery = await browser.newContext(contextOptions(media));
  let selected;
  try {
    const page = await discovery.newPage();
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    verifyPage(page);
    const locator = await locateTarget(page, spec);
    await locator.evaluate(async image => { image.__commitAtlasProfileTarget = "discovery"; await image.decode(); });
    await locator.evaluate(image => image.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
    selected = await locator.evaluate(readImageState, { token: "discovery" });
    validateImageState(selected, checks);
    row.discovery = selected;
  } finally { await discovery.close(); }

  const context = await browser.newContext(contextOptions(media));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let intercepted;
  const firstInterception = new Promise(resolve => { intercepted = resolve; });
  let interceptions = 0;
  try {
    await context.route(url => url.href === selected.currentSrc, async route => {
      interceptions += 1;
      intercepted();
      await gate;
      await route.continue();
    });
    const page = await context.newPage(), responses = new Map();
    page.on("response", response => { if (response.request().resourceType() === "image") responses.set(response.url(), response); });
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    verifyPage(page);
    const locator = await locateTarget(page, spec);
    let timer;
    try {
      await Promise.race([firstInterception, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("selected image request gate timed out")), 20000);
      })]);
    } finally { clearTimeout(timer); }
    const token = `${spec.name}:${media}`;
    const wasComplete = await locator.evaluate((image, token) => {
      image.__commitAtlasProfileTarget = token;
      if (image.complete) return true;
      image.__commitAtlasProfileLoad = new Promise(resolve => {
        image.addEventListener("load", () => resolve({ at: performance.now(), error: null }), { once: true });
        image.addEventListener("error", () => resolve({ at: performance.now(), error: "image failed to load" }), { once: true });
      });
      return false;
    }, token);
    assert.equal(wasComplete, false, "timed image must still be held by its exact request gate");
    assert.equal(interceptions, 1, "request gate must intercept one selected image");
    release();
    const loaded = await locator.evaluate(image => Promise.race([
      image.__commitAtlasProfileLoad,
      new Promise((_, reject) => setTimeout(() => reject(new Error("profile image load timed out")), 20000)),
    ]));
    assert.equal(loaded.error, null);
    await locator.evaluate(image => image.decode());
    await locator.evaluate(image => image.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
    const initial = await locator.evaluate(readImageState, { token, anchor: loaded.at });
    validateImageState(initial, checks);
    assert.equal(initial.currentSrc, selected.currentSrc, "timed image must retain its discovered source");
    row.initial = initial;
    const images = [];
    for (const requestedMs of FRAME_TIMES) {
      await page.waitForFunction(({ at, ms }) => performance.now() - at >= ms, { at: loaded.at, ms: requestedMs }, { timeout: 10000 });
      const frame = { requestedMs, file: `${row.name}/${requestedMs}.png` };
      row.frames.push(frame);
      frame.before = await locator.evaluate(readImageState, { token, anchor: loaded.at });
      validateImageState(frame.before, { ...checks, previous: initial });
      frame.beforeMs = frame.before.observedMs;
      const { x, y, width, height } = frame.before;
      // Keep screenshot completion separate from file I/O, and check node/source/geometry again.
      // Playwright 1.57 interprets non-full-page clips in viewport CSS pixels;
      // both browser drivers add their observed scroll offset internally.
      const bytes = await page.screenshot({ clip: { x, y, width, height }, fullPage: false, animations: "allow" });
      frame.after = await locator.evaluate(readImageState, { token, anchor: loaded.at });
      frame.afterMs = frame.after.observedMs;
      await writeFile(path.join(directory, `${requestedMs}.png`), bytes);
      frame.sha256 = sha256(bytes);
      frame.bytes = bytes.length;
      validateImageState(frame.after, { ...checks, previous: initial });
      validateFrameTiming(frame, requestedMs);
      const decoded = decodePng(bytes);
      Object.assign(frame, { pngWidth: decoded.width, pngHeight: decoded.height });
      images.push(decoded);
    }
    row.responseChain = [];
    await observeSelectedResponse(responses, selected.currentSrc, expected.artifact, target.profileCommit, media === "reduce", row.responseChain);
    Object.assign(row, evaluatePlayback(images, expected.source, media === "reduce"));
    row.final = await locator.evaluate(readImageState, { token, anchor: loaded.at });
    validateImageState(row.final, { ...checks, previous: initial });
    assert.equal(interceptions, 1, "timed source was unexpectedly requested again");
    row.requestGate = { url: selected.currentSrc, interceptions, behavior: "continue original request without changing URL or response bytes" };
    const overview = await page.screenshot({ fullPage: true, animations: "allow" });
    await writeFile(path.join(directory, "profile.png"), overview);
    row.profileScreenshot = { file: `${row.name}/profile.png`, sha256: sha256(overview), bytes: overview.length };
    row.accepted = true;
  } finally {
    release();
    await context.close();
  }
}

export async function captureProfileAdoption() {
  const output = process.env.PROFILE_ADOPTION_OUTPUT;
  assert.ok(output && path.isAbsolute(output), "PROFILE_ADOPTION_OUTPUT must be a fresh absolute directory");
  await createFreshOutputDirectory(output);
  const report = { version: 1, kind: "github-profile-adoption", issue: 144,
    scope: "actual logged-out github.com/Chris0Jeky; dark desktop; Beacon, Atlas, Coverage, Terrain; ambient/reduce; not the #113 transport matrix",
    observedAt: new Date().toISOString(), page: PAGE, viewport: VIEWPORT, frameTimes: FRAME_TIMES, maximumLateMs: MAXIMUM_LATE_MS,
    timingBoundary: "load-relative browser observations bracket screenshot completion; not exact compositor timestamps or exact animation frame zero",
    screenshotCoordinates: "viewport CSS pixels with fullPage:false; Playwright 1.57 applies the recorded stable page scroll offset",
    freshnessBoundary: "source freshness is evaluated at generation time; printed partial/stale/unavailable evidence is retained, not promoted to current evidence at capture time",
    sourceFiles: {}, rows: [], complete: false, phase: "target" };
  let browser, failure;
  try {
    report.target = validateTarget(JSON.parse(await readFile(TARGET_FILE, "utf8")));
    report.sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    report.sourceWorkingTreeDirty = Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim());
    assert.equal(report.sourceWorkingTreeDirty, false, "evidence source must be a clean exact checkout");
    for (const file of ["tests/profile-adoption-browser.mjs", "tests/profile-adoption-browser.test.mjs", "tests/fixtures/profile-adoption-target.json",
      "tests/motion-probes/capture.mjs", ".github/workflows/profile-adoption-browser-evidence.yml", "package.json", "package-lock.json"]) {
      report.sourceFiles[file] = sha256(await readFile(file));
    }
    report.phase = "refresh-provenance";
    validateProfileHead(await remoteJson(`${API}/git/ref/heads/main`), report.target);
    const run = await remoteJson(`${API}/actions/runs/${report.target.refreshRunId}`);
    assert.ok(commitHash(run.head_sha), "refresh run has no valid head commit");
    const comparison = await remoteJson(`${API}/compare/${run.head_sha}...${report.target.profileCommit}`, 8 * 1024 * 1024);
    const refreshProof = validateRefreshRun(report.target, run, comparison);
    report.refresh = { id: run.id, url: run.html_url, head: run.head_sha, path: run.path, status: run.status,
      conclusion: run.conclusion, createdAt: run.created_at, ...refreshProof };
    report.phase = "immutable-sources";
    const pinned = await pinnedSources(report.target, output);
    report.pinnedSourceFiles = pinned.sourceFiles;
    report.snapshot = { generatedAt: pinned.generatedAt, window: pinned.window,
      ageAtCaptureMs: Date.parse(report.observedAt) - Date.parse(pinned.generatedAt) };
    report.snapshot.refreshInterval = validateSnapshotRefresh(pinned.generatedAt, refreshProof);
    assert.ok(report.snapshot.ageAtCaptureMs >= -60000, "snapshot generation is unexpectedly in the future");
    report.phase = "browser";
    const prefix = process.env.PLAYWRIGHT_PREFIX, engine = process.env.PROFILE_ADOPTION_ENGINE;
    assert.ok(prefix && path.isAbsolute(prefix) && Object.hasOwn(BROWSERS, engine), "explicit Playwright prefix and chromium/firefox engine are required");
    const require = createRequire(path.join(prefix, "package.json"));
    report.playwrightVersion = require("playwright/package.json").version;
    assert.equal(report.playwrightVersion, "1.57.0", "Playwright version must be pinned");
    const launcher = require("playwright")[engine];
    report.engine = engine;
    report.browserExecutable = launcher.executablePath();
    report.expectedBrowserVersion = BROWSERS[engine];
    browser = await launcher.launch({ headless: true, executablePath: report.browserExecutable });
    report.browserVersion = browser.version();
    assert.equal(report.browserVersion, report.expectedBrowserVersion, "browser version must match the explicit pin");
    for (const media of ["ambient", "reduce"]) for (const spec of pinned.targets) {
      report.phase = `capture:${spec.name}:${media}`;
      const row = { name: `${spec.name}-${media}`, target: spec.name, media, alt: spec.alt, frames: [], accepted: false };
      report.rows.push(row);
      const directory = path.join(output, row.name);
      await mkdir(directory);
      await captureRow(browser, spec, media, pinned, report.target, directory, row);
      await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
    }
    report.phase = "final-head-check";
    validateProfileHead(await remoteJson(`${API}/git/ref/heads/main`), report.target);
    assert.equal(report.rows.length, 8);
    assert.ok(report.rows.every(row => row.accepted && row.frames.length === FRAME_TIMES.length));
    report.phase = "adoption-acceptance";
    for (const row of report.rows) validateAdoptionSource(row.target, row.source.source, row.media, report.snapshot);
    report.phase = "complete";
    report.complete = true;
  } catch (error) {
    failure = error;
    report.failure = error.message;
  } finally {
    try { await browser?.close(); } catch (error) {
      failure ??= error;
      report.complete = false;
      report.cleanupFailure = error.message;
    }
    report.finishedAt = new Date().toISOString();
    await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  }
  if (failure) throw failure;
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv[2] === "--check-target") {
      const target = validateTarget(JSON.parse(await readFile(process.argv[3] ?? fileURLToPath(TARGET_FILE), "utf8")));
      console.log(JSON.stringify(target));
    } else {
      assert.equal(process.argv.length, 2, "unexpected harness arguments");
      const report = await captureProfileAdoption();
      console.log(JSON.stringify({ complete: report.complete, engine: report.engine, browser: report.browserVersion, rows: report.rows.length }));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
