import type { PortfolioSnapshot } from "./github/types";
import { compactCount, signedPercent } from "./instruments";
import { summariseCiStates } from "./health";

/**
 * The evidence layer: every number on the page can answer "how do you know that".
 *
 * CommitAtlas already refuses to paint an unknown signal green. This is the same rule applied one
 * level up — a number that is *counted* and a number that is *inferred* look different, are
 * labelled differently, and carry their own caveat. Three rungs, never a fourth:
 *
 * - `observed`   — it is in the data. Counted, not modelled.
 * - `derived`    — it follows from the data by a stated formula. The formula is printed.
 * - `hypothesis` — CommitAtlas chose it. A band, a threshold, or a proxy. Labelled as a guess and
 *                  given dashed trim everywhere it appears.
 *
 * A tier is never a fixed property of a metric. The activity mix is `observed` when GitHub returns
 * exact categorised counts and `hypothesis` when the only available source is the annual
 * public-profile percentages, because those describe a year this window does not cover. That
 * distinction already exists inside `ContributionMetrics.breakdownBasis`; this file is where it
 * becomes visible to a reader.
 */

export const EVIDENCE_TIERS = ["observed", "derived", "hypothesis"] as const;
export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];

export interface EvidenceTierPresentation {
  tier: EvidenceTier;
  /** `ORDER 1 · OBSERVED ●` */
  order: number;
  word: string;
  glyph: string;
  claim: string;
  colour: string;
  /** Dot fill style, the second of three independent encodings. */
  dot: "solid" | "half" | "dashed";
  /** Border style, the third. */
  border: "solid" | "solid-soft" | "dashed";
}

export const EVIDENCE_TIER_PRESENTATION: Readonly<Record<EvidenceTier, EvidenceTierPresentation>> = {
  observed: {
    tier: "observed",
    order: 1,
    word: "OBSERVED",
    glyph: "●",
    claim: "THIS IS IN THE DATA",
    colour: "#58e6be",
    dot: "solid",
    border: "solid",
  },
  derived: {
    tier: "derived",
    order: 2,
    word: "DERIVED",
    glyph: "◍",
    claim: "THIS FOLLOWS FROM THE DATA",
    colour: "#b89bff",
    dot: "half",
    border: "solid-soft",
  },
  hypothesis: {
    tier: "hypothesis",
    order: 3,
    word: "HYPOTHESIS",
    glyph: "○",
    claim: "THIS IS A GUESS — LABELLED AS ONE",
    colour: "#edf0e2",
    dot: "dashed",
    border: "dashed",
  },
};

export interface EvidenceRecord {
  /** Stable identity. The drawer opens by id, so it must not change between renders. */
  id: string;
  /** What the number is, in sentence case: `active days`. */
  label: string;
  /** The number exactly as it is printed on the page. */
  value: string;
  tier: EvidenceTier;
  /** The named rule that produced it, in the project's own vocabulary. */
  rule: string;
  /** Where it came from. Always names the window and the source. */
  basis: string;
  /** Printed in mono. `null` for `observed` values, which have no formula to show. */
  formula: string | null;
  /** What this number cannot see. Never omitted, never softened. */
  caveat: string;
}

