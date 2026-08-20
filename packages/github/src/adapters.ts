import {
  calculateCiState,
  type CiObservation,
  type CiState,
  type CiStatus,
} from "@commit-atlas/core";
import type { ProjectCiSignal } from "./types.js";

const JSON_CI_LABELS: Readonly<Record<CiState, string>> = {
  unavailable: "CI unavailable",
  unconfigured: "Not configured",
  stale: "Stale result",
  passing: "Passing",
  failing: "Failing",
  pending: "Pending",
};

export function calculateGitHubCiState(observation: CiObservation, now: Date): CiStatus {
  return calculateCiState(observation, now.toISOString());
}

export function toJsonCiSignal(
  status: CiStatus,
  workflow: string | null,
  url: string | null,
  headSha: string | null,
): ProjectCiSignal {
  return {
    state: status.state,
    label: JSON_CI_LABELS[status.state],
    workflow,
    url,
    checkedAt: status.updatedAt ?? null,
    headSha,
  };
}
