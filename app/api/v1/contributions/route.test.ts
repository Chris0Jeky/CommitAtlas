import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route";

test("serves two-year demo windows and rejects wider ones", async () => {
  const response = await GET(new Request("https://example.test/api/v1/contributions?user=octocat&demo=true&days=730"));
  assert.equal(response.status, 200);
  const payload = await response.json() as { days: unknown[] };
  assert.equal(payload.days.length, 730);
});

test("rejects contribution windows outside one week to two years", async () => {
  for (const days of ["6", "731"]) {
    const response = await GET(new Request(`https://example.test/api/v1/contributions?user=octocat&demo=true&days=${days}`));
    assert.equal(response.status, 400);
    const payload = await response.json() as { error?: { code?: string; message?: string } };
    assert.equal(payload.error?.code, "invalid_input");
    assert.match(payload.error?.message ?? "", /days must be an integer from 7 to 730/);
  }
});
