/**
 * One source of truth for the site's public identity.
 *
 * The canonical origin, the page list, and the product description are each read by more than one
 * surface: `app/layout.tsx` metadata, the per-page metadata, `app/robots.txt/route.ts`,
 * `app/sitemap.xml/route.ts`, and the JSON-LD block on the landing page. Duplicating any of them
 * lets a crawler be told two different things about the same page — a canonical URL that disagrees
 * with the sitemap is worse for discoverability than having no sitemap at all.
 *
 * `SITE_ORIGIN` is deliberately a constant rather than something read from the request. A canonical
 * URL derived from the incoming Host header would name whatever hostname the visitor arrived on,
 * including a preview alias, which is exactly the duplicate-content problem `rel=canonical` exists
 * to solve.
 */

export const SITE_ORIGIN = "https://commit-atlas.commit-atlas.workers.dev";

export const SITE_NAME = "CommitAtlas";

export const SITE_TAGLINE = "GitHub portfolio signals, mapped clearly";

export const SITE_DESCRIPTION =
  "Create beautiful GitHub contribution cards and a trustworthy project-status dashboard from one open-source toolkit.";

export const SOURCE_REPOSITORY = "https://github.com/Chris0Jeky/CommitAtlas";

/**
 * Every indexable HTML page. The SVG and JSON endpoints under `/api/` are deliberately absent:
 * they are dynamic renders of a caller-supplied query, not pages, and each one is a fresh render
 * rather than a cache hit. Listing them would invite a crawler to walk a combinatorial parameter
 * space on a free-plan Worker.
 */
export const INDEXABLE_PAGES: readonly { readonly path: string; readonly changeFrequency: string; readonly priority: string }[] = [
  { path: "/", changeFrequency: "weekly", priority: "1.0" },
  { path: "/studio", changeFrequency: "weekly", priority: "0.8" },
];

/** Absolute URL for a site-relative path, with no chance of a double slash. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).href;
}
