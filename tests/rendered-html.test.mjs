import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The built worker falls back to process.env.GITHUB_TOKEN when a request env omits the binding.
// Keep these fixtures hermetic: a token exported in the developer shell must not switch the
// unauthenticated paths onto authenticated GitHub calls the mocked fetch rejects.
delete process.env.GITHUB_TOKEN;

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function request(path, extraEnv = {}, init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...extraEnv },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function htmlSecurityPolicy(response) {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  const policy = response.headers.get("content-security-policy");
  assert.ok(policy, "HTML must carry an enforced CSP, not just a report-only policy");
  return new Map(policy.split(";").filter((part) => part.trim()).map((part) => {
    const [directive, ...sources] = part.trim().split(/\s+/);
    return [directive, sources];
  }));
}

test("the built Worker hardens every HTML document, including its not-found page", async () => {
  for (const [path, status] of [["/", 200], ["/studio", 200], ["/gallery", 200], ["/missing-security-fixture", 404]]) {
    const response = await render(path);
    assert.equal(response.status, status, path);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const policy = htmlSecurityPolicy(response);
    for (const directive of ["base-uri", "object-src", "frame-src", "frame-ancestors", "worker-src", "script-src-attr"]) {
      assert.deepEqual(policy.get(directive), ["'none'"], `${path}: ${directive}`);
    }
    assert.deepEqual(policy.get("default-src"), ["'self'"]);
    assert.deepEqual(policy.get("form-action"), ["'self'"]);
    assert.deepEqual(policy.get("script-src"), ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(policy.get("style-src"), ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(policy.get("font-src"), ["'self'"]);
    assert.deepEqual(policy.get("img-src"), ["'self'", "data:", "blob:"]);
    assert.deepEqual(policy.get("connect-src"), ["'self'", "https://pulseboard-observatory.commit-atlas.workers.dev"]);
    await response.text();
  }
});

test("the HTML policy accommodates the production bootstrap and bundled resources", async () => {
  const response = await render();
  htmlSecurityPolicy(response);
  const html = await response.text();
  // Vinext's hydration payload and the two pre-paint bootstraps are inline.
  assert.match(html, /<script>[^<]+<\/script>/);
  assert.match(html, /<style\b/);
  for (const [, source] of html.matchAll(/<(?:script|img)\b[^>]*\bsrc="([^"]+)"/g)) {
    assert.ok(source.startsWith("/") || source.startsWith("data:") || source.startsWith("blob:"), source);
  }
  assert.doesNotMatch(html, /(?:src|href)="https:\/\/fonts\.(?:googleapis|gstatic)\.com\//);
  // The SDK's only cross-origin transport is deliberately allowlisted, not all HTTPS hosts.
  const sdk = await readFile(new URL("../public/pulseboard.js", import.meta.url), "utf8");
  const collector = /"collector":"([^"]+)"/.exec(sdk)?.[1];
  assert.equal(collector, "https://pulseboard-observatory.commit-atlas.workers.dev");
});

test("HTML hardening does not replace the API's stricter JSON and SVG policies", async () => {
  for (const path of ["/api/v1/health", "/api/v1/cards/atlas.svg?user=octocat&demo=true"]) {
    let response = await request(path);
    if (response.status === 308) {
      const canonical = new URL(response.headers.get("location"));
      response = await request(canonical.pathname + canonical.search);
    }
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const policy = response.headers.get("content-security-policy") ?? "";
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /script-src 'none'/);
    assert.match(policy, /(?:^|;\s*)sandbox(?:;|$)/);
    assert.doesNotMatch(policy, /pulseboard-observatory/);
    await response.text();
  }
});

test("HTML hardening leaves App Router navigation payloads unchanged", async () => {
  for (const path of ["/?_rsc", "/studio?_rsc", "/gallery?_rsc"]) {
    const response = await request(path, {}, { headers: { RSC: "1" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/x-component");
    assert.equal(response.headers.get("content-security-policy"), null);
    assert.equal(response.headers.get("x-frame-options"), null);
    assert.equal(response.headers.get("cache-control"), "no-store, must-revalidate");
    assert.match(response.headers.get("vary") ?? "", /(?:^|,\s*)RSC(?:,|$)/);
    assert.ok((await response.text()).length > 0);
  }
});

test("server-renders the CommitAtlas product surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>CommitAtlas/);
  assert.match(html, /Your GitHub work/);
  for (const family of [
    "/api/v1/cards/atlas.svg?",
    "/api/v1/cards/profile.svg?",
    "/api/v1/cards/streak.svg?",
    "/api/v1/cards/breakdown.svg?",
    "/api/v1/cards/rhythm.svg?",
    "/api/v1/cards/activity.svg?",
    "/api/v1/cards/languages.svg?",
    "/api/v1/projects.svg?",
  ]) assert.match(html, new RegExp(family.replace(/[.?]/g, "\\$&")));
  assert.match(html, /Synthetic demo/);
  assert.match(html, /No GitHub calls are made to render this page/);
  assert.match(html, /Available now/);
  assert.match(html, /The packages are not published to npm/);
  assert.match(html, /Explainer only/);
  assert.match(html, /not separate cards or monitoring services/);
  assert.match(html, /Exact categorized counts when available; otherwise clearly labelled public-profile percentages/);
  assert.match(html, /Transparent personal consistency based on density and streak — not a GitHub rank/);
  assert.match(html, /aria-label="Open SVG for the synthetic Contribution breakdown card"/);
  assert.match(html, /aria-label="Open SVG for the synthetic Personal rhythm card"/);
  assert.match(html, /Open SVG/);
  assert.match(html, /Open the Studio/);
  assert.match(html, /aria-label="Primary navigation"/);
  assert.match(html, /From evidence to embed/);
  assert.match(html, /hosted SVG URL/);
  assert.match(html, /static CLI or pinned Action/);
  assert.match(html, /byte\/SHA-256 manifest/);
  assert.match(html, /Cadence<\/em> and <em>Releases<\/em>, which are static-only/);
  assert.match(html, /design lab below is optional/);
  const normalized = html.replaceAll("<!-- -->", "");
  assert.match(normalized, /05 \/\/ Research bridge · C0 invented evidence/);
  assert.match(normalized, /75% \/ 75%/);
  assert.match(normalized, /2\.97 \/ 4\.2/);
  assert.match(normalized, /Both nonviable/);
  assert.match(normalized, /candidate is rejected because both selections are nonviable/);
  assert.match(normalized, /not GitHub profile evidence and not production monitoring/);
  assert.match(normalized, /real-repository validity/);
  assert.match(normalized, /person-level inference/);
  assert.match(normalized, /promote a model/);
  assert.match(normalized, /online PELT performance/);
  assert.match(normalized, /Open the public method trial/);
  assert.match(normalized, /no runtime fetch/);
  assert.doesNotMatch(html, /Updated 8m ago|\+18%/);
  assert.doesNotMatch(html, /northstar-api|signal-canvas|archive-kit|Illustrative 90-day activity|Portfolio status/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/);
  // developer-lens is the other station on the shared chassis and lives in another repository.
  // None of its vocabulary may leak onto this surface.
  assert.doesNotMatch(html, /Force Multiplier|effective repositories|Method Trial|orchestration-hypothesis/);
});

test("gives the research bridge readable body and result text", async () => {
  const css = await (await import("node:fs/promises")).readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.research-bridge-lede[^}]*font-size:\s*16px/);
  assert.match(css, /\.research-bridge-outcome p[^}]*font-size:\s*16px/);
  assert.match(css, /\.research-bridge-metrics span, \.research-bridge-metrics small[^}]*font-size:\s*14px/);

  const bridgeRules = [...css.matchAll(/\.research-bridge[^}]*}/g)].map(([rule]) => rule).join("\n");
  const definedProperties = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]));
  const externalProperties = new Set(["--font-geist-mono"]);
  const undefinedProperties = [...new Set([...bridgeRules.matchAll(/var\((--[a-z0-9-]+)/gi)].map((match) => match[1]))]
    .filter((property) => !definedProperties.has(property) && !externalProperties.has(property));
  assert.deepEqual(undefinedProperties, [], `research bridge references undefined CSS properties: ${undefinedProperties.join(", ")}`);
  assert.match(bridgeRules, /color-mix\(in srgb, var\(--cool-ink\) 48%, var\(--line\)\)/);
  assert.match(bridgeRules, /color:\s*var\(--warm-ink\)/);
});

