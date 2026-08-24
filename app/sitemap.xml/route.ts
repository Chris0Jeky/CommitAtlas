import { INDEXABLE_PAGES, absoluteUrl } from "@/lib/site";

/**
 * `/sitemap.xml`.
 *
 * `lastmod` is deliberately omitted. The honest value is the deployment date of the currently
 * running Worker, which this route cannot observe — and a `lastmod` stamped with "now" on every
 * request is a claim that the page changed when it did not. An absent `lastmod` is a missing
 * signal; a fabricated one is a false signal, and the product rule here is that an unknown is never
 * dressed up as an observation.
 */
export function GET(): Response {
  const urls = INDEXABLE_PAGES.map(({ path, changeFrequency, priority }) => [
    "  <url>",
    `    <loc>${escapeXml(absoluteUrl(path))}</loc>`,
    `    <changefreq>${changeFrequency}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n")).join("\n");

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
    },
  });
}

/**
 * Every value reaching this is a constant from `lib/site.ts`, so this cannot currently fire. It is
 * here so that adding a page with an ampersand in its path stays a routine edit rather than a
 * silent XML break.
 */
function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character] as string);
}
