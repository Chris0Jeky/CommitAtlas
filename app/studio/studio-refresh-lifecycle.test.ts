import assert from "node:assert/strict";
import test from "node:test";
import { isStudioCardAvailable, resolveStudioLiveEvidence } from "./studio-card-availability";
import { buildStudioMarkdown } from "./studio-markdown";
import { buildStudioGalleryCards } from "./studio-presentation";
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
 * `preview()` adds the requested configuration key to the unresolved set,
 * removes that same key only on success, and leaves it in place when the
 * request throws.
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
const OTHER_KEY = buildStudioConfigurationKey({ ...liveConfiguration, theme: "aurora" });
const SELECTED = new Set<StudioCardKind>(["profile", "streak", "languages", "projects"]);

/** Mirrors the client's `previewConfiguration`, which is written only on success. */
interface PreviewConfiguration {
  key: string;
  demo: boolean;
  hasContributions: boolean;
  hasLanguages: boolean;
  projectCount: number;
}

interface StudioState {
  demo: boolean;
  validatedPreview: { key: string; origin: string } | null;
  unresolvedRefreshKeys: ReadonlySet<string>;
  previewConfiguration: PreviewConfiguration;
  contributionsPresent: boolean;
  repositoriesTruncated: boolean;
}

const blankState: StudioState = {
  demo: false,
  validatedPreview: null,
  unresolvedRefreshKeys: new Set<string>(),
  previewConfiguration: { key: "", demo: false, hasContributions: false, hasLanguages: false, projectCount: 0 },
  contributionsPresent: false,
  repositoriesTruncated: true,
};

function startPreview(state: StudioState, key: string): StudioState {
  return { ...state, unresolvedRefreshKeys: new Set(state.unresolvedRefreshKeys).add(key) };
}

function previewFailed(state: StudioState): StudioState {
  // studio-client.tsx's catch block sets phase/notice only; every evidence
  // input and the unresolved set survive untouched.
  return { ...state };
}

