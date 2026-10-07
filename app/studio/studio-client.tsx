"use client";

import type { HostedMotionProfile, ScenePack } from "@/packages/svg/src/index";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ChassisFooter, ConsoleHeader, STUDIO_LINKS } from "../chassis/console";
import { WorkflowMap } from "../chassis/workflow-map";
import {
  isStudioCardAvailable,
  projectsForValidatedPreview,
  resolveStudioLiveEvidence,
} from "./studio-card-availability";
import { buildStudioMarkdown, STUDIO_CARD_KINDS, STUDIO_CARD_LABELS } from "./studio-markdown";
import {
  configurationChangedNotice,
  contributionUnavailableNotice,
  previewLoadedNotice,
  retainedPreviewNotice,
  unconfirmedEvidenceNotice,
} from "./studio-messages";
import {
  buildStudioGalleryCards,
  describeProjectActionUrl,
  findProjectDraft,
  starterCiPresentation,
  studioSourceLabel,
} from "./studio-presentation";
import {
  buildStudioConfigurationKey,
  buildStudioRouteUrl,
  buildStudioSceneUrl,
  STUDIO_PREVIEW_DAYS,
  STUDIO_SCENE_IDS,
  STUDIO_SCENE_LABELS,
  STUDIO_SCENE_PACKS,
  isCopyableStudioOrigin,
  isStudioPreviewCurrent,
  resolveStudioBaseUrl,
  type StudioCardKind,
} from "./studio-urls";
import {
  pulseboardCardTheme,
  pulseboardEvent,
  pulseboardRepoCountBucket,
  pulseboardSmallCount,
  whenPulseboardReady,
} from "@/lib/pulseboard";
import { fetchJson } from "./studio-fetch";
import { StudioCardPreview } from "./studio-card-preview-image";
import { StudioScenePreview } from "./studio-scene-preview-image";
import { scenePreviewToken, sceneReceiptMatches, type SceneImageReceipt, type ScenePreviewView } from "./studio-scene-preview";

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
  openIssuesAndPullRequests: number;
  ci: { state: string; label: string; url: string | null; checkedAt: string | null };
  releaseState: "published" | "none" | "unavailable";
  release: { tag: string; url: string; download: { name: string; url: string } | null } | null;
}

interface ProjectBoardSnapshot {
  projects: ProjectSnapshot[];
  freshness: Freshness;
}

