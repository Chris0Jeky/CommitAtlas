import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorResponse, jsonResponse } from "./http";
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
