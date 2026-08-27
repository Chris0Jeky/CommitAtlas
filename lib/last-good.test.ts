import assert from "node:assert/strict";
import test from "node:test";
import {
  publicLastGoodKey,
  withPublicLastGood,
  type LastGoodStore,
} from "./last-good";

const LIVE_AT = new Date("2026-08-27T20:00:00.000Z");

test("canonical keys ignore query order while isolating user, theme, and route", async () => {
  const first = new Request("https://example.test/api/v1/cards/profile.svg?theme=paper&user=octocat&demo=false&motion=none");
  const reordered = new Request("https://another-host.test/api/v1/cards/profile.svg?motion=none&demo=false&user=octocat&theme=paper");
  const otherUser = new Request("https://example.test/api/v1/cards/profile.svg?theme=paper&user=hubot&demo=false&motion=none");
  const otherTheme = new Request("https://example.test/api/v1/cards/profile.svg?theme=ember&user=octocat&demo=false&motion=none");
  const otherRoute = new Request("https://example.test/api/v1/cards/streak.svg?theme=paper&user=octocat&demo=false&motion=none");

  assert.equal(await publicLastGoodKey(first), await publicLastGoodKey(reordered));
  assert.notEqual(await publicLastGoodKey(first), await publicLastGoodKey(otherUser));
  assert.notEqual(await publicLastGoodKey(first), await publicLastGoodKey(otherTheme));
  assert.notEqual(await publicLastGoodKey(first), await publicLastGoodKey(otherRoute));
  assert.match(await publicLastGoodKey(first), /^public-last-good:v1:[a-f\d]{64}$/);
});

test("a validated public SVG primes one expiring entry and later serves an explicit stale fallback", async () => {
  const store = memoryStore();
  const pending: Promise<unknown>[] = [];
  const request = new Request("https://example.test/api/v1/cards/atlas.svg?user=octocat&demo=false&theme=paper&days=365&motion=none&layout=wide");
  const liveBody = svgBody("2026-08-27T19:58:00.000Z");
  const live = await withPublicLastGood(request, async () => svgResponse(liveBody), runtime(store, pending, LIVE_AT));

  assert.equal(live.status, 200);
  assert.equal(live.headers.get("x-commitatlas-data-state"), "live");
  assert.equal(store.values.size, 0, "persistence stays off the response path");
  await Promise.all(pending);
  assert.equal(store.values.size, 1);
  assert.deepEqual(store.putOptions, [{ expirationTtl: 604800 }]);

  const staleAt = new Date("2026-08-27T21:00:00.000Z");
  const stale = await withPublicLastGood(
    request,
    async () => githubError(502, "github_unavailable"),
    runtime(store, [], staleAt),
  );
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get("warning"), '110 - "Response is stale"');
  assert.equal(stale.headers.get("x-commitatlas-data-state"), "stale");
  assert.equal(stale.headers.get("x-commitatlas-fallback-reason"), "unavailable");
  assert.equal(stale.headers.get("x-commitatlas-last-good-at"), LIVE_AT.toISOString());
  assert.equal(stale.headers.get("x-commitatlas-observed-at"), "2026-08-27T19:58:00.000Z");
  assert.equal(stale.headers.get("x-commitatlas-last-good-age"), "3600");
  assert.equal(stale.headers.get("cache-control"), "public, max-age=60, s-maxage=60");
  assert.notEqual(stale.headers.get("etag"), svgResponse(liveBody).headers.get("etag"));
  const staleBody = await stale.text();
  assert.match(staleBody, /STALE SNAPSHOT/);
  assert.match(staleBody, /OBSERVED 2026-08-27T19:58:00\.000Z/);
  assert.match(staleBody, /<g role="note" aria-label="STALE SNAPSHOT/);
});

test("a stale conditional SVG response uses the marked representation ETag", async () => {
  const store = memoryStore();
  const path = "https://example.test/api/v1/cards/profile.svg?user=octocat&demo=false&theme=aurora&motion=none";
  const request = new Request(path);
  const pending: Promise<unknown>[] = [];
  await withPublicLastGood(request, async () => svgResponse(svgBody()), runtime(store, pending, LIVE_AT));
  await Promise.all(pending);

  const first = await withPublicLastGood(
    request,
    async () => githubError(429, "github_rate_limited"),
    runtime(store, [], new Date("2026-08-27T20:01:00.000Z")),
  );
  const staleEtag = first.headers.get("etag");
  assert.match(staleEtag ?? "", /^W\/"[a-f\d]{64}"$/);

  const conditional = await withPublicLastGood(
    new Request(path, { headers: { "if-none-match": staleEtag! } }),
    async () => githubError(429, "github_rate_limited"),
    runtime(store, [], new Date("2026-08-27T20:02:00.000Z")),
  );
  assert.equal(conditional.status, 304);
  assert.equal(conditional.headers.get("x-commitatlas-data-state"), "stale");
  assert.equal(await conditional.text(), "");
});

