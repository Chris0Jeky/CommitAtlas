import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, SITE_TAGLINE } from "@/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = `${SITE_NAME} — ${SITE_TAGLINE}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: title, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Long-tail phrasing a person actually types. `keywords` carries no weight with the major search
  // engines and is here only because some smaller crawlers and embed unfurlers still read it; the
  // discoverability work that matters is the title, the description, and the sitemap.
  keywords: [
    "GitHub profile README cards",
    "GitHub contribution graph SVG",
    "GitHub stats card",
    "GitHub streak card",
    "project health dashboard",
    "CI status badge",
    "GitHub Action portfolio",
    "open source developer portfolio",
    "accessible SVG cards",
  ],
  authors: [{ name: "CommitAtlas contributors", url: "https://github.com/Chris0Jeky/CommitAtlas" }],
  creator: "CommitAtlas contributors",
  publisher: "CommitAtlas contributors",
  alternates: { canonical: "/" },
  // The HTML pages are indexable; `/robots.txt` separately keeps crawlers off `/api/`, where every
  // request is a fresh render of a caller-supplied query rather than a document.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    siteName: SITE_NAME,
    title,
    description: "Accessible GitHub cards and a truthful project-health dashboard in one open-source toolkit.",
    type: "website",
    locale: "en_GB",
    url: "/",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "CommitAtlas GitHub portfolio dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: "Accessible GitHub cards and a truthful project-health dashboard in one open-source toolkit.",
    images: ["/og.png"],
  },
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
