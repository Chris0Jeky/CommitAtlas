import { ProjectLinksSchema, type ProjectManifestEntry } from "@commit-atlas/core";
import { safeHttpsUrl, type PortfolioSnapshot, type ProjectReleaseSignal, type ProjectSnapshot } from "@commit-atlas/github";
import type { StaticConfig } from "./config.js";

/**
 * Version 2 is the first catalog shape that is not wire-compatible with
 * version 1. A consumer's only compatibility gate is this number, so an
 * incompatible shape must never keep the old one: two mutually invalid schemas
 * sharing a version is exactly what the field exists to prevent. Bumping makes
 * a version-1 reader fail closed with a clear version error instead of
 * silently reading `undefined` out of a renamed or unexpected key.
 */
export const PROJECT_CATALOG_VERSION = 2 as const;

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
  /** Lowercase (punycode) hostname of `url`, so a destination is never presented without its host. */
  readonly host: string;
  /** True when `host` is not a GitHub-owned host; such links are labelled in the Markdown catalog. */
  readonly external: boolean;
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
  readonly releaseState: ProjectSnapshot["releaseState"];
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

/**
 * Trust boundary for rendered destinations.
 *
 * The two link sources are bounded differently. Configured `links` are already *restricted*:
 * `ProjectLinkSchema` in `@commit-atlas/core` rejects anything off `ALLOWED_LINK_HOSTS` at
 * config-parse time, so `validatedConfiguredUrl` can only ever yield an allowlisted host. An
 * observed repository homepage (`websiteUrl`) is arbitrary owner-supplied text that GitHub echoes
 * back and may point anywhere; constraining it would break legitimate project websites.
 *
 * So this set is not an allowlist — it is the disclosure line. Any host outside it, allowlisted or
 * not, is emitted with `external: true` and labelled with its hostname in `projects.md`.
 *
 * The rule is about the **hostname**, not about who authored what the hostname serves: these are
 * fixed hostnames GitHub operates, none of which a repository owner can choose. `*.github.io` is
 * absent because the label on a Pages hostname *is* author-chosen — `<anything>.github.io` is picked
 * by its owner — not because Pages content is author-controlled.
 *
 * Content authorship is deliberately not the test, and the absence of a label is NOT a safety claim
 * about the payload. Plenty of author-controlled content lives on these hostnames: every
 * `github.com/<owner>/<repo>` page, every gist, and — the sharpest case — the `release-download`
 * action, which points at an arbitrary binary the owner uploaded to
 * `objects.githubusercontent.com`. All of those go unlabelled, because a reader of a repository
 * catalog already expects the owner's own repository content. What the label adds is the one thing
 * that is not expected: this destination is not on GitHub at all.
 *
 * This is a *rendering* boundary and is distinct from the outbound-fetch invariant: CommitAtlas still
 * fetches data only from GitHub-owned hosts. It never requests any of these URLs.
 */
const GITHUB_OWNED_HOSTS: readonly string[] = [
  "api.github.com",
  "docs.github.com",
  "gist.github.com",
  "github.com",
  "objects.githubusercontent.com",
  "raw.githubusercontent.com",
  "www.github.com",
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
  if ((project.releaseState === "published") !== Boolean(project.release)) {
    throw new Error(`Release observation mismatch for ${project.repo}`);
  }
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
    releaseState: project.releaseState,
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
  const validated = origin === "snapshot" ? validatedObservedUrl(url, label) : validatedConfiguredUrl(url, label);
  const host = urlHost(validated, label);
  actions.push({ kind, label, url: validated, origin, host, external: !GITHUB_OWNED_HOSTS.includes(host) });
}

function urlHost(value: string, label: string): string {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (!host) throw new Error("empty host");
    return host;
  } catch {
    throw new Error(`${label} URL has no resolvable host`);
  }
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

/**
 * `projects.md` is a heading-and-list document and deliberately emits no GFM table. A `|` only has
 * structural meaning inside a table row, and `codeSpan` output is *not* table-cell safe: GFM requires
 * `\|` for a pipe inside a table cell, while the same escape would render literally in a list item.
 * Prose goes through `escapeMarkdown`, which already escapes `|`. If a table is ever added here, its
 * cells need a table-aware escaper; `renders no Markdown table rows` in the test suite pins that.
 */
