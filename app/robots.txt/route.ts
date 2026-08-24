import { INDEXABLE_PAGES, SITE_ORIGIN, absoluteUrl } from "@/lib/site";

/**
 * `/robots.txt`.
 *
 * The two HTML pages are open to crawlers. Everything under `/api/` is disallowed, which is a
 * capacity decision rather than a secrecy one: those routes are public and uncredentialed, but each
 * request is a fresh SVG or JSON render driven by caller-supplied query parameters, so a crawler
 * following card links would walk a combinatorial parameter space against a free-plan Worker. The
 * cards are meant to be embedded by a README, not indexed as documents.
 *
 * `Disallow` is a crawl instruction, not an access control. Nothing here is secret and nothing
 * relies on this file being obeyed.
 */
export function GET(): Response {
  const body = [
    "# CommitAtlas — https://github.com/Chris0Jeky/CommitAtlas",
    "",
    "User-agent: *",
    ...INDEXABLE_PAGES.map(({ path }) => `Allow: ${path}`),
    "# Dynamic renders, not documents: every request is a fresh render of a caller-supplied query.",
    "Disallow: /api/",
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    `Host: ${new URL(SITE_ORIGIN).host}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
