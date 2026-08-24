import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CHASSIS_THEMES, CHASSIS_THEME_BOOTSTRAP, DEFAULT_CHASSIS_THEME } from "@/lib/chassis";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, SITE_TAGLINE } from "@/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = `${SITE_NAME} — ${SITE_TAGLINE}`;
const social = "Accessible GitHub cards and a truthful project-health dashboard in one open-source toolkit.";

/**
 * Site-wide metadata only.
 *
 * There is deliberately no `robots` block here. The framework marks its own not-found page
 * `noindex`, and a layout-wide `index, follow` would land on that same page as a contradictory
 * directive. `index, follow` is the default anyway, so the only part worth declaring is the preview
 * sizing — and that belongs on the two real pages, which declare it themselves.
 *
 * No `keywords` either. The major engines ignore it, Bing has publicly described it as a spam
 * signal, and the discoverability that actually works here is the title, the description, the
 * canonical URL, and the sitemap.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: title, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "CommitAtlas contributors", url: "https://github.com/Chris0Jeky/CommitAtlas" }],
  creator: "CommitAtlas contributors",
  publisher: "CommitAtlas contributors",
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    siteName: SITE_NAME,
    title,
    description: social,
    type: "website",
    locale: "en_GB",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CommitAtlas — your GitHub work, mapped clearly" }],
  },
  twitter: { card: "summary_large_image", title, description: social, images: ["/og.png"] },
};

export const viewport: Viewport = {
  // The default chassis ground. A visitor who has chosen a different chassis theme gets that
  // theme applied by the bootstrap below, but `theme-color` is read from the served document
  // before any script runs, so it can only ever describe the default — and describing the default
  // is right, because that is what the first paint shows.
  themeColor: CHASSIS_THEMES[DEFAULT_CHASSIS_THEME].ground,
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The bootstrap below writes `data-chassis` onto this element before hydration, which the
    // server did not render. That is the whole point, and it is exactly what this attribute is for.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Applies a stored chassis theme before first paint.

          Without it, a Limestone reader gets a full-page flash of the Fieldline ground on every
          navigation, because the served HTML is cacheable and therefore always carries the
          default. The script is a bounded allowlist check over one `localStorage` key and is
          total: any storage failure falls through to the default rather than throwing before
          hydration. `chassis.test.ts` holds it to that shape and to being unable to close its own
          script element.
        */}
        <script dangerouslySetInnerHTML={{ __html: CHASSIS_THEME_BOOTSTRAP }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