export interface EvidenceSet {
  /** `SYNTHETIC OCTOCAT`, `PUBLIC GITHUB`, `PUBLIC PROFILE`. */
  sourceLabel: string;
  /** One line, printed in the drawer footer. */
  coverage: string;
  records: readonly EvidenceRecord[];
  byId: Readonly<Record<string, EvidenceRecord>>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** `18 Feb 2026`, in UTC, because every window boundary in this product is a UTC day. */
export function formatUtcDate(date: string): string {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parsed) return date;
  const [, year, month, day] = parsed;
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

export function formatUtcRange(from: string, to: string): string {
  return `${formatUtcDate(from)} — ${formatUtcDate(to)}`;
}

function sourceLabelFor(snapshot: PortfolioSnapshot): string {
  if (snapshot.freshness.mode === "demo") return "SYNTHETIC OCTOCAT";
  return snapshot.freshness.source === "github-profile-html" ? "PUBLIC PROFILE" : "PUBLIC GITHUB";
}

function sourceSentenceFor(snapshot: PortfolioSnapshot): string {
  if (snapshot.freshness.mode === "demo") {
    return "Counted from the deterministic synthetic calendar this page renders — no GitHub request is made.";
  }
  return snapshot.freshness.source === "github-profile-html"
    ? "Counted from the public profile page GitHub serves anonymously."
    : "Counted from GitHub's public contribution calendar for this handle.";
}

/**
 * Build the evidence set for a rendered portfolio snapshot.
 *
 * Every record describes a reading this product shows *somewhere* — on the page, or inside one of
 * the cards, which are SVG and cannot host a button. `LANDING_EVIDENCE_IDS` in `lib/landing.ts` is
 * the subset the landing page wires to a trigger, and `rendered-html.test.mjs` holds the served
 * HTML to exactly that set. An earlier version of this comment claimed the tests enforced a
 * two-way correspondence between records and printed numbers; they did not, and the page was
 * printing a count of 17 while wiring 10.
 */
export function buildEvidence(snapshot: PortfolioSnapshot): EvidenceSet {
  const { metrics, profile, contributions, projects } = snapshot;
  const window = `${metrics.window.days}-day window (${formatUtcRange(metrics.window.from, metrics.window.to)})`;
  const source = sourceSentenceFor(snapshot);
  const exactMix = metrics.breakdownBasis === "exact-counts";
  const ciStates = (projects?.projects ?? []).map((project) => project.ci.state);
  const reading = summariseCiStates(ciStates);

  const records: EvidenceRecord[] = [
    {
      id: "contributions",
      label: "contributions",
      value: compactCount(metrics.total),
      tier: "observed",
      rule: "contribution-total-observed",
      basis: `${metrics.total.toLocaleString("en-GB")} contributions summed across the ${window}. ${source}`,
      formula: null,
      caveat:
        "Public contributions only. Private repositories, local commits, and work under another identity are unobserved — missing is never zero, so this describes the visible trail rather than the person.",
    },
    {
      id: "active-days",
      label: "active days",
      value: String(metrics.activeDays),
      tier: "observed",
      rule: "contribution-days-observed",
      basis: `${metrics.activeDays} of the ${metrics.window.days} days in the window carried at least one public contribution. ${source}`,
      formula: null,
      caveat:
        "A day with one contribution and a day with forty both count once here. Volume is reported separately, by the peak and average.",
    },
    {
      id: "density",
      label: "active-day density",
      value: `${metrics.density}%`,
      tier: "derived",
      rule: "density-derived",
      basis: `${metrics.activeDays} active days over the ${window}.`,
      formula: `active_days / window_days × 100 — ${metrics.activeDays} / ${metrics.window.days} × 100 = ${metrics.density}%`,
      caveat:
        "Density measures how often work was visible, not how much there was. A short window flatters a steady week and punishes a deliberate break.",
    },
    {
      id: "average-per-day",
      label: "contributions per day",
      value: metrics.averagePerDay.toFixed(2),
      tier: "derived",
      rule: "average-derived",
      basis: `${metrics.total.toLocaleString("en-GB")} contributions over the ${window}, including days with none.`,
      formula: `total / window_days — ${metrics.total} / ${metrics.window.days} = ${metrics.averagePerDay}`,
      caveat:
        `Averaged across every day, not only active ones. The active-day average is ${metrics.averagePerActiveDay}, and the two answer different questions.`,
    },
    {
      id: "momentum",
      label: "28-day momentum",
      value: String(metrics.trend.recent28Days),
      tier: "observed",
      rule: "momentum-window-observed",
      basis: `${metrics.trend.recent28Days} contributions in the most recent 28 days of the window. ${source}`,
      formula: null,
      caveat:
        "A 28-day count, not a rate and not a projection. It says what happened, and nothing about what happens next.",
    },
    {
      id: "momentum-change",
      label: "momentum change",
      value: signedPercent(metrics.trend.changePercent),
      tier: "derived",
      rule: "momentum-change-derived",
      basis: metrics.trend.previous28Days === null
        ? "The window is shorter than 56 days, so there is no prior 28-day period to compare against. CommitAtlas reports no change rather than assuming one."
        : `${metrics.trend.recent28Days} contributions in the recent 28 days against ${metrics.trend.previous28Days} in the 28 before them.`,
      // Never `null`. A derived reading with no working shown would put a DERIVED pill reading
      // "this follows from the data" over a value of `—` with nothing behind it, which is the one
      // combination this layer exists to prevent. When there is no prior period, the formula states
      // the requirement that was not met.
      formula: metrics.trend.previous28Days === null
        ? `(recent − previous) / previous × 100 — needs a 56-day window; this one is ${metrics.window.days} days, so there is no prior period`
        : `(recent − previous) / previous × 100 — (${metrics.trend.recent28Days} − ${metrics.trend.previous28Days}) / ${metrics.trend.previous28Days} × 100 = ${signedPercent(metrics.trend.changePercent)}`,
      caveat:
        "Two adjacent four-week counts. One holiday, one release week, or one week of private work moves this number more than any change in habit would.",
    },
    {
      id: "rhythm",
      label: "rhythm score",
      value: `${metrics.rhythm.score}/100`,
      tier: "derived",
      rule: "rhythm-derived",
      basis: `Active-day density of ${metrics.density}% and a current streak of ${metrics.streak.current} ${metrics.streak.current === 1 ? "day" : "days"}, both measured inside the ${window}.`,
      formula: `min(1, density / 80) × 70 + min(1, streak / 30) × 30 = ${metrics.rhythm.score}`,
      caveat:
        "A personal consistency reading, not a GitHub rank and not a percentile. Nobody else's score is an input, so it cannot place you against anyone.",
    },
    {
      id: "rhythm-level",
      label: "rhythm level",
      value: metrics.rhythm.level,
      tier: "hypothesis",
      rule: "rhythm-band-hypothesis",
      basis: `The score of ${metrics.rhythm.score} falls in the band CommitAtlas names "${metrics.rhythm.level}".`,
      formula: "≥80 relentless · ≥60 strong · ≥40 steady · ≥20 building · else starting",
      caveat:
        "The bands are a CommitAtlas invention. Nothing in GitHub's data says where \"steady\" ends and \"strong\" begins, so the word is a label on a threshold, not a finding.",
    },
    {
      id: "current-streak",
      label: "current streak",
      value: `${metrics.streak.current}`,
      tier: "observed",
      rule: "streak-observed",
      basis: `${metrics.streak.current} consecutive active ${metrics.streak.current === 1 ? "day" : "days"} ending ${formatUtcDate(metrics.window.to)}. ${source}`,
      formula: null,
      caveat: metrics.streak.boundary.current === "open"
        ? "The streak reaches the first day of the window, so it may have started earlier than CommitAtlas can see. It is a floor, not a total."
        : "Bounded by the requested window. A longer window can only lengthen this number, never shorten it.",
    },
    {
      id: "longest-streak",
      label: "longest streak",
      value: `${metrics.streak.longest}`,
      tier: "observed",
      rule: "streak-observed",
      basis: `The longest run of consecutive active days inside the ${window}. ${source}`,
      formula: null,
      caveat:
        "Window-bounded, and deliberately so. CommitAtlas does not fetch history it was not asked for, so a longer run before this window is unobserved rather than absent.",
    },
    {
      id: "peak-day",
      label: "peak day",
      value: String(metrics.peakDay.count),
      tier: "observed",
      rule: "peak-observed",
      basis: `${metrics.peakDay.count} contributions on ${formatUtcDate(metrics.peakDay.date)}, the busiest observed day in the window. ${source}`,
      formula: null,
      caveat: "Ties resolve to the earliest date, so a repeated peak reports the first time it happened.",
    },
    {
      id: "mix",
      label: "activity mix",
      value: `${compactCount(metrics.breakdown.commits)} / ${compactCount(metrics.breakdown.pullRequests)} / ${compactCount(metrics.breakdown.reviews)} / ${compactCount(metrics.breakdown.issues)}`,
      tier: exactMix ? "observed" : "hypothesis",
      rule: exactMix ? "activity-mix-observed" : "profile-percentage-proxy",
      basis: exactMix
        ? `Exact categorised counts for the ${window}: ${metrics.breakdown.commits} commits, ${metrics.breakdown.pullRequests} pull requests, ${metrics.breakdown.reviews} reviews, ${metrics.breakdown.issues} issues. ${source}`
        : `GitHub's public profile page publishes an annual activity split as percentages, not counts. Those percentages are all that is available without a credential, and they are what is shown.`,
      formula: exactMix ? null : "annual public-profile percentage ≠ requested-window count",
      caveat: exactMix
        ? "Categories come from GitHub's own classification. A commit pushed to someone else's fork and a commit on your default branch are counted the same way."
        : "These are percentages of a whole year, applied to a window that is not a year. They describe the shape of a year's work, and CommitAtlas labels them so rather than presenting them as counts for this window.",
    },
    {
      id: "repositories",
      label: "public repositories",
      value: String(profile.publicRepositories),
      tier: "observed",
      rule: "profile-observed",
      basis: `GitHub reports ${profile.publicRepositories} public repositories for @${profile.login}. ${source}`,
      formula: null,
      caveat: "Public repositories only. Forks are included exactly as GitHub counts them.",
    },
    {
      id: "followers",
      label: "followers",
      value: compactCount(profile.followers),
      tier: "observed",
      rule: "profile-observed",
      basis: `GitHub reports ${profile.followers.toLocaleString("en-GB")} followers for @${profile.login}. ${source}`,
      formula: null,
      caveat: "A follower count measures reach, not reception. It is reported because it is observed, not because it is a quality signal.",
    },
    {
      id: "stars",
      label: "stars",
      value: compactCount(profile.stars),
      // A summed total is a derivation, not an observation: GitHub reports stars per repository,
      // never a per-account figure. Calling it observed would be the same category error the
      // activity mix avoids.
      tier: profile.repositoriesTruncated ? "hypothesis" : "derived",
      rule: profile.repositoriesTruncated ? "star-total-truncated" : "star-total-derived",
      basis: profile.repositoriesTruncated
        ? "GitHub truncated the public repository list, so this total covers only the page that was returned."
        : `Summed across every public repository GitHub returned for @${profile.login}. ${source}`,
      formula: profile.repositoriesTruncated ? "sum over a truncated repository page" : "Σ stargazers over public repositories",
      caveat: profile.repositoriesTruncated
        ? "A truncated list makes this a lower bound, not a total. CommitAtlas withholds the figure from cards rather than presenting a partial sum as complete."
        : "Stars accumulate and never decay, so this favours older work over recent work.",
    },
    {
      id: "languages",
      label: "language share",
      value: profile.primaryLanguages[0]
        ? `${profile.primaryLanguages[0].name} ${profile.primaryLanguages[0].share}%`
        : "—",
      tier: "derived",
      rule: "language-share-derived",
      basis: profile.primaryLanguages.length > 0
        ? `${profile.primaryLanguages.length} languages across the public repositories GitHub returned for @${profile.login}, ranked by share. ${source}`
        : "GitHub returned no public repository languages for this handle.",
      formula: "repository_language_share — the declared primary language of each public repository",
      caveat:
        "A share of repositories, not a claim about proficiency and not a measure of time spent. A generated file and a hand-written one weigh the same to GitHub.",
    },
    {
      id: "ci-passing",
      label: "CI passing",
      value: `${reading.passing}/${reading.total}`,
      tier: "observed",
      rule: "ci-state-observed",
      basis: reading.total === 0
        ? "No projects are declared on this page, so there is no CI evidence to report."
        : `${reading.headline}. Each state comes from calculateCiState() against a 72-hour freshness window.`,
      formula: null,
      caveat:
        "Only projects you declare are watched, and only a named workflow is read. An unconfigured project is shown as unconfigured — never as passing, and never as failing.",
    },
  ];

  return {
    sourceLabel: sourceLabelFor(snapshot),
    coverage: `COVERAGE: ${records.length} DIMENSIONS · ${contributions.days.length}-DAY PUBLIC WINDOW · "EVERY NUMBER SHOULD KNOW WHAT IT CANNOT SEE"`,
    records,
    byId: Object.fromEntries(records.map((record) => [record.id, record])),
  };
}

/**
 * The three ladder rungs, each illustrated with a real reading from this snapshot.
 *
 * The ladder is a legend, not a leaderboard: it exists so a reader can learn the vocabulary once
 * and then recognise it on every number. It therefore always shows all three rungs, including the
 * hypothesis rung — a system that only names its guesses when it happens to have made one teaches
 * nobody to look for them.
 */
export function evidenceLadder(evidence: EvidenceSet): readonly EvidenceRecord[] {
  return EVIDENCE_TIERS.map((tier) => evidence.records.find((record) => record.tier === tier))
    .filter((record): record is EvidenceRecord => record !== undefined);
}