interface PreviewConfiguration {
  owner: string;
  projects: ProjectDraft[];
  theme: string;
  demo: boolean;
  motion: HostedMotionProfile;
  layout: "wide" | "compact";
  pack: ScenePack;
  scenes: readonly string[];
  hasContributions: boolean;
  hasLanguages: boolean;
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
  { length: STUDIO_PREVIEW_DAYS },
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
// Client-side mirror of the shared REPOSITORY rule in packages/github/src/validation.ts.
const REPOSITORY = /^(?!\.\.?$)[a-z\d._-]{1,100}$/i;

export default function StudioClient() {
  const [handle, setHandle] = useState("octocat");
  const [demo, setDemo] = useState(true);
  const [theme, setTheme] = useState("ember");
  const [motion, setMotion] = useState<HostedMotionProfile>("subtle");
  const [pack, setPack] = useState<ScenePack>("survey");
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(() => new Set());
  const [sceneView, setSceneView] = useState<ScenePreviewView>("profile");
  const [sceneReplay, setSceneReplay] = useState(0);
  const [renderedCards, setRenderedCards] = useState<ReadonlyMap<string, SceneImageReceipt>>(() => new Map());
  const [renderedScenes, setRenderedScenes] = useState<ReadonlyMap<string, SceneImageReceipt>>(() => new Map());
  const [layout, setLayout] = useState<"wide" | "compact">("wide");
  const [projects, setProjects] = useState<ProjectDraft[]>(starterProjects);
  const [selectedCards, setSelectedCards] = useState<Set<CardKind>>(() => new Set(["atlas", "projects"]));
  const [profile, setProfile] = useState<ProfileSnapshot>(starterProfile);
  const [contributions, setContributions] = useState<ContributionSnapshot | null>(starterContributions);
  const [board, setBoard] = useState<ProjectBoardSnapshot | null>(null);
  const [phase, setPhase] = useState<"ready" | "loading" | "error">("ready");
  const [notice, setNotice] = useState("Synthetic starter data — run Preview to refresh it through the API.");
  const [previewCanvas, setPreviewCanvas] = useState<"auto" | "dark" | "light">("auto");
  const [validatedPreview, setValidatedPreview] = useState<{ key: string; origin: string } | null>(null);
  // Configuration keys whose preview request has not produced a validated result.
  // A key is added when a run starts and removed only when that same key succeeds,
  // so it survives a failed refresh of an unchanged configuration. This is a set
  // rather than one key because a run for a different configuration must not
  // overwrite — and thereby forget — an earlier configuration left unconfirmed.
  const [unresolvedRefreshKeys, setUnresolvedRefreshKeys] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [previewConfiguration, setPreviewConfiguration] = useState<PreviewConfiguration>({
    owner: "octocat",
    projects: starterProjects,
    theme: "ember",
    demo: true,
    motion: "subtle",
    layout: "wide",
    pack: "survey",
    scenes: [],
    hasContributions: true,
    hasLanguages: true,
  });

  // Usage signal for the Studio itself: no props, and a no-op when the SDK is absent or blocked.
  useEffect(() => whenPulseboardReady(() => { pulseboardEvent({ name: "studio.opened", props: {} }); }), []);

  const activeProjects = useMemo(() => projects.filter((project) => project.repo.trim()), [projects]);
  const configurationKey = useMemo(() => buildStudioConfigurationKey({
    owner: handle,
    projects: activeProjects,
    theme,
    demo,
    days: STUDIO_PREVIEW_DAYS,
    motion,
    layout,
    pack,
    scenes: [...selectedScenes].sort(),
  }), [activeProjects, demo, handle, layout, motion, pack, selectedScenes, theme]);
  const previewConfigurationKey = useMemo(() => buildStudioConfigurationKey({
    owner: previewConfiguration.owner,
    projects: previewConfiguration.projects,
    theme: previewConfiguration.theme,
    demo: previewConfiguration.demo,
    days: STUDIO_PREVIEW_DAYS,
    motion: previewConfiguration.motion,
    layout: previewConfiguration.layout,
    pack: previewConfiguration.pack,
    scenes: previewConfiguration.scenes,
  }), [previewConfiguration]);
  const configurationIsValidated = isStudioPreviewCurrent(configurationKey, validatedPreview);
  const visibleBoard = configurationIsValidated ? board : null;
  const visibleProjectDrafts = configurationIsValidated ? previewConfiguration.projects : activeProjects;
  const visibleNotice = phase === "ready" && validatedPreview && !configurationIsValidated
    ? configurationChangedNotice()
    : notice;
  const { refreshUnresolved, hasCurrentContributions, hasCurrentLanguages } = resolveStudioLiveEvidence({
    demo,
    currentConfigurationKey: configurationKey,
    validatedConfigurationKey: validatedPreview?.key ?? null,
    unresolvedRefreshKeys,
    contributionsPresent: contributions !== null,
    repositoriesTruncated: profile.repositoriesTruncated,
  });
  // The gallery keeps rendering the last validated payload, so it is labelled
  // retained whenever the configuration moved on *or* the newest run for this
  // configuration has not confirmed it yet.
  const previewIsRetained = configurationKey !== previewConfigurationKey || refreshUnresolved;
  const baseUrl = resolveStudioBaseUrl(configurationKey, validatedPreview, PLACEHOLDER_BASE_URL);
  const galleryAvailability = {
    demo: previewConfiguration.demo,
    hasCurrentContributions: previewConfiguration.hasContributions,
    hasCurrentLanguages: previewConfiguration.hasLanguages,
  };
  const galleryCards = buildStudioGalleryCards({
    selectedCards,
    availability: galleryAvailability,
    projectCount: previewConfiguration.projects.length,
  });
  const previewUrls = useMemo(() => Object.fromEntries(STUDIO_CARD_KINDS.map((kind) => [kind, buildStudioRouteUrl(kind, {
    owner: previewConfiguration.owner,
    projects: previewConfiguration.projects,
    theme: previewConfiguration.theme,
    demo: previewConfiguration.demo,
    days: STUDIO_PREVIEW_DAYS,
    motion: previewConfiguration.motion,
    layout: previewConfiguration.layout,
  })])) as Record<CardKind, string>, [previewConfiguration]);
  const markdown = useMemo(() => {
    return buildStudioMarkdown({
      baseUrl,
      owner: previewConfiguration.owner,
      projects: previewConfiguration.projects,
      theme: previewConfiguration.theme,
      demo: previewConfiguration.demo,
      selectedCards,
      renderedCardIds: new Set(STUDIO_CARD_KINDS.filter(id => sceneReceiptMatches(
        renderedCards.get(id), scenePreviewToken(previewConfigurationKey, id, sceneView, sceneReplay),
        previewUrls[id], renderedCards.get(id)?.view ?? sceneView))),
      hasCurrentContributions,
      hasCurrentLanguages,
      motion: previewConfiguration.motion,
      layout: previewConfiguration.layout,
      pack: previewConfiguration.pack,
      selectedScenes,
      renderedSceneIds: new Set(STUDIO_SCENE_IDS.filter((id) => sceneReceiptMatches(
        renderedScenes.get(id), scenePreviewToken(previewConfigurationKey, id, sceneView, sceneReplay),
        buildStudioSceneUrl(id, { owner: previewConfiguration.owner, projects: previewConfiguration.projects,
          theme: previewConfiguration.theme, demo: previewConfiguration.demo, days: STUDIO_PREVIEW_DAYS,
          motion: previewConfiguration.motion, layout: previewConfiguration.layout, pack: previewConfiguration.pack }), renderedScenes.get(id)?.view ?? sceneView))),
    });
  }, [baseUrl, hasCurrentContributions, hasCurrentLanguages, previewConfiguration, previewConfigurationKey, previewUrls, renderedCards, renderedScenes, sceneView, sceneReplay, selectedCards, selectedScenes]);
  const markSceneRendered = useCallback((id: string, token: string, receipt: SceneImageReceipt | null) => {
    setRenderedScenes((current) => {
      if (receipt === null && current.get(id)?.token !== token) return current;
      const next = new Map(current);
      if (receipt) next.set(id, receipt); else next.delete(id);
      return next;
    });
  }, []);
  const markCardRendered = useCallback((id: string, token: string, receipt: SceneImageReceipt | null) => {
    setRenderedCards((current) => {
      if (receipt === null && current.get(id)?.token !== token) return current;
      const next = new Map(current);
      if (receipt) next.set(id, receipt); else next.delete(id);
      return next;
    });
  }, []);
  function changeSceneView(view: ScenePreviewView) {
    setSceneView(view);
    setSceneReplay(current => current + 1);
  }
  const sceneRouteOptions = {
    owner: previewConfiguration.owner,
    projects: previewConfiguration.projects,
    theme: previewConfiguration.theme,
    demo: previewConfiguration.demo,
    days: STUDIO_PREVIEW_DAYS,
    layout: previewConfiguration.layout,
    pack: previewConfiguration.pack,
  };
  const previewIsValidated = configurationIsValidated && !refreshUnresolved;
  const markdownReady = previewIsValidated && isCopyableStudioOrigin(baseUrl);
  const visibleMarkdown = markdownReady
    ? markdown || "Select an image and wait for its profile preview to load before copying Markdown."
    : previewIsValidated
      ? "Preview validated. README copying is available from a deployed HTTPS Studio; local previews remain local."
      : "Run Preview to validate this configuration and bind its card URLs before copying Markdown.";

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const login = handle.trim();
    if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) {
      setPhase("error");
      setNotice(retainedPreviewNotice("Enter a valid GitHub handle before previewing.", profile.login));
      return;
    }

