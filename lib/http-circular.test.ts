import assert from "node:assert/strict";
import test from "node:test";
import { jsonResponse } from "./http";

test("returns 500 internal_error for circular JSON input", async () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const response = await jsonResponse(new Request("https://example.test/api"), circular, {
    edgeSeconds: 60,
    publicData: true,
  });
  assert.equal(response.status, 500);
  const body = (await response.json()) as { status: string; error: { code: string } };
  assert.equal(body.status, "error");
  assert.equal(body.error.code, "internal_error");
});

test("returns 200 with body for normal JSON input", async () => {
  const response = await jsonResponse(new Request("https://example.test/api"), { hello: "world" }, {
    edgeSeconds: 60,
    publicData: true,
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { hello: string };
  assert.equal(body.hello, "world");
});
