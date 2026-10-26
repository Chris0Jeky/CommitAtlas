import { parseRepositorySlug } from "@commit-atlas/core";
import type { PortfolioSnapshot, ProjectSnapshot } from "@commit-atlas/github";
import type { StaticConfig } from "./config.js";

function repositoryKey(value: unknown): string | null {
  try { return parseRepositorySlug(value).toLowerCase(); }
  catch { return null; }
}

/** Labels are literal identity text; only repository association is case-insensitive. */
export function configuredBeaconLabels(projects: StaticConfig["projects"], focus: readonly string[]): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  const occurrences = new Map<string, number>();
  for (const project of projects) {
    const key = repositoryKey(project.repo);
    if (!key || labels.has(key)) throw new Error("identity-beacon requires unique valid configured project identities");
    labels.set(key, project.label);
    occurrences.set(project.label, (occurrences.get(project.label) ?? 0) + 1);
  }
  if (focus.some(label => (occurrences.get(label) ?? 0) > 1)) {
    throw new Error("identity-beacon focus has an ambiguous configured project label");
  }
  return labels;
}

/**
 * Adapt only the static Beacon input. Never borrow counts by array order or a fetched display
 * name, and never change a caller snapshot used by cards or other scenes. An unsafe observed
 * association makes this Beacon unavailable; missing/observed-empty boards retain their semantics.
 */
export function beaconSnapshot(snapshot: PortfolioSnapshot, configured: StaticConfig["projects"], focus: readonly string[]): PortfolioSnapshot {
  const labels = configuredBeaconLabels(configured, focus);
  const board = snapshot.projects;
  if (!board || !Array.isArray(board.projects)) return snapshot;
  const projects: ProjectSnapshot[] = [];
  const seen = new Set<string>();
  for (const project of board.projects) {
    const key = repositoryKey(project?.repo);
    if (!key || seen.has(key) || !labels.has(key)) return { ...snapshot, projects: null };
    seen.add(key);
    projects.push({ ...project, name: labels.get(key)! });
  }
  return { ...snapshot, projects: { ...board, projects } };
}
