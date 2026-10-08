import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/v1/scenes/[id]/route";
import { withWorkerEnv } from "@/lib/runtime-env";

const header = "x-commitatlas-scene-metadata";
function call(id: string, tail = "", headers?: HeadersInit) {
  return GET(new Request(`https://example.test/api/v1/scenes/${id}.svg?user=octocat&repos=atlas&states=atlas%3Aactive&demo=true${tail}`, { headers }),
    { params: Promise.resolve({ id: `${id}.svg` }) });
}
for (const id of ["evidence-coverage", "activity-terrain", "lifecycle-map"]) {
  for (const motion of ["none", "ambient"]) test(`${id}/${motion} carries renderer-owned counters bound to its exact SVG`, async () => {
    await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
      const tail = motion === "none" ? "" : `&motion=${motion}`;
      const response = await call(id, tail);
      assert.equal(response.status, 200);
      const metadata = JSON.parse(response.headers.get(header) ?? "null");
      assert.ok(metadata, "renderer metadata is absent");
      assert.equal(metadata.version, 1); assert.equal(metadata.scene, id);
      assert.equal(metadata.bytes, new TextEncoder().encode(await response.text()).length);
      assert.equal(typeof metadata.unavailable, "boolean");
      assert.ok(Number.isSafeInteger(metadata.animatedElements));
      assert.ok(Number.isSafeInteger(metadata.loopingGroups));
      if (motion === "none") {
        assert.equal(metadata.animatedElements, 0); assert.equal(metadata.loopingGroups, 0);
      }
      assert.match(response.headers.get("access-control-expose-headers") ?? "", /X-CommitAtlas-Scene-Metadata/i);
      const conditional = await call(id, tail, { "if-none-match": response.headers.get("etag")! });
      assert.equal(conditional.status, 304);
      assert.deepEqual(JSON.parse(conditional.headers.get(header)!), metadata);
    });
  });
}
test("unavailable scene plates are not labelled as successfully rendered evidence", async () => {
  await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
    const response = await GET(new Request("https://example.test/api/v1/scenes/lifecycle-map.svg?user=octocat&demo=true&motion=ambient"),
      { params: Promise.resolve({ id: "lifecycle-map.svg" }) });
    assert.equal(response.status, 200);
    const metadata = JSON.parse(response.headers.get(header) ?? "null");
    assert.equal(metadata?.unavailable, true); assert.equal(metadata?.animatedElements, 0);
  });
});
test("errors and canonical redirects cannot supply a scene receipt", async () => {
  await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
    for (const [id, tail, status] of [["unknown", "", 404], ["evidence-coverage", "&motion=cinematic", 400],
      ["evidence-coverage", "&theme=aurora", 308]] as const) {
      const response = await call(id, tail);
      assert.equal(response.status, status); assert.equal(response.headers.has(header), false);
    }
  });
});
