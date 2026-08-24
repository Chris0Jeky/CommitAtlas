import { absoluteUrl } from "@/lib/site";

/**
 * `/robots.txt`.
 *
 * Everything under `/api/` is disallowed. That is a capacity decision rather than a secrecy one:
 * those routes are public and uncredentialed, but each request is a fresh SVG or JSON render driven
 * by caller-supplied query parameters, so a crawler following card links would walk a combinatorial
 * parameter space against a free-plan Worker. The cards are meant to be embedded by a README, not
 * indexed as documents.
 *
 * There is deliberately no `Allow:` line. Allow-all is already the default, and an `Allow: /`
 * emitted above `Disallow: /api/` resolves correctly only under longest-match (RFC 9309, and
 * Google) — a naive first-match parser reads it as permission to crawl `/api/`, and naive crawlers
 * are exactly the population this file is trying to hold back.
 *
 * `Disallow` is a crawl instruction, not an access control. Nothing here is secret and nothing
 * relies on this file being obeyed.
 *
 * Two costs this accepts, recorded rather than glossed:
 *
 * 1. Someone embedding a card `<img>` on their own site gets an image Googlebot-Image may decline
 *    to fetch, so it will not appear in Google Images and may show as a blocked resource against
 *    *their* page. GitHub READMEs are unaffected: GitHub's camo proxy is a synchronous image proxy
 *    in the render path, not a crawler, and does not consult robots.txt.
 * 2. A raw card URL pasted into Slack, Discord, or X will not unfurl, because those unfurlers do
 *    fetch robots.txt for the URL they are previewing. Landing-page unfurls are unaffected — the
 *    `og:image` is `/og.png`, a static asset outside `/api/`.
 *
 * One thing that was worth checking and turned out not to be true: while this route did not exist,
 * Cloudflare's edge answered `/robots.txt` itself with a 1248-byte managed Content Signals Policy
 * block, and the documented behaviour for a 200 from the origin is that the managed block is
 * prepended. Measured after the first deploy of this route, it is not: the served body is 253 bytes
 * and is exactly what this function returns. The synthesised block appears only when the origin has
 * no robots.txt of its own. Re-check after any change to the zone's bot settings rather than
 * assuming either way.
 */
export function GET(): Response {
  const body = [
    "# CommitAtlas — https://github.com/Chris0Jeky/CommitAtlas",
    "",
    "User-agent: *",
    "# Dynamic renders, not documents: every request is a fresh render of a caller-supplied query.",
    "Disallow: /api/",
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=86400",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
