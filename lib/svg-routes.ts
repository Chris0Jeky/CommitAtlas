import type { ThemeName } from "@/packages/svg/src/index";
import type { ProjectLifecycle, ProjectWorkflow } from "./github/types";
import { encodeWorkflowMapComponent } from "./github/workflow-map";
import {
  InputError,
  parseDemo,
  parseGitHubHandle,
  parseLifecycleMap,
  parseRepositoryNames,
  parseWorkflowMap,
  rejectUnknownParameters,
} from "./github/validation";

export type { ThemeName } from "@/packages/svg/src/index";

const DEFAULT_THEME: ThemeName = "aurora";

export interface SvgProfileQuery {
  readonly user: string;
  readonly demo: boolean;
  readonly theme: ThemeName;
  readonly motion: "none" | "subtle";
  readonly canonical: string;
}

export type SvgStreakQuery = SvgProfileQuery;
export type SvgLanguagesQuery = SvgProfileQuery;

export interface SvgActivityQuery extends SvgProfileQuery {
  readonly days: number;
}

export interface SvgAtlasQuery extends SvgActivityQuery {
  readonly motion: "none" | "subtle";
  readonly layout: "wide" | "compact";
  readonly repos: readonly string[];
  readonly states: ReadonlyMap<string, ProjectLifecycle>;
  readonly workflows: ReadonlyMap<string, ProjectWorkflow>;
  readonly projects: readonly SvgProjectQueryItem[];
}

export interface SvgProjectQueryItem {
  readonly repository: string;
  readonly lifecycle: ProjectLifecycle;
  readonly workflow: ProjectWorkflow | null;
}

export interface SvgProjectsQuery {
  readonly owner: string;
  readonly repos: readonly string[];
  readonly states: ReadonlyMap<string, ProjectLifecycle>;
  readonly workflows: ReadonlyMap<string, ProjectWorkflow>;
  readonly projects: readonly SvgProjectQueryItem[];
  readonly demo: boolean;
  readonly theme: ThemeName;
  readonly motion: "none" | "subtle";
  readonly canonical: string;
}

export function parseSvgProfileQuery(parameters: URLSearchParams): SvgProfileQuery {
  const allowed = ["user", "demo", "theme", "motion"] as const;
  rejectUnknownParameters(parameters, allowed);
  const user = parseGitHubHandle(parameters.get("user"));
  const demo = parseDemo(parameters.get("demo"));
  const theme = parseTheme(parameters.get("theme"));
  const motion = parseStandaloneMotion(parameters.get("motion"));
  return { user, demo, theme, motion, canonical: canonicalQuery([
    ["user", user],
    ["demo", String(demo)],
    ["theme", theme],
    ["motion", motion],
  ]) };
}

export function parseSvgStreakQuery(parameters: URLSearchParams): SvgStreakQuery {
  return parseSvgProfileQuery(parameters);
}

export function parseSvgActivityQuery(parameters: URLSearchParams): SvgActivityQuery {
  const allowed = ["user", "demo", "theme", "days", "motion"] as const;
  rejectUnknownParameters(parameters, allowed);
  const user = parseGitHubHandle(parameters.get("user"));
  const demo = parseDemo(parameters.get("demo"));
  const theme = parseTheme(parameters.get("theme"));
  const days = parseActivityDays(parameters.get("days"));
  const motion = parseStandaloneMotion(parameters.get("motion"));
  return { user, demo, theme, days, motion, canonical: canonicalQuery([
    ["user", user],
    ["demo", String(demo)],
    ["theme", theme],
    ["days", String(days)],
    ["motion", motion],
  ]) };
}

export function parseSvgLanguagesQuery(parameters: URLSearchParams): SvgLanguagesQuery {
  return parseSvgProfileQuery(parameters);
}

