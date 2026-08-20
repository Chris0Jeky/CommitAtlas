import type { Metadata } from "next";
import StudioClient from "./studio-client";

export const metadata: Metadata = {
  title: "Studio — CommitAtlas",
  description: "Configure truthful GitHub cards and a project-health dashboard, then copy the exact README Markdown you need.",
};

export default function StudioPage() {
  return <StudioClient />;
}
