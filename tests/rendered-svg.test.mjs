import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker(label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${label}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

async function request(path, extraEnv = {}, init = {}) {
  const worker = await loadWorker(path);
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...extraEnv },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("serves all five synthetic SVG cards with their planned public cache windows", async () => {
  const cases = [
    ["/api/v1/cards/profile.svg?user=octocat&demo=true&theme=aurora", "900"],
    ["/api/v1/cards/streak.svg?user=octocat&demo=true&theme=aurora", "3600"],
    ["/api/v1/cards/activity.svg?user=octocat&demo=true&theme=aurora&days=7", "3600"],
    ["/api/v1/cards/languages.svg?user=octocat&demo=true&theme=aurora", "900"],
    ["/api/v1/projects.svg?owner=acme&repos=atlas&states=atlas:active&demo=true&theme=aurora", "300"],
  ];
  for (const [path, edgeSeconds] of cases) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("content-type"), "image/svg+xml; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), `public, max-age=60, s-maxage=${edgeSeconds}`, path);
    const body = await response.text();
    assert.match(body, /^<svg [^>]*role="img"/);
    assert.match(body, /aria-label="Synthetic demo: [^"]+"/);
    assert.match(body, /<title>Synthetic demo: [^<]+<\/title><desc>Synthetic demonstration data, not live GitHub data\./);
    assert.match(body, />SYNTHETIC DEMO<\/text>/);
    assert.doesNotMatch(body, /undefined|NaN/);
  }
});

test("keeps SVG security headers and ETag values identical for a matching 304", async () => {
  const path = "/api/v1/cards/profile.svg?user=octocat&demo=true&theme=paper";
  const first = await request(path);
  const etag = first.headers.get("etag");
  assert.match(etag ?? "", /^W\/"[a-f\d]{64}"$/);
  const second = await request(path, {}, { headers: { "if-none-match": etag } });
  assert.equal(second.status, 304);
  assert.equal(await second.text(), "");
  for (const name of [
    "etag", "cache-control", "content-type", "access-control-allow-origin", "access-control-allow-methods",
    "access-control-allow-headers", "cross-origin-resource-policy", "content-security-policy", "referrer-policy",
    "x-content-type-options",
  ]) assert.equal(second.headers.get(name), first.headers.get(name), name);
});

test("redirects reordered, padded, and default-equivalent public SVG URLs before rendering", async () => {
  const response = await request(
    "/api/v1/projects.svg?states=%20atlas:planned%20&demo=true&repos=%20atlas%20&owner=%20acme%20",
  );
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    response.headers.get("location"),
    "http://localhost/api/v1/projects.svg?owner=acme&repos=atlas&states=atlas%3Aplanned&demo=true&theme=aurora",
  );

  const canonical = await request(new URL(response.headers.get("location")).pathname + new URL(response.headers.get("location")).search);
  assert.equal(canonical.status, 200);
  assert.equal(canonical.headers.get("cache-control"), "public, max-age=60, s-maxage=300");
  const body = await canonical.text();
  assert.match(body, /Planned · CI Unconfigured/);
  assert.doesNotMatch(body, /Experimental/);
});

test("keeps the rich synthetic Atlas byte-stable within its UTC day", async () => {
  const path = "/api/v1/cards/atlas.svg?user=octocat&demo=true&theme=ember&days=365&motion=subtle&layout=wide";
  const first = await request(path);
  const etag = first.headers.get("etag");
  assert.match(etag ?? "", /^W\/"[a-f\d]{64}"$/);
  assert.match(await first.text(), /Generated \d{4}-\d{2}-\d{2}T00:00:00\.000Z/);
  const second = await request(path, {}, { headers: { "if-none-match": etag } });
  assert.equal(second.status, 304);
  assert.equal(second.headers.get("etag"), etag);
  assert.equal(await second.text(), "");
});

test("returns bounded no-store JSON for invalid, duplicate, and traversal queries", async () => {
  for (const path of [
    "/api/v1/cards/profile.svg?user=octocat&unknown=x",
    "/api/v1/cards/profile.svg?user=octocat&user=other",
    "/api/v1/cards/activity.svg?user=octocat&days=6",
    "/api/v1/projects.svg?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:%2E%2E",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 400, path);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    const payload = await response.json();
    assert.equal(payload.error.code, "invalid_input");
  }
});

