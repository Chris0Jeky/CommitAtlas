import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/v1/scenes/[id]/route";
import { withWorkerEnv } from "@/lib/runtime-env";

const scene = (id: string, query: string) =>
  new Request(`https://example.test/api/v1/scenes/${id}.svg?${query}`);

function call(id: string, query: string) {
  return GET(scene(id, query), { params: Promise.resolve({ id: `${id}.svg` }) });
}

test("hosts the evidence-coverage scene from the public snapshot", async () => {
  await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
    const response = await call("evidence-coverage", "user=octocat&demo=true");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/svg+xml; charset=utf-8");
    assert.match(response.headers.get("etag") ?? "", /^W\/"[a-f\d]{64}"$/);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=300");
    assert.match(response.headers.get("content-security-policy") ?? "", /style-src 'none'/);
    assert.doesNotMatch(response.headers.get("content-security-policy") ?? "", /unsafe-inline/);
    const body = await response.text();
    assert.match(body, /^<svg [^>]*role="img"/);
    assert.match(body, /<title>Evidence coverage<\/title>/);
    assert.doesNotMatch(body, /<script|foreignObject|onload=/i);

    const ambient = await call("evidence-coverage", "user=octocat&demo=true&motion=ambient");
    assert.equal(ambient.status, 200);
    const ambientBody = await ambient.text();
    const csp = ambient.headers.get("content-security-policy") ?? "";
    if (ambientBody.includes("<style")) assert.match(csp, /style-src 'unsafe-inline'/);
    else assert.match(csp, /style-src 'none'/);
  });
});

test("rejects an unknown scene, cinematic motion, and an unknown pack", async () => {
  await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
    const missing = await call("not-a-scene", "user=octocat&demo=true");
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    assert.equal((await missing.json()).error.code, "github_not_found");

    const cinematic = await call("evidence-coverage", "user=octocat&demo=true&motion=cinematic");
    assert.equal(cinematic.status, 400);
    assert.equal((await cinematic.json()).error.code, "invalid_input");

    const pack = await call("evidence-coverage", "user=octocat&demo=true&pack=nebula");
    assert.equal(pack.status, 400);
    assert.equal((await pack.json()).error.code, "invalid_input");
  });
});
