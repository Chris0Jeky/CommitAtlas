import { encodeWorkflowMapComponent } from "@/lib/github/workflow-map";

export type StudioCardKind = "atlas" | "profile" | "streak" | "activity" | "languages" | "projects";
export type StudioProjectSurface = "json" | "svg";

export interface StudioProjectInput {
  repo: string;
  lifecycle: string;
  workflow?: string;
}

export interface StudioRouteOptions {
  owner: string;
  theme: string;
  demo: boolean;
  days?: number;
  motion?: "none" | "subtle";
  layout?: "wide" | "compact";
  projects?: StudioProjectInput[];
}

export function buildStudioConfigurationKey(options: StudioRouteOptions): string {
  return JSON.stringify({
    owner: options.owner.trim().toLowerCase(),
    theme: options.theme,
    demo: options.demo,
    days: options.days ?? null,
    motion: options.motion ?? "subtle",
    layout: options.layout ?? "wide",
    projects: (options.projects ?? [])
      .filter((project) => project.repo.trim())
      .map((project) => ({
        repo: project.repo.trim().toLowerCase(),
        lifecycle: project.lifecycle,
        workflow: project.workflow?.trim() ?? "",
      })),
  });
}

export function resolveStudioBaseUrl(
  currentConfigurationKey: string,
  validatedPreview: { key: string; origin: string } | null,
  placeholder: string,
): string {
  return isStudioPreviewCurrent(currentConfigurationKey, validatedPreview)
    ? validatedPreview.origin
    : placeholder;
}

export function isStudioPreviewCurrent<T extends { key: string }>(
  currentConfigurationKey: string,
  validatedPreview: T | null,
): validatedPreview is T {
  return validatedPreview?.key === currentConfigurationKey;
}

const cardPaths: Record<Exclude<StudioCardKind, "projects">, string> = {
  atlas: "/api/v1/cards/atlas.svg",
  profile: "/api/v1/cards/profile.svg",
  streak: "/api/v1/cards/streak.svg",
  activity: "/api/v1/cards/activity.svg",
  languages: "/api/v1/cards/languages.svg",
};

export function buildStudioRouteUrl(
  kind: StudioCardKind,
  options: StudioRouteOptions,
  projectSurface: StudioProjectSurface = "svg",
): string {
  const query = new URLSearchParams();
  const projects = options.projects ?? [];

  if (kind === "projects" || kind === "atlas") {
    query.set(kind === "projects" ? "owner" : "user", options.owner);
    if (kind === "projects" || projects.length > 0) {
      query.set("repos", projects.map((project) => project.repo.trim()).join(","));
      query.set("states", projects.map((project) => `${project.repo.trim()}:${project.lifecycle}`).join(","));
    }
    const workflows = projects
      .map((project) => {
        const repo = project.repo.trim();
        const workflow = project.workflow?.trim() ?? "";
        return repo && workflow ? `${repo}:${encodeWorkflowMapComponent(workflow)}` : null;
      })
      .filter((workflow): workflow is string => Boolean(workflow));
    if (workflows.length > 0) query.set("workflows", workflows.join(","));
    if (kind === "atlas") {
      if (options.days !== undefined) query.set("days", String(options.days));
      query.set("motion", options.motion ?? "subtle");
      query.set("layout", options.layout ?? "wide");
    }
  } else {
    query.set("user", options.owner);
    if (kind === "activity" && options.days !== undefined) query.set("days", String(options.days));
  }

  query.set("demo", String(options.demo));
  if (kind !== "projects" || projectSurface === "svg") query.set("theme", options.theme);

  const path = kind === "projects"
    ? projectSurface === "json" ? "/api/v1/projects" : "/api/v1/projects.svg"
    : cardPaths[kind];
  return `${path}?${query.toString()}`;
}
