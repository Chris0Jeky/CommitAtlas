import { ProjectLinksSchema, type ProjectManifestEntry } from "@commit-atlas/core";
import { safeHttpsUrl, type PortfolioSnapshot, type ProjectReleaseSignal, type ProjectSnapshot } from "@commit-atlas/github";
import type { StaticConfig } from "./config.js";

export const PROJECT_CATALOG_VERSION = 1 as const;

export type ProjectCatalogActionKind =
  | "source"
  | "website"
  | "ci"
  | "release"
  | "release-download"
  | "docs"
  | "install"
  | "download";

export interface ProjectCatalogAction {
  readonly kind: ProjectCatalogActionKind;
  readonly label: string;
  readonly url: string;
  readonly origin: "snapshot" | "config";
}

export interface ProjectCatalogCi {
  readonly state: ProjectSnapshot["ci"]["state"];
  readonly label: string;
  readonly workflow: string | null;
  readonly url?: string;
}

export interface ProjectCatalogRelease {
  readonly tag: string;
  readonly name: string;
  readonly url: string;
  readonly download?: { readonly name: string; readonly url: string };
}

export interface ProjectCatalogEntry {
  readonly repo: string;
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  readonly lifecycle: ProjectSnapshot["lifecycle"];
  readonly primaryLanguage?: string;
  readonly stars: number;
  readonly forks: number;
  readonly openIssuesAndPullRequests: number;
  readonly pushedAt?: string;
  readonly ci: ProjectCatalogCi;
  readonly release?: ProjectCatalogRelease;
  readonly actions: readonly ProjectCatalogAction[];
}

export interface ProjectCatalog {
  readonly version: typeof PROJECT_CATALOG_VERSION;
  readonly generator: "CommitAtlas";
  readonly user: string;
  readonly source: "github-public-rest";
  readonly generatedAt: string;
  readonly window: Readonly<PortfolioSnapshot["metrics"]["window"]>;
  readonly projects: readonly ProjectCatalogEntry[];
}

export interface ProjectCatalogArtifacts {
  readonly "projects.json": string;
  readonly "projects.md": string;
}

const MAX_LABEL = 80;
const MAX_TEXT = 500;
const ACTION_ORDER: readonly ProjectCatalogActionKind[] = [
  "source", "website", "ci", "release", "release-download", "docs", "install", "download",
];

/** Render the JSON and Markdown project catalog from the same validated snapshot. */
export function renderProjectCatalogArtifacts(snapshot: PortfolioSnapshot, config: StaticConfig): ProjectCatalogArtifacts {
  if (!config.cards.includes("projects")) throw new Error("Project catalog requires projects in cards");
  const catalog = buildProjectCatalog(snapshot, config);
  return {
    "projects.json": `${JSON.stringify(catalog, null, 2)}\n`,
    "projects.md": renderProjectCatalogMarkdown(catalog),
  };
}

export function buildProjectCatalog(snapshot: PortfolioSnapshot, config: StaticConfig): ProjectCatalog {
  const board = snapshot.projects;
  if (!board) throw new Error("Project catalog requires a public project snapshot");
  if (board.owner.toLowerCase() !== config.user.toLowerCase()) throw new Error("Project snapshot owner does not match static config");

  const configured = new Map<string, ProjectManifestEntry>();
  for (const entry of config.projects) {
    const key = entry.repo.toLowerCase();
    if (configured.has(key)) throw new Error(`Duplicate configured project: ${entry.repo}`);
    configured.set(key, entry);
  }
  const fetched = new Map<string, ProjectSnapshot>();
  for (const project of board.projects) {
    const key = project.repo.toLowerCase();
    if (fetched.has(key)) throw new Error(`Duplicate fetched project: ${project.repo}`);
    if (!configured.has(key)) throw new Error(`Fetched project is not configured: ${project.repo}`);
    fetched.set(key, project);
  }
  if (fetched.size !== configured.size) {
    const missing = [...configured.keys()].find((key) => !fetched.has(key));
    throw new Error(`Missing fetched project snapshot: ${missing ?? "unknown"}`);
  }

  const projects = config.projects.map((entry) => {
    const project = fetched.get(entry.repo.toLowerCase());
    if (!project) throw new Error(`Missing fetched project snapshot: ${entry.repo}`);
    if (project.lifecycle !== entry.lifecycle) throw new Error(`Lifecycle mismatch for ${entry.repo}`);
    if ((project.ci.workflow ?? undefined) !== (entry.workflow ?? undefined)) throw new Error(`CI workflow mismatch for ${entry.repo}`);
    return buildEntry(entry, project);
  });

  return {
    version: PROJECT_CATALOG_VERSION,
    generator: "CommitAtlas",
    user: boundedText(snapshot.profile.login, "user", MAX_LABEL),
    source: "github-public-rest",
    generatedAt: boundedText(snapshot.freshness.generatedAt, "generatedAt", 80),
    window: snapshot.metrics.window,
    projects,
  };
}

