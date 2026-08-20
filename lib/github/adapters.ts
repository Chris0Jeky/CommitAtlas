import type { CiState, ProjectLifecycle } from "@/packages/core/src/index";
import { calculateGitHubCiState, toJsonCiSignal } from "@commit-atlas/github";
import type {
  CiState as SvgCiState,
  Lifecycle as SvgLifecycle,
} from "@/packages/svg/src/index";

const SVG_CI_STATES: Readonly<Record<CiState, SvgCiState>> = {
  unavailable: "unavailable",
  unconfigured: "unconfigured",
  stale: "stale",
  passing: "passing",
  failing: "failing",
  pending: "pending",
};

const SVG_LIFECYCLES: Readonly<Record<ProjectLifecycle, SvgLifecycle>> = {
  planned: "planned",
  active: "active",
  maintenance: "maintained",
  paused: "paused",
  archived: "archived",
};

export { calculateGitHubCiState, toJsonCiSignal };

/** Translate the core lifecycle into the SVG presentation vocabulary without changing its meaning. */
export function toSvgCiState(state: CiState): SvgCiState {
  return SVG_CI_STATES[state];
}

export function toSvgLifecycle(lifecycle: ProjectLifecycle): SvgLifecycle {
  return SVG_LIFECYCLES[lifecycle];
}
