import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "CommitAtlas GitHub portfolio dashboard" }],
  },
  twitter: { card: "summary_large_image", title, description: social, images: ["/og.png"] },
};

export const viewport: Viewport = {
  // Matches `--canvas` in globals.css, so the browser chrome does not flash a light band above a
  // near-black page on mobile.
  themeColor: "#11110f",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
