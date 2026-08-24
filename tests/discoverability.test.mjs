import assert from "node:assert/strict";
import test from "node:test";

const ORIGIN = "https://commit-atlas.commit-atlas.workers.dev";

async function request(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("robots.txt opens the pages and closes the dynamic render endpoints", async () => {
  const response = await request("/robots.txt");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");

  const body = await response.text();
  assert.match(body, /^User-agent: \*$/m);
  assert.match(body, /^Allow: \/$/m);
  assert.match(body, /^Allow: \/studio$/m);
  // The card and JSON routes are a combinatorial parameter space rendered fresh per request. A
  // crawler walking them is a capacity problem on a free-plan Worker.
  assert.match(body, /^Disallow: \/api\/$/m);
  assert.match(body, new RegExp(`^Sitemap: ${ORIGIN.replace(/[./]/g, "\\$&")}/sitemap\\.xml$`, "m"));
  // A blanket disallow would deindex the product itself; catch that inversion explicitly.
  assert.doesNotMatch(body, /^Disallow: \/$/m);
});

test("sitemap.xml lists every indexable page and claims nothing it cannot observe", async () => {
  const response = await request("/sitemap.xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/xml\b/i);

  const body = await response.text();
  assert.match(body, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(body, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  for (const path of ["/", "/studio"]) {
    assert.ok(body.includes(`<loc>${new URL(path, ORIGIN).href}</loc>`), `sitemap is missing ${path}`);
  }
  assert.equal((body.match(/<loc>/g) ?? []).length, 2);
  // Every URL is absolute and on the canonical origin — a relative or preview-host `loc` is
  // ignored by crawlers at best and reports a duplicate at worst.
  for (const loc of body.match(/<loc>([^<]+)<\/loc>/g) ?? []) {
    assert.ok(loc.includes(`<loc>${ORIGIN}/`), `sitemap loc is not on the canonical origin: ${loc}`);
  }
  // `lastmod` would have to be fabricated at request time; an absent signal beats a false one.
  assert.doesNotMatch(body, /<lastmod>/);
  // The dynamic render endpoints are not documents and must never be advertised as such.
  assert.doesNotMatch(body, /\/api\//);
});

test("the landing page carries a canonical URL and honest structured data", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, new RegExp(`<link[^>]+rel="canonical"[^>]+href="${ORIGIN.replace(/[./]/g, "\\$&")}/?"`));
  assert.match(html, /<meta[^>]+property="og:title"/);
  assert.match(html, /<meta[^>]+name="twitter:card"[^>]+content="summary_large_image"/);
  assert.match(html, /<meta[^>]+name="theme-color"[^>]+content="#11110f"/);
  assert.match(html, /<link[^>]+rel="(?:shortcut )?icon"[^>]+href="\/favicon\.svg"/);

  const block = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(block, "no JSON-LD block was rendered");
  const graph = JSON.parse(block[1].replace(/\\u003c/gi, "<"));
  assert.equal(graph["@context"], "https://schema.org");

  const types = graph["@graph"].map((node) => node["@type"]);
  assert.deepEqual(types, ["SoftwareApplication", "WebSite"]);

  const software = graph["@graph"][0];
  assert.equal(software.name, "CommitAtlas");
  assert.equal(software.url, ORIGIN);
  assert.equal(software.offers.price, "0");
  assert.ok(software.featureList.length > 0);
  // Self-serving rating and review markup is the structured-data version of painting an unknown
  // signal green. There is no rating to report, so none is claimed.
  assert.equal(software.aggregateRating, undefined);
  assert.equal(software.review, undefined);
  // The JSON-LD payload must never be able to close its own script element.
  assert.doesNotMatch(block[1], /<\/script/i);
});

test("the Studio page has its own canonical URL and title, not the landing page's", async () => {
  const response = await request("/studio");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<title>Studio\s*—\s*CommitAtlas/);
  assert.match(html, new RegExp(`<link[^>]+rel="canonical"[^>]+href="${ORIGIN.replace(/[./]/g, "\\$&")}/studio"`));
  // The title template must not double the site name onto a page that already names it.
  assert.doesNotMatch(html, /<title>[^<]*CommitAtlas[^<]*CommitAtlas/);
  // Structured data describes the product once, on the landing page, not on every page.
  assert.doesNotMatch(html, /application\/ld\+json/);
});
