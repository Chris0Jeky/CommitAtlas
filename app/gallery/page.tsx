import type { Metadata } from "next";
import { ChassisFooter, ConsoleHeader, GALLERY_LINKS } from "../chassis/console";
import { buildGallery, type GalleryTile } from "@/lib/gallery";
import { landingSnapshot } from "@/lib/landing";
import { PAGE_ROBOTS, SITE_NAME } from "@/lib/site";

const description = "Every registered CommitAtlas output, grouped by family, from the synthetic demo snapshot.";
const socialTitle = `Gallery — ${SITE_NAME}`;

export const metadata: Metadata = {
  title: "Gallery",
  description,
  alternates: { canonical: "/gallery" },
  robots: PAGE_ROBOTS,
  openGraph: {
    siteName: SITE_NAME,
    title: socialTitle,
    description,
    type: "website",
    locale: "en_GB",
    url: "/gallery",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CommitAtlas Gallery" }],
  },
  twitter: { card: "summary_large_image", title: socialTitle, description, images: ["/og.png"] },
};

/** Lead with the overview, then keep the existing alphabetical catalogue order. */
function displayOrder(tiles: readonly GalleryTile[]): readonly GalleryTile[] {
  return [...tiles].sort((left, right) => Number(right.id === "atlas") - Number(left.id === "atlas"));
}

export default async function GalleryPage() {
  const gallery = buildGallery(await landingSnapshot());
  return (
    <>
      <a className="skip-link" href="#gallery">Skip to content</a>
      <ConsoleHeader section="Gallery" reference="ATL/CH-REV-B" links={GALLERY_LINKS} />
      <main id="gallery" className="shell gallery-page" tabIndex={-1}>
        <header className="gallery-hero">
          <div>
            <p className="eyebrow"><span aria-hidden="true" /> 00 // The CommitAtlas gallery</p>
            <h1>The signal,<br /><em>in every form.</em></h1>
            <p className="gallery-intro">Explore the whole toolkit, from a single reading to a complete composition. Choose a form for your work.</p>
          </div>
          <div className="gallery-summary">
            <p className="gallery-summary-label">Catalogue / {String(gallery.families.length).padStart(2, "0")} families</p>
            <p className="gallery-output-count" data-gallery-count={gallery.tiles.length}>{gallery.tiles.length} outputs</p>
            <p>Every preview uses synthetic demo data. Still images keep every reading in view.</p>
          </div>
        </header>

        <nav className="gallery-index" aria-label="Gallery families">
          {gallery.families.map((family, index) => (
            <a href={`#gallery-${family.id}`} key={family.id}>
              <span className="gallery-index-label"><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{family.title}</span>
              <span className="gallery-index-count">{family.tiles.length}<span className="sr-only"> outputs</span></span>
            </a>
          ))}
        </nav>

        {gallery.families.map((family, familyIndex) => (
          <section className="gallery-family" key={family.id} data-gallery-section={family.id} aria-labelledby={`gallery-${family.id}`}>
            <div className="gallery-family-heading">
              <div>
                <p className="numeral">{String(familyIndex + 1).padStart(2, "0")}{" // "}{family.tiles.length} {family.tiles.length === 1 ? "output" : "outputs"}</p>
                <h2 id={`gallery-${family.id}`}>{family.title}</h2>
              </div>
              <p>{family.description}</p>
            </div>
            {family.tiles.length === 0 ? <div className="gallery-empty"><p>None registered.</p><span>This family has no preview to show yet.</span></div> : (
              <div className="gallery-grid">
                {displayOrder(family.tiles).map((item, index) => (
                  <article
                    className={`gallery-specimen${item.id === "atlas" || item.pack !== "card" ? " gallery-specimen--wide" : ""}`}
                    key={item.id}
                    aria-labelledby={`gallery-title-${item.id}`}
                    data-gallery-id={item.id}
                    data-gallery-family={item.family}
                    data-rung={item.rung}
                    data-pack={item.pack}
                    data-motion={item.motion}
                    data-state={item.state}
                  >
                    <header className="gallery-specimen-heading">
                      <div><span className="gallery-specimen-number" aria-hidden="true">{String(familyIndex + 1).padStart(2, "0")}.{String(index + 1).padStart(2, "0")}</span><h3 id={`gallery-title-${item.id}`}>{item.label}</h3></div>
                      <span className="gallery-specimen-state">{item.state === "unavailable" ? "Unavailable" : item.state === "stale" ? "Stale" : "Ready"}</span>
                    </header>
                    <div className="gallery-specimen-stage" dangerouslySetInnerHTML={{ __html: item.svg }} />
                    <div className="gallery-specimen-details">
                      <dl className="gallery-specimen-meta">
                        <div><dt>Family</dt><dd>{family.title}</dd></div>
                        <div><dt>Evidence</dt><dd>{item.rung}</dd></div>
                        <div><dt>Pack</dt><dd>{item.pack}</dd></div>
                        <div><dt>Motion</dt><dd>{item.motion}</dd></div>
                      </dl>
                      {item.note && item.note !== "Unavailable" ? <p className="gallery-specimen-note">{item.note}</p> : null}
                      <footer className="gallery-specimen-footer">
                        <div><p data-marker="synthetic-demo">{item.marker}</p><code>{item.id}</code></div>
                        <a href={item.studioHref} aria-label={`${item.destinationLabel}: ${item.label}`}>{item.destinationLabel} <span aria-hidden="true">↗</span></a>
                      </footer>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
      <ChassisFooter note="Synthetic demo gallery. No live GitHub request is made to render this page." />
    </>
  );
}