test("prints every instrument reading as text, so the page is readable at frame zero", async () => {
  // The whole reduced-motion contract rests on this: if the number is only in the SVG, removing the
  // animation removes the information. Values are the deterministic synthetic octocat window, and
  // `lib/evidence.test.ts` pins them against the metrics pipeline that produces them.
  const html = await (await render()).text();
  for (const reading of [
    ">88<",          // 28-day momentum, M1
    ">72<",          // rhythm score, M2
    "77.8%",         // active-day density, M3
    "1.1k",          // contributions
    ">284<",         // active days
    "731",           // commits
    "\u22121.1%",     // momentum change, with a real minus sign
  ]) assert.ok(html.includes(reading), `the page never prints ${reading}`);

  // The fourth bay reports the portfolio honestly rather than reporting nothing.
  assert.match(html, /0\/2 CI PASSING · 0 ATTENTION · 2 UNCONFIGURED/);
  assert.match(html, /shown dark, never green/i);
});

test("renders the layered instrument motion without making animation the data source", async () => {
  const html = await (await render()).text();

  assert.match(html, /class="m1-ghost"/);
  assert.match(html, /class="m1-bloom"/);
  assert.match(html, /class="m1-dot m1-dot-halo"/);
  assert.match(html, /class="m2-charge"/);
  assert.equal((html.match(/class="m2-tick"/g) ?? []).length, 7);
  assert.match(html, /--column-delay:/);
  assert.match(html, /class="m3-scan"/);
  assert.match(html, /class="m3-scan" x="4" y="0" width="1" height="34"/);
  assert.match(html, /opacity="0" style="--density-travel:[^;]+;--density-steps:/);
});

test("keeps motion emphasis separate from the gauge and density encodings", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /@keyframes gaugeCharge\s*\{\s*from\s*\{\s*stroke-dasharray:\s*0 100;/);
  assert.match(css, /\.m3-scan\s*\{\s*animation:\s*densityScan 5\.6s steps\(var\(--density-steps\), end\)/);
  assert.doesNotMatch(css, /densityWave|\.m3-column[^}]*filter|filter:\s*brightness/);
});

test("teaches all six health states, with the unknowns leading", async () => {
  const html = await (await render()).text();
  for (const word of ["UNAVAILABLE", "UNCONFIGURED", "STALE", "PASSING", "FAILING", "PENDING"]) {
    assert.ok(html.includes(word), `the rack never names ${word}`);
  }
  // Order matters: the three "we do not know" bays come first, or they read as leftovers.
  const positions = ["UNAVAILABLE", "UNCONFIGURED", "STALE", "PASSING", "FAILING", "PENDING"]
    .map((word) => html.indexOf(`>${word}<`));
  assert.ok(positions.every((position) => position > -1), "a state word is missing from the rack");
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "the rack bays are out of order");
  // Every bay prints its explanation rather than hiding it in a tooltip.
  assert.match(html, /NOT ZERO — UNOBSERVED/);
  assert.match(html, /NO NAMED WORKFLOW TO WATCH/);
  assert.match(html, /ACQUIRING — THE ONLY STATE/);
});

