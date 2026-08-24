import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ORIGIN = "https://commit-atlas.commit-atlas.workers.dev";
const literal = (value) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

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

/** The JSON-LD block as it is literally served, with no truncation at the first closing tag. */
function structuredDataBlock(html) {
  const start = html.indexOf('<script type="application/ld+json"');
  assert.notEqual(start, -1, "no JSON-LD block was rendered");
  const bodyStart = html.indexOf(">", start) + 1;
  const bodyEnd = html.indexOf("</script>", bodyStart);
  assert.notEqual(bodyEnd, -1, "the JSON-LD block is never closed");
  return { body: html.slice(bodyStart, bodyEnd), tail: html.slice(bodyStart) };
}

test("robots.txt closes the dynamic render endpoints without an allow-all above them", async () => {
  const response = await request("/robots.txt");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");

  const body = await response.text();
  assert.match(body, /^User-agent: \*$/m);
  // The card and JSON routes are a combinatorial parameter space rendered fresh per request. A
  // crawler walking them is a capacity problem on a free-plan Worker.
  assert.match(body, /^Disallow: \/api\/$/m);
  assert.match(body, new RegExp(`^Sitemap: ${literal(ORIGIN)}/sitemap\\.xml$`, "m"));
  // A blanket disallow would deindex the product itself; catch that inversion explicitly.
  assert.doesNotMatch(body, /^Disallow: \/$/m);
  // No `Allow:` line at all. Allow-all is already the default, and an `Allow: /` above
  // `Disallow: /api/` resolves correctly only under longest-match (RFC 9309, and Google). A naive
  // first-match parser would read it as permission to crawl /api/ — and naive crawlers are exactly
  // the population that directive is trying to hold back.
  assert.doesNotMatch(body, /^Allow:/m);
});

