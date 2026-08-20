"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  hasCurrentLiveContributions,
  hasCurrentLiveLanguages,
  isStudioCardAvailable,
} from "./studio-card-availability";
import { buildStudioMarkdown, STUDIO_CARD_KINDS, STUDIO_CARD_LABELS } from "./studio-markdown";
import { configurationChangedNotice, contributionUnavailableNotice, retainedPreviewNotice } from "./studio-messages";
import {
  findProjectDraft,
  safeProjectActionUrl,
  starterCiPresentation,
} from "./studio-presentation";
import {
  buildStudioConfigurationKey,
  buildStudioRouteUrl,
  isStudioPreviewCurrent,
  resolveStudioBaseUrl,
  type StudioCardKind,
} from "./studio-urls";

type Lifecycle = "planned" | "active" | "maintenance" | "paused" | "archived";
type CardKind = StudioCardKind;

interface ProjectDraft {
  id: number;
  repo: string;
  lifecycle: Lifecycle;
  workflow: string;
  docs: string;
  install: string;
  download: string;
}

interface Freshness {
  generatedAt: string;
  source: string;
  mode: string;
}

interface ProfileSnapshot {
  login: string;
  name: string | null;
  profileUrl: string;
  publicRepositories: number;
  followers: number;
  stars: number;
  forks: number;
  repositoriesTruncated: boolean;
  freshness: Freshness;
}

interface ContributionSnapshot {
  totalContributions: number;
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
  days: Array<{ date: string; count: number; level?: number }>;
  freshness: Freshness;
}

interface ProjectSnapshot {
  repo: string;
  name: string;
  description: string | null;
  sourceUrl: string;
  websiteUrl: string | null;
  lifecycle: Lifecycle;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  ci: { state: string; label: string; url: string | null; checkedAt: string | null };
  release: { tag: string; url: string; download: { name: string; url: string } | null } | null;
}

interface ProjectBoardSnapshot {
  projects: ProjectSnapshot[];
  freshness: Freshness;
}

const starterProjects: ProjectDraft[] = [
  { id: 1, repo: "Hello-World", lifecycle: "active", workflow: "", docs: "", install: "", download: "" },
  { id: 2, repo: "Spoon-Knife", lifecycle: "maintenance", workflow: "", docs: "", install: "", download: "" },
];

const starterProfile: ProfileSnapshot = {
  login: "octocat",
  name: "Synthetic preview",
  profileUrl: "https://github.com/octocat",
  publicRepositories: 24,
  followers: 312,
  stars: 487,
  forks: 96,
  repositoriesTruncated: false,
  freshness: { generatedAt: "", source: "synthetic-demo", mode: "demo" },
};

const starterContributionDays = Array.from(
  { length: 120 },
  (_, index) => ({ date: `demo-${index}`, count: (index * 5) % 8 }),
);

const starterContributions: ContributionSnapshot = {
  totalContributions: starterContributionDays.reduce((total, day) => total + day.count, 0),
  commits: 284,
  issues: 23,
  pullRequests: 61,
  reviews: 74,
  days: starterContributionDays,
  freshness: { generatedAt: "", source: "synthetic-demo", mode: "demo" },
};

let nextProjectId = 3;
const PLACEHOLDER_BASE_URL = "https://your-commitatlas-host.example";

