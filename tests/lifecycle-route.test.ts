import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/v1/scenes/[id]/route";
import { withWorkerEnv } from "@/lib/runtime-env";

function call(id: string, query: string) {
  return GET(new Request(`https://example.test/api/v1/scenes/${id}.svg?${query}`), { params: Promise.resolve({ id: `${id}.svg` }) });
}

for (const days of [365, 730, "auto"]) {
  for (const layout of ["wide", "compact"]) {
    test(`lifecycle scene hosts declared projects at ${days} days in ${layout}`, async () => {
      await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
        const parameters = new URLSearchParams({ user: "octocat", repos: "atlas,studio", states: "atlas:active,studio:archived", demo: "true" });
        if (days !== 365) parameters.set("days", String(days));
        if (layout !== "wide") parameters.set("layout", layout);
        const response = await call("lifecycle-map", parameters.toString());
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "image/svg+xml; charset=utf-8");
        const body = await response.text();
        assert.match(body, /<title>Lifecycle map<\/title>/);
        assert.match(body, />LIFECYCLE · DECLARED<\/text>/);
        assert.match(body, /SYNTHETIC DEMO/);
        assert.match(body, /DECLARED ACTIVE/);
        assert.match(body, /DECLARED ARCHIVED/);
        assert.match(body, new RegExp(`viewBox="0 0 ${layout === "compact" ? 480 : 720} `));
        assert.match(response.headers.get("content-security-policy") ?? "", /style-src 'none'/);
        assert.doesNotMatch(body, /<script|foreignObject|<animate/i);
      });
    });
  }
}

test("a lifecycle request without configured projects returns a still unavailable plate", async () => {
  await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
    const response = await call("lifecycle-map", "user=octocat&demo=true&motion=ambient");
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /PROJECT EVIDENCE UNAVAILABLE/);
    assert.doesNotMatch(body, /<animate|CI PASSING/);
  });
});

test("lifecycle rejects unsupported packs and cinematic without silently downgrading", async () => {
  await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
    for (const tail of ["pack=orbital", "motion=cinematic"]) {
      const response = await call("lifecycle-map", `user=octocat&demo=true&${tail}`);
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal((await response.json()).error.code, "invalid_input");
    }
  });
});