test("every printed reading can answer how it is known", async () => {
  const html = await (await render()).text();
  // The evidence triggers are real buttons, not decorated spans.
  const triggers = html.match(/class="ev"/g) ?? [];
  assert.ok(triggers.length >= 10, `only ${triggers.length} readings are explainable`);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /how is .* known\?/);

  // The page states a count of explained readings. An earlier version printed the size of the whole
  // evidence set (17) while wiring 10 of them, and claimed "every number on this page is a button".
  //
  // Two assertions, because they fail for different reasons. The first is the invariant that cannot
  // drift: the count the page prints has to equal the number of readings it actually wires. The
  // second pins the identities, so removing a trigger is caught even if the count is updated to
  // match. The list is stated literally rather than imported from `LANDING_EVIDENCE_IDS` — this
  // suite runs under plain Node against the built Worker, and a test that re-derives its
  // expectation from the source it is testing proves only that the source equals itself.
  const wired = [...new Set([...html.matchAll(/data-ev="([^"]+)"/g)].map((match) => match[1]))];
  assert.ok(
    html.includes(`${wired.length} readings explained on this page`),
    `the page wires ${wired.length} readings but does not print that count`,
  );
  assert.deepEqual(wired.sort(), [
    "active-days",
    "average-per-day",
    "ci-passing",
    "contributions",
    "density",
    "mix",
    "momentum",
    "momentum-change",
    "rhythm",
    "rhythm-level",
  ], "keep this in step with LANDING_EVIDENCE_IDS in lib/landing.ts");
  // Deliberately loose. The exact-phrase version of this guard reported green while the page still
  // carried "Closed — every number is a button:" one line above the copy it was written to protect.
  assert.doesNotMatch(html, /every number (on this page )?is a button/i);
  // The three rungs, each shown with a real reading from this page's own snapshot.
  for (const rung of ["OBSERVED", "DERIVED", "HYPOTHESIS"]) {
    assert.ok(html.includes(rung), `the ladder never names ${rung}`);
  }
  assert.match(html, /rhythm-band-hypothesis/, "the rhythm band must be labelled a guess");
  assert.match(html, /contribution-total-observed/);
});

test("applies a stored chassis theme before first paint, from a bounded allowlist", async () => {
  const html = await (await render()).text();
  // Without this the page flashes the default ground on every navigation for anyone who chose
  // another theme, because the served HTML is cacheable and always carries the default.
  assert.match(html, /commitatlas:chassis-theme/);
  assert.match(html, /\["fieldline","observatory","midline","limestone"\]/);
  // The switch itself, and the default it renders on the server.
  assert.match(html, /name="chassis-theme"[^>]*checked=""[^>]*value="fieldline"/);
  for (const theme of ["observatory", "midline", "limestone"]) {
    assert.ok(html.includes(`value="${theme}"`), `the switch is missing ${theme}`);
  }
});

/**
 * True when a CSP would still run the inline landing-route bootstrap in `head`: its effective script
 * policy (`script-src`, else `default-src`, else none) allows it by 'unsafe-inline', by the script's
 * sha256 hash, or by a nonce the script carries. A bare `script-src 'self'` does not.
 */
function cspRunsRouteBootstrap(csp, head) {
  const directives = Object.fromEntries(csp.split(";").map((part) => part.trim().split(/\s+/))
    .filter(([name]) => name).map(([name, ...values]) => [name.toLowerCase(), values]));
  const sources = directives["script-src"] ?? directives["default-src"];
  if (!sources) return true;
  const tag = /<script([^>]*)>([^<]*data-pulseboard-route[^<]*)<\/script>/.exec(head);
  if (!tag) return false;
  const nonce = /\snonce="([^"]+)"/.exec(tag[1])?.[1];
  const hash = `'sha256-${createHash("sha256").update(tag[2]).digest("base64")}'`;
  return sources.includes("'unsafe-inline'") || sources.includes(hash) || Boolean(nonce && sources.includes(`'nonce-${nonce}'`));
}

test("recognizes CSP sources that admit the inline landing-route bootstrap", async () => {
  const html = await (await render("/studio")).text();
  const head = html.slice(0, html.indexOf("</head>"));
  const body = /<script[^>]*>([^<]*data-pulseboard-route[^<]*)<\/script>/.exec(head)?.[1] ?? "";
  const hash = `'sha256-${createHash("sha256").update(body).digest("base64")}'`;
  assert.equal(cspRunsRouteBootstrap("script-src 'self'; connect-src https://pulseboard-observatory.commit-atlas.workers.dev", head), false);
  assert.equal(cspRunsRouteBootstrap("default-src 'self'", head), false);
  assert.equal(cspRunsRouteBootstrap(`script-src 'self' ${hash}`, head), true);
  assert.equal(cspRunsRouteBootstrap("script-src 'self' 'unsafe-inline'", head), true);
  assert.equal(cspRunsRouteBootstrap("connect-src https://pulseboard-observatory.commit-atlas.workers.dev", head), true);
});

test("loads the Pulseboard SDK on every page the root layout renders, the 404 included", async () => {
  // `/` and `/studio` are the product pages; the framework's not-found page also renders the root
  // layout, so it loads the SDK and names its landing route `other`.
  for (const pathname of ["/", "/studio", "/no-such-page"]) {
    const response = await render(pathname);
    if (pathname === "/no-such-page") assert.equal(response.status, 404);
    const html = await response.text();
    assert.equal((html.match(/<script[^>]*src="\/pulseboard\.js"[^>]*>/g) ?? []).length, 1, `${pathname} loads the SDK once`);
    assert.match(html, /<script defer="" src="\/pulseboard\.js"><\/script>/, `${pathname} loads the SDK deferred`);
    assert.match(html, /<body[^>]*><div data-pulseboard-bar="" style="min-height:2\.5rem"><\/div>/, `${pathname} reserves the bar first in body`);
    assert.doesNotMatch(html, /observatory\.js/, `${pathname} still loads the retired observer`);
    const head = html.slice(0, html.indexOf("</head>"));
    assert.match(head, /setAttribute\("data-pulseboard-route",r\)/, `${pathname} names its landing route before the SDK`);
    // The HTML CSP must admit the collector, and its script policy must still
    // run the inline landing-route bootstrap (a nonce on that script, its
    // sha256 hash, or 'unsafe-inline'); a bare `script-src 'self'` would silently record `home` again.
    const csp = response.headers.get("content-security-policy");
    if (csp) {
      assert.match(csp, /connect-src[^;]*https:\/\/pulseboard-observatory\.commit-atlas\.workers\.dev/);
      assert.ok(cspRunsRouteBootstrap(csp, head), `${pathname} CSP script-src would block the inline route bootstrap`);
    }
  }
  for (const path of ["/api/v1/profile?user=octocat&demo=true"]) {
    const body = await (await request(path)).text();
    assert.doesNotMatch(body, /pulseboard/i, `${path} must never carry the SDK`);
  }
});