function previewSucceeded(
  state: StudioState,
  key: string,
  payload: { contributionsPresent: boolean; repositoriesTruncated: boolean },
): StudioState {
  const unresolved = new Set(state.unresolvedRefreshKeys);
  unresolved.delete(key);
  return {
    ...state,
    validatedPreview: { key, origin: ORIGIN },
    unresolvedRefreshKeys: unresolved,
    previewConfiguration: {
      key,
      demo: state.demo,
      hasContributions: payload.contributionsPresent,
      hasLanguages: !payload.repositoriesTruncated,
      projectCount: liveConfiguration.projects.length,
    },
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
    unresolvedRefreshKeys: state.unresolvedRefreshKeys,
    contributionsPresent: state.contributionsPresent,
    repositoriesTruncated: state.repositoriesTruncated,
  });
  const availability = {
    demo: state.demo,
    hasCurrentContributions: evidence.hasCurrentContributions,
    hasCurrentLanguages: evidence.hasCurrentLanguages,
  };
  // The gallery reads `previewConfiguration`, never the live evidence, which is
  // what keeps the visible preview stable across an unresolved refresh.
  const galleryCards = buildStudioGalleryCards({
    selectedCards: SELECTED,
    availability: {
      demo: state.previewConfiguration.demo,
      hasCurrentContributions: state.previewConfiguration.hasContributions,
      hasCurrentLanguages: state.previewConfiguration.hasLanguages,
    },
    projectCount: state.previewConfiguration.projectCount,
  });
  const baseUrl = resolveStudioBaseUrl(currentConfigurationKey, state.validatedPreview, PLACEHOLDER);
  return {
    ...evidence,
    baseUrl,
    previewIsRetained: currentConfigurationKey !== state.previewConfiguration.key || evidence.refreshUnresolved,
    galleryKinds: galleryCards.map((card) => card.kind),
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

test("the visible gallery survives an unresolved refresh unchanged", () => {
  // The "retain the preview" half of the decision: withholding evidence must not
  // remove anything the user can currently see.
  const settled = view(settledLivePreview());
  const loading = view(startPreview(settledLivePreview(), LIVE_KEY));
  const failed = view(previewFailed(startPreview(settledLivePreview(), LIVE_KEY)));

  assert.deepEqual(settled.galleryKinds, ["profile", "streak", "languages", "projects"]);
  assert.deepEqual(loading.galleryKinds, settled.galleryKinds, "nothing disappears while loading");
  assert.deepEqual(failed.galleryKinds, settled.galleryKinds, "nothing disappears after a failure");
  // ...while the copyable surface is strictly narrower than the visible one.
  assert.ok(loading.enabledCards.length < loading.galleryKinds.length);
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

  // Edited away: the validated-key mismatch already invalidates and unbinds the origin.
  const edited = view(failed, OTHER_KEY);
  assert.equal(edited.refreshUnresolved, false);
  assert.equal(edited.hasCurrentLanguages, false);
  assert.equal(edited.baseUrl, PLACEHOLDER);

  // Edited back: the unresolved run still applies, so nothing silently re-confirms.
  const back = view(failed, LIVE_KEY);
  assert.equal(back.refreshUnresolved, true);
  assert.equal(back.hasCurrentLanguages, false);
  assert.doesNotMatch(back.markdown, /languages\.svg/);
});

test("an intervening run elsewhere does not forget an earlier unconfirmed configuration", () => {
  // Purely sequential, one run at a time. A single scalar marker would be
  // overwritten at step 3 and would re-confirm LIVE_KEY at step 4.
  const succeeded = settledLivePreview();                              // 1. preview K -> ok
  const failedHere = previewFailed(startPreview(succeeded, LIVE_KEY)); // 2. preview K -> fail
  const failedThere = previewFailed(startPreview(failedHere, OTHER_KEY)); // 3. edit, preview K2 -> fail

  assert.deepEqual([...failedThere.unresolvedRefreshKeys].sort(), [LIVE_KEY, OTHER_KEY].sort());

  const back = view(failedThere, LIVE_KEY);                            // 4. edit back to K
  assert.equal(back.refreshUnresolved, true, "K's failed run is still unresolved");
  assert.equal(back.hasCurrentContributions, false);
  assert.equal(back.hasCurrentLanguages, false);
  assert.equal(back.previewIsRetained, true, "the retained-preview label stays on");
  assert.deepEqual(back.enabledCards, ["profile", "projects"]);
  assert.doesNotMatch(back.markdown, /languages\.svg/);
  assert.doesNotMatch(back.markdown, /streak\.svg/);

  // Only a run that actually confirms K clears K.
  const confirmed = view(previewSucceeded(failedThere, LIVE_KEY, {
    contributionsPresent: true,
    repositoriesTruncated: false,
  }), LIVE_KEY);
  assert.equal(confirmed.refreshUnresolved, false);
  assert.deepEqual(confirmed.enabledCards, ["profile", "streak", "languages", "projects"]);
});

test("resolving one configuration leaves another still unconfirmed", () => {
  const failedHere = previewFailed(startPreview(settledLivePreview(), LIVE_KEY));
  const failedThere = previewFailed(startPreview(failedHere, OTHER_KEY));

  // Succeeding at K2 must not vouch for K.
  const resolvedThere = previewSucceeded(failedThere, OTHER_KEY, {
    contributionsPresent: true,
    repositoriesTruncated: false,
  });
  assert.equal(view(resolvedThere, OTHER_KEY).refreshUnresolved, false);
  assert.equal(view(resolvedThere, LIVE_KEY).refreshUnresolved, true);
});

test("the synthetic demo path is unaffected by an unresolved refresh", () => {
  // A guard, not coverage of the fix: isStudioCardAvailable short-circuits on
  // `demo`, so this holds with or without the unresolved-evidence change.
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
  assert.deepEqual(loading.galleryKinds, settled.galleryKinds);
});
