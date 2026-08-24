/**
 * One source of truth for the site's public identity.
 *
 * The canonical origin, the page list, and the product description are each read by more than one
 * surface: `app/layout.tsx` metadata, the per-page metadata, `app/robots.txt/route.ts`,
 * `app/sitemap.xml/route.ts`, and the JSON-LD block on the landing page. Duplicating any of them
 * lets a crawler be told two different things about the same page — a canonical URL that disagrees
 * with the sitemap is worse for discoverability than having no sitemap at all.
 */

/** The origin this project's own deployment answers on, and the default for every other. */
export const DEFAULT_SITE_ORIGIN = "https://commit-atlas.commit-atlas.workers.dev";

/**
 * The canonical origin, overridable per deployment.
 *
 * Two things had to be true at once. A canonical URL must be **stable** — deriving it from the
 * incoming Host header would name whatever alias the visitor arrived on, including a preview
 * hostname, which is the duplicate-content problem `rel=canonical` exists to solve. But it must
 * also not be **this** deployment's origin baked into every fork: a `workers.dev` hostname is
 * `<worker>.<account-subdomain>.workers.dev` and differs per account, so a hard-coded constant
 * makes a fork's canonical links, sitemap entries, and JSON-LD all advertise someone else's site
 * and quietly deindex its own. That is the same reasoning `scripts/deploy.mjs` already applies to
 * the deployed origin it verifies.
 *
 * `SITE_ORIGIN` is therefore **deployment configuration, not request data**: a Wrangler `vars`
 * entry, read once at module load. It is fixed for the lifetime of a deployment and cannot be
 * influenced by a caller, so it keeps the stability a canonical URL needs while letting a fork be
 * honest about being a fork. Set it in `wrangler.jsonc` under `vars`, or leave it unset and get the
 * default.
 *
 * Anything unparseable, non-https, or carrying a path, query, or fragment falls back to the
 * default rather than emitting a broken canonical URL — a malformed origin here would corrupt every
 * link on the site at once.
 */
export const SITE_ORIGIN = resolveSiteOrigin(process.env.SITE_ORIGIN);

export function resolveSiteOrigin(configured: string | undefined): string {
  const candidate = configured?.trim();
  if (!candidate) return DEFAULT_SITE_ORIGIN;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return DEFAULT_SITE_ORIGIN;
    // `new URL("https://x/y").origin` silently discards the path, so a configured value carrying
    // one is a mistake worth refusing rather than half-honouring.
    if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return DEFAULT_SITE_ORIGIN;
    return url.origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export const SITE_NAME = "CommitAtlas";

export const SITE_TAGLINE = "GitHub portfolio signals, mapped clearly";

export const SITE_DESCRIPTION =
  "Create beautiful GitHub contribution cards and a trustworthy project-status dashboard from one open-source toolkit.";

export const SOURCE_REPOSITORY = "https://github.com/Chris0Jeky/CommitAtlas";

/**
 * Every indexable HTML page.
 *
 * The SVG and JSON endpoints under `/api/` are deliberately absent: they are dynamic renders of a
 * caller-supplied query, not pages, and each one is a fresh render rather than a cache hit. Listing
 * them would invite a crawler to walk a combinatorial parameter space on a free-plan Worker.
 *
 * Paths only. `<changefreq>` and `<priority>` are omitted for the same reason `<lastmod>` is: an
 * update cadence this route cannot observe is an unevidenced claim stated as fact, and the honesty
 * rule that governs the product's CI freshness governs its sitemap too. Google ignores both fields
 * outright, so keeping them would be pure assertion for no benefit.
 */
export const INDEXABLE_PAGES: readonly string[] = ["/", "/studio"];

/** Absolute URL for a site-relative path, with no chance of a double slash. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).href;
}

/**
 * Indexing directives for the two real pages.
 *
 * Deliberately per-page rather than site-wide. The framework marks its own not-found page
 * `noindex`; a layout-wide `index, follow` would land on that page too and contradict it. Since
 * `index, follow` is already the default, the only thing this actually buys is the preview sizing,
 * and that is worth having only where there is a page to preview.
 */
export const PAGE_ROBOTS = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
} as const;