test("sitemap.xml lists every indexable page and claims nothing it cannot observe", async () => {
  const response = await request("/sitemap.xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/xml\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");

  const body = await response.text();
  assert.match(body, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(body, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  for (const path of ["/", "/studio"]) {
    assert.ok(body.includes(`<loc>${new URL(path, ORIGIN).href}</loc>`), `sitemap is missing ${path}`);
  }
  assert.equal((body.match(/<loc>/g) ?? []).length, 2);
  for (const loc of body.match(/<loc>([^<]+)<\/loc>/g) ?? []) {
    assert.ok(loc.includes(`<loc>${ORIGIN}/`), `sitemap loc is not on the canonical origin: ${loc}`);
  }
  // `lastmod`, `changefreq`, and `priority` are all claims this route cannot evidence. An absent
  // signal is missing; a fabricated one is false, and the second is the one the product forbids.
  assert.doesNotMatch(body, /<lastmod>|<changefreq>|<priority>/);
  // The dynamic render endpoints are not documents and must never be advertised as such.
  assert.doesNotMatch(body, /\/api\//);
});

test("no unescaped XML metacharacter can reach a sitemap location", async () => {
  // `escapeXml` cannot fire on today's constant page list. Rather than leave the helper with no
  // coverage at all, assert the property it exists to guarantee, on the bytes actually served.
  const body = await (await request("/sitemap.xml")).text();
  assert.doesNotMatch(body, /<loc>[^<]*["'&][^<]*<\/loc>/, "an unescaped metacharacter reached a <loc>");
  // And the document must still be balanced, which an unescaped angle bracket would break.
  assert.equal((body.match(/<url>/g) ?? []).length, (body.match(/<\/url>/g) ?? []).length);
});

test("the landing page carries a canonical URL and honest structured data", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, new RegExp(`<link[^>]+rel="canonical"[^>]+href="${literal(ORIGIN)}/?"`));
  assert.match(html, /<meta[^>]+name="theme-color"[^>]+content="#11110f"/);
  assert.match(html, /<link[^>]+rel="(?:shortcut )?icon"[^>]+href="\/favicon\.svg"/);
  assert.match(html, /<meta[^>]+name="twitter:card"[^>]+content="summary_large_image"/);
  // The preview directives are the only thing the robots block buys, since index/follow is already
  // the default. They belong on a real page, never site-wide where they would land on the 404.
  assert.match(html, /<meta[^>]+name="googlebot"[^>]+content="[^"]*max-image-preview:large/);

  // The social title must agree with the document title, or a share renders a different product
  // name than the page does.
  const documentTitle = /<title>([^<]*)<\/title>/.exec(html);
  const ogTitle = /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/.exec(html);
  assert.ok(documentTitle && ogTitle, "the landing page is missing a title or an og:title");
  assert.equal(ogTitle[1], documentTitle[1]);

  const { body, tail } = structuredDataBlock(html);
  // The real control: every angle bracket is escaped, so the payload can never close its own
  // element. Asserted on the raw body rather than on a non-greedy regex capture — a capture that
  // stops at the first closing tag can never contain one, which makes that assertion a tautology
  // that survives deleting the escape entirely. This one does not.
  assert.doesNotMatch(body, /</, "an unescaped angle bracket reached the JSON-LD payload");
  assert.equal(tail.indexOf("</script>"), body.length, "the block does not end where it should");

  const graph = JSON.parse(body);
  assert.equal(graph["@context"], "https://schema.org");
  assert.deepEqual(graph["@graph"].map((node) => node["@type"]), ["SoftwareApplication", "WebSite"]);

  const software = graph["@graph"][0];
  assert.equal(software.name, "CommitAtlas");
  assert.equal(software.url, ORIGIN);
  assert.equal(software.offers.price, "0");
  assert.ok(software.featureList.length > 0);
  // Self-serving rating and review markup is the structured-data version of painting an unknown
  // signal green. There is no rating to report, so none is claimed.
  assert.equal(software.aggregateRating, undefined);
  assert.equal(software.review, undefined);
});

test("the published license claim matches the license the repository actually ships", async () => {
  // A license URL is a machine-readable legal claim about how the work may be reused. Getting it
  // wrong is worse than omitting it, and it is exactly the kind of value that gets copied from a
  // template and never re-read — this shipped as MIT in its first draft against a GPL-3.0 repo, in
  // the permissive direction, where a reader concludes no copyleft obligation applies.
  const licenseText = readFileSync(new URL("../LICENSE", import.meta.url), "utf8");
  assert.match(licenseText, /GNU GENERAL PUBLIC LICENSE/);
  assert.match(licenseText, /Version 3/);

  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.license, "GPL-3.0-only");

  const html = await (await request("/")).text();
  const graph = JSON.parse(structuredDataBlock(html).body);
  const software = graph["@graph"].find((node) => node["@type"] === "SoftwareApplication");
  assert.match(software.license, /gnu\.org\/licenses\/gpl-3\.0/);
  assert.doesNotMatch(software.license, /mit/i);
});

test("the Studio page has its own canonical URL, title, and social identity", async () => {
  const response = await request("/studio");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<title>Studio\s*—\s*CommitAtlas/);
  assert.match(html, new RegExp(`<link[^>]+rel="canonical"[^>]+href="${literal(ORIGIN)}/studio"`));
  // The title template must not double the site name onto a page that already names it.
  assert.doesNotMatch(html, /<title>[^<]*CommitAtlas[^<]*CommitAtlas/);

  const documentTitle = /<title>([^<]*)<\/title>/.exec(html);
  const ogTitle = /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/.exec(html);
  assert.ok(documentTitle && ogTitle, "the Studio page is missing a title or an og:title");
  assert.equal(ogTitle[1], documentTitle[1]);

  // A page-level `openGraph` replaces the layout's rather than merging into it, so these two are
  // silently lost the moment a page declares its own block.
  assert.match(html, /<meta[^>]+property="og:site_name"[^>]+content="CommitAtlas"/);
  assert.match(html, /<meta[^>]+property="og:locale"[^>]+content="en_GB"/);

  // Structured data describes the product once, on the landing page, not on every page.
  assert.doesNotMatch(html, /application\/ld\+json/);
});

test("the not-found page is told not to index, with nothing contradicting it", async () => {
  const html = await (await request("/this-path-does-not-exist")).text();
  assert.match(html, /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/);
  // The indexing directive lives on the two real pages precisely so it cannot land here and
  // contradict the framework's own noindex.
  assert.doesNotMatch(html, /<meta[^>]+name="robots"[^>]+content="index/);
  assert.doesNotMatch(html, /<meta[^>]+name="googlebot"[^>]+content="index/);
});
