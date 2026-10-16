import type { Metadata } from "next";
import { ChassisFooter, ConsoleHeader, GALLERY_LINKS } from "../chassis/console";
import { buildGallery } from "@/lib/gallery";
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

export default async function GalleryPage() {
  const gallery = buildGallery(await landingSnapshot());
  return (
    <>
      <a className="skip-link" href="#gallery">Skip to content</a>
      <ConsoleHeader section="Gallery" reference="ATL/CH-REV-B" links={GALLERY_LINKS} />
      <main id="gallery" className="shell gallery-page">
        <h1>Gallery</h1>
        <p data-gallery-count={gallery.tiles.length}>{gallery.tiles.length} outputs</p>
        {gallery.families.map((family) => (
          <section key={family.id} aria-labelledby={`gallery-${family.id}`}>
            <h2 id={`gallery-${family.id}`}>{family.title}</h2>
            {family.tiles.length === 0 ? <p>None registered.</p> : (
              <div className="gallery-grid">
                {family.tiles.map((item) => (
                  <article
                    key={item.id}
                    data-gallery-id={item.id}
                    data-gallery-family={item.family}
                    data-rung={item.rung}
                    data-pack={item.pack}
                    data-motion={item.motion}
                    data-state={item.state}
                  >
                    <h3>{item.label}</h3>
                    <p>{item.id}</p>
                    <p>Family {family.title}</p>
                    <p>Evidence {item.rung}</p>
                    <p>Pack {item.pack}</p>
                    <p>Motion {item.motion}</p>
                    <p data-marker="synthetic-demo">{item.marker}</p>
                    <p>{item.state === "unavailable" ? "Unavailable" : "Ready"}</p>
                    {item.note ? <p>{item.note}</p> : null}
                    <a href={item.studioHref}>Open in Studio</a>
                    <div dangerouslySetInnerHTML={{ __html: item.svg }} />
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
