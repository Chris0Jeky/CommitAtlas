import assert from "node:assert/strict";
import test from "node:test";
import { isStudioCardAvailable, resolveStudioLiveEvidence } from "./studio-card-availability";
import { buildStudioMarkdown } from "./studio-markdown";
import { buildStudioConfigurationKey, resolveStudioBaseUrl, type StudioCardKind } from "./studio-urls";

/**
 * Regression coverage for the same-key Studio refresh window (issue #48).
 *
 * `StudioClient` keeps the previously validated profile, contributions, and
 * gallery on screen while a retry of an *unchanged* configuration is in flight
 * and after that retry fails. Before this fix nothing distinguished that window
 * from a settled preview, so card availability — and therefore the copyable
 * README Markdown — kept asserting evidence from a superseded response.
 *
 * The model below mirrors the state transitions in `studio-client.tsx`:
 * `preview()` records the requested configuration key as unresolved, clears it
 * only on success, and leaves it set when the request throws.
 */

const ORIGIN = "https://studio.example";
const PLACEHOLDER = "https://your-commitatlas-host.example";

const liveConfiguration = {
  owner: "octocat",
  projects: [{ repo: "Hello-World", lifecycle: "active" }],
  theme: "ember",
  demo: false,
  days: 365,
  motion: "subtle" as const,
  layout: "wide" as const,
};

const LIVE_KEY = buildStudioConfigurationKey(liveConfiguration);
const SELECTED = new Set<StudioCardKind>(["profile", "streak", "languages", "projects"]);

interface StudioState {
  demo: boolean;
  validatedPreview: { key: string; origin: string } | null;
  unresolvedRefreshKey: string | null;
  previewConfigurationKey: string;
  contributionsPresent: boolean;
  repositoriesTruncated: boolean;
}

const blankState: StudioState = {
  demo: false,
  validatedPreview: null,
  unresolvedRefreshKey: null,
  previewConfigurationKey: "",
  contributionsPresent: false,
  repositoriesTruncated: true,
};

function startPreview(state: StudioState, key: string): StudioState {
  return { ...state, unresolvedRefreshKey: key };
}

function previewFailed(state: StudioState): StudioState {
  // studio-client.tsx's catch block sets phase/notice only; every evidence
  // input and the unresolved key survive untouched.
  return { ...state };
}

function previewSucceeded(
  state: StudioState,
  key: string,
  payload: { contributionsPresent: boolean; repositoriesTruncated: boolean },
): StudioState {
  return {
    ...state,
    validatedPreview: { key, origin: ORIGIN },
    unresolvedRefreshKey: null,
    previewConfigurationKey: key,
    contributionsPresent: payload.contributionsPresent,
    repositoriesTruncated: payload.repositoriesTruncated,
  };
}

/** Mirrors the derivation block in `studio-client.tsx`. */
function view(state: StudioState, currentConfigurationKey = LIVE_KEY) {
  const evidence = resolveStudioLiveEvidence({
    demo: state.demo,
    currentConfigurationKey,
    validatedConfigurationKey: state.validatedPreview?.key ?? null,
    unresolvedRefreshKey: state.unresolvedRefreshKey,
    contributionsPresent: state.contributionsPresent,
    repositoriesTruncated: state.repositoriesTruncated,
  });
  const availability = {
    demo: state.demo,
    hasCurrentContributions: evidence.hasCurrentContributions,
    hasCurrentLanguages: evidence.hasCurrentLanguages,
  };
  const baseUrl = resolveStudioBaseUrl(currentConfigurationKey, state.validatedPreview, PLACEHOLDER);
  return {
    ...evidence,
    baseUrl,
    previewIsRetained: currentConfigurationKey !== state.previewConfigurationKey || evidence.refreshUnresolved,
    enabledCards: [...SELECTED].filter((kind) => isStudioCardAvailable(kind, availability)),
    markdown: buildStudioMarkdown({
      baseUrl,
      owner: liveConfiguration.owner,
      projects: liveConfiguration.projects,
      theme: liveConfiguration.theme,
      demo: state.demo,
      selectedCards: SELECTED,
      hasCurrentContributions: evidence.hasCurrentContributions,
      hasCurrentLanguages: evidence.hasCurrentLanguages,
      motion: liveConfiguration.motion,
      layout: liveConfiguration.layout,
    }),
  };
}

/** A complete live preview has already succeeded for `LIVE_KEY`. */
function settledLivePreview(): StudioState {
  return previewSucceeded(blankState, LIVE_KEY, {
    contributionsPresent: true,
    repositoriesTruncated: false,
  });
}

test("a settled live preview backs every evidence-gated card", () => {
  const settled = view(settledLivePreview());
  assert.equal(settled.refreshUnresolved, false);
  assert.equal(settled.hasCurrentContributions, true);
  assert.equal(settled.hasCurrentLanguages, true);
  assert.equal(settled.previewIsRetained, false);
  assert.deepEqual(settled.enabledCards, ["profile", "streak", "languages", "projects"]);
  assert.match(settled.markdown, /languages\.svg/);
  assert.match(settled.markdown, /streak\.svg/);
});