test("server-renders an honest interactive Studio shell", async () => {
  const response = await render("/studio");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Interactive Studio/);
  assert.match(html, /Synthetic starter data/);
  assert.match(html, /Data source/);
  assert.match(html, /Declare lifecycle yourself/);
  assert.match(html, /Open links below/);
  assert.match(html, /README Markdown/);
  assert.match(html, /The path to an embed/);
  assert.match(html, /aria-label="Project 1 repository"/);
  assert.match(html, /aria-label="Project 2 repository"/);
  assert.match(html, /aria-label="Remove Hello-World, project 1"/);
  assert.match(html, /aria-label="Remove Spoon-Knife, project 2"/);
  assert.match(html, />Remove (?:<!-- -->)?Hello-World</);
  assert.match(html, />Remove (?:<!-- -->)?Spoon-Knife</);
  assert.match(html, /<span>Breakdown<\/span>/);
  assert.match(html, /<span>Rhythm<\/span>/);
  assert.match(html, /2<!-- --> preview<!-- -->s/);
  assert.match(html, /Copy stays disabled until Preview validates this exact configuration/);
  assert.match(html, /<button type="button" disabled="">Copy Markdown<\/button>/);
  assert.match(html, /<legend>Scene pack<\/legend>/);
  assert.match(html, /<button type="button"[^>]*>Profile view<\/button>/);
  for (const scene of ["Activity terrain", "Evidence coverage", "Lifecycle map"]) assert.ok(html.includes(scene));
  for (const pack of ["Survey", "Orbital", "Spectral", "Terminal"]) assert.match(html, new RegExp(`<strong>${pack}</strong>`));
  assert.match(html, /Scenes to show &amp; copy/);
  assert.match(html, /<span>Evidence coverage<\/span>/);
  assert.match(html, /<legend>Preview tools<\/legend>/);
  assert.match(html, /<button type="button"[^>]*>Replay<\/button>/);
  assert.match(html, /<button type="button"[^>]*>Reduced-motion view<\/button>/);
  assert.match(html, /<button type="button"[^>]*>Frame zero<\/button>/);
  assert.doesNotMatch(html, /your-commitatlas-host\.example/);
  assert.doesNotMatch(html, /Updated 8m ago|\+18%|Building in public, one useful commit/);
});

test("serves a versioned synthetic profile without a token", async () => {
  const response = await request("/api/v1/profile?user=octocat&demo=true");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  const payload = await response.json();
  assert.equal(payload.version, 1);
  assert.equal(payload.login, "octocat");
  assert.equal(payload.freshness.mode, "demo");
});

test("reports contribution capability without claiming an unverified credential works", async () => {
  for (const [token, expected, cacheControl] of [
    ["", { status: "available", mode: "public-profile" }, "no-store"],
    ["ghp_public-only", { status: "unverified", mode: "configured-credential" }, "private, no-store"],
    ["unknown-private-capable-token", { status: "unverified", mode: "configured-credential" }, "private, no-store"],
  ]) {
    const response = await request("/api/v1/health", { GITHUB_TOKEN: token });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), cacheControl);
    const payload = await response.json();
    assert.deepEqual(payload.capabilities.contributions, expected);
    assert.doesNotMatch(JSON.stringify(payload), new RegExp(token || "token-that-cannot-match"));
  }
});

test("fails closed on unknown API parameters", async () => {
  const response = await request("/api/v1/profile?user=octocat&token=do-not-accept");
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error.code, "invalid_input");
});

