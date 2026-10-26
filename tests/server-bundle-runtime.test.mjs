import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

test("built health retains the checkout identity when runtime SHA claims change", async (t) => {
  const root = new URL("../", import.meta.url);
  const checkout = existsSync(new URL(".git", root))
    ? spawnSync("git", ["rev-parse", "HEAD"], { cwd: fileURLToPath(root), encoding: "utf8" })
    : null;
  const expected = checkout?.status === 0 ? checkout.stdout.trim() : null;
  const previous = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = "f".repeat(40);
  t.after(() => {
    if (previous === undefined) delete process.env.GITHUB_SHA;
    else process.env.GITHUB_SHA = previous;
  });
  const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url));
  const response = await worker.fetch(new Request("http://localhost/api/v1/health"),
    { GITHUB_TOKEN: "", BUILD_SHA: "e".repeat(40), GITHUB_SHA: "d".repeat(40) },
    { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const payload = await response.json();
  assert.equal(payload.status, "ok");
  assert.equal(payload.service, "CommitAtlas");
  assert.equal(payload.buildSha, expected);
});

test("the Node contract harness imports the production Worker bundle", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("server-bundle-runtime", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  assert.equal(typeof worker?.fetch, "function");
});

test("the harness provides only an empty cloudflare:workers namespace", async () => {
  const runtime = await import("cloudflare:workers");
  assert.deepEqual(Object.keys(runtime), []);
});

test("an unbound image optimizer serves passthrough without a doomed transform", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("server-bundle-runtime", `${process.pid}-${Date.now()}-image`);
  const { default: worker } = await import(workerUrl.href);
  // wrangler.jsonc declares no images binding, so the production env has no IMAGES.
  // Serve a real PNG so the optimizer reaches the transform step it cannot perform.
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => { logged.push(args); };
  let response;
  try {
    response = await worker.fetch(
      new Request("http://localhost/_vinext/image?url=%2Fopengraph.png&w=640&q=75"),
      {
        ASSETS: {
          fetch: async () => new Response(pixel, {
            status: 200,
            headers: { "Content-Type": "image/png" },
          }),
        },
      },
      { waitUntil() {}, passThroughOnException() {} },
    );
  } finally {
    console.error = originalError;
  }
  // Passthrough keeps the client-visible behavior: the source bytes with the
  // optimizer's security and cache headers, and no transform error logged.
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\/png\b/);
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pixel);
  assert.deepEqual(logged, []);
});

test("the harness does not swallow another cloudflare protocol import", async () => {
  await assert.rejects(
    import("cloudflare:not-workers"),
    (error) => error instanceof Error
      && error.code === "ERR_UNSUPPORTED_ESM_URL_SCHEME"
      && error.message.includes("cloudflare:"),
  );
});

test("the image optimizer rejects remote and recursive targets before the asset binding", async () => {
  const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url).href);
  const targets = [
    "https://example.invalid/pixel.png",
    "//example.invalid/pixel.png",
    "/\\example.invalid/pixel.png",
    "\\\\example.invalid/pixel.png",
    "/local/..//example.invalid/pixel.png",
    "data:image/png;base64,AAAA",
    "/_vinext/image?url=/opengraph.png",
    "/_next/image?url=/opengraph.png",
    "/%5Fnext/image?url=/opengraph.png",
  ];
  const assetRequests = [];
  for (const target of targets) {
    const query = new URLSearchParams({ url: target, w: "640", q: "75" });
    const response = await worker.fetch(
      new Request(`http://localhost/_vinext/image?${query}`),
      { ASSETS: { async fetch(request) { assetRequests.push(request.url); return new Response("unexpected"); } } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 400, target);
  }
  assert.deepEqual(assetRequests, [], "invalid image targets must never reach ASSETS");
});

for (const failure of ["synchronous fetch", "rejected fetch", "fallback refetch"]) {
  test(`the image optimizer bounds a ${failure} failure`, async () => {
    const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url).href);
    const bindingDetail = "synthetic-binding-detail-must-stay-private";
    let fetches = 0;
    const logged = [];
    const originalError = console.error;
    console.error = (...args) => { logged.push(args.map(String).join(" ")); };
    let response;
    try {
      response = await worker.fetch(
        new Request("http://localhost/_vinext/image?url=%2Fopengraph.png&w=640&q=75"),
        {
          ASSETS: {
            fetch() {
              fetches++;
              if (failure === "fallback refetch" && fetches === 1) {
                return Promise.resolve(new Response("synthetic image bytes", {
                  headers: { "Content-Type": "image/png" },
                }));
              }
              if (failure === "rejected fetch") return Promise.reject(bindingDetail);
              throw new Error(bindingDetail);
            },
          },
          ...(failure === "fallback refetch" ? {
            IMAGES: {
              input(stream) {
                return {
                  transform() {
                    return {
                      async output() {
                        // A transform that consumed the source forces Vinext to refetch.
                        await new Response(stream).arrayBuffer();
                        throw new Error("synthetic transform failure");
                      },
                    };
                  },
                };
              },
            },
          } : {}),
        },
        { waitUntil() {}, passThroughOnException() {} },
      );
    } finally {
      console.error = originalError;
    }
    assert.equal(fetches, failure === "fallback refetch" ? 2 : 1);
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-security-policy"), /sandbox/);
    const { generatedAt, ...body } = await response.json();
    assert.ok(Number.isFinite(Date.parse(generatedAt)));
    assert.deepEqual(body, {
      version: 1,
      status: "error",
      error: { code: "internal_error", message: "CommitAtlas could not complete the request" },
    });
    assert.ok(logged.every((line) => !line.includes(bindingDetail)), "binding details must not be logged");
  });
}
