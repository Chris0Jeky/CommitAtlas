import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorResponse, canonicalSvgRedirect, jsonResponse, optionsResponse, svgResponse } from "./http";
import { InputError } from "./github/validation";

test("uses stable weak ETags for semantically identical canonical JSON", async () => {
  const first = await jsonResponse(
    new Request("https://example.test/api"),
    { version: 1, freshness: { generatedAt: "2026-08-20T00:00:00.000Z", mode: "demo" } },
    { edgeSeconds: 60, publicData: true },
  );
  const etag = first.headers.get("etag");
  const conditional = await jsonResponse(
    new Request("https://example.test/api", { headers: { "if-none-match": etag! } }),
    { freshness: { mode: "demo", generatedAt: "2026-08-20T00:01:00.000Z" }, version: 1 },
    { edgeSeconds: 60, publicData: true },
  );
  assert.match(etag ?? "", /^W\/"[a-f\d]{64}"$/);
  assert.equal(conditional.status, 304);
});

test("never publicly caches token-backed or error responses", async () => {
  const privateResponse = await jsonResponse(
    new Request("https://example.test/api"),
    { version: 1 },
    { edgeSeconds: 60, publicData: false },
  );
  assert.equal(privateResponse.headers.get("cache-control"), "private, no-store");
  assert.equal(apiErrorResponse(new InputError("invalid input")).headers.get("cache-control"), "no-store");
});

test("hashes the exact UTF-8 SVG body and preserves headers on a matching 304", async () => {
  const body = '<svg aria-label="café">&amp; 🎨</svg>';
  const first = await svgResponse(
    new Request("https://example.test/api/v1/cards/profile.svg"),
    body,
    { edgeSeconds: 900, publicData: true },
  );
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const expected = `W/"${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}"`;
  assert.equal(await first.text(), body);
  assert.equal(first.headers.get("etag"), expected);
  assert.equal(first.headers.get("content-type"), "image/svg+xml; charset=utf-8");

  const conditional = await svgResponse(
    new Request("https://example.test/api/v1/cards/profile.svg", { headers: { "if-none-match": expected } }),
    body,
    { edgeSeconds: 900, publicData: true },
  );
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
  for (const name of [
    "etag", "cache-control", "content-type", "access-control-allow-origin", "access-control-allow-methods",
    "access-control-allow-headers", "cross-origin-resource-policy", "content-security-policy", "referrer-policy",
    "x-content-type-options",
  ]) {
    assert.equal(conditional.headers.get(name), first.headers.get(name), name);
  }
});

test("uses bounded public SVG caching and private no-store caching", async () => {
  const publicResponse = await svgResponse(new Request("https://example.test/api"), "<svg/>", { edgeSeconds: 300, publicData: true });
  assert.equal(publicResponse.headers.get("cache-control"), "public, max-age=60, s-maxage=300");
  const privateResponse = await svgResponse(new Request("https://example.test/api"), "<svg/>", { edgeSeconds: 300, publicData: false });
  assert.equal(privateResponse.headers.get("cache-control"), "private, no-store");
});

test("redirects only equivalent public SVG queries to the parsed canonical URL", () => {
  const request = new Request("https://example.test/api/v1/cards/profile.svg?theme=aurora&user=%20octocat%20");
  const canonical = "user=octocat&demo=false&theme=aurora";
  const redirect = canonicalSvgRedirect(request, canonical, true);
  assert.equal(redirect?.status, 308);
  assert.equal(redirect?.headers.get("location"), `https://example.test/api/v1/cards/profile.svg?${canonical}`);
  assert.equal(redirect?.headers.get("cache-control"), "no-store");
  assert.equal(
    canonicalSvgRedirect(new Request(`https://example.test/api/v1/cards/profile.svg?${canonical}`), canonical, true),
    null,
  );
  assert.equal(canonicalSvgRedirect(request, canonical, false), null);
});

test("sets SVG embed and script-blocking security headers for GET and OPTIONS", async () => {
  const response = await svgResponse(new Request("https://example.test/api"), "<svg/>", { edgeSeconds: 60, publicData: true });
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.equal(response.headers.get("access-control-allow-headers"), "Accept, If-None-Match");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; script-src 'none'; style-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; sandbox");
  const options = optionsResponse();
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.equal(options.headers.get("access-control-allow-headers"), "Accept, If-None-Match");
  assert.equal(options.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal(options.headers.get("content-security-policy"), response.headers.get("content-security-policy"));
});

test("keeps live source timestamps in the semantic ETag", async () => {
  const first = await jsonResponse(
    new Request("https://example.test/api"),
    {
      version: 1,
      latestPushAt: "2026-08-20T00:00:00.000Z",
      freshness: { generatedAt: "2026-08-20T00:01:00.000Z", mode: "live" },
    },
    { edgeSeconds: 60, publicData: true },
  );
  const etag = first.headers.get("etag");
  const changed = await jsonResponse(
    new Request("https://example.test/api", { headers: { "if-none-match": etag! } }),
    {
      version: 1,
      latestPushAt: "2026-08-20T01:00:00.000Z",
      freshness: { generatedAt: "2026-08-20T00:02:00.000Z", mode: "live" },
    },
    { edgeSeconds: 60, publicData: true },
  );
  assert.equal(changed.status, 200);
  assert.notEqual(changed.headers.get("etag"), etag);
});

test("allows only inline SVG presentation styles when a renderer explicitly opts into motion", async () => {
  const response = await svgResponse(
    new Request("https://example.test/api"),
    "<svg><style>.metric{opacity:1}</style></svg>",
    { edgeSeconds: 60, publicData: true, inlineStyles: true },
  );
  const policy = response.headers.get("content-security-policy") ?? "";
  assert.match(policy, /script-src 'none'/);
  assert.match(policy, /style-src 'unsafe-inline'/);
  assert.match(policy, /object-src 'none'/);
});

test("honours wildcard and weak/strong If-None-Match forms for SVG", async () => {
  const body = "<svg/>";
  const first = await svgResponse(new Request("https://example.test/api"), body, { edgeSeconds: 60, publicData: true });
  const etag = first.headers.get("etag")!;
  for (const candidate of ["*", etag, etag.replace(/^W\//, "")]) {
    const response = await svgResponse(
      new Request("https://example.test/api", { headers: { "if-none-match": candidate } }),
      body,
      { edgeSeconds: 60, publicData: true },
    );
    assert.equal(response.status, 304, candidate);
    assert.equal(await response.text(), "");
  }
});