test("returns stable conditional ETags for public demo data", async () => {
  const first = await request("/api/v1/contributions?user=octocat&days=7&demo=true");
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "public, max-age=60, s-maxage=3600");
  const etag = first.headers.get("etag");
  assert.ok(etag);
  const payload = await first.json();
  assert.equal(payload.days.length, 7);

  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-etag`);
  const { default: worker } = await import(workerUrl.href);
  const conditional = await worker.fetch(
    new Request("http://localhost/api/v1/contributions?user=octocat&days=7&demo=true", {
      headers: { "if-none-match": etag },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
});

test("keeps demo profile and project ETags stable within the UTC day", async () => {
  for (const path of [
    "/api/v1/profile?user=octocat&demo=true",
    "/api/v1/projects?owner=octocat&repos=atlas&states=atlas:active&workflows=atlas:ci.yml&demo=true",
  ]) {
    const first = await request(path);
    assert.equal(first.status, 200, path);
    const etag = first.headers.get("etag");
    assert.match(etag ?? "", /^W\/"[a-f\d]{64}"$/, path);
    const payload = await first.json();
    const semanticTimestamp = path.includes("/profile")
      ? payload.latestPushAt
      : payload.projects[0].pushedAt;
    assert.match(semanticTimestamp, /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/, path);

    await new Promise((resolve) => setTimeout(resolve, 2));
    const conditional = await request(path, {}, { headers: { "if-none-match": etag } });
    assert.equal(conditional.status, 304, path);
    assert.equal(await conditional.text(), "", path);
  }
});

test("fails closed for unsafe or unproven contribution credentials in the built Worker", async () => {
  for (const [scopes, token, expectedStatus] of [
    ["public_repo", "server-secret", 200],
    [null, "server-secret", 403],
    ["repo", "server-secret", 403],
    ["", "github_pat_private", 403],
  ]) {
    const calls = [];
    const response = await withMockedFetch(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      calls.push(url.pathname);
      if (url.pathname === "/rate_limit") {
        return new Response("{}", { headers: scopes === null ? {} : { "x-oauth-scopes": scopes } });
      }
      assert.equal(init?.method, "POST");
      const { variables } = JSON.parse(String(init?.body));
      return githubJson(publicContributionPayload({}, variables.to.slice(0, 10)));
    }, () => request("/api/v1/contributions?user=octocat&days=7", { GITHUB_TOKEN: token }));
    assert.equal(response.status, expectedStatus);
    assert.equal(response.headers.get("cache-control"), expectedStatus === 200 ? "private, no-store" : "no-store");
    if (expectedStatus === 200) {
      assert.deepEqual(calls, ["/rate_limit", "/graphql"]);
    } else {
      assert.deepEqual(calls, ["/rate_limit"]);
      assert.equal((await response.json()).error.code, "private_data");
    }
  }
});

test("rejects future contribution days in the built Worker", async () => {
  const response = await withMockedFetch(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return new Response("{}", { headers: { "x-oauth-scopes": "" } });
    assert.equal(url.pathname, "/graphql");
    const { variables } = JSON.parse(String(init?.body));
    return githubJson(publicContributionPayload({}, variables.to.slice(0, 10), true));
  }, () => request("/api/v1/contributions?user=octocat&days=7", { GITHUB_TOKEN: "ghp_public-only" }));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "invalid_response");
});

test("makes token-backed profile and project guesses indistinguishable before GitHub resource lookup", async () => {
  for (const [scopes, token] of [["repo", "server-secret"], [null, "server-secret"], ["", "github_pat_private"]]) {
    const calls = [];
    const responseFor = (path) => withMockedFetch(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      calls.push(url.pathname);
      if (url.pathname === "/rate_limit") {
        return new Response("{}", { headers: scopes === null ? {} : { "x-oauth-scopes": scopes } });
      }
      assert.fail(`unsafe credential reached GitHub resource ${url.pathname}`);
    }, () => request(path, { GITHUB_TOKEN: token }));

    const privateGuess = await responseFor("/api/v1/projects?owner=acme&repos=private-guess&states=private-guess:active");
    const missingGuess = await responseFor("/api/v1/projects?owner=acme&repos=missing-guess&states=missing-guess:active");
    const profileGuess = await responseFor("/api/v1/profile?user=guessed-private");

    for (const response of [privateGuess, missingGuess, profileGuess]) {
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal((await response.json()).error.code, "private_data");
    }
    assert.deepEqual(calls, ["/rate_limit", "/rate_limit", "/rate_limit"]);
  }
});

test("rejects restricted contribution collections in the built Worker", async () => {
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return new Response("{}", { headers: { "x-oauth-scopes": "" } });
    return githubJson(publicContributionPayload({ hasAnyRestrictedContributions: true }));
  }, () => request("/api/v1/contributions?user=octocat&days=7", { GITHUB_TOKEN: "ghp_public-only" }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "private_data");
});

test("uses only aligned configured workflows in the built Worker project route", async () => {
  const configuredCalls = [];
  const configured = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    configuredCalls.push(url.pathname);
    if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
    if (url.pathname.endsWith("/branches/main")) return githubJson({ name: "main", commit: { sha: CI_HEAD_SHA } });
    if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
    if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) return githubJson(workflowRuns("success"));
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:ci.yml"));
  assert.equal(configured.status, 200);
  assert.deepEqual((await configured.json()).projects[0].ci, {
    state: "passing", label: "Passing", workflow: "ci.yml", url: null, checkedAt: RECENT_RUN_UPDATED_AT, headSha: CI_HEAD_SHA,
  });
  assert.equal(configuredCalls.some((path) => path.endsWith("/actions/runs")), false);

  const noWorkflowCalls = [];
  const unconfigured = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    noWorkflowCalls.push(url.pathname);
    if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
    if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active"));
  assert.equal(unconfigured.status, 200);
  assert.equal((await unconfigured.json()).projects[0].ci.state, "unconfigured");
  assert.equal(noWorkflowCalls.some((path) => path.includes("/actions/")), false);

  const wrongWorkflow = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
    if (url.pathname.endsWith("/branches/main")) return githubJson({ name: "main", commit: { sha: CI_HEAD_SHA } });
    if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
    if (url.pathname.endsWith("/actions/workflows/docs.yml/runs")) return githubJson(workflowRuns("failure"));
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:docs.yml"));
  assert.equal(wrongWorkflow.status, 200);
  const wrongPayload = await wrongWorkflow.json();
  assert.equal(wrongPayload.projects[0].ci.workflow, "docs.yml");
  assert.equal(wrongPayload.projects[0].ci.state, "failing");
});

test("rejects path-normalizing workflow identities before the built Worker requests GitHub", async () => {
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    assert.fail(`invalid workflow reached GitHub resource ${url.pathname}`);
  }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:%2E%2E"));

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "invalid_input");
});

test("rejects oversized GitHub text before the built Worker emits a snapshot", async () => {
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/users/octocat") {
      return githubJson({ login: "octocat", name: "x".repeat(201), public_repos: 0, followers: 0, following: 0 });
    }
    if (url.pathname.endsWith("/repos")) return githubJson([]);
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => request("/api/v1/profile?user=octocat"));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "invalid_response");
});

test("returns one non-disclosing 404 for unknown public users and repositories in the built Worker", async () => {
  const upstreamNotFound = async () => githubJson({ message: "Not Found" }, 404);
  const bodies = [];
  for (const path of [
    "/api/v1/profile?user=unknown-user",
    "/api/v1/projects?owner=acme&repos=unknown-repo&states=unknown-repo:active",
    // A private repository answers with the same upstream 404 as a repository
    // that does not exist, so the rendered contract must be byte-identical.
    "/api/v1/projects?owner=acme&repos=private-repo&states=private-repo:active",
    "/api/v1/contributions?user=unknown-user&days=7",
  ]) {
    const response = await withMockedFetch(upstreamNotFound, () => request(path));
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
    assert.equal(response.headers.get("retry-after"), null, path);
    const payload = await response.json();
    assert.equal(payload.status, "error", path);
    assert.equal(payload.error.code, "github_not_found", path);
    assert.equal(payload.error.message, "No public GitHub resource matched this request", path);
    bodies.push(JSON.stringify(payload.error));
  }
  assert.equal(new Set(bodies).size, 1);
});

test("keeps rate-limit and upstream-outage codes distinct from not found in the built Worker", async () => {
  for (const [status, expectedStatus, expectedCode] of [
    [404, 404, "github_not_found"],
    [500, 502, "github_unavailable"],
    [401, 502, "github_auth_required"],
    [403, 502, "github_forbidden"],
    [429, 429, "github_rate_limited"],
  ]) {
    const response = await withMockedFetch(
      async () => new Response(null, { status, headers: { "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 30) } }),
      () => request("/api/v1/profile?user=octocat"),
    );
    assert.equal(response.status, expectedStatus, `upstream ${status}`);
    const payload = await response.json();
    assert.equal(payload.version, 1);
    assert.equal(payload.status, "error");
    assert.deepEqual(Object.keys(payload).sort(), ["error", "generatedAt", "status", "version"]);
    assert.equal(payload.error.code, expectedCode, `upstream ${status}`);
  }

  const exhausted = await withMockedFetch(
    async () => new Response(null, {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 30),
      },
    }),
    () => request("/api/v1/profile?user=octocat"),
  );
  assert.equal(exhausted.status, 429);
  assert.equal((await exhausted.json()).error.code, "github_rate_limited");
});

test("returns the not-found contract for the partial GraphQL not-found answer in the built Worker", async () => {
  const calls = [];
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url.pathname);
    if (url.pathname === "/rate_limit") return new Response("{}", { headers: { "x-oauth-scopes": "" } });
    // The exact partial answer api.github.com/graphql returns for an unknown
    // login: HTTP 200, a null user, and a NOT_FOUND entry in errors.
    return githubJson({
      data: { user: null },
      errors: [{
        type: "NOT_FOUND",
        path: ["user"],
        locations: [{ line: 3, column: 5 }],
        message: "Could not resolve to a User with the login of 'unknown-user'.",
      }],
    });
  }, () => request("/api/v1/contributions?user=unknown-user&days=7", { GITHUB_TOKEN: "ghp_public-only" }));

  assert.deepEqual(calls, ["/rate_limit", "/graphql"]);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), null);
  const payload = await response.json();
  assert.equal(payload.error.code, "github_not_found");
  assert.equal(payload.error.message, "No public GitHub resource matched this request");
  // The upstream message quotes the probed login; the served contract must not.
  assert.doesNotMatch(JSON.stringify(payload), /unknown-user|resolve to a User/i);
});

test("treats only 404 as an absent optional lookup in the built Worker project route", async () => {
  const projectFetch = (optional) => async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
    if (url.pathname.endsWith("/branches/main")) return githubJson({ name: "main", commit: { sha: CI_HEAD_SHA } });
    if (url.pathname.endsWith("/releases/latest") || url.pathname.endsWith("/actions/workflows/ci.yml/runs")) return optional();
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  };
  const path = "/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:ci.yml";

  const absent = await withMockedFetch(projectFetch(() => githubJson({ message: "Not Found" }, 404)), () => request(path));
  assert.equal(absent.status, 200);
  const absentPayload = await absent.json();
  assert.equal(absentPayload.projects[0].release, null);
  assert.equal(absentPayload.projects[0].releaseState, "none");
  assert.equal(absentPayload.projects[0].ci.state, "unavailable");
  assert.equal(absentPayload.projects[0].ci.label, "CI unavailable");

  const limited = await withMockedFetch(
    projectFetch(() => new Response(null, { status: 403, headers: { "retry-after": "31" } })),
    () => request(path),
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("cache-control"), "no-store");
  assert.equal(limited.headers.get("retry-after"), "31");
  assert.equal((await limited.json()).error.code, "github_rate_limited");

  const restricted = await withMockedFetch(
    projectFetch(() => githubJson({ message: "Resource not accessible" }, 403)),
    () => request(path),
  );
  assert.equal(restricted.status, 200);
  const restrictedPayload = await restricted.json();
  assert.equal(restrictedPayload.projects[0].release, null);
  assert.equal(restrictedPayload.projects[0].releaseState, "unavailable");
  assert.equal(restrictedPayload.projects[0].ci.state, "unavailable");
  assert.equal(restrictedPayload.projects[0].ci.label, "CI unavailable");
  assert.equal(restrictedPayload.freshness.mode, "partial");
});

test("never reports a malformed workflow_runs payload as configured or clean in the built Worker", async () => {
  for (const body of [{}, { workflow_runs: null }, { workflow_runs: "boom" }, { workflow_runs: [] }]) {
    const response = await withMockedFetch(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
      if (url.pathname.endsWith("/branches/main")) return githubJson({ name: "main", commit: { sha: CI_HEAD_SHA } });
      if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
      if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) return githubJson(body);
      assert.fail(`unexpected GitHub route: ${url.pathname}`);
    }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:ci.yml"));
    assert.equal(response.status, 200, JSON.stringify(body));
    const payload = await response.json();
    assert.deepEqual(payload.projects[0].ci, {
      state: "unavailable", label: "CI unavailable", workflow: "ci.yml", url: null, checkedAt: null, headSha: null,
    }, JSON.stringify(body));
    assert.equal(payload.freshness.mode, "partial", JSON.stringify(body));
  }
});

test("names the combined GitHub issue and pull-request total honestly in the built Worker", async () => {
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/repos/acme/atlas") return githubJson({ ...publicProjectPayload(), open_issues_count: 5 });
    if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active"));
  assert.equal(response.status, 200);
  const project = (await response.json()).projects[0];
  assert.equal(project.openIssuesAndPullRequests, 5);
  assert.equal("openIssues" in project, false);
});

test("returns exactly the requested inclusive UTC contribution window from the built Worker", async () => {
  for (const requestedDays of [7, 30]) {
    const response = await withMockedFetch(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/rate_limit") return new Response("{}", { headers: { "x-oauth-scopes": "" } });
      const { variables } = JSON.parse(String(init?.body));
      // Answer with a wider calendar than requested: the served window must
      // still be defined by the request, inclusive of its first UTC day.
      const start = shiftUtcDate(variables.from.slice(0, 10), -4);
      const contributionDays = Array.from({ length: requestedDays + 4 }, (_, offset) => ({
        date: shiftUtcDate(start, offset),
        contributionCount: 1,
      }));
      return githubJson({ data: { user: { contributionsCollection: {
        totalCommitContributions: 1,
        totalIssueContributions: 0,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        hasAnyRestrictedContributions: false,
        restrictedContributionsCount: 0,
        contributionCalendar: { weeks: [{ contributionDays }] },
      } } } });
    }, () => request(`/api/v1/contributions?user=octocat&days=${requestedDays}`, { GITHUB_TOKEN: "ghp_public-only" }));

    assert.equal(response.status, 200, `days=${requestedDays}`);
    const payload = await response.json();
    assert.equal(payload.days.length, requestedDays, `days=${requestedDays}`);
    const today = payload.freshness.generatedAt.slice(0, 10);
    assert.equal(payload.days.at(-1).date, today, `days=${requestedDays}`);
    assert.equal(payload.days[0].date, shiftUtcDate(today, -(requestedDays - 1)), `days=${requestedDays}`);
    assert.equal(payload.totalContributions, requestedDays, `days=${requestedDays}`);
  }
});

test("returns a validated rate-limit retry hint without caching the error", async () => {
  const response = await withMockedFetch(async () => new Response(null, {
    status: 429,
    headers: {
      "retry-after": "not-a-delay",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 45),
    },
  }), () => request("/api/v1/profile?user=octocat"));

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const retryAfterHeader = response.headers.get("retry-after");
  assert.notEqual(retryAfterHeader, null);
  const retryAfter = Number(retryAfterHeader);
  assert.ok(Number.isInteger(retryAfter) && retryAfter >= 0 && retryAfter <= 45);
  assert.equal((await response.json()).error.code, "github_rate_limited");
});

test("the built Worker serves an honest public last-good response after a primed upstream outage", async () => {
  const worker = await (async () => loadBuiltWorker("last-good"))();
  const values = new Map();
  const pending = [];
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    LAST_GOOD: {
      get: async (key, type) => {
        assert.equal(type, "text");
        return values.get(key) ?? null;
      },
      put: async (key, value, options) => {
        assert.deepEqual(options, { expirationTtl: 604800 });
        values.set(key, value);
      },
    },
  };
  const ctx = {
    waitUntil(promise) { pending.push(promise); },
    passThroughOnException() {},
  };
  const path = "/api/v1/profile?user=octocat&demo=false";

  const live = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/users/octocat") {
      return githubJson({ login: "octocat", name: "The Octocat", public_repos: 0, followers: 1, following: 2 });
    }
    if (url.pathname === "/users/octocat/repos") return githubJson([]);
    assert.fail(`unexpected GitHub route: ${url.pathname}`);
  }, () => worker.fetch(new Request(`http://localhost${path}`), env, ctx));
  assert.equal(live.status, 200);
  assert.equal(live.headers.get("x-commitatlas-data-state"), "live");
  await Promise.all(pending);
  assert.equal(values.size, 1);
  const livePayload = await live.json();

  const stale = await withMockedFetch(
    async () => githubJson({ message: "upstream unavailable" }, 500),
    () => worker.fetch(new Request(`http://localhost${path}`), env, ctx),
  );
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get("x-commitatlas-data-state"), "stale");
  assert.equal(stale.headers.get("x-commitatlas-fallback-reason"), "unavailable");
  assert.equal(stale.headers.get("warning"), '110 - "Response is stale"');
  assert.match(stale.headers.get("x-commitatlas-observed-at") ?? "", /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(await stale.json(), {
    ...livePayload,
    freshness: { ...livePayload.freshness, mode: "stale" },
  });

  const [key, raw] = [...values][0];
  const entry = JSON.parse(raw);
  for (const invalid of ["no-referrer\u0000", "\u0100"]) {
    values.set(key, JSON.stringify({
      ...entry,
      headers: { ...entry.headers, "referrer-policy": invalid },
    }));
    const rejectedCache = await withMockedFetch(
      async () => githubJson({ message: "upstream unavailable" }, 500),
      () => worker.fetch(new Request(`http://localhost${path}`), env, ctx),
    );
    assert.equal(rejectedCache.status, 502);
    assert.equal(rejectedCache.headers.get("cache-control"), "no-store");
    assert.equal((await rejectedCache.json()).error.code, "github_unavailable");
  }
});