test("renders a complete logged-out public profile streak without a contribution token", async () => {
  const previous = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  try {
    const response = await withMockedFetch(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      assert.equal(url.origin, "https://github.com");
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      const year = Number(url.searchParams.get("from")?.slice(0, 4));
      return new Response(publicContributionHtml(year), { headers: { "content-type": "text/html; charset=utf-8" } });
    }, () => request("/api/v1/cards/streak.svg?user=octocat&demo=false&theme=aurora"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=3600");
    const body = await response.text();
    assert.match(body, />365\+<\/text>/);
    assert.match(body, /Longest in 365-day window/);
    assert.match(body, /earlier history not observed/);
  } finally {
    if (previous === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous;
  }
});

test("rejects unsafe credentials before any GitHub resource lookup", async () => {
  const calls = [];
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url.pathname);
    if (url.pathname === "/rate_limit") return new Response("{}", { headers: { "x-oauth-scopes": "" } });
    assert.fail(`unsafe credential reached GitHub resource ${url.pathname}`);
  }, () => request("/api/v1/cards/profile.svg?user=guessed-private", { GITHUB_TOKEN: "github_pat_private" }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "private_data");
  assert.deepEqual(calls, ["/rate_limit"]);
});

test("renders a live out-of-order complete window ending at the requested UTC day", async () => {
  let requestedTo = "";
  const response = await withMockedFetch(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return new Response("{}", { headers: { "x-oauth-scopes": "" } });
    assert.equal(url.pathname, "/graphql");
    const { variables } = JSON.parse(String(init?.body));
    requestedTo = variables.to.slice(0, 10);
    const dates = Array.from({ length: 7 }, (_, offset) => shiftUtcDate(requestedTo, -offset));
    return githubJson({
      data: { user: { contributionsCollection: {
        totalCommitContributions: 5,
        totalIssueContributions: 0,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        hasAnyRestrictedContributions: false,
        restrictedContributionsCount: 0,
        contributionCalendar: { weeks: [{ contributionDays: [
          { date: dates[0], contributionCount: 3 },
          { date: dates[1], contributionCount: 0 },
          { date: dates[2], contributionCount: 1 },
          { date: dates[3], contributionCount: 1 },
          { date: dates[4], contributionCount: 0 },
          { date: dates[5], contributionCount: 0 },
          { date: dates[6], contributionCount: 0 },
        ] }] },
      } } },
    });
  }, () => request("/api/v1/cards/activity.svg?user=octocat&days=7", { GITHUB_TOKEN: "ghp_public-only" }));
  assert.equal(response.status, 200);
  const body = await response.text();
  const dates = Array.from({ length: 7 }, (_, offset) => shiftUtcDate(requestedTo, -6 + offset));
  assert.match(body, new RegExp(`${dates.map((date, index) => `${date} ${[0, 0, 0, 1, 1, 0, 3][index]}`).join("; ")}`));
  assert.match(body, new RegExp(`${dates[0]} → ${dates.at(-1)}`));
});

test("rejects a gapped live contribution window as bounded JSON", async () => {
  const response = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return new Response("{}", { headers: { "x-oauth-scopes": "" } });
    assert.equal(url.pathname, "/graphql");
    return githubJson({
      data: { user: { contributionsCollection: {
        totalCommitContributions: 1,
        totalIssueContributions: 0,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        hasAnyRestrictedContributions: false,
        restrictedContributionsCount: 0,
        contributionCalendar: { weeks: [{ contributionDays: [
          { date: "2024-02-25", contributionCount: 0 },
          { date: "2024-02-26", contributionCount: 0 },
          { date: "2024-02-27", contributionCount: 0 },
          { date: "2024-02-29", contributionCount: 1 },
          { date: "2024-03-01", contributionCount: 0 },
          { date: "2024-03-02", contributionCount: 0 },
        ] }] },
      } } },
    });
  }, () => request("/api/v1/cards/activity.svg?user=octocat&days=7", { GITHUB_TOKEN: "ghp_public-only" }));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "invalid_response");
});

