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

test("the harness does not swallow another cloudflare protocol import", async () => {
  await assert.rejects(
    import("cloudflare:not-workers"),
    (error) => error instanceof Error
      && error.code === "ERR_UNSUPPORTED_ESM_URL_SCHEME"
      && error.message.includes("cloudflare:"),
  );
});
