import { INDEXABLE_PAGES, absoluteUrl } from "@/lib/site";

/**
 * `/sitemap.xml`.
 *
 * `<loc>` and nothing else. `<lastmod>` would have to be fabricated at request time — the honest
 * value is the deployment date of the running Worker, which this route cannot observe, and a
 * `lastmod` stamped with "now" on every request asserts a change that did not happen.
 * `<changefreq>` and `<priority>` are omitted on the same grounds: both are unevidenced claims about
 * this site's behaviour, and Google ignores them regardless, so keeping them would be assertion
 * without benefit. An absent signal is missing; a fabricated one is false, and the product rule here
 * is that an unknown is never dressed up as an observation.
 */
export function GET(): Response {
  const urls = INDEXABLE_PAGES
    .map((path) => `  <url><loc>${escapeXml(absoluteUrl(path))}</loc></url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=86400",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

/**
 * Every value reaching this is a constant from `lib/site.ts`, so it cannot fire on today's input.
 * It is here so that adding a page whose path contains an ampersand stays a routine edit rather
 * than a silent XML break, and the test asserts the property it guarantees on the served bytes.
 */
function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character] as string);
}