export default function StudioClient() {
  const [handle, setHandle] = useState("octocat");
  const [demo, setDemo] = useState(true);
  const [theme, setTheme] = useState("ember");
  const [motion, setMotion] = useState<"none" | "subtle">("subtle");
  const [layout, setLayout] = useState<"wide" | "compact">("wide");
  const [projects, setProjects] = useState<ProjectDraft[]>(starterProjects);
  const [selectedCards, setSelectedCards] = useState<Set<CardKind>>(new Set(["atlas", "projects"]));
  const [profile, setProfile] = useState<ProfileSnapshot>(starterProfile);
  const [contributions, setContributions] = useState<ContributionSnapshot | null>(starterContributions);
  const [board, setBoard] = useState<ProjectBoardSnapshot | null>(null);
  const [phase, setPhase] = useState<"ready" | "loading" | "error">("ready");
  const [notice, setNotice] = useState("Synthetic starter data — run Preview to refresh it through the API.");
  const [validatedPreview, setValidatedPreview] = useState<{ key: string; origin: string } | null>(null);
  const [atlasPreviewUrl, setAtlasPreviewUrl] = useState(() => buildStudioRouteUrl("atlas", {
    owner: "octocat",
    projects: starterProjects,
    theme: "ember",
    demo: true,
    days: 365,
    motion: "subtle",
    layout: "wide",
  }));

  const activeProjects = useMemo(() => projects.filter((project) => project.repo.trim()), [projects]);
  const configurationKey = useMemo(() => buildStudioConfigurationKey({
    owner: handle,
    projects: activeProjects,
    theme,
    demo,
    days: 365,
    motion,
    layout,
  }), [activeProjects, demo, handle, layout, motion, theme]);
  const configurationIsValidated = isStudioPreviewCurrent(configurationKey, validatedPreview);
  const visibleBoard = configurationIsValidated ? board : null;
  const visibleNotice = phase === "ready" && validatedPreview && !configurationIsValidated
    ? configurationChangedNotice()
    : notice;
  const hasCurrentContributions = hasCurrentLiveContributions({
    demo,
    currentConfigurationKey: configurationKey,
    validatedConfigurationKey: validatedPreview?.key ?? null,
    contributionsPresent: contributions !== null,
  });
  const hasCurrentLanguages = hasCurrentLiveLanguages({
    demo,
    currentConfigurationKey: configurationKey,
    validatedConfigurationKey: validatedPreview?.key ?? null,
    repositoriesTruncated: profile.repositoriesTruncated,
  });
  const baseUrl = resolveStudioBaseUrl(configurationKey, validatedPreview, PLACEHOLDER_BASE_URL);
  const compactAtlasPreviewUrl = atlasPreviewUrl.includes("layout=wide")
    ? atlasPreviewUrl.replace("layout=wide", "layout=compact")
    : atlasPreviewUrl;
  const markdown = useMemo(() => {
    return buildStudioMarkdown({
      baseUrl,
      owner: handle.trim() || "octocat",
      projects: activeProjects,
      theme,
      demo,
      selectedCards,
      hasCurrentContributions,
      hasCurrentLanguages,
      motion,
      layout,
    });
  }, [activeProjects, baseUrl, demo, handle, hasCurrentContributions, hasCurrentLanguages, layout, motion, selectedCards, theme]);

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const login = handle.trim();
    if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) {
      setPhase("error");
      setNotice(retainedPreviewNotice("Enter a valid GitHub handle before previewing.", profile.login));
      return;
    }

    const requestedConfigurationKey = buildStudioConfigurationKey({
      owner: login,
      projects: activeProjects,
      theme,
      demo,
      days: 365,
      motion,
      layout,
    });

    setPhase("loading");
    setNotice(`Loading ${demo ? "synthetic" : "live public"} GitHub signals for @${login}…`);
    try {
      const common = `user=${encodeURIComponent(login)}&demo=${demo}`;
      const contributionPromise = fetchJson<ContributionSnapshot>(`/api/v1/contributions?${common}&days=120`)
        .then((value) => ({ value, error: null }))
        .catch((error: unknown) => ({ value: null, error }));
      const [nextProfile, contributionResult, nextBoard] = await Promise.all([
        fetchJson<ProfileSnapshot>(`/api/v1/profile?${common}`),
        contributionPromise,
        activeProjects.length
          ? fetchJson<ProjectBoardSnapshot>(buildStudioRouteUrl("projects", {
              owner: login,
              projects: activeProjects,
              theme,
              demo,
            }, "json"))
          : Promise.resolve(null),
      ]);

      setProfile(nextProfile);
      setContributions(contributionResult.value);
      setBoard(nextBoard);
      if (contributionResult.value) {
        setAtlasPreviewUrl(buildStudioRouteUrl("atlas", {
          owner: login,
          projects: activeProjects,
          theme,
          demo,
          days: 365,
          motion,
          layout,
        }));
      }
      setValidatedPreview({ key: requestedConfigurationKey, origin: window.location.origin });
      setPhase("ready");
      setNotice(
        contributionResult.error
          ? contributionUnavailableNotice()
          : `${demo ? "Synthetic" : "Live public"} preview loaded. Source and generation time are shown below.`,
      );
    } catch (error) {
      setPhase("error");
      const reason = error instanceof Error ? error.message : "The preview could not be loaded.";
      setNotice(retainedPreviewNotice(reason, profile.login));
    }
  }

  function updateProject(id: number, patch: Partial<ProjectDraft>) {
    setProjects((current) => current.map((project) => project.id === id ? { ...project, ...patch } : project));
  }

  function toggleCard(kind: CardKind) {
    setSelectedCards((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  async function copyMarkdown() {
    if (!markdown) {
      setNotice("Select at least one card before copying Markdown.");
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      setNotice("README Markdown copied to your clipboard.");
    } catch {
      setNotice("Clipboard access was unavailable. Select the Markdown and copy it manually.");
    }
  }

  return (
    <main className="studio-page">
      <nav className="nav studio-nav" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="CommitAtlas home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>CommitAtlas</span>
        </Link>
        <div className="nav-links"><Link href="/">Overview</Link><a href="#configure">Configure</a><a href="#preview">Preview</a><a href="https://github.com/Chris0Jeky/CommitAtlas">GitHub <span aria-hidden="true">↗</span></a></div>
      </nav>

      <header className="studio-hero">
        <div>
          <p className="eyebrow"><span /> Interactive Studio</p>
          <h1>Build the signal layer<br /><em>your work deserves.</em></h1>
        </div>
        <p>Configure only what you can support with evidence. Preview the result, inspect provenance, and copy portable README Markdown.</p>
      </header>

      <form className="studio-workspace" onSubmit={preview} id="configure">
        <aside className="config-panel" aria-labelledby="config-title">
          <div className="panel-heading"><span>01</span><div><p>Configuration</p><h2 id="config-title">Your atlas</h2></div></div>

          <label className="field-label" htmlFor="studio-handle">GitHub handle</label>
          <div className="text-field prefixed"><span aria-hidden="true">@</span><input id="studio-handle" value={handle} onChange={(event) => setHandle(event.target.value)} maxLength={39} autoComplete="off" required /></div>

          <fieldset className="segmented-field">
            <legend>Data source</legend>
            <label><input aria-label="Use synthetic preview data" type="radio" name="mode" checked={demo} onChange={() => setDemo(true)} /><span><strong>Synthetic</strong><small>Safe preview</small></span></label>
            <label><input aria-label="Use live public GitHub data" type="radio" name="mode" checked={!demo} onChange={() => setDemo(false)} /><span><strong>Live public</strong><small>GitHub API</small></span></label>
          </fieldset>

          <label className="field-label" htmlFor="theme">Card theme</label>
          <select id="theme" className="select-field" value={theme} onChange={(event) => setTheme(event.target.value)}>
            <option value="ember">Ember</option><option value="aurora">Aurora</option><option value="midnight">Midnight</option><option value="paper">Paper</option>
          </select>

          <fieldset className="segmented-field">
            <legend>Atlas layout</legend>
            <label><input aria-label="Use wide atlas layout" type="radio" name="layout" checked={layout === "wide"} onChange={() => setLayout("wide")} /><span><strong>Wide</strong><small>README hero</small></span></label>
            <label><input aria-label="Use compact atlas layout" type="radio" name="layout" checked={layout === "compact"} onChange={() => setLayout("compact")} /><span><strong>Compact</strong><small>Mobile friendly</small></span></label>
          </fieldset>

          <fieldset className="segmented-field">
            <legend>Load motion</legend>
            <label><input aria-label="Use subtle card motion" type="radio" name="motion" checked={motion === "subtle"} onChange={() => setMotion("subtle")} /><span><strong>Subtle</strong><small>Reduced-motion safe</small></span></label>
            <label><input aria-label="Disable card motion" type="radio" name="motion" checked={motion === "none"} onChange={() => setMotion("none")} /><span><strong>Still</strong><small>Static export</small></span></label>
          </fieldset>

          <fieldset className="card-picker">
            <legend>Cards to copy</legend>
            {STUDIO_CARD_KINDS.map((kind) => {
              const available = isStudioCardAvailable(kind, { demo, hasCurrentContributions, hasCurrentLanguages });
              return (
                <label key={kind}>
                  <input type="checkbox" checked={selectedCards.has(kind)} disabled={!available} onChange={() => toggleCard(kind)} />
                  <span>{STUDIO_CARD_LABELS[kind]}</span>
                </label>
              );
            })}
            {!demo && !hasCurrentContributions && (
              <p className="card-availability-note">Atlas, Streak, and Activity are omitted until this live preview has contribution history.</p>
            )}
            {!demo && !hasCurrentLanguages && (
              <p className="card-availability-note">Languages stays selected but is omitted until this live preview has a complete public repository list.</p>
            )}
          </fieldset>

          <div className="project-config-heading"><div><span>02</span><h2>Projects</h2></div><button type="button" onClick={() => projects.length < 6 && setProjects((current) => [...current, { id: nextProjectId++, repo: "", lifecycle: "planned", workflow: "", docs: "", install: "", download: "" }])} disabled={projects.length >= 6}>+ Add</button></div>
          <p className="field-help">Declare lifecycle yourself. CommitAtlas never guesses it from commit recency.</p>
          <div className="project-config-list">
            {projects.map((project, index) => (
              <details key={project.id} open={index === 0}>
                <summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{project.repo || "New project"}</strong><small>{project.lifecycle}</small></summary>
                <div className="project-fields">
                  <label>Repository<input value={project.repo} onChange={(event) => updateProject(project.id, { repo: event.target.value })} maxLength={100} placeholder="repository-name" /></label>
                  <label>Lifecycle<select value={project.lifecycle} onChange={(event) => updateProject(project.id, { lifecycle: event.target.value as Lifecycle })}><option value="planned">Planned</option><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>
                  <label>Workflow (optional)<input value={project.workflow} onChange={(event) => updateProject(project.id, { workflow: event.target.value })} maxLength={120} placeholder="ci.yml" /></label>
                  <label>Docs URL (optional)<input type="url" value={project.docs} onChange={(event) => updateProject(project.id, { docs: event.target.value })} maxLength={500} placeholder="https://…" /></label>
                  <label>Install URL (optional)<input type="url" value={project.install} onChange={(event) => updateProject(project.id, { install: event.target.value })} maxLength={500} placeholder="https://…" /></label>
                  <label>Download URL (optional)<input type="url" value={project.download} onChange={(event) => updateProject(project.id, { download: event.target.value })} maxLength={500} placeholder="https://…" /></label>
                  <button className="remove-project" type="button" onClick={() => setProjects((current) => current.filter((item) => item.id !== project.id))}>Remove {project.repo || "project"}</button>
                </div>
              </details>
            ))}
          </div>
          <button className="preview-button" type="submit" disabled={phase === "loading"}>{phase === "loading" ? "Loading signals…" : "Preview atlas"}<span aria-hidden="true">→</span></button>
        </aside>

        <section className="studio-preview-panel" id="preview" aria-labelledby="preview-title">
          <div className="panel-heading preview-heading"><span>03</span><div><p>Evidence preview</p><h2 id="preview-title">@{profile.login}</h2></div><div className={`mode-chip ${profile.freshness.mode}`}><i />{profile.freshness.mode === "demo" ? "Synthetic" : profile.freshness.mode}</div></div>
          <p className={`studio-notice ${phase}`} role="status" aria-live="polite">{visibleNotice}</p>

          <div className={`atlas-preview-frame ${layout}`}>
            <picture>
              <source media="(max-width: 560px)" srcSet={compactAtlasPreviewUrl} />
              <img key={atlasPreviewUrl} src={atlasPreviewUrl} alt={`CommitAtlas developer atlas preview for @${profile.login}`} />
            </picture>
          </div>

          <div className="dashboard-heading"><div><p>Project dashboard</p><h3>{visibleBoard?.projects.length ?? activeProjects.length} declared projects</h3></div><span>Open links below</span></div>
          <div className="dashboard-list">
            {(visibleBoard?.projects ?? []).map((project) => <ProjectRow key={project.repo} project={project} draft={findProjectDraft(projects, project.name)} />)}
            {!visibleBoard && activeProjects.map((project) => <StarterProjectRow key={project.id} project={project} owner={handle.trim() || "octocat"} />)}
            {!activeProjects.length && <div className="empty-projects"><strong>No projects selected</strong><span>Add a repository to build a project-health dashboard.</span></div>}
          </div>

          <div className="markdown-panel">
            <div><p>README Markdown</p><button type="button" onClick={copyMarkdown}>Copy Markdown</button></div>
            <textarea aria-label="Generated README Markdown" readOnly value={markdown || "Select one or more cards to generate Markdown."} />
            {(baseUrl.includes("localhost") || baseUrl.includes("your-commitatlas-host.example")) && (
              <small>Run Preview to bind these URLs to this Studio origin. Local URLs are for preview only.</small>
            )}
          </div>
        </section>
      </form>

      <footer className="site-footer studio-footer"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>CommitAtlas</Link><p>Unknown stays unknown. Stale stays stale. Your work stays yours.</p><a href="https://github.com/Chris0Jeky/CommitAtlas">Source <span aria-hidden="true">↗</span></a></footer>
    </main>
  );
}

function ProjectRow({ project, draft }: { project: ProjectSnapshot; draft?: ProjectDraft }) {
  const actions = [
    ["Source", project.sourceUrl], ["Website", project.websiteUrl], ["Docs", safeProjectActionUrl(draft?.docs)],
    ["Install", safeProjectActionUrl(draft?.install)], ["Download", safeProjectActionUrl(draft?.download) || project.release?.download?.url],
    ["Release", project.release?.url], ["CI", project.ci.url],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  return (
    <article className="dashboard-project">
      <div className="project-title"><span className={`signal-dot ${ciTone(project.ci.state)}`} aria-hidden="true" /><div><h4>{project.name}</h4><p>{project.description || "No repository description supplied."}</p></div><span className="lifecycle-chip">{project.lifecycle}</span></div>
      <dl><div><dt>CI</dt><dd className={ciTone(project.ci.state)}>{project.ci.label}</dd></div><div><dt>Release</dt><dd>{project.release?.tag || "Unavailable"}</dd></div><div><dt>Language</dt><dd>{project.primaryLanguage || "Unavailable"}</dd></div><div><dt>Stars</dt><dd>{formatNumber(project.stars)}</dd></div></dl>
      {actions.length > 0 && <div className="project-actions">{actions.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}<span aria-hidden="true">↗</span></a>)}</div>}
    </article>
  );
}

function StarterProjectRow({ project, owner }: { project: ProjectDraft; owner: string }) {
  const ci = starterCiPresentation(project.workflow);
  const actions = [["Source", `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(project.repo.trim())}`], ["Docs", safeProjectActionUrl(project.docs)], ["Install", safeProjectActionUrl(project.install)], ["Download", safeProjectActionUrl(project.download)]].filter((item): item is [string, string] => Boolean(item[1]));
  return <article className="dashboard-project synthetic"><div className="project-title"><span className={`signal-dot ${ci.tone}`} aria-hidden="true" /><div><h4>{project.repo}</h4><p>Synthetic project preview — run Preview to load the API.</p></div><span className="lifecycle-chip">{project.lifecycle}</span></div><dl><div><dt>CI</dt><dd className={ci.tone}>{ci.label}</dd></div><div><dt>Release</dt><dd>Unavailable</dd></div><div><dt>Workflow</dt><dd>{ci.workflowLabel}</dd></div><div><dt>Source</dt><dd>Synthetic</dd></div></dl><div className="project-actions">{actions.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}<span aria-hidden="true">↗</span></a>)}</div></article>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const payload = await response.json() as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch { /* The status remains the truthful fallback. */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function ciTone(state: string): string {
  if (state === "passing") return "good";
  if (state === "pending") return "warn";
  if (state === "failing") return "bad";
  return "muted";
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : "—";
}