test("the built atlas and scene routes consult LAST_GOOD for every recoverable GitHub failure", async (context) => {
  const worker = await loadBuiltWorker("svg-last-good-failure-classes");
  const values = new Map();
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    LAST_GOOD: { get: async (key) => values.get(key) ?? null, put: async () => assert.fail("failure must not persist") },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const realNow = Date.now.bind(Date);
  let elapsed = 0;
  context.mock.method(Date, "now", () => realNow() + elapsed);
  for (const path of ["/api/v1/cards/atlas.svg", "/api/v1/scenes/evidence-coverage.svg", "/api/v1/scenes/chronograph.svg"]) {
    const redirect = await withMockedFetch(async () => assert.fail("canonicalization must precede GitHub"),
      () => worker.fetch(new Request(`http://localhost${path}?user=%20octocat%20&demo=false`), env, ctx));
    assert.equal(redirect.status, 308);
    const canonical = new URL(redirect.headers.get("location"));
    const pairs = [...canonical.searchParams].sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
    const hash = createHash("sha256").update(`${path}?${new URLSearchParams(pairs)}`).digest("hex");
    const observedAt = new Date().toISOString();
    values.set(`public-last-good:v1:${hash}`, JSON.stringify({
      version: 1, storedAt: observedAt, observedAt,
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 220" role="img"><title>Fixture</title><desc>Public fixture</desc></svg>',
      headers: { "content-type": "image/svg+xml", etag: `W/"${"a".repeat(64)}"` },
    }));
    for (const failure of [401, 403, 429, 503, "network", "timeout"]) {
      elapsed = 0;
      const stale = await withMockedFetch(async () => {
        if (failure === "network") throw new TypeError("fixture-sensitive-network-detail");
        if (failure === "timeout") elapsed = 13_000;
        return new Response(null, { status: typeof failure === "number" ? failure : 503 });
      }, () => worker.fetch(new Request(canonical), env, ctx));
      assert.equal(stale.status, 200, `${path}: ${failure}`);
      assert.equal(stale.headers.get("x-commitatlas-data-state"), "stale");
      assert.equal(stale.headers.get("x-commitatlas-fallback-reason"), failure === 429 ? "rate-limited" : "unavailable");
      assert.match(await stale.text(), /STALE SNAPSHOT/);
    }
    elapsed = 0;
    const missing = await withMockedFetch(async () => new Response(null, { status: 404 }),
      () => worker.fetch(new Request(canonical), env, ctx));
    assert.equal(missing.status, 404, "not found must never resurrect a retained representation");
  }
});

