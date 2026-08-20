import {
  calculateCiState,
  type CiObservation,
  type CiState,
  type CiStatus,
  type ProjectLifecycle,
} from "@/packages/core/src/index";
import type {
  CiState as SvgCiState,
  Lifecycle as SvgLifecycle,
} from "@/packages/svg/src/index";
import type { ProjectCiSignal } from "./types";

const JSON_CI_LABELS: Readonly<Record<CiState, string>> = {
  unavailable: "CI unavailable",
  unconfigured: "Not configured",
  stale: "Stale result",
  passing: "Passing",
  failing: "Failing",
  pending: "Pending",
};

const SVG_CI_STATES: Readonly<Record<CiState, SvgCiState>> = {
  unavailable: "unavailable",
  unconfigured: "unconfigured",
  stale: "stale",
  passing: "passing",
  failing: "failing",
  pending: "pending",
};

const SVG_LIFECYCLES: Readonly<Record<ProjectLifecycle, SvgLifecycle>> = {
  planned: "experimental",
  active: "active",
  maintenance: "maintained",
  paused: "paused",
  archived: "archived",
};

export function calculateGitHubCiState(observation: CiObservation, now: Date): CiStatus {
  return calculateCiState(observation, now.toISOString());
}

/** Keep the HTTP JSON vocabulary exactly aligned with core. */
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

/** SVG has a deliberately smaller presentation vocabulary, so translate explicitly. */
export function toSvgCiState(state: CiState): SvgCiState {
  return SVG_CI_STATES[state];
}

export function toSvgLifecycle(lifecycle: ProjectLifecycle): SvgLifecycle {
  return SVG_LIFECYCLES[lifecycle];
}
