import type { CiState } from "@commit-atlas/core";
import { STATUS_COLOURS } from "./chassis";

/**
 * The presentation vocabulary for the six CI states.
 *
 * The product rule this file exists to hold is that **an unknown, missing, or stale signal is never
 * displayed as healthy**, and its corollary: colour is never the only encoding. Every state below
 * therefore carries four independent channels —
 *
 *   1. a printed `word`, always visible;
 *   2. a `glyph`, legible at label size;
 *   3. a `lamp` *shape*, distinct in greyscale;
 *   4. a `trace` whose stroke pattern differs from every other trace.
 *
 * Delete the colours and the rack still reads correctly. That is the test.
 *
 * The three "we do not know" states come first deliberately. In a rack sorted by good news they
 * read as leftovers; sorted this way they read as findings, which is what they are.
 */

export type CiLampShape =
  | "plate"
  | "socket"
  | "frozen-clock"
  | "disc"
  | "diamond"
  | "half-disc";

export interface CiTrace {
  /** Primary path, drawn at frame zero. `null` means a flat rule across the full width. */
  path: string | null;
  dash?: string;
  opacity?: number;
  /** Optional continuation drawn dim and dashed — the "still acquiring" tail on `pending`. */
  tail?: { path: string; dash: string; opacity: number };
}

export interface CiStatePresentation {
  state: CiState;
  word: string;
  glyph: string;
  /** `null` where the state is defined by the *absence* of a signal and must not be tinted. */
  colour: string | null;
  /**
   * The same colour as the CSS ink role that renders it.
   *
   * `colour` is the canonical value and is what the contrast tests measure; `cssVar` is what the
   * components paint with, because a light chassis theme re-renders the whole palette darker and a
   * hard-coded hex would survive that swap and become illegible. `null` states fall back to ink.
   */
  cssVar: string;
  lamp: CiLampShape;
  /** True only for `pending`. Acquisition is the one idiom allowed to pulse. */
  pulses: boolean;
  /** Three mono lines, printed under the lamp. Never a tooltip-only explanation. */
  description: readonly [string, string, string];
  trace: CiTrace;
  /** Maps onto the existing Studio dashboard tone classes. */
  tone: "good" | "warn" | "bad" | "unknown";
}

const INK_TRACE = null;

export const CI_STATE_PRESENTATION: Readonly<Record<CiState, CiStatePresentation>> = {
  unavailable: {
    state: "unavailable",
    cssVar: "color-mix(in srgb, var(--ink) 40%, transparent)",
    word: "UNAVAILABLE",
    glyph: "▬",
    colour: null,
    lamp: "plate",
    pulses: false,
    description: ["PROVIDER RETURNED NOTHING.", "NOT ZERO — UNOBSERVED.", "LAMP UNLIT · STEADY · NO PULSE"],
    trace: { path: INK_TRACE, opacity: 0.35 },
    tone: "unknown",
  },
  unconfigured: {
    state: "unconfigured",
    cssVar: "color-mix(in srgb, var(--ink) 40%, transparent)",
    word: "UNCONFIGURED",
    glyph: "□",
    colour: null,
    lamp: "socket",
    pulses: false,
    description: ["NO PROBE FITTED.", "NO NAMED WORKFLOW TO WATCH.", "EMPTY SOCKET · DASHED TRIM"],
    trace: { path: INK_TRACE, dash: "3 5", opacity: 0.25 },
    tone: "unknown",
  },
  stale: {
    state: "stale",
    cssVar: "var(--stale-ink)",
    word: "STALE",
    glyph: "◷",
    colour: STATUS_COLOURS.stale,
    lamp: "frozen-clock",
    pulses: false,
    description: ["LAST OBSERVED >72H AGO.", "WAS PASSING · NO LONGER CLAIMED.", "NEEDLE FROZEN · DOTTED TRACE"],
    trace: { path: "M0,12 L30,12 L44,6 L58,12 L160,12", dash: "5 4", opacity: 0.55 },
    tone: "warn",
  },
  passing: {
    state: "passing",
    cssVar: "var(--pass-ink)",
    word: "PASSING",
    glyph: "✓",
    colour: STATUS_COLOURS.passing,
    lamp: "disc",
    pulses: false,
    description: ["NAMED WORKFLOW GREEN,", "OBSERVED INSIDE 72H.", "LAMP LIT · SOLID TRACE · ✓"],
    trace: { path: "M0,13 L24,13 L34,5 L46,13 L78,13 L90,6 L104,13 L160,13" },
    tone: "good",
  },
  failing: {
    state: "failing",
    cssVar: "var(--fail-ink)",
    word: "FAILING",
    glyph: "✕",
    colour: STATUS_COLOURS.failing,
    lamp: "diamond",
    pulses: false,
    description: ["RED RUN, FRESH EVIDENCE.", "A FACT, NOT A SHAME.", "DIAMOND LAMP · SPIKED TRACE"],
    trace: { path: "M0,13 L36,13 L48,4 L60,15 L72,4 L84,15 L96,13 L160,13" },
    tone: "bad",
  },
  pending: {
    state: "pending",
    cssVar: "var(--pending-ink)",
    word: "PENDING",
    glyph: "◐",
    colour: STATUS_COLOURS.pending,
    lamp: "half-disc",
    pulses: true,
    description: ["RUN IN FLIGHT.", "ACQUIRING — THE ONLY STATE", "ALLOWED TO PULSE. HALF LAMP"],
    trace: {
      path: "M0,13 L40,13 L52,8 L64,13 L104,13",
      tail: { path: "M104,13 L160,13", dash: "2 4", opacity: 0.3 },
    },
    tone: "warn",
  },
};

/** Rack order: the three unknowns first, then the three observations. */
export const CI_RACK_ORDER: readonly CiState[] = [
  "unavailable",
  "unconfigured",
  "stale",
  "passing",
  "failing",
  "pending",
];

export interface CiReading {
  total: number;
  counts: Readonly<Record<CiState, number>>;
  passing: number;
  /** States that carry a fresh, actionable observation. */
  attention: number;
  /** States where nothing was observed at all. Never folded into `passing`. */
  unknown: number;
  /** The single headline line, e.g. `0/2 CI PASSING · 0 ATTENTION · 2 UNCONFIGURED`. */
  headline: string;
}

/**
 * Summarise a set of observed CI signals without ever rounding an unknown towards good news.
 *
 * `attention` counts `failing`, `pending`, and `stale` — states with a fresh observation behind
 * them. `unknown` counts `unavailable` and `unconfigured`, which have none. They are reported
 * separately because collapsing them would let "we never looked" and "we looked and it is fine"
 * share a number.
 */
export function summariseCiStates(states: readonly CiState[]): CiReading {
  const counts: Record<CiState, number> = {
    unavailable: 0,
    unconfigured: 0,
    stale: 0,
    passing: 0,
    failing: 0,
    pending: 0,
  };
  for (const state of states) counts[state] += 1;

  const passing = counts.passing;
  const attention = counts.failing + counts.pending + counts.stale;
  const unknown = counts.unavailable + counts.unconfigured;
  const unknownParts = CI_RACK_ORDER
    .filter((state) => state === "unavailable" || state === "unconfigured")
    .filter((state) => counts[state] > 0)
    .map((state) => `${counts[state]} ${CI_STATE_PRESENTATION[state].word}`);

  const headline = [
    `${passing}/${states.length} CI PASSING`,
    `${attention} ATTENTION`,
    ...(unknownParts.length > 0 ? unknownParts : []),
  ].join(" · ");

  return { total: states.length, counts, passing, attention, unknown, headline };
}