async function withMockedFetch(fetchImpl, operation) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await operation();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function loadBuiltWorker(label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${label}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

function publicContributionPayload(restrictions = {}, endingDate = new Date().toISOString().slice(0, 10), includeFuture = false) {
  const dates = Array.from({ length: 8 }, (_, offset) => shiftUtcDate(endingDate, -7 + offset));
  if (includeFuture) dates.push(shiftUtcDate(endingDate, 1));
  return {
    data: {
      user: {
        contributionsCollection: {
          totalCommitContributions: 2,
          totalIssueContributions: 1,
          totalPullRequestContributions: 1,
          totalPullRequestReviewContributions: 1,
          hasAnyRestrictedContributions: false,
          restrictedContributionsCount: 0,
          ...restrictions,
          contributionCalendar: { weeks: [{ contributionDays: dates.map((date, index) => ({ date, contributionCount: index === dates.length - 1 ? 2 : 0 })) }] },
        },
      },
    },
  };
}

function githubJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function shiftUtcDate(date, offset) {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

function publicProjectPayload() {
  return {
    name: "atlas",
    html_url: "https://github.com/acme/atlas",
    default_branch: "main",
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
  };
}

// CI freshness is a 72-hour window, so a pinned observation silently decays into
// `stale` once the fixture ages past it. Observe one hour ago instead.
const CI_HEAD_SHA = "a".repeat(40);
const RECENT_RUN_UPDATED_AT = new Date(Date.now() - 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z");

function workflowRuns(conclusion) {
  return {
    workflow_runs: [{ head_sha: CI_HEAD_SHA, status: "completed", conclusion, updated_at: RECENT_RUN_UPDATED_AT }],
  };
}


test("the built Worker attributes workflow status only to the captured default-branch tip", async () => {
  for (const matches of [false, true]) {
    const response = await withMockedFetch(async input => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/repos/acme/atlas") return githubJson(publicProjectPayload());
      if (url.pathname.endsWith("/releases/latest")) return githubJson({}, 404);
      if (url.pathname.endsWith("/branches/main")) return githubJson({ name: "main", commit: { sha: matches ? CI_HEAD_SHA : "b".repeat(40) } });
      if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) return githubJson(workflowRuns("success"));
      assert.fail(`unexpected fixture request: ${url.pathname}`);
    }, () => request("/api/v1/projects?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:ci.yml"));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.projects[0].ci.state, matches ? "passing" : "unavailable");
    assert.equal(payload.projects[0].ci.headSha, matches ? CI_HEAD_SHA : null);
    assert.equal(payload.projects[0].ci.checkedAt, matches ? RECENT_RUN_UPDATED_AT : null);
    assert.equal(payload.freshness.mode, matches ? "live" : "partial");
  }
});

