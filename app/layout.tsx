import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const siteUrl = "https://commitatlas.jeky-tck.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "CommitAtlas — GitHub portfolio signals, mapped clearly",
  description: "Create beautiful GitHub contribution cards and a trustworthy project-status dashboard from one open-source toolkit.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "CommitAtlas — GitHub portfolio signals, mapped clearly",
    description: "Accessible GitHub cards and a truthful project-health dashboard in one open-source toolkit.",
    type: "website",
    url: "/",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "CommitAtlas GitHub portfolio dashboard" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