function buildEntry(entry: ProjectManifestEntry, project: ProjectSnapshot): ProjectCatalogEntry {
  const links = ProjectLinksSchema.parse(entry.links);
  const actions: ProjectCatalogAction[] = [];
  addAction(actions, "source", "Source", project.sourceUrl, "snapshot");
  if (project.websiteUrl) addAction(actions, "website", "Website", project.websiteUrl, "snapshot");
  if (project.ci.url) addAction(actions, "ci", "CI", project.ci.url, "snapshot");
  if (project.release) addAction(actions, "release", "Release", project.release.url, "snapshot");
  if (project.release?.download) addAction(actions, "release-download", "Release download", project.release.download.url, "snapshot");
  if (links.docs) addAction(actions, "docs", "Docs", links.docs, "config");
  if (links.install) addAction(actions, "install", "Install", links.install, "config");
  if (links.download) addAction(actions, "download", "Download", links.download, "config");
  actions.sort((left, right) => ACTION_ORDER.indexOf(left.kind) - ACTION_ORDER.indexOf(right.kind));

  return {
    repo: boundedText(project.repo, "repository", 140),
    name: boundedText(project.name, "project name", MAX_LABEL),
    label: boundedText(entry.label, "project label", MAX_LABEL),
    ...(project.description ? { description: boundedText(project.description, "description", MAX_TEXT) } : {}),
    lifecycle: project.lifecycle,
    ...(project.primaryLanguage ? { primaryLanguage: boundedText(project.primaryLanguage, "language", MAX_LABEL) } : {}),
    stars: boundedCount(project.stars, "stars"),
    forks: boundedCount(project.forks, "forks"),
    openIssuesAndPullRequests: boundedCount(project.openIssuesAndPullRequests, "open issues and pull requests"),
    ...(project.pushedAt ? { pushedAt: boundedText(project.pushedAt, "pushedAt", 80) } : {}),
    ci: {
      state: project.ci.state,
      label: boundedText(project.ci.label, "CI label", MAX_LABEL),
      workflow: project.ci.workflow ? boundedText(project.ci.workflow, "workflow", MAX_LABEL) : null,
      ...(project.ci.url ? { url: validatedObservedUrl(project.ci.url, "CI") } : {}),
    },
    ...(project.release ? { release: buildRelease(project.release) } : {}),
    actions,
  };
}

function buildRelease(release: ProjectReleaseSignal): ProjectCatalogRelease {
  return {
    tag: boundedText(release.tag, "release tag", MAX_LABEL),
    name: boundedText(release.name, "release name", MAX_LABEL),
    url: validatedObservedUrl(release.url, "release"),
    ...(release.download ? {
      download: {
        name: boundedText(release.download.name, "release download name", MAX_LABEL),
        url: validatedObservedUrl(release.download.url, "release download"),
      },
    } : {}),
  };
}

function addAction(actions: ProjectCatalogAction[], kind: ProjectCatalogActionKind, label: string, url: string, origin: ProjectCatalogAction["origin"]): void {
  actions.push({ kind, label, url: origin === "snapshot" ? validatedObservedUrl(url, label) : validatedConfiguredUrl(url, label), origin });
}

function validatedObservedUrl(value: string, label: string): string {
  const normalized = safeHttpsUrl(value);
  if (!normalized) throw new Error(`${label} URL is not a safe HTTPS URL`);
  return normalized;
}

function validatedConfiguredUrl(value: string, label: string): string {
  try {
    return ProjectLinksSchema.parse({ docs: value }).docs!;
  } catch {
    try {
      return ProjectLinksSchema.parse({ install: value }).install!;
    } catch {
      try {
        return ProjectLinksSchema.parse({ download: value }).download!;
      } catch {
        throw new Error(`${label} URL is not an allowed HTTPS URL`);
      }
    }
  }
}

function boundedText(value: string, label: string, max: number): string {
  if (typeof value !== "string" || [...value].length > max || containsControl(value)) {
    throw new Error(`${label} contains invalid or overlong text`);
  }
  return value.trim();
}

function boundedCount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} is invalid`);
  return value;
}

function containsControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0)!;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
}

function renderProjectCatalogMarkdown(catalog: ProjectCatalog): string {
  const lines = [
    "# Project catalog",
    "",
    `Generated for **${escapeMarkdown(catalog.user)}** from public GitHub data at \`${escapeCode(catalog.generatedAt)}\`.`,
    `Window: \`${escapeCode(catalog.window.from)}\` → \`${escapeCode(catalog.window.to)}\` (${catalog.window.days} days).`,
    "",
    "> Source: `github-public-rest`. Links are emitted only when observed in the public snapshot or explicitly configured.",
    "",
  ];
  for (const project of catalog.projects) {
    lines.push(`## ${escapeMarkdown(project.label)}`, "", `- **Repository:** \`${escapeCode(project.repo)}\``, `- **Lifecycle:** ${escapeMarkdown(lifecycleLabel(project.lifecycle))}`, `- **CI:** ${escapeMarkdown(project.ci.label)}${project.ci.workflow ? ` (\`${escapeCode(project.ci.workflow)}\`)` : ""}`);
    if (project.description) lines.push(`- **Description:** ${escapeMarkdown(project.description)}`);
    lines.push(`- **Stats:** ${project.stars} stars · ${project.forks} forks · ${project.openIssuesAndPullRequests} open issues/PRs`);
    if (project.release) lines.push(`- **Release:** ${escapeMarkdown(project.release.name)} (\`${escapeCode(project.release.tag)}\`)`);
    lines.push("", "### Actions", "");
    for (const action of project.actions) lines.push(`- [${escapeMarkdown(action.label)}](${markdownUrl(action.url)}) — ${action.origin === "snapshot" ? "observed" : "configured"}`);
    lines.push("");
  }
  return lines.join("\n");
}

function lifecycleLabel(value: ProjectSnapshot["lifecycle"]): string {
  return value[0]!.toUpperCase() + value.slice(1);
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|<>-]/g, "\\$&");
}

function escapeCode(value: string): string {
  return value.replace(/[\\`]/g, "\\$&");
}

function markdownUrl(value: string): string {
  return value.replace(/[()<>\\]/g, (character) => encodeURIComponent(character));
}