test("JSON fallbacks preserve the versioned payload and expose its observation time in headers", async () => {
  const store = memoryStore();
  const pending: Promise<unknown>[] = [];
  const request = new Request("https://example.test/api/v1/profile?demo=false&user=octocat");
  const body = JSON.stringify({
    version: 1,
    login: "octocat",
    freshness: { generatedAt: "2026-08-27T19:45:00.000Z", mode: "live", source: "github-rest" },
  });
  await withPublicLastGood(request, async () => jsonSuccess(body), runtime(store, pending, LIVE_AT));
  await Promise.all(pending);

  const stale = await withPublicLastGood(
    request,
    async () => githubError(429, "github_rate_limited"),
    runtime(store, [], new Date("2026-08-27T20:10:00.000Z")),
  );
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get("x-commitatlas-observed-at"), "2026-08-27T19:45:00.000Z");
  assert.deepEqual(await stale.json(), JSON.parse(body));
});

test("cold, expired, corrupt, and non-upstream failures retain the original error", async () => {
  const request = new Request("https://example.test/api/v1/profile?user=octocat&demo=false");
  const cold = memoryStore();
  const coldResponse = await withPublicLastGood(
    request,
    async () => githubError(502, "github_unavailable"),
    runtime(cold, [], LIVE_AT),
  );
  assert.equal(coldResponse.status, 502);

  const expired = memoryStore();
  const pending: Promise<unknown>[] = [];
  await withPublicLastGood(request, async () => jsonSuccess(), runtime(expired, pending, LIVE_AT));
  await Promise.all(pending);
  const expiredResponse = await withPublicLastGood(
    request,
    async () => githubError(502, "github_unavailable"),
    runtime(expired, [], new Date("2026-09-03T20:00:01.000Z")),
  );
  assert.equal(expiredResponse.status, 502);

  const corrupt = memoryStore();
  corrupt.values.set(await publicLastGoodKey(request), JSON.stringify({ version: 1, body: "<script>bad</script>" }));
  const corruptResponse = await withPublicLastGood(
    request,
    async () => githubError(429, "github_rate_limited"),
    runtime(corrupt, [], LIVE_AT),
  );
  assert.equal(corruptResponse.status, 429);

  const invalid = memoryStore();
  const invalidResponse = await withPublicLastGood(
    request,
    async () => githubError(502, "invalid_response"),
    runtime(invalid, [], LIVE_AT),
  );
  assert.equal(invalidResponse.status, 502);
  assert.equal(invalid.reads, 0);
});

test("synthetic, token-backed, method-mismatched, and cross-key requests never reuse public entries", async () => {
  const store = memoryStore();
  const pending: Promise<unknown>[] = [];
  const primed = new Request("https://example.test/api/v1/cards/profile.svg?user=octocat&demo=false&theme=paper&motion=none");
  await withPublicLastGood(primed, async () => svgResponse(svgBody()), runtime(store, pending, LIVE_AT));
  await Promise.all(pending);
  const writes = store.values.size;

  const cases = [
    [new Request("https://example.test/api/v1/cards/profile.svg?user=octocat&demo=true&theme=paper&motion=none"), true],
    [new Request("https://example.test/api/v1/cards/profile.svg?user=octocat&demo=false&theme=paper&motion=none"), false],
    [new Request("https://example.test/api/v1/cards/profile.svg?user=hubot&demo=false&theme=paper&motion=none"), true],
    [new Request("https://example.test/api/v1/cards/profile.svg?user=octocat&demo=false&theme=ember&motion=none"), true],
    [new Request("https://example.test/api/v1/cards/profile.svg?user=octocat&demo=false&theme=paper&motion=none", { method: "POST" }), true],
  ] as const;

  for (const [candidate, publicOnly] of cases) {
    const result = await withPublicLastGood(
      candidate,
      async () => githubError(502, "github_unavailable"),
      runtime(store, [], LIVE_AT, publicOnly),
    );
    assert.equal(result.status, 502, candidate.url);
  }
  assert.equal(store.values.size, writes);
});

function runtime(
  store: ReturnType<typeof memoryStore>,
  pending: Promise<unknown>[],
  now: Date,
  publicOnly = true,
) {
  return {
    publicOnly,
    store,
    now: () => now,
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    logError: () => {},
  };
}

function memoryStore(): LastGoodStore & {
  values: Map<string, string>;
  putOptions: Array<{ expirationTtl: number }>;
  reads: number;
} {
  const values = new Map<string, string>();
  const putOptions: Array<{ expirationTtl: number }> = [];
  return {
    values,
    putOptions,
    reads: 0,
    async get(key) {
      this.reads += 1;
      return values.get(key) ?? null;
    },
    async put(key, value, options) {
      values.set(key, value);
      putOptions.push(options);
    },
  };
}

function svgBody(generatedAt = "2026-08-27T19:55:00.000Z") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 220" role="img"><title>Atlas</title><desc>Generated ${generatedAt}</desc><rect width="720" height="220" fill="#fff"/><text>Generated ${generatedAt}</text></svg>`;
}

function svgResponse(body: string) {
  return new Response(body, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=60, s-maxage=300",
      "content-security-policy": "default-src 'none'; script-src 'none'; style-src 'none'",
      "content-type": "image/svg+xml; charset=utf-8",
      etag: 'W/"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      "x-content-type-options": "nosniff",
    },
  });
}

function jsonSuccess(body = JSON.stringify({ version: 1, freshness: { generatedAt: "2026-08-27T19:55:00.000Z" } })) {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=60, s-maxage=900",
      "content-type": "application/json; charset=utf-8",
      etag: 'W/"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"',
    },
  });
}

function githubError(status: number, code: string) {
  return new Response(JSON.stringify({ version: 1, status: "error", error: { code, message: "upstream failed" } }), {
    status,
    headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
  });
}
