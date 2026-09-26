import type { ObservatoryRoute } from "./observatory-route";

/**
 * Guarded calls into the Pulseboard SDK v3 (`public/pulseboard.js`, loaded with `defer` by the root layout).
 *
 * The SDK may be absent (blocked, not yet executed, a local preview), so every call here is optional and
 * total: it returns `false` instead of throwing, and product code never waits on it. Props are built only
 * from closed enums, counts and flags. Handles, repository names and URLs a visitor types are identity
 * or free text and never reach this module's inputs.
 */

type PulseboardApi = {
  route?: (name: string) => boolean;
  count?: (event: string) => boolean;
  track?: (name: string, props?: Record<string, unknown>) => boolean;
};

export const PULSEBOARD_CARD_THEMES = ["ember", "aurora", "midnight", "paper"] as const;
export type PulseboardCardTheme = (typeof PULSEBOARD_CARD_THEMES)[number] | "other";

export const PULSEBOARD_REPO_COUNT_BUCKETS = ["0", "1-9", "10-49", "50-99", "100+", "unknown"] as const;
export type PulseboardRepoCountBucket = (typeof PULSEBOARD_REPO_COUNT_BUCKETS)[number];

export type PulseboardEvent =
  | { name: "studio.opened"; props: Record<string, never> }
  | { name: "card.exported"; props: { format: "markdown"; theme: PulseboardCardTheme; cards: number } }
  | {
      name: "profile.loaded";
      props: { repoCountBucket: PulseboardRepoCountBucket; source: "synthetic" | "live"; projects: number; contributions: boolean };
    };

/** The events registered as aggregate counts for `commitatlas` in Pulseboard `observatory/src/projects.mjs`. */
const COUNTED_EVENTS: ReadonlySet<string> = new Set(["studio.opened", "card.exported"]);

function sdk(scope: unknown = globalThis): PulseboardApi | undefined {
  try {
    const candidate = (scope as { Pulseboard?: unknown } | null | undefined)?.Pulseboard;
    return candidate && typeof candidate === "object" ? (candidate as PulseboardApi) : undefined;
  } catch {
    return undefined;
  }
}

/** True once the deferred SDK script has defined `window.Pulseboard`. */
export function pulseboardPresent(scope: unknown = globalThis): boolean {
  return sdk(scope) !== undefined;
}

/**
 * Runs `action` now when the SDK is present or the page has finished loading, else once on the window
 * `load` event (deferred scripts have executed by then). Returns a cleanup that cancels a pending run.
 */
export function whenPulseboardReady(action: () => void, scope: unknown = globalThis): () => void {
  try {
    const win = scope as Window;
    if (pulseboardPresent(scope) || win.document?.readyState === "complete" || typeof win.addEventListener !== "function") {
      action();
      return () => {};
    }
    const run = () => { action(); };
    win.addEventListener("load", run, { once: true });
    return () => win.removeEventListener("load", run);
  } catch {
    return () => {};
  }
}

/** Records a navigation to a route bucket. Returns false when the SDK is absent or refuses it. */
export function pulseboardRoute(route: ObservatoryRoute, scope: unknown = globalThis): boolean {
  try {
    return sdk(scope)?.route?.(route) === true;
  } catch {
    return false;
  }
}

/**
 * Records a product event: an aggregate count when the name is in the registered count vocabulary, and a
 * journeys event with its bounded props. Returns true when either was queued.
 */
export function pulseboardEvent(event: PulseboardEvent, scope: unknown = globalThis): boolean {
  const api = sdk(scope);
  if (!api) return false;
  let queued = false;
  try {
    if (COUNTED_EVENTS.has(event.name)) queued = api.count?.(event.name) === true;
  } catch { /* Counting is best effort. */ }
  try {
    queued = api.track?.(event.name, { ...event.props }) === true || queued;
  } catch { /* Journeys are best effort. */ }
  return queued;
}

/** Folds a theme select value into the closed card-theme enum. */
export function pulseboardCardTheme(theme: string): PulseboardCardTheme {
  return (PULSEBOARD_CARD_THEMES as readonly string[]).includes(theme) ? (theme as PulseboardCardTheme) : "other";
}

/** Buckets a public repository count so a profile cannot be singled out by its exact size. */
export function pulseboardRepoCountBucket(count: number | null | undefined): PulseboardRepoCountBucket {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return "unknown";
  if (count === 0) return "0";
  if (count < 10) return "1-9";
  if (count < 50) return "10-49";
  if (count < 100) return "50-99";
  return "100+";
}

/** Clamps a small count (cards, projects) to a non-negative integer no larger than `max`. */
export function pulseboardSmallCount(value: number, max = 32): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.trunc(value))) : 0;
}