export function parseSvgAtlasQuery(parameters: URLSearchParams): SvgAtlasQuery {
  const allowed = ["user", "repos", "states", "workflows", "demo", "theme", "days", "motion", "layout"] as const;
  rejectUnknownParameters(parameters, allowed);
  const user = parseGitHubHandle(parameters.get("user"));
  const demo = parseDemo(parameters.get("demo"));
  const theme = parseTheme(parameters.get("theme"));
  const days = parseActivityDays(parameters.get("days"));
  const motion = parseMotion(parameters.get("motion"));
  const layout = parseAtlasLayout(parameters.get("layout"));
  const rawRepos = parameters.get("repos");
  if (rawRepos === null && (parameters.has("states") || parameters.has("workflows"))) {
    throw new InputError("states and workflows require repos");
  }
  const repos = rawRepos === null ? [] : parseRepositoryNames(rawRepos);
  const states = repos.length > 0 ? parseLifecycleMap(parameters.get("states"), repos) : new Map<string, ProjectLifecycle>();
  const workflows = repos.length > 0 ? parseWorkflowMap(parameters.get("workflows"), repos) : new Map<string, ProjectWorkflow>();
  const projects = repos.map((repository) => ({
    repository,
    lifecycle: states.get(repository.toLowerCase())!,
    workflow: workflows.get(repository.toLowerCase()) ?? null,
  }));
  const canonicalEntries: [string, string][] = [["user", user]];
  if (projects.length > 0) {
    canonicalEntries.push(["repos", repos.join(",")]);
    canonicalEntries.push(["states", projects.map(({ repository, lifecycle }) => `${repository}:${lifecycle}`).join(",")]);
    const workflowValue = projects
      .filter(({ workflow }) => workflow !== null)
      .map(({ repository, workflow }) => `${repository}:${encodeWorkflowMapComponent(workflow!)}`)
      .join(",");
    if (workflowValue) canonicalEntries.push(["workflows", workflowValue]);
  }
  canonicalEntries.push(["demo", String(demo)], ["theme", theme], ["days", String(days)], ["motion", motion], ["layout", layout]);
  return { user, demo, theme, days, motion, layout, repos, states, workflows, projects, canonical: canonicalQuery(canonicalEntries) };
}

export function parseSvgProjectsQuery(parameters: URLSearchParams): SvgProjectsQuery {
  const allowed = ["owner", "repos", "states", "workflows", "demo", "theme", "motion"] as const;
  rejectUnknownParameters(parameters, allowed);
  const owner = parseGitHubHandle(parameters.get("owner"), "owner");
  const repos = parseRepositoryNames(parameters.get("repos"));
  const states = parseLifecycleMap(parameters.get("states"), repos);
  const workflows = parseWorkflowMap(parameters.get("workflows"), repos);
  const demo = parseDemo(parameters.get("demo"));
  const theme = parseTheme(parameters.get("theme"));
  const motion = parseStandaloneMotion(parameters.get("motion"));
  const projects = repos.map((repository) => ({
    repository,
    lifecycle: states.get(repository.toLowerCase())!,
    workflow: workflows.get(repository.toLowerCase()) ?? null,
  }));
  const stateValue = projects.map(({ repository, lifecycle }) => `${repository}:${lifecycle}`).join(",");
  const workflowValue = projects
    .filter(({ workflow }) => workflow !== null)
    .map(({ repository, workflow }) => `${repository}:${encodeWorkflowMapComponent(workflow!)}`)
    .join(",");
  const canonicalEntries: [string, string][] = [
    ["owner", owner],
    ["repos", repos.join(",")],
    ["states", stateValue],
  ];
  if (workflowValue) canonicalEntries.push(["workflows", workflowValue]);
  canonicalEntries.push(["demo", String(demo)], ["theme", theme], ["motion", motion]);
  return { owner, repos, states, workflows, projects, demo, theme, motion, canonical: canonicalQuery(canonicalEntries) };
}

export function parseTheme(value: string | null): ThemeName {
  if (value === null) return DEFAULT_THEME;
  if (value === "aurora" || value === "midnight" || value === "paper" || value === "ember") return value;
  throw new InputError("theme must be aurora, midnight, paper, or ember");
}

export function parseActivityDays(value: string | null): number {
  if (value === null) return 365;
  if (!/^[0-9]{1,3}$/.test(value)) throw new InputError("days must be an integer from 7 to 365");
  const days = Number(value);
  if (days < 7 || days > 365) throw new InputError("days must be an integer from 7 to 365");
  return days;
}

export function parseMotion(value: string | null): "none" | "subtle" {
  if (value === null || value === "subtle") return "subtle";
  if (value === "none") return "none";
  throw new InputError("motion must be subtle or none");
}

export function parseStandaloneMotion(value: string | null): "none" | "subtle" {
  if (value === null || value === "none") return "none";
  if (value === "subtle") return "subtle";
  throw new InputError("motion must be subtle or none");
}

export function parseAtlasLayout(value: string | null): "wide" | "compact" {
  if (value === null || value === "wide") return "wide";
  if (value === "compact") return "compact";
  throw new InputError("layout must be wide or compact");
}

function canonicalQuery(entries: readonly [string, string][]): string {
  const query = new URLSearchParams();
  for (const [key, value] of entries) query.append(key, value);
  return query.toString();
}