test("rejects a live contribution window that ends one day early despite its older boundary", async () => {
  const response = await withMockedFetch(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/rate_limit") return new Response("{}", { headers: { "x-oauth-scopes": "" } });
    assert.equal(url.pathname, "/graphql");
    const { variables } = JSON.parse(String(init?.body));
    const end = shiftUtcDate(variables.to.slice(0, 10), -1);
    const dates = Array.from({ length: 7 }, (_, offset) => shiftUtcDate(end, -6 + offset));
    return githubJson({
      data: { user: { contributionsCollection: {
        totalCommitContributions: 1,
        totalIssueContributions: 0,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        hasAnyRestrictedContributions: false,
        restrictedContributionsCount: 0,
        contributionCalendar: { weeks: [{ contributionDays: dates.map((date) => ({ date, contributionCount: 0 })) }] },
      } } },
    });
  }, () => request("/api/v1/cards/activity.svg?user=octocat&days=7", { GITHUB_TOKEN: "ghp_public-only" }));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "invalid_response");
});

test("marks truncated profiles and refuses partial language distributions", async () => {
  const profileResponse = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/users/octocat") return githubJson({
      login: "octocat", name: "Octocat", public_repos: 101, followers: 1, following: 2,
    });
    if (url.pathname.endsWith("/repos")) return githubJson([
      { stargazers_count: 999, forks_count: 0, language: "TypeScript", pushed_at: "2024-03-02T00:00:00Z" },
    ]);
    assert.fail(`unexpected GitHub route ${url.pathname}`);
  }, () => request("/api/v1/cards/profile.svg?user=octocat&demo=false&theme=aurora"));
  assert.equal(profileResponse.status, 200);
  const profileBody = await profileResponse.text();
  assert.match(profileBody, /star totals are unavailable because the repository list is partial/);
  assert.doesNotMatch(profileBody, />Stars<\/text>/);

  const languagesResponse = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/users/octocat") return githubJson({
      login: "octocat", name: "Octocat", public_repos: 101, followers: 1, following: 2,
    });
    if (url.pathname.endsWith("/repos")) return githubJson([
      { stargazers_count: 999, forks_count: 0, language: "TypeScript", pushed_at: "2024-03-02T00:00:00Z" },
    ]);
    assert.fail(`unexpected GitHub route ${url.pathname}`);
  }, () => request("/api/v1/cards/languages.svg?user=octocat&demo=false&theme=aurora"));
  assert.equal(languagesResponse.status, 502);
  assert.equal(languagesResponse.headers.get("cache-control"), "no-store");
  assert.equal((await languagesResponse.json()).error.code, "invalid_response");
});

test("renders empty languages and partial projects without inventing actions or health", async () => {
  const languageResponse = await withMockedFetch(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/users/octocat") return githubJson({ login: "octocat", public_repos: 0, followers: 0, following: 0 });
    if (url.pathname.endsWith("/repos")) return githubJson([]);
    assert.fail(`unexpected GitHub route ${url.pathname}`);
  }, () => request("/api/v1/cards/languages.svg?user=octocat&demo=false&theme=aurora"));
  assert.equal(languageResponse.status, 200);
  const languageBody = await languageResponse.text();
  assert.match(languageBody, />LANGUAGES</);
  assert.doesNotMatch(languageBody, /Unknown language|NaN|undefined/);

  const projectsResponse = await request(
    "/api/v1/projects.svg?owner=acme&repos=atlas&states=atlas:active&workflows=atlas:ci.yml&demo=true&theme=aurora",
  );
  assert.equal(projectsResponse.status, 200);
  const projectsBody = await projectsResponse.text();
  assert.doesNotMatch(projectsBody, /of 1 shown/);
  assert.match(projectsBody, /CI Passing/);
  assert.doesNotMatch(projectsBody, /<a\b|Install|Download|Docs/);
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

function githubJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function shiftUtcDate(date, offset) {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

function publicContributionHtml(year) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const cells = [];
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10);
    cells.push(`<td data-date="${day}" data-level="1"></td><tool-tip>1 contribution on ${day}.</tool-tip>`);
  }
  return `<div data-percentages="{&quot;Commits&quot;:80,&quot;Pull requests&quot;:10,&quot;Issues&quot;:5,&quot;Code review&quot;:5}">${cells.join("")}</div>`;
}