function renderProjectCatalogMarkdown(catalog: ProjectCatalog): string {
  const lines = [
    "# Project catalog",
    "",
    `Generated for **${escapeMarkdown(catalog.user)}** from public GitHub data at ${codeSpan(catalog.generatedAt)}.`,
    `Window: ${codeSpan(catalog.window.from)} → ${codeSpan(catalog.window.to)} (${catalog.window.days} days).`,
    "",
    "> Source: `github-public-rest`. Links are emitted only when observed in the public snapshot or explicitly configured.",
    "> A destination outside GitHub's own hosts is labelled with its hostname; CommitAtlas does not vouch for it.",
    "",
  ];
  for (const project of catalog.projects) {
    lines.push(`## ${escapeMarkdown(project.label)}`, "", `- **Repository:** ${codeSpan(project.repo)}`, `- **Lifecycle:** ${escapeMarkdown(lifecycleLabel(project.lifecycle))}`, `- **CI:** ${escapeMarkdown(project.ci.label)}${project.ci.workflow ? ` (${codeSpan(project.ci.workflow)})` : ""}`);
    if (project.description) lines.push(`- **Description:** ${escapeMarkdown(project.description)}`);
    // Zero-valued vanity counts stay in the JSON contract but out of the prose: "0 stars · 0 forks"
    // reads as an apology, not a stat. Open work is always stated — hiding it would dress the project up.
    const stats = [
      project.stars > 0 ? `${project.stars} stars` : null,
      project.forks > 0 ? `${project.forks} forks` : null,
      `${project.openIssuesAndPullRequests} open issues/PRs`,
    ].filter((part): part is string => part !== null);
    lines.push(`- **Stats:** ${stats.join(" · ")}`);
    // `boundedText` trims, so a tag of nothing but non-ASCII whitespace (a single U+00A0 is a legal
    // git ref name) reaches here empty. Drop the parenthetical the way an absent `ci.workflow` is
    // dropped, rather than throwing and failing every artifact over one cosmetic field.
    if (project.release) {
      const tag = project.release.tag ? ` (${codeSpan(project.release.tag)})` : "";
      lines.push(`- **Release:** ${escapeMarkdown(project.release.name)}${tag}`);
    } else if (project.releaseState === "none") {
      lines.push("- **Release:** No published release observed");
    } else {
      lines.push("- **Release:** Unavailable (not observed)");
    }
    lines.push("", "### Actions", "");
    for (const action of project.actions) {
      const provenance = action.origin === "snapshot" ? "observed" : "configured";
      const destination = action.external ? ` · external host ${codeSpan(action.host)}` : "";
      lines.push(`- [${escapeMarkdown(action.label)}](${markdownUrl(action.url)}) — ${provenance}${destination}`);
    }
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

/**
 * Wrap untrusted text in a delimiter-safe CommonMark code span.
 *
 * Backslash escapes are inert inside a code span (CommonMark 0.31 §6.1), so escaping a backtick
 * cannot contain it — the span simply closes early and the remainder becomes live Markdown. The only
 * correct construction is a backtick fence longer than the longest backtick run in the content, plus
 * a single space of padding when the content starts or ends with a backtick (it would otherwise merge
 * into the fence) or when it both starts and ends with a space (the reader strips one from each end).
 *
 * The "consists entirely of spaces" exemption is U+0020 only, per the spec, so it is tested with
 * `/^ *$/` rather than `String.prototype.trim()` — trim also strips tab, NBSP, U+2000-200A and
 * U+3000, which would skip the padding for content like `" \t "` and silently lose a space at each
 * end. Callers must not pass an empty string; every current call site is either structurally
 * non-empty or guarded, and the throw is a programming-error guard, not a data path.
 */
export function codeSpan(value: string): string {
  if (value.length === 0) throw new Error("Cannot render an empty value as a Markdown code span");
  const longestRun = (value.match(/`+/g) ?? []).reduce((longest, run) => Math.max(longest, run.length), 0);
  const fence = "`".repeat(longestRun + 1);
  const padded = value.startsWith("`") || value.endsWith("`")
    || (value.startsWith(" ") && value.endsWith(" ") && !/^ *$/.test(value));
  const pad = padded ? " " : "";
  return `${fence}${pad}${value}${pad}${fence}`;
}

function markdownUrl(value: string): string {
  return value.replace(/[()<>\\]/g, (character) => encodeURIComponent(character));
}
