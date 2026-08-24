import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, SOURCE_REPOSITORY, absoluteUrl } from "@/lib/site";

/**
 * Schema.org JSON-LD for the landing page.
 *
 * Every claim here is one the project can actually stand behind. `price: "0"` is true — the toolkit
 * is free and the hosted surface is credential-free — and there is deliberately no `aggregateRating`
 * or `review`: inventing either is the structured-data equivalent of painting an unknown signal
 * green, and search engines discount self-serving review markup anyway.
 *
 * The `license` value is a machine-readable legal claim about how the work may be reused, so it is
 * pinned by a test that reads LICENSE and package.json and requires all three to agree. It shipped
 * as MIT in the first draft of this file against a GPL-3.0-only repository, in the permissive
 * direction, where a reader would conclude no copyleft obligation applies.
 *
 * The graph is emitted as a single `@graph` so the software entity and the site entity can reference
 * each other by `@id` rather than being repeated.
 */
export const JSON_LD_GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_ORIGIN}/#software`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: SITE_ORIGIN,
      applicationCategory: "DeveloperApplication",
      applicationSubCategory: "Data visualization",
      operatingSystem: "Any",
      softwareHelp: `${SOURCE_REPOSITORY}#readme`,
      codeRepository: SOURCE_REPOSITORY,
      programmingLanguage: "TypeScript",
      license: "https://www.gnu.org/licenses/gpl-3.0.html",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Embeddable GitHub contribution, streak, rhythm, and language SVG cards",
        "Project-health dashboard with explicit unavailable and stale states",
        "Credential-free public GitHub data by default",
        "GitHub Action and CLI for statically generated portfolio cards",
        "Reduced-motion and light-theme variants for README embeds",
      ],
      screenshot: absoluteUrl("/og.png"),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: SITE_ORIGIN,
      inLanguage: "en",
      about: { "@id": `${SITE_ORIGIN}/#software` },
    },
  ],
};

/**
 * Serialize a value for embedding inside a `<script type="application/ld+json">` element.
 *
 * The `<` escape is a live security control, not a belt-and-braces flourish. `JSON.stringify`
 * emits `<` verbatim — `JSON.stringify({ a: "</script>" })` is `{"a":"</script>"}` — so a single
 * `</script>` anywhere in the graph would close the surrounding element early and turn whatever
 * followed into executable markup. Escaping every `<` prevents that: `<` is a legal escape in
 * every JSON string context, and `<` can only appear inside a string literal in `stringify` output,
 * so the replacement yields valid JSON with no `<` left in it at all.
 *
 * This is exported as a pure function specifically so a test can feed it a hostile value. Asserting
 * only on the rendered page cannot cover it: today's graph contains no `<`, so deleting the escape
 * produces byte-identical output and every page-level assertion still passes. The escape exists for
 * the edit that adds a field later, and that is the edit a test has to be able to catch.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(JSON_LD_GRAPH) }}
    />
  );
}
