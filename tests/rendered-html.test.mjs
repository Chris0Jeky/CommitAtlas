import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the CommitAtlas product surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>CommitAtlas/);
  assert.match(html, /Your GitHub work/);
  assert.match(html, /Project signals/);
  assert.match(html, /Synthetic preview/);
  assert.match(html, /Open the Studio/);
  assert.match(html, /aria-label="Primary navigation"/);
  assert.doesNotMatch(html, /Updated 8m ago|\+18%/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/);
});

test("server-renders an honest interactive Studio shell", async () => {
  const response = await render("/studio");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Interactive Studio/);
  assert.match(html, /Synthetic starter data/);
  assert.match(html, /Data source/);
  assert.match(html, /Declare lifecycle yourself/);
  assert.match(html, /Actions are HTML, not SVG/);
  assert.match(html, /README Markdown/);
  assert.doesNotMatch(html, /Updated 8m ago|\+18%|Building in public, one useful commit/);
});
