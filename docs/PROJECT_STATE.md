# CommitAtlas project state

Last verified: 2026-08-20 18:42 BST

This is the authoritative checkpoint for the public demonstration milestone. Git, hosted CI,
deployment state, and live GitHub output outrank this file after any ref or deployment moves.

The release path is in [V0_1_PLAN.md](./V0_1_PLAN.md), the static generator and Action architecture
is in [STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md), the repeatable walkthrough is in
[DEMO_GUIDE.md](./DEMO_GUIDE.md), and detailed browser/API evidence is in
[STUDIO_QA_2026-08-20.md](./STUDIO_QA_2026-08-20.md).

## Public checkpoint

- [PR #47](https://github.com/Chris0Jeky/CommitAtlas/pull/47) was merged into `main` with merge commit
  `a39abf8afe314e1b45ce26c8f3af5a769fefb78f`.
- The exact deployed application source is
  `948c795ddd30e6a134ef72dd268c539ab1671b24`. This state-document commit is intentionally a later,
  documentation-only `main` commit.
- The public production origin is
  [commitatlas.jeky-tck.chatgpt.site](https://commitatlas.jeky-tck.chatgpt.site), with the
  [interactive Studio](https://commitatlas.jeky-tck.chatgpt.site/studio).
- Sites project: `appgprj_6a872d3f98c481919ed37186cb4d0c30`; current saved version 4:
  `appgprj_6a872d3f98c481919ed37186cb4d0c30~appgver_7aaf903ac3f481918800cc0605519aae`;
  successful deployment: `appgdep_6a873bd4a8e8819182b55da0e3d1bc78`.
- The deployment archive is bound to exact source `948c795` with content hash
  `sha256:83fb2e30d38c1dea980af5051daebe5acc6d67477464e60922accdb49670939a`.
- The repository homepage points to the public origin.
- [Hosted Quality gate run 32398474693](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32398474693)
  passed for exact deployed head `948c795`.
- The main [Chris0Jeky profile](https://github.com/Chris0Jeky) now publishes a curated CommitAtlas
  portfolio at profile-repository head `5033fb0`. Its three checked-in snapshots remain dependable
  when GitHub's anonymous API quota is exhausted and link back to the live Studio.
- There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.

## What the demonstration contains

- Responsive landing page and interactive Studio.
- Profile, streak, activity, language, and project-summary SVGs in Ember, Aurora, Midnight, and
  Paper themes.
- Synthetic and supported live-public preview paths with honest partial/unavailable states.
- README Markdown generated only for the exact configuration that succeeded.
- Up to six curated projects with lifecycle, named-workflow CI, release metadata, and safe HTML
  actions for Source, Docs, Install, Download, Release, and CI.
- Versioned profile, contribution, project, health, and SVG routes.
- Bounded validation, stable ETags, public/private cache separation, accessible SVG metadata, and
  script-blocking SVG security headers.
- Buildable `@commit-atlas/core` and `@commit-atlas/svg` packages with dry-run package proof.
- A public profile portfolio centered on Taskdeck, CommitAtlas, IdleHarbor, developer-lens,
  llm-release-gate, and MDviewer, including a real Taskdeck `v0.1.0` Windows download.

## Verified

- Full `npm.cmd run check` passed at the merged implementation:
  - core: 15 tests;
  - GitHub/API/route: 59 tests;
  - Studio: 28 tests;
  - SVG: 18 tests;
  - built/rendered product: 22 tests;
  - typecheck, ESLint, package builds/dry-run packs, and production build.
- Focused typecheck, lint, production build, and `git diff --check` passed after the final metadata
  changes.
- Hosted CI passed on the exact deployed source.
- Production `/`, `/studio`, `/api/v1/health`, `/og.png`, all five synthetic SVG routes, and the
  bounded invalid-query paths returned the expected statuses, formats, cache behavior, and security
  headers. Conditional SVG requests returned stable 304 responses.
- Live Studio preview for `Chris0Jeky` loaded public profile, languages, and six project signals;
  unavailable streak/activity cards were omitted from Markdown instead of guessed.
- Desktop 1440x900 and mobile 390x844 browser QA passed for the production site and public GitHub
  profile: no document overflow, no console errors, and all three profile snapshots loaded at their
  intrinsic dimensions. Mobile QA directly led to stacking the snapshots at readable width.
- Independent production, profile, and focused post-fix reviews found no CRITICAL/HIGH blocker. Profile figures,
  language shares, configured workflows, release links, and public-only provenance were checked
  against live GitHub state.
- The late P1 truncated-language thread was fixed in `948c795`, answered with exact proof, and
  resolved. Of 15 total PR #47 review threads, 13 are resolved. The two remaining P2 threads were
  explicitly classified and parked for later work.

## NOT verified or released

- Full sequential keyboard-only traversal. Landmarks, labels, focus styling, reduced motion, and
  accessibility metadata were inspected, but the browser-control layer could not reliably drive a
  complete Tab/Space traversal.
- Live contribution history using a token positively proved to be public-only. The configured
  authenticated GitHub CLI token has private scopes and was deliberately never installed as a
  Sites secret.
- `@commit-atlas/github`, `@commit-atlas/static`, offline fixture transport, the Node 24 Action, and
  their clean-consumer/bundle proofs.
- npm registry publication, a GitHub `v0.1.0` release, or a static generator release.

## Residual risk and next slice

- Anonymous GitHub API rate limiting is observable and can transiently return 429 from live card
  routes. The public profile therefore uses dated, checked-in snapshots; the Studio remains the
  current live preview when quota is available.
- [#45](https://github.com/Chris0Jeky/CommitAtlas/issues/45) tracks bounded contribution history
  making a displayed streak look like a lifetime best.
- [#46](https://github.com/Chris0Jeky/CommitAtlas/issues/46) tracks making synthetic-data labelling
  explicit inside every card.
- [#40](https://github.com/Chris0Jeky/CommitAtlas/issues/40) tracks deferred route-contract gaps.
- [#48](https://github.com/Chris0Jeky/CommitAtlas/issues/48) tracks the nonblocking same-key failed
  refresh/retained-evidence decision found by the post-fix review.
- Two unresolved P2 threads preserve optional-action matching after repository renames and warning
  coverage for `127.0.0.1`/`::1` preview origins; both have explicit parked replies on PR #47.
- #28, #30, #32-#34, #38, and Dependabot #5/#6 still need release-impact triage.
- The next product slice is the ordered static generator/Action implementation in
  [STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md), followed by package/release proof. Do not
  turn anonymous quota pressure into permission to use a private-capable token.

## Clean resume commands

```powershell
Set-Location 'C:\Users\Cristian3\Documents\Codex\2026-08-18\i-x20\work\CommitAtlas'
git fetch --all --prune
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
gh pr view 47 --repo Chris0Jeky/CommitAtlas --json state,mergedAt,mergeCommit
gh run list --repo Chris0Jeky/CommitAtlas --workflow ci.yml --limit 5
npm.cmd ci
npm.cmd run check
```

Open the [public Studio](https://commitatlas.jeky-tck.chatgpt.site/studio) and follow
[DEMO_GUIDE.md](./DEMO_GUIDE.md). Use the checked-in synthetic path for a deterministic walkthrough
and `Chris0Jeky` for the live-public partial-data path.
