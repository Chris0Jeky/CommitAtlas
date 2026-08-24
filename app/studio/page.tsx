import type { Metadata } from "next";
import StudioClient from "./studio-client";
import { PAGE_ROBOTS, SITE_NAME } from "@/lib/site";

const description =
  "Configure truthful GitHub cards and a project-health dashboard, then copy the exact README Markdown you need.";
const socialTitle = `Studio — ${SITE_NAME}`;

export const metadata: Metadata = {
  // The root layout's title template appends the site name, so this is just the page's own name.
  title: "Studio",
  description,
  alternates: { canonical: "/studio" },
  robots: PAGE_ROBOTS,
  openGraph: {
    // A page-level `openGraph` replaces the layout's rather than merging into it, so `siteName` and
    // `locale` have to be restated here or this page silently loses both.
    siteName: SITE_NAME,
    title: socialTitle,
    description,
    type: "website",
    locale: "en_GB",
    url: "/studio",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "CommitAtlas Studio" }],
  },
  twitter: { card: "summary_large_image", title: socialTitle, description, images: ["/og.png"] },
};

export default function StudioPage() {
  return <StudioClient />;
}
