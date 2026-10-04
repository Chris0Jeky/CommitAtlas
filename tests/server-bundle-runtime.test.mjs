import assert from "node:assert/strict";
import test from "node:test";

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
