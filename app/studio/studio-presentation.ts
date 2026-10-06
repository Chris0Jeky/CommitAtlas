import { ALLOWED_LINK_HOSTS, ProjectLinksSchema } from "@/packages/core/src/index";
import { isStudioCardAvailable, type StudioCardAvailability } from "./studio-card-availability";
import { STUDIO_CARD_KINDS } from "./studio-markdown";
import type { StudioCardKind } from "./studio-urls";

export interface StudioGalleryCard {
  kind: StudioCardKind;
  title: string;
  purpose: string;
  dimensions: string;
  span: "full" | "half";
  compact: boolean;
}

const STUDIO_GALLERY_CARDS: Readonly<Record<StudioCardKind, Omit<StudioGalleryCard, "kind" | "dimensions"> & { dimensions: string }>> = {
  atlas: {
    title: "Developer atlas",
    purpose: "A responsive overview of contribution rhythm, activity, languages, and project health.",
    dimensions: "860 × 380 · 480 × 570 compact",
    span: "full",
    compact: false,
  },
  profile: {
    title: "Profile snapshot",
    purpose: "Public repository, follower, contribution, and star signals at a glance.",
    dimensions: "720 × 190–220 adaptive",
    span: "full",
    compact: false,
  },
  streak: {
    title: "Contribution streak",
    purpose: "Current and longest observed streaks with an honest history boundary.",
    dimensions: "720 × 180",
    span: "full",
    compact: false,
  },
  breakdown: {
    title: "Contribution breakdown",
    purpose: "Exact categorized counts when available; otherwise clearly labelled public-profile percentages.",
    dimensions: "720 × 220",
    span: "full",
    compact: false,
  },
  rhythm: {
    title: "Personal rhythm",
    purpose: "Transparent personal consistency based on density and streak — not a GitHub rank.",
    dimensions: "720 × 220",
    span: "full",
    compact: false,
  },
  activity: {
    title: "Activity map",
    purpose: "A compact calendar view of public contribution density over time.",
    dimensions: "720 × 220",
    span: "full",
    compact: false,
  },
  languages: {
    title: "Language mix",
    purpose: "Public repository-language distribution, presented without proficiency claims.",
    dimensions: "720 × 230",
    span: "full",
    compact: false,
  },
  projects: {
    title: "Project signals",
    purpose: "Declared lifecycle, named-workflow CI, release, and repository signals.",
    dimensions: "720 × adaptive",
    span: "full",
    compact: false,
  },
};

export function buildStudioGalleryCards(options: {
  selectedCards: ReadonlySet<StudioCardKind>;
  availability: StudioCardAvailability;
  projectCount: number;
}): StudioGalleryCard[] {
  return STUDIO_CARD_KINDS
    .filter((kind) => options.selectedCards.has(kind))
    .filter((kind) => isStudioCardAvailable(kind, options.availability))
    .filter((kind) => kind !== "projects" || options.projectCount > 0)
    .map((kind) => {
      const card = STUDIO_GALLERY_CARDS[kind];
      const rows = Math.max(1, Math.ceil(Math.min(6, options.projectCount) / 2));
      return {
        kind,
        ...card,
        dimensions: kind === "projects" ? `720 × ${68 + rows * 90}` : card.dimensions,
      };
    });
}

export function studioSourceLabel(source: string): string {
  if (source === "synthetic-demo") return "Synthetic demo";
  if (source === "public-profile" || source === "github-profile-html") return "Public profile";
  if (source === "public-github" || source === "github-rest" || source === "github-graphql") return "Public GitHub";
  return "Source unavailable";
}

export interface StarterCiPresentation {
  label: "Not configured" | "Preview required";
  tone: "unknown";
  /**
   * The six-state vocabulary word for a row nobody has previewed yet.
   *
   * A project with no named workflow is `unconfigured` — that is exactly what the API would say
   * about it. A project that names one but has not been observed is `unavailable`: something could
   * be watched and nothing has been, which is a different claim from "there is nothing to watch".
   * Neither is tinted, and the printed label says which it is.
   */
  state: "unconfigured" | "unavailable";
  workflowLabel: string;
}

export function starterCiPresentation(workflow: string): StarterCiPresentation {
  const configuredWorkflow = workflow.trim();
  return configuredWorkflow
    ? { label: "Preview required", tone: "unknown", state: "unavailable", workflowLabel: configuredWorkflow }
    : { label: "Not configured", tone: "unknown", state: "unconfigured", workflowLabel: "Not configured" };
}

export function activityBarPercent(count: number, maximum: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const safeMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 1;
  return Math.min(100, Math.max(8, (count / safeMaximum) * 100));
}

export function contributionMetricLabel(returnedDays: number | null): string {
  return returnedDays === null ? "Contributions" : `Contributions · ${returnedDays}d`;
}

export function contributionWindowLabel(returnedDays: number, activityDays: number): string {
  return `${activityDays}-day activity · ${returnedDays}-day total`;
}

export function visibleProfileStars(stars: number, repositoriesTruncated: boolean): number | null {
  return repositoriesTruncated ? null : stars;
}

export function findProjectDraft<T extends { repo: string }>(
  drafts: readonly T[],
  repositoryName: string,
): T | undefined {
  const expected = repositoryName.trim().toLowerCase();
  return drafts.find((draft) => draft.repo.trim().toLowerCase() === expected);
}

export function safeProjectActionUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = ProjectLinksSchema.safeParse({ docs: value });
  if (!parsed.success || !parsed.data.docs) return null;
  return new URL(parsed.data.docs).toString();
}

export interface ProjectActionPresentation {
  /** Trimmed typed value ("" when the field is empty). Always kept so invalid input stays visible. */
  raw: string;
  /** Normalized HTTPS URL when the value passes the shared link boundary, otherwise null. */
  href: string | null;
  /** Inline field message when a non-empty value fails validation, otherwise null. */
  error: string | null;
}

/**
 * Validation message for a non-empty project action value that failed
 * `safeProjectActionUrl`. Empty values have no message; valid values are null.
 */
export function projectActionUrlError(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (safeProjectActionUrl(raw)) return null;
  let parsed: URL | null = null;
  try {
    parsed = new URL(raw);
  } catch {
    return "Enter a valid HTTPS URL on an allowed host.";
  }
  if (parsed.protocol !== "https:") return "Use an HTTPS URL on an allowed host.";
  if (parsed.username || parsed.password) return "Use an HTTPS URL on an allowed host.";
  const host = parsed.hostname.toLowerCase();
  if (!(ALLOWED_LINK_HOSTS as readonly string[]).includes(host)) {
    return "Use an HTTPS URL on an allowed host.";
  }
  return "Use an HTTPS URL on an allowed host.";
}

/**
 * Presentation for one Docs/Install/Download draft value. Valid values
 * normalize to `href`; non-empty invalid values keep `raw` with an `error`
 * message instead of being dropped silently; empty values stay empty.
 */
export function describeProjectActionUrl(value: string | null | undefined): ProjectActionPresentation {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { raw: "", href: null, error: null };
  const href = safeProjectActionUrl(raw);
  if (href) return { raw, href, error: null };
  return { raw, href: null, error: projectActionUrlError(raw) };
}
