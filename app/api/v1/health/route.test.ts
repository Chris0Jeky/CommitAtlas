import assert from "node:assert/strict";
import test from "node:test";
import { withWorkerEnv } from "@/lib/runtime-env";
import { GET } from "./route";

interface HealthPayload {
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

  assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=60");
  assert.deepEqual(payload.capabilities.contributions, {
    status: "available",
    mode: "public-profile",
  });
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

function healthWithToken(token: string): Promise<Response> {
  return withWorkerEnv(
    { GITHUB_TOKEN: token },
    () => GET(new Request("https://example.test/api/v1/health")),
  );
}
