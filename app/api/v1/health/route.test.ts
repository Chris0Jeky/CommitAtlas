import assert from "node:assert/strict";
import test from "node:test";
import { withWorkerEnv } from "@/lib/runtime-env";
import { GET } from "./route";

interface HealthPayload {
  buildSha: string | null;
  capabilities: {
    contributions: {
      status: string;
      mode: string;
    };
  };
}

test("reports tokenless public contributions as available", async () => {
  const response = await healthWithToken("");
  const payload = await response.json() as HealthPayload;

  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(payload.capabilities.contributions, {
    status: "available",
    mode: "public-profile",
  });
});

test("unbuilt health reports no build identity and ignores runtime SHA claims", async (t) => {
  const previous = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = "a".repeat(40);
  t.after(() => {
    if (previous === undefined) delete process.env.GITHUB_SHA;
    else process.env.GITHUB_SHA = previous;
  });
  const response = await healthWithToken("");
  const payload = await response.json() as HealthPayload;
  assert.equal(payload.buildSha, null);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("reports every configured contribution credential as unverified", async () => {
  for (const token of ["ghp_public-only", "unknown-private-capable-token"]) {
    const response = await healthWithToken(token);
    const payload = await response.json() as HealthPayload;

    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(payload.capabilities.contributions, {
      status: "unverified",
      mode: "configured-credential",
    });
    assert.doesNotMatch(JSON.stringify(payload), new RegExp(token));
  }
});

test("rejects unknown query parameters instead of minting cache keys", async () => {
  const response = await withWorkerEnv(
    { GITHUB_TOKEN: "" },
    () => GET(new Request("https://example.test/api/v1/health?junk=1")),
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const payload = await response.json() as { error?: { code?: string; message?: string } };
  assert.equal(payload.error?.code, "invalid_input");
  assert.match(payload.error?.message ?? "", /unknown query parameter: junk/);
});

function healthWithToken(token: string): Promise<Response> {
  return withWorkerEnv(
    { GITHUB_TOKEN: token },
    () => GET(new Request("https://example.test/api/v1/health")),
  );
}