test("a loading same-key refresh withholds evidence-gated cards from Markdown", () => {
  const loading = view(startPreview(settledLivePreview(), LIVE_KEY));

  assert.equal(loading.refreshUnresolved, true);
  assert.equal(loading.hasCurrentContributions, false, "the in-flight response may lack contributions");
  assert.equal(loading.hasCurrentLanguages, false, "the in-flight response may be repository-truncated");

  // The visible preview is preserved and labelled, not torn down.
  assert.equal(loading.previewIsRetained, true);
  assert.equal(loading.baseUrl, ORIGIN, "the validated origin still served this configuration");

  // Copyable Markdown drops every card whose evidence is no longer the latest word.
  assert.deepEqual(loading.enabledCards, ["profile", "projects"]);
  assert.doesNotMatch(loading.markdown, /languages\.svg/);
  assert.doesNotMatch(loading.markdown, /streak\.svg/);
  assert.match(loading.markdown, /profile\.svg/);
  assert.match(loading.markdown, /projects\.svg/);
});

test("a failed same-key refresh keeps evidence-gated cards withheld", () => {
  const failed = view(previewFailed(startPreview(settledLivePreview(), LIVE_KEY)));

  assert.equal(failed.refreshUnresolved, true);
  assert.equal(failed.hasCurrentContributions, false);
  assert.equal(failed.hasCurrentLanguages, false);
  assert.equal(failed.previewIsRetained, true, "the gallery is labelled as a retained preview");
  assert.deepEqual(failed.enabledCards, ["profile", "projects"]);
  assert.doesNotMatch(failed.markdown, /languages\.svg/);
  assert.doesNotMatch(failed.markdown, /streak\.svg/);
});

test("a successful same-key refresh restores exactly what the new response supports", () => {
  const restored = view(previewSucceeded(
    startPreview(settledLivePreview(), LIVE_KEY),
    LIVE_KEY,
    { contributionsPresent: true, repositoriesTruncated: false },
  ));

  assert.equal(restored.refreshUnresolved, false);
  assert.equal(restored.hasCurrentContributions, true);
  assert.equal(restored.hasCurrentLanguages, true);
  assert.equal(restored.previewIsRetained, false);
  assert.deepEqual(restored.enabledCards, ["profile", "streak", "languages", "projects"]);
  assert.match(restored.markdown, /languages\.svg/);
});

test("a successful same-key refresh that is truncated does not restore Languages", () => {
  const truncated = view(previewSucceeded(
    startPreview(settledLivePreview(), LIVE_KEY),
    LIVE_KEY,
    { contributionsPresent: true, repositoriesTruncated: true },
  ));

  assert.equal(truncated.refreshUnresolved, false);
  assert.equal(truncated.hasCurrentContributions, true);
  assert.equal(truncated.hasCurrentLanguages, false, "the fresh response is the one that decides");
  assert.deepEqual(truncated.enabledCards, ["profile", "streak", "projects"]);
  assert.doesNotMatch(truncated.markdown, /languages\.svg/);
});

test("editing away from a failed refresh and back keeps the evidence unconfirmed", () => {
  const failed = previewFailed(startPreview(settledLivePreview(), LIVE_KEY));
  const otherKey = buildStudioConfigurationKey({ ...liveConfiguration, theme: "aurora" });

  // Edited away: the validated-key mismatch already invalidates and unbinds the origin.
  const edited = view(failed, otherKey);
  assert.equal(edited.refreshUnresolved, false);
  assert.equal(edited.hasCurrentLanguages, false);
  assert.equal(edited.baseUrl, PLACEHOLDER);

  // Edited back: the unresolved run still applies, so nothing silently re-confirms.
  const back = view(failed, LIVE_KEY);
  assert.equal(back.refreshUnresolved, true);
  assert.equal(back.hasCurrentLanguages, false);
  assert.doesNotMatch(back.markdown, /languages\.svg/);
});

test("the synthetic demo path is unaffected by an unresolved refresh", () => {
  const demoKey = buildStudioConfigurationKey({ ...liveConfiguration, demo: true });
  const settledDemo = previewSucceeded({ ...blankState, demo: true }, demoKey, {
    contributionsPresent: true,
    repositoriesTruncated: false,
  });

  const settled = view(settledDemo, demoKey);
  const loading = view(startPreview(settledDemo, demoKey), demoKey);

  assert.deepEqual(settled.enabledCards, ["profile", "streak", "languages", "projects"]);
  assert.deepEqual(loading.enabledCards, settled.enabledCards);
  assert.equal(loading.markdown, settled.markdown, "synthetic Markdown is byte-identical mid-refresh");
  assert.equal(loading.baseUrl, settled.baseUrl);
});
