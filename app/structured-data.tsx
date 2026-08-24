import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, SOURCE_REPOSITORY, absoluteUrl } from "@/lib/site";

/**
 * Schema.org JSON-LD for the landing page.
 *
 * Every claim here is one the project can actually stand behind. `price: "0"` is true — the toolkit
 * is free and the hosted surface is credential-free — and there is deliberately no `aggregateRating`
 * or `review`: inventing either is the structured-data equivalent of painting an unknown signal
 * green, and Google penalises self-serving review markup anyway.
 *
 * The graph is emitted as a single `@graph` so the software entity and the site entity can reference
 * each other by `@id` rather than being repeated.
 */
const graph = {
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
 * `JSON.stringify` cannot emit `<`, so the only sequence that could close the surrounding script
 * element early is impossible by construction — but the escape is kept because the graph above is
 * the kind of thing that later gains a field, and a single `</script>` in a string would otherwise
 * turn a content edit into an XSS. The values are all module constants, never request input.
 */
export function StructuredData() {
  const json = JSON.stringify(graph).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
