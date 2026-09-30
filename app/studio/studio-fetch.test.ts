import assert from "node:assert/strict";
import test from "node:test";
import { fetchJson } from "./studio-fetch";

function stubFetch(body: unknown, ok = true, status = 200): void {
  globalThis.fetch = (async () =>
    ({ ok, status, json: async () => body }) as unknown as Response) as typeof fetch;
}

let originalFetch: typeof fetch;

test.beforeEach(() => {
  originalFetch = globalThis.fetch;
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("returns a valid object body", async () => {
  stubFetch({ login: "octocat" });
  const result = await fetchJson<{ login: string }>("/api/v1/profile");
  assert.deepEqual(result, { login: "octocat" });
});

test("rejects a null body with an invalid shape error", async () => {
  stubFetch(null);
  await assert.rejects(fetchJson("/api/v1/profile"), /invalid response shape/);
});

test("rejects a string body with an invalid shape error", async () => {
  stubFetch("oops");
  await assert.rejects(fetchJson("/api/v1/profile"), /invalid response shape/);
});

test("rejects an array body with an invalid shape error", async () => {
  stubFetch([{ login: "octocat" }]);
  await assert.rejects(fetchJson("/api/v1/profile"), /invalid response shape/);
});

test("keeps the non-OK status message unchanged", async () => {
  stubFetch({ error: { message: "" } }, false, 500);
  await assert.rejects(fetchJson("/api/v1/profile"), /Request failed with 500/);
});
