import type { StudioCardKind } from "./studio-urls";

export interface StudioCardAvailability {
  demo: boolean;
  hasCurrentContributions: boolean;
  hasCurrentLanguages: boolean;
}

export function isStudioCardAvailable(
  kind: StudioCardKind,
  availability: StudioCardAvailability,
): boolean {
  if (availability.demo) return true;
  if (kind === "languages") return availability.hasCurrentLanguages;
  if (kind === "profile" || kind === "projects") return true;
  return availability.hasCurrentContributions;
}

/**
 * True while the most recent preview request for the *current* configuration has
 * not produced a validated result — it is still in flight, or it failed.
 *
 * A retry of an unchanged configuration keeps the previously validated payload on
 * screen, so the configuration key alone cannot distinguish "confirmed by the last
 * response" from "superseded by a response nobody has seen". This flag makes that
 * window explicit: the payload still describes the current configuration, but the
 * evidence backing it is no longer the latest word.
 */
export function isStudioRefreshUnresolved(options: {
  currentConfigurationKey: string;
  unresolvedRefreshKey: string | null;
}): boolean {
  return options.unresolvedRefreshKey !== null
    && options.unresolvedRefreshKey === options.currentConfigurationKey;
}

export function hasCurrentLiveContributions(options: {
  demo: boolean;
  currentConfigurationKey: string;
  validatedConfigurationKey: string | null;
  unresolvedRefreshKey: string | null;
  contributionsPresent: boolean;
}): boolean {
  return !options.demo
    && options.contributionsPresent
    && options.validatedConfigurationKey === options.currentConfigurationKey
    && !isStudioRefreshUnresolved(options);
}

export function hasCurrentLiveLanguages(options: {
  demo: boolean;
  currentConfigurationKey: string;
  validatedConfigurationKey: string | null;
  unresolvedRefreshKey: string | null;
  repositoriesTruncated: boolean;
}): boolean {
  return !options.demo
    && !options.repositoriesTruncated
    && options.validatedConfigurationKey === options.currentConfigurationKey
    && !isStudioRefreshUnresolved(options);
}

export interface StudioLiveEvidenceInput {
  demo: boolean;
  currentConfigurationKey: string;
  validatedConfigurationKey: string | null;
  unresolvedRefreshKey: string | null;
  contributionsPresent: boolean;
  repositoriesTruncated: boolean;
}

export interface StudioLiveEvidence {
  /** The displayed payload is older than the newest request for this configuration. */
  refreshUnresolved: boolean;
  hasCurrentContributions: boolean;
  hasCurrentLanguages: boolean;
}

/**
 * Single derivation of what the *current* evidence supports. Card toggles, the
 * gallery's retained-preview label, and copyable README Markdown all read from
 * this so they cannot drift apart.
 */
export function resolveStudioLiveEvidence(input: StudioLiveEvidenceInput): StudioLiveEvidence {
  return {
    refreshUnresolved: isStudioRefreshUnresolved(input),
    hasCurrentContributions: hasCurrentLiveContributions(input),
    hasCurrentLanguages: hasCurrentLiveLanguages(input),
  };
}
