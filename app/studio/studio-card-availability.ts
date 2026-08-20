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
  if (kind !== "streak" && kind !== "activity") return true;
  return availability.hasCurrentContributions;
}

export function hasCurrentLiveContributions(options: {
  demo: boolean;
  currentConfigurationKey: string;
  validatedConfigurationKey: string | null;
  contributionsPresent: boolean;
}): boolean {
  return !options.demo
    && options.contributionsPresent
    && options.validatedConfigurationKey === options.currentConfigurationKey;
}

export function hasCurrentLiveLanguages(options: {
  demo: boolean;
  currentConfigurationKey: string;
  validatedConfigurationKey: string | null;
  repositoriesTruncated: boolean;
}): boolean {
  return !options.demo
    && !options.repositoriesTruncated
    && options.validatedConfigurationKey === options.currentConfigurationKey;
}
