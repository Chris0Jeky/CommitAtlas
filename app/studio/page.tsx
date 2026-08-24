import type { Metadata } from "next";
import StudioClient from "./studio-client";
import { SITE_NAME } from "@/lib/site";

const description =
  "Configure truthful GitHub cards and a project-health dashboard, then copy the exact README Markdown you need.";

export const metadata: Metadata = {
  // The root layout's title template appends the site name, so this is just the page's own name.
  title: "Studio",
  description,
  alternates: { canonical: "/studio" },
  openGraph: {
    title: `Studio — ${SITE_NAME}`,
    description,
    type: "website",
    url: "/studio",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "CommitAtlas Studio" }],
  },
  twitter: { card: "summary_large_image", title: `Studio — ${SITE_NAME}`, description, images: ["/og.png"] },
};

export default function StudioPage() {
  return <StudioClient />;
}
