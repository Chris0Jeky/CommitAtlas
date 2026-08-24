import { fetchPortfolioSnapshot } from "./portfolio";
import type { PortfolioSnapshot, ProjectLifecycle } from "./github/types";
import { buildStudioRouteUrl, type StudioCardKind, type StudioRouteOptions } from "@/app/studio/studio-urls";
import { compactCount } from "./instruments";

/**
 * The landing page's data contract.
 *
 * The page renders the *same* snapshot the SVG routes render, through the same `fetchPortfolioSnapshot`
 * call, in demo mode. That is the point: the instrument fascia, the health rack, and the evidence
 * drawer are not a mock-up of what the product measures — they are the product measuring, with the
 * numbers printed as text beside every instrument.
 *
 * Demo mode makes no network request at all, so this costs one synchronous computation per render
 * and cannot fail on a rate limit, which is what makes it safe to put on the front page.
 */

export const LANDING_OWNER = "octocat";
export const LANDING_DAYS = 365;

/**
 * Two declared projects with **no named workflow**, and deliberately so.
 *
 * The page could configure a workflow and light two lamps green. It does not, because the honest
 * default for a repository nobody has told CommitAtlas how to watch is `unconfigured` — and the
 * front page is exactly where that should be visible rather than hidden behind a happier demo.
 */
export const LANDING_PROJECTS: readonly { repo: string; lifecycle: ProjectLifecycle }[] = [
  { repo: "Hello-World", lifecycle: "active" },
  { repo: "Spoon-Knife", lifecycle: "maintenance" },
];

export const LANDING_OPTIONS: StudioRouteOptions = {
  owner: LANDING_OWNER,
  theme: "ember",
  demo: true,
  days: LANDING_DAYS,
  motion: "subtle",
  layout: "wide",
  projects: LANDING_PROJECTS.map((project) => ({ repo: project.repo, lifecycle: project.lifecycle })),
};

const COMPACT_OPTIONS: StudioRouteOptions = { ...LANDING_OPTIONS, layout: "compact" };

export function landingCardUrl(kind: StudioCardKind, options: StudioRouteOptions = LANDING_OPTIONS): string {
  return buildStudioRouteUrl(kind, options);
}

export function landingCompactAtlasUrl(): string {
  return buildStudioRouteUrl("atlas", COMPACT_OPTIONS);
}

export function landingThemedAtlasUrl(theme: string): string {
  return buildStudioRouteUrl("atlas", { ...LANDING_OPTIONS, theme });
}

/** Resolve the deterministic synthetic snapshot the whole landing page is built from. */
export function landingSnapshot(): Promise<PortfolioSnapshot> {
  return fetchPortfolioSnapshot({
    user: LANDING_OWNER,
    days: LANDING_DAYS,
    demo: true,
    repositories: LANDING_PROJECTS.map((project) => project.repo),
    lifecycles: new Map(LANDING_PROJECTS.map((project) => [project.repo.toLowerCase(), project.lifecycle])),
  });
}

export interface SpecimenCard {
  kind: StudioCardKind;
  /** `CARD 02 // PROFILE` — the specimen number is stable, so a reader can cite one. */
  number: string;
  name: string;
  /** Human title, also used for the accessible link name. */
  title: string;
  /** What the card is for, in product language. Read by the rendered-page test. */
  purpose: string;
  /** `860×380 FIXED` or `RESPONSIVE`. */
  size: string;
  /** The one-line honesty note printed in the plate footer. */
  note: string;
  width: number;
  height: number;
  compact?: true;
}

/**
 * The specimen tray.
 *
 * The frame does the work; the SVG inside is never restyled. Each plate states the route's own
 * constraint in its footer, because the constraint *is* the feature — a card that cannot run script
 * and cannot reach an external origin is the reason it is safe to paste into a README.
 */
export function specimenCards(snapshot: PortfolioSnapshot): readonly SpecimenCard[] {
  const { profile, metrics } = snapshot;
  return [
    {
      kind: "atlas",
      number: "CARD 01",
      name: "ATLAS COMPACT",
      title: "Developer atlas, compact",
      purpose: "The full atlas in a 480×570 portrait plate, for a README column that has no room to run wide.",
      size: "480×570 FIXED",
      note: "MOBILE README",
      width: 480,
      height: 570,
      compact: true,
    },
    {
      kind: "profile",
      number: "CARD 02",
      name: "PROFILE",
      title: "Profile snapshot",
      purpose: "Public repository, follower, contribution, and star signals at a glance.",
      size: "RESPONSIVE",
      note: `${profile.publicRepositories} REPOS · ${compactCount(profile.followers)} FOLLOWERS · ${compactCount(profile.stars)} STARS`,
      width: 720,
      height: 190,
    },
    {
      kind: "streak",
      number: "CARD 03",
      name: "STREAK",
      title: "Contribution streak",
      purpose: "Current and longest observed streaks with an honest history boundary.",
      size: "RESPONSIVE",
      note: "WINDOW-BOUNDED · NO GUILT",
      width: 720,
      height: 180,
    },
    {
      kind: "breakdown",
      number: "CARD 04",
      name: "BREAKDOWN",
      title: "Contribution breakdown",
      purpose: "Exact categorized counts when available; otherwise clearly labelled public-profile percentages.",
      size: "RESPONSIVE",
      note: "EXACT COUNTS OR LABELLED PROFILE %",
      width: 720,
      height: 220,
    },
    {
      kind: "rhythm",
      number: "CARD 05",
      name: "RHYTHM",
      title: "Personal rhythm",
      purpose: "Transparent personal consistency based on density and streak — not a GitHub rank.",
      size: "RESPONSIVE",
      note: `${metrics.rhythm.score}/100 · NOT A RANK`,
      width: 720,
      height: 220,
    },
    {
      kind: "activity",
      number: "CARD 06",
      name: "ACTIVITY",
      title: "Activity map",
      purpose: "A compact calendar view of public contribution density over time.",
      size: "RESPONSIVE",
      note: "EXACT DATE WINDOW",
      width: 720,
      height: 220,
    },
    {
      kind: "languages",
      number: "CARD 07",
      name: "LANGUAGES",
      title: "Language mix",
      purpose: "Public repository-language distribution, presented without proficiency claims.",
      size: "RESPONSIVE",
      // The design bundle's specimen note read "BYTE SHARE". This route is fed by the profile
      // snapshot, whose `share` is a distribution over repositories, not over bytes — see
      // `toLanguagesCard`. Printing the wrong basis on a card whose whole point is that it makes no
      // proficiency claim would be the exact failure this product exists to avoid.
      note: "REPOSITORY SHARE · NOT PROFICIENCY",
      width: 720,
      height: 230,
    },
    {
      kind: "projects",
      number: "CARD 08",
      name: "PROJECTS",
      title: "Project signals",
      purpose: "Declared lifecycle and project signals for Hello-World and Spoon-Knife.",
      size: "RESPONSIVE",
      note: "SIX HEALTH STATES · UNKNOWN ≠ FINE",
      width: 720,
      height: 158,
    },
  ];
}

/** The four SVG card themes, unchanged by the chassis. `paper` ships for light README embeds. */
export const CARD_THEMES: readonly { id: string; label: string; ground: string; light?: true }[] = [
  { id: "aurora", label: "AURORA · #09131F", ground: "#09131f" },
  { id: "midnight", label: "MIDNIGHT · #05070D", ground: "#05070d" },
  { id: "paper", label: "PAPER · #F8FAFC · ON LIMESTONE", ground: "#e8ecd6", light: true },
  { id: "ember", label: "EMBER · #0D1117 · DEFAULT", ground: "#0d1117" },
];