async function registeredGalleryCount() {
  const gallery = await readFile(new URL("../lib/gallery.ts", import.meta.url), "utf8");
  const cards = /export const GALLERY_CARD_IDS = \[([\s\S]*?)\] as const/.exec(gallery);
  assert.ok(cards);
  const scene = await readFile(new URL("../packages/svg/src/scene.ts", import.meta.url), "utf8");
  const builtins = /function loadBuiltins\(\): void \{([\s\S]*?)\n\}/.exec(scene);
  assert.ok(builtins);
  const cardCount = [...cards[1].matchAll(/"([a-z0-9-]+)"/g)].length;
  const sceneCount = [...builtins[1].matchAll(/registry\.set\(/g)].length;
  const findingCount = [...gallery.matchAll(/(?<!function )findingTile\(\)/g)].length;
  return cardCount + sceneCount + findingCount;
}

test("the gallery lists every registered output without calling GitHub", async () => {
  const load = () => withMockedFetch(() => {
    throw new Error("gallery must not call GitHub");
  }, () => request("/gallery"));
  const first = await load();
  assert.equal(first.status, 200);
  assert.match(first.headers.get("content-type") ?? "", /^text\/html\b/i);
  const etag = first.headers.get("etag") ?? "";
  assert.match(etag, /^W\/"[a-f0-9]{64}"$/);
  assert.equal(first.headers.get("cache-control"), "no-store, must-revalidate");
  const html = await first.text();
  for (const heading of ["Instruments", "Maps", "Signatures", "Scenes", "Findings"]) {
    assert.match(html, new RegExp(`<h2[^>]*>${heading}</h2>`));
  }
  assert.equal([...html.matchAll(/<h2\b/g)].length, 5);
  const articles = [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((match) => match[0]);
  const count = Number(/data-gallery-count="(\d+)"/.exec(html)?.[1]);
  assert.equal(articles.length, count);
  assert.equal(count, await registeredGalleryCount());
  assert.equal((html.match(/data-marker="synthetic-demo"/g) ?? []).length, count);
  assert.match(html.replaceAll("<!-- -->", ""), new RegExp(`>${count} outputs<`));
  const familyIndex = /<nav\b[^>]*aria-label="Gallery families"[\s\S]*?<\/nav>/.exec(html)?.[0];
  assert.ok(familyIndex, "readers can jump directly to each family");
  const sections = [...html.matchAll(/<section\b[^>]*data-gallery-section="([a-z]+)"[\s\S]*?<\/section>/g)];
  assert.equal(sections.length, 5);
  for (const [section, id] of sections) {
    const familyCount = [...section.matchAll(/<article\b/g)].length;
    assert.match(section, new RegExp(`id="gallery-${id}"`));
    const indexLink = new RegExp(`<a\\b[^>]*href="#gallery-${id}"[^>]*>[\\s\\S]*?<\\/a>`).exec(familyIndex)?.[0];
    assert.ok(indexLink, `family index links to ${id}`);
    assert.match(indexLink.replaceAll("<!-- -->", ""), new RegExp(`>${familyCount}<`));
    if (familyCount === 0) assert.match(section, /None registered\./);
  }
  const beacon = articles.find((article) => article.includes('data-gallery-id="identity-beacon"'));
  assert.ok(beacon);
  assert.match(beacon, /data-rung="unavailable"/);
  assert.match(beacon, /UNAVAILABLE/);
  assert.doesNotMatch(beacon, /data-rung="observed"/);
  const finding = articles.find((article) => article.includes('data-gallery-id="wbc1"'));
  assert.ok(finding);
  assert.match(finding, /data-rung="C0"/);
  assert.match(finding, />C0</);
  assert.match(finding, />reject</);
  assert.doesNotMatch(html, /promoted/i);
  for (const article of articles) {
    const text = article.replaceAll("<!-- -->", "");
    assert.match(text, /data-gallery-family="(?:instrument|map|signature|scene|finding)"/);
    assert.match(text, /data-rung="(?:observed|derived|hypothesis|C0|declared|partial|stale|unavailable)"/);
    assert.match(text, /data-pack="\S+"/);
    assert.match(text, /data-motion="\S+"/);
    assert.match(text, /<dt>Family<\/dt><dd>(?:Instruments|Maps|Signatures|Scenes|Findings)<\/dd>/);
    assert.match(text, /<dt>Evidence<\/dt><dd>(?:observed|derived|hypothesis|C0|declared|partial|stale|unavailable)<\/dd>/);
    assert.match(text, /<dt>Pack<\/dt><dd>\S+<\/dd>/);
    assert.match(text, /<dt>Motion<\/dt><dd>\S+<\/dd>/);
    assert.ok(text.indexOf("<svg") < text.indexOf("<dl"), "specimen precedes its supporting metadata");
    const headingId = /<h3 id="([^"]+)"/.exec(text)?.[1];
    assert.ok(headingId);
    assert.match(text, new RegExp(`aria-labelledby="${headingId}"`));
    assert.doesNotMatch(article, /<style/i);
  }
  assert.match(beacon, /href="\/studio"[^>]*>Explore Studio/);
  assert.match(finding, /href="\/#research-bridge-title"[^>]*>Read research note/);
  const atlas = articles.find((article) => article.includes('data-gallery-id="atlas"'));
  assert.ok(atlas);
  assert.match(atlas, /href="\/studio\?card=atlas"[^>]*>Customize in Studio/);
  const lifecycle = articles.find((article) => article.includes('data-gallery-id="lifecycle-map"'));
  assert.ok(lifecycle);
  assert.match(lifecycle, /data-rung="declared"/);

  const second = await load();
  assert.equal(await second.text(), html);
  assert.equal(second.headers.get("etag"), etag);
  const cached = await withMockedFetch(() => {
    throw new Error("gallery must not call GitHub");
  }, () => request("/gallery", {}, { headers: { "if-none-match": etag } }));
  assert.equal(cached.status, 304);
  assert.equal(cached.headers.get("etag"), etag);
  assert.deepEqual(htmlSecurityPolicy(cached), htmlSecurityPolicy(first));
  assert.equal(await cached.text(), "");
});