    const invalidRepo = activeProjects.find((project) => !REPOSITORY.test(project.repo.trim()));
    if (invalidRepo) {
      setPhase("error");
      setNotice(retainedPreviewNotice("Enter a valid repository name before previewing.", profile.login));
      return;
    }

    const requestedConfigurationKey = buildStudioConfigurationKey({
      owner: login,
      projects: activeProjects,
      theme,
      demo,
      days: STUDIO_PREVIEW_DAYS,
      motion,
      layout,
      pack,
      scenes: [...selectedScenes].sort(),
    });

    setPhase("loading");
    setUnresolvedRefreshKeys((current) => new Set(current).add(requestedConfigurationKey));
    setNotice(`Loading ${demo ? "synthetic" : "live public"} GitHub signals for @${login}…`);
    try {
      const common = `user=${encodeURIComponent(login)}&demo=${demo}`;
      const contributionPromise = fetchJson<ContributionSnapshot>(`/api/v1/contributions?${common}&days=${STUDIO_PREVIEW_DAYS}`)
        .then((value) => ({ value, error: null }))
        .catch((error: unknown) => ({ value: null, error }));
      const boardPromise = (activeProjects.length
        ? fetchJson<ProjectBoardSnapshot>(buildStudioRouteUrl("projects", {
            owner: login,
            projects: activeProjects,
            theme,
            demo,
          }, "json"))
        : Promise.resolve(null))
        .then((value) => ({ value, error: null }))
        .catch((error: unknown) => ({ value: null, error }));
      const [nextProfile, contributionResult, boardResult] = await Promise.all([
        fetchJson<ProfileSnapshot>(`/api/v1/profile?${common}`),
        contributionPromise,
        boardPromise,
      ]);

      setProfile(nextProfile);
      setContributions(contributionResult.value);
      setBoard(boardResult.value);
      setSceneReplay(current => current + 1);
      setPreviewConfiguration({
        owner: login,
        projects: projectsForValidatedPreview(activeProjects, !boardResult.error),
        theme,
        demo,
        motion,
        layout,
        pack,
        scenes: [...selectedScenes].sort(),
        hasContributions: contributionResult.value !== null,
        hasLanguages: !nextProfile.repositoriesTruncated,
      });
      setValidatedPreview({ key: requestedConfigurationKey, origin: window.location.origin });
      // Resolve only this run's key; any other configuration left unconfirmed stays so.
      setUnresolvedRefreshKeys((current) => {
        const next = new Set(current);
        next.delete(requestedConfigurationKey);
        return next;
      });
      setPhase("ready");
      // Only a bucketed repository count, the data source and small counts: never the handle,
      // repository names or URLs typed into the form.
      pulseboardEvent({
        name: "profile.loaded",
        props: {
          repoCountBucket: pulseboardRepoCountBucket(nextProfile.publicRepositories),
          source: demo ? "synthetic" : "live",
          projects: pulseboardSmallCount(activeProjects.length),
          contributions: contributionResult.value !== null,
        },
      });
      setNotice(
        contributionResult.error
          ? contributionUnavailableNotice()
          : boardResult.error
            ? "Available public signals loaded. Project board is unavailable for this preview and was omitted; no value was guessed."
            : previewLoadedNotice(demo),
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
    setRenderedCards(current => { const next = new Map(current); next.delete(kind); return next; });
    setSelectedCards((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  async function copyMarkdown() {
    if (!markdownReady) {
      setNotice("Run Preview on the deployed Studio before copying README Markdown.");
      return;
    }
    if (!markdown) {
      setNotice("Select at least one card before copying Markdown.");
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      setNotice("README Markdown copied to your clipboard.");
      pulseboardEvent({
        name: "card.exported",
        props: { format: "markdown", theme: pulseboardCardTheme(theme), cards: pulseboardSmallCount(selectedCards.size) },
      });
    } catch {
      setNotice("Clipboard access was unavailable. Select the Markdown and copy it manually.");
    }
  }

  return (
    <>
      <a className="skip-link" href="#configure">Skip to the configuration</a>
      <div className="survey" aria-hidden="true" />
      <ConsoleHeader section="Studio" reference="ATL/CH-REV-B" links={STUDIO_LINKS} />

      <main className="studio-page">
      <header className="studio-hero shell">
        <p className="eyebrow"><span aria-hidden="true" /> 00 // Interactive Studio</p>
        <h1>Build the signal layer<br /><em>your work deserves.</em></h1>
        <p>Configure only what you can support with evidence. Preview the result, inspect provenance, and copy portable README Markdown.</p>
      </header>
      <WorkflowMap compact />

      <form className="studio-workspace shell" onSubmit={preview} id="configure" tabIndex={-1}>
        <aside className="config-panel" aria-labelledby="config-title">
          <div className="panel-heading"><span>01</span><div><p>Configuration</p><h2 id="config-title">Your atlas</h2></div></div>

          <label className="field-label" htmlFor="studio-handle">GitHub handle</label>
          <div className="text-field prefixed"><span aria-hidden="true">@</span><input id="studio-handle" value={handle} onChange={(event) => setHandle(event.target.value)} maxLength={39} autoComplete="off" required /></div>

          <fieldset className="segmented-field">
            <legend>Data source</legend>
            <label><input type="radio" name="mode" checked={demo} onChange={() => setDemo(true)} /><span><strong>Synthetic</strong><small>Safe preview</small></span></label>
            <label><input type="radio" name="mode" checked={!demo} onChange={() => setDemo(false)} /><span><strong>Live public</strong><small>GitHub API</small></span></label>
          </fieldset>

          <label className="field-label" htmlFor="theme">Card theme</label>
          <select id="theme" className="select-field" value={theme} onChange={(event) => setTheme(event.target.value)}>
            <option value="ember">Ember</option><option value="aurora">Aurora</option><option value="midnight">Midnight</option><option value="paper">Paper</option>
          </select>

          <fieldset className="segmented-field">
            <legend>Atlas layout</legend>
            <label><input type="radio" name="layout" checked={layout === "wide"} onChange={() => setLayout("wide")} /><span><strong>Wide</strong><small>README hero</small></span></label>
            <label><input type="radio" name="layout" checked={layout === "compact"} onChange={() => setLayout("compact")} /><span><strong>Compact</strong><small>Mobile friendly</small></span></label>
          </fieldset>

          <fieldset className="segmented-field">
            <legend>Load motion</legend>
            <label><input type="radio" name="motion" checked={motion === "subtle"} onChange={() => setMotion("subtle")} /><span><strong>Subtle</strong><small>Reduced-motion safe</small></span></label>
            <label><input type="radio" name="motion" checked={motion === "ambient"} onChange={() => setMotion("ambient")} /><span><strong>Ambient</strong><small>Subtle-compatible</small></span></label>
            <label><input type="radio" name="motion" checked={motion === "none"} onChange={() => setMotion("none")} /><span><strong>Still</strong><small>Static export</small></span></label>
          </fieldset>

          <fieldset className="segmented-field">
            <legend>Scene pack</legend>
            {STUDIO_SCENE_PACKS.map((value) => (
              <label key={value}>
                <input type="radio" name="pack" checked={pack === value} onChange={() => setPack(value)} />
                <span><strong>{value[0].toUpperCase() + value.slice(1)}</strong><small>{value === "survey" ? "Default geometry" : "Alternate geometry"}</small></span>
              </label>
            ))}
          </fieldset>

          <fieldset className="card-picker">
            <legend>Scenes to show &amp; copy</legend>
            {STUDIO_SCENE_IDS.map((id) => (
              <label key={id}>
                <input type="checkbox" checked={selectedScenes.has(id)} onChange={() => setSelectedScenes((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })} />
                <span>{STUDIO_SCENE_LABELS[id]}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="preview-tools">
            <legend>Preview tools</legend>
            <p>Apply to all card and scene previews. Each image also has its own controls.</p>
            <button type="button" onClick={() => changeSceneView("profile")} disabled={selectedScenes.size === 0 && selectedCards.size === 0} aria-pressed={sceneView === "profile"}>Profile view</button>
            <button type="button" onClick={() => changeSceneView("profile")} disabled={selectedScenes.size === 0 && selectedCards.size === 0}>Replay</button>
            <button type="button" onClick={() => changeSceneView("reduced")} disabled={selectedScenes.size === 0 && selectedCards.size === 0} aria-pressed={sceneView === "reduced"}>Reduced-motion view</button>
            <button type="button" onClick={() => changeSceneView("frame-zero")} disabled={selectedScenes.size === 0 && selectedCards.size === 0} aria-pressed={sceneView === "frame-zero"}>Frame zero</button>
          </fieldset>

          <fieldset className="card-picker">
            <legend>Cards to show &amp; copy</legend>
            {STUDIO_CARD_KINDS.map((kind) => {
              const available = isStudioCardAvailable(kind, { demo, hasCurrentContributions, hasCurrentLanguages });
              return (
                <label key={kind}>
                  <input type="checkbox" checked={selectedCards.has(kind)} disabled={!available} onChange={() => toggleCard(kind)} />
                  <span>{STUDIO_CARD_LABELS[kind]}</span>
                </label>
              );
            })}
            {!demo && refreshUnresolved && (
              <p className="card-availability-note">{unconfirmedEvidenceNotice()}</p>
            )}
            {!demo && !refreshUnresolved && !hasCurrentContributions && (
              <p className="card-availability-note">Atlas, Streak, Breakdown, Rhythm, and Activity are omitted until this live preview has contribution history.</p>
            )}
            {!demo && !refreshUnresolved && !hasCurrentLanguages && (
              <p className="card-availability-note">Languages stays selected but is omitted until this live preview has a complete public repository list.</p>
            )}
          </fieldset>

          <div className="project-config-heading"><div><span>02</span><h2>Projects</h2></div><button type="button" aria-label={`Add project (${projects.length} of 6 configured)`} onClick={() => projects.length < 6 && setProjects((current) => [...current, { id: nextProjectId++, repo: "", lifecycle: "planned", workflow: "", docs: "", install: "", download: "" }])} disabled={projects.length >= 6}>+ Add</button></div>
          <p className="field-help">Declare lifecycle yourself. CommitAtlas never guesses it from commit recency.</p>
          <div className="project-config-list">
            {projects.map((project, index) => (
              <details key={project.id} open={index === 0}>
                <summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{project.repo || "New project"}</strong><small>{project.lifecycle}</small></summary>
                <div className="project-fields">
                  <label>Repository<input aria-label={`Project ${index + 1} repository`} value={project.repo} onChange={(event) => updateProject(project.id, { repo: event.target.value })} maxLength={100} placeholder="repository-name" /></label>
                  <label>Lifecycle<select aria-label={`Project ${index + 1} lifecycle`} value={project.lifecycle} onChange={(event) => updateProject(project.id, { lifecycle: event.target.value as Lifecycle })}><option value="planned">Planned</option><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>
                  <label>Workflow (optional)<input aria-label={`Project ${index + 1} workflow (optional)`} value={project.workflow} onChange={(event) => updateProject(project.id, { workflow: event.target.value })} maxLength={120} placeholder="ci.yml" /></label>
                  <label>Docs URL (optional)<input aria-label={`Project ${index + 1} docs URL (optional)`} type="text" value={project.docs} onChange={(event) => updateProject(project.id, { docs: event.target.value })} maxLength={500} placeholder="https://…" inputMode="url" /></label>
                  <label>Install URL (optional)<input aria-label={`Project ${index + 1} install URL (optional)`} type="text" value={project.install} onChange={(event) => updateProject(project.id, { install: event.target.value })} maxLength={500} placeholder="https://…" inputMode="url" /></label>
                  <label>Download URL (optional)<input aria-label={`Project ${index + 1} download URL (optional)`} type="text" value={project.download} onChange={(event) => updateProject(project.id, { download: event.target.value })} maxLength={500} placeholder="https://…" inputMode="url" /></label>
                  <button className="remove-project" type="button" aria-label={`Remove project ${index + 1}: ${project.repo || "new project"}`} onClick={() => setProjects((current) => current.filter((item) => item.id !== project.id))}>Remove {project.repo || "project"}</button>
                </div>
              </details>
            ))}
          </div>
          {/*
            This `disabled` is load-bearing for the unresolved-evidence invariant, not
            just a double-submit guard. It is the only thing keeping two preview runs
            from overlapping: with two in flight for the same configuration, the first
            to resolve would delete a key the second still owns and re-confirm evidence
            the second has not returned. Comparing keys would not help — both runs share
            one. Allowing concurrent runs requires a monotonic run id, so that a
            resolving run clears the marker only if it is still the newest for its key.
          */}
          <button className="preview-button" type="submit" disabled={phase === "loading"}>{phase === "loading" ? "Loading signals…" : "Preview atlas"}<span aria-hidden="true">→</span></button>
        </aside>

        <section className="studio-preview-panel" id="preview" aria-labelledby="preview-title">
          <div className="panel-heading preview-heading"><span>03</span><div><p>Evidence preview</p><h2 id="preview-title">@{profile.login}</h2></div><div className={`mode-chip ${profile.freshness.mode}`}><i />{profile.freshness.mode === "demo" ? "Synthetic" : profile.freshness.mode}</div></div>
          <p className={`studio-notice ${phase}`} role="status" aria-live="polite">{visibleNotice}</p>

          <div className="gallery-heading">
            <div><p>Selected card gallery</p><h3>{galleryCards.length} preview{galleryCards.length === 1 ? "" : "s"}</h3></div>
            <fieldset className="preview-canvas-control">
              <legend>Preview canvas</legend>
              {(["auto", "dark", "light"] as const).map((canvas) => (
                <label key={canvas}>
                  <input type="radio" name="preview-canvas" checked={previewCanvas === canvas} onChange={() => setPreviewCanvas(canvas)} />
                  <span>{canvas[0].toUpperCase() + canvas.slice(1)}</span>
                </label>
              ))}
            </fieldset>
          </div>

          <div className={`studio-card-gallery canvas-${previewCanvas}`}>
            {galleryCards.map((card) => (
              <StudioCardPreview
                key={scenePreviewToken(previewConfigurationKey, card.kind, sceneView, sceneReplay)}
                card={card}
                url={previewUrls[card.kind]}
                stillUrl={buildStudioRouteUrl(card.kind, { ...sceneRouteOptions, motion: "none" })}
                view={sceneView}
                token={scenePreviewToken(previewConfigurationKey, card.kind, sceneView, sceneReplay)}
                onRendered={markCardRendered}
                login={profile.login}
                source={studioSourceLabel(card.kind === "profile" || card.kind === "languages"
                  ? profile.freshness.source
                  : card.kind === "projects"
                    ? board?.freshness.source ?? (previewConfiguration.demo ? "synthetic-demo" : "")
                    : contributions?.freshness.source ?? (previewConfiguration.demo ? "synthetic-demo" : ""))}
                retained={previewIsRetained}
              />
            ))}
            {!galleryCards.length && (
              <div className="empty-gallery">
                <strong>No card previews selected</strong>
                <span>Select an available card in Configuration to show it here and include it in Markdown.</span>
              </div>
            )}
            {STUDIO_SCENE_IDS.filter((id) => previewConfiguration.scenes.includes(id)).map((id) => (
              <StudioScenePreview
                key={scenePreviewToken(previewConfigurationKey, id, sceneView, sceneReplay)}
                id={id}
                title={STUDIO_SCENE_LABELS[id]}
                pack={previewConfiguration.pack}
                url={buildStudioSceneUrl(id, { ...sceneRouteOptions, motion: previewConfiguration.motion })}
                stillUrl={buildStudioSceneUrl(id, { ...sceneRouteOptions, motion: "none" })}
                view={sceneView}
                token={scenePreviewToken(previewConfigurationKey, id, sceneView, sceneReplay)}
                onRendered={markSceneRendered}
              />
            ))}
          </div>

          <div className="dashboard-heading"><div><p>Project dashboard</p><h3>{visibleBoard?.projects.length ?? visibleProjectDrafts.length} declared projects</h3></div><span>Open links below</span></div>
          <div className="dashboard-list">
            {(visibleBoard?.projects ?? []).map((project) => <ProjectRow key={project.repo} project={project} draft={findProjectDraft(projects, project.name)} />)}
            {!visibleBoard && visibleProjectDrafts.map((project) => <StarterProjectRow key={project.id} project={project} owner={handle.trim() || "octocat"} />)}
            {!visibleProjectDrafts.length && <div className="empty-projects"><strong>No project board available</strong><span>Add repositories or run Preview again to build a project-health dashboard.</span></div>}
          </div>

          <div className="markdown-panel">
            <div><p>README Markdown</p><button type="button" onClick={copyMarkdown} disabled={!markdownReady || !markdown}>Copy Markdown</button></div>
            <textarea aria-label="Generated README Markdown" readOnly value={visibleMarkdown} />
            {/*
              The withheld-evidence explanation also lives beside the card picker, in the
              other column. Repeat it here: this is where the short Markdown is read and
              copied, so the reason it is short has to be legible without looking away.
            */}
            {!demo && refreshUnresolved && (
              <small>{unconfirmedEvidenceNotice()}</small>
            )}
            {!markdownReady && (
              <small>{previewIsValidated
                ? "This preview is valid, but local URLs remain preview-only. Open the deployed Studio to copy portable README Markdown."
                : "Copy stays disabled until Preview validates this exact configuration on a deployed Studio. Local URLs remain preview-only."}</small>
            )}
          </div>
        </section>
      </form>

      </main>
      <ChassisFooter note="Unknown stays unknown · Stale stays stale · Your work stays yours" />
    </>
  );
}

function ProjectRow({ project, draft }: { project: ProjectSnapshot; draft?: ProjectDraft }) {
  const docs = describeProjectActionUrl(draft?.docs);
  const install = describeProjectActionUrl(draft?.install);
  const download = describeProjectActionUrl(draft?.download);
  // An invalid typed download stays visible instead of being masked by the release fallback.
  const downloadHref = download.href ?? (download.raw ? null : project.release?.download?.url ?? null);
  const actions = [
    ["Source", project.sourceUrl], ["Website", project.websiteUrl], ["Docs", docs.href],
    ["Install", install.href], ["Download", downloadHref],
    ["Release", project.release?.url], ["CI", project.ci.url],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const invalid = [
    { label: "Docs", presentation: docs },
    { label: "Install", presentation: install },
    { label: "Download", presentation: download },
  ].filter((item) => item.presentation.error);
  return (
    <article className="dashboard-project">
      <div className="project-title"><span className="signal-mark" data-state={project.ci.state} aria-hidden="true" /><div><h4>{project.name}</h4><p>{project.description || "No repository description supplied."}</p></div><span className="lifecycle-chip">{project.lifecycle}</span></div>
      <dl><div><dt>CI</dt><dd className={ciTone(project.ci.state)}>{project.ci.label}</dd></div><div><dt>Release</dt><dd className={project.releaseState === "unavailable" ? "unknown" : undefined}>{releaseLabel(project)}</dd></div><div><dt>Language</dt><dd>{project.primaryLanguage || "Unavailable"}</dd></div><div><dt>Stars</dt><dd>{formatNumber(project.stars)}</dd></div></dl>
      {(actions.length > 0 || invalid.length > 0) && <div className="project-actions">{actions.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}<span aria-hidden="true">↗</span></a>)}{invalid.map(({ label, presentation }) => <span key={label} className="project-action-invalid">{label}: {presentation.raw} <small role="alert">{presentation.error}</small></span>)}</div>}
    </article>
  );
}

function releaseLabel(project: ProjectSnapshot): string {
  if (project.release) return project.release.tag;
  return project.releaseState === "none" ? "None observed" : "Unavailable";
}

function StarterProjectRow({ project, owner }: { project: ProjectDraft; owner: string }) {
  const ci = starterCiPresentation(project.workflow);
  const docs = describeProjectActionUrl(project.docs);
  const install = describeProjectActionUrl(project.install);
  const download = describeProjectActionUrl(project.download);
  const actions = [["Source", `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(project.repo.trim())}`], ["Docs", docs.href], ["Install", install.href], ["Download", download.href]].filter((item): item is [string, string] => Boolean(item[1]));
  const invalid = [
    { label: "Docs", presentation: docs },
    { label: "Install", presentation: install },
    { label: "Download", presentation: download },
  ].filter((item) => item.presentation.error);
  return <article className="dashboard-project synthetic"><div className="project-title"><span className="signal-mark" data-state={ci.state} aria-hidden="true" /><div><h4>{project.repo}</h4><p>Synthetic project preview — run Preview to load the API.</p></div><span className="lifecycle-chip">{project.lifecycle}</span></div><dl><div><dt>CI</dt><dd className={ci.tone}>{ci.label}</dd></div><div><dt>Release</dt><dd>Unavailable</dd></div><div><dt>Workflow</dt><dd>{ci.workflowLabel}</dd></div><div><dt>Source</dt><dd>Synthetic</dd></div></dl><div className="project-actions">{actions.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}<span aria-hidden="true">↗</span></a>)}{invalid.map(({ label, presentation }) => <span key={label} className="project-action-invalid">{label}: {presentation.raw} <small role="alert">{presentation.error}</small></span>)}</div></article>;
}

/**
 * Tone for the CI value text.
 *
 * `stale` is warn rather than muted: it is a real observation that has aged out of the freshness
 * window, which is a finding, not an absence. The two genuine absences stay untinted so they can
 * never be mistaken for a reading.
 */
function ciTone(state: string): string {
  if (state === "passing") return "good";
  if (state === "pending" || state === "stale") return "warn";
  if (state === "failing") return "bad";
  return "unknown";
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : "—";
}
