# CommitAtlas project state

Last verified: 2026-08-20 17:00 BST

This is the authoritative local checkpoint for the demonstration milestone. It is not a deployment,
merge, package-publication, or `v0.1.0` release claim. Fetch before resuming because GitHub, CI, and
review state can move after this file is committed.

The release-critical path is in [V0_1_PLAN.md](./V0_1_PLAN.md), the approved static generator and
Action architecture is in [STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md), and the repeatable
demonstration is in [DEMO_GUIDE.md](./DEMO_GUIDE.md).

## Exact checkpoint

- `main`: `a876dc30ac34134f405b7b9a7d4ed3ae181e9407`, the merge commit for
  [PR #44](https://github.com/Chris0Jeky/CommitAtlas/pull/44).
- Studio branch: `feat/studio-dashboard`.
- Last implementation head before this documentation checkpoint:
  `9f80a03043fb3b293d2b3c16f9b79aa2f450b1be`.
- Ready [PR #47](https://github.com/Chris0Jeky/CommitAtlas/pull/47) targets `main` and remains
  intentionally unmerged for the owner's visual demonstration.
- The remote branch still pointed to `984cd97a8c53b73c1b1f7019fb8c274cb5da25e3` when this local
  checkpoint was written. Do not treat the older hosted run as proof for the new implementation;
  push and inspect exact-head CI.
- No Sites deployment, GitHub release, or npm publication has been verified.
- There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.

## Demonstration milestone

The branch contains a production-buildable portfolio demonstration with:

- a responsive landing page and interactive Studio;
- profile, streak, activity, language, and project-summary SVG cards across Ember, Aurora,
  Midnight, and Paper themes;
- synthetic and supported live-public preview paths;
- selectable, copyable README Markdown bound only to the exact configuration that succeeded;
- up to six projects with owner-declared lifecycle, configured-workflow CI, release metadata, and
  safe HTML actions for Source, Docs, Install, Download, Release, and CI;
- versioned profile, contribution, project, and health JSON routes;
- bounded validation, honest unavailable/partial states, stable ETags, public/private cache
  separation, and script-blocking SVG security headers; and
- publishable `@commit-atlas/core` and `@commit-atlas/svg` packages with dry-run package proof.

The four focused implementation commits after the saved handoff are:

- `b1ef23c fix(studio): bind demo output to current evidence`
- `bcaf5b4 fix(routes): preserve bounded project configuration`
- `2f576f8 fix(studio): restore paper theme contrast`
- `9f80a03 fix(studio): retire stale project previews`

Together they close the confirmed demonstration defects: unavailable contribution cards are omitted
from live Markdown; starter CI never invents health; partial star totals disappear; zero activity is
visually zero; labels name their windows; route-affecting edits retire stale origins and project
snapshots; whitespace is normalized; workflows containing map delimiters round-trip; six maximum
project configurations stay within explicit finite bounds; action URLs use the shared host boundary;
and Paper small text passes WCAG AA contrast.

## Verification at implementation head `9f80a03`

- `npm.cmd run check` passed:
  - core: 15 tests;
  - GitHub/API/route: 59 tests;
  - Studio: 25 tests;
  - SVG package: 18 tests;
  - built/rendered product: 22 tests;
  - typecheck, ESLint, both package builds/dry-run packs, and production build.
- `git diff --check` passed.
- Two fresh independent reviews found no CRITICAL/HIGH issue: one over the main three-commit fix
  range and one over the final stale-snapshot fix.
- Production browser QA passed on the exact build at 1440x900 and 390x844 with no horizontal
  overflow or console warnings/errors.
- The full synthetic flow, live-public partial-data flow, add/remove/configure projects, all four
  themes, all five SVGs, copy output, invalid/missing-account errors, safe actions, and stale-preview
  retirement were exercised.
- Profile, contribution, project, health, and `/og.png` requests returned 200 with the expected
  types and cache policies. SVG revalidation returned an empty 304 with the same ETag and security
  headers. Unknown input returned bounded 400 JSON with `no-store`.
- Detailed evidence is in [STUDIO_QA_2026-08-20.md](./STUDIO_QA_2026-08-20.md).

## GitHub review state

The twelve concerns present when this session resumed were reproduced and classified. The code now
covers every confirmed seam, and both independent post-fix reviews found no CRITICAL/HIGH issue.
Remote review replies and thread resolutions were not posted; that is a separate GitHub write and
should be reconciled once after the final branch push.

The earlier thread links and their original wording remain preserved in
[STUDIO_QA_2026-08-20.md](./STUDIO_QA_2026-08-20.md). GitHub review state, not this prose, is the
authority after the branch moves.

## Shipped on `main`

Main already contains the repository/community metadata, canonical GPL-3.0-only licensing, locked
CI, bounded core calculations, deterministic accessible SVG renderers, hardened GitHub transport,
versioned JSON routes, all five secure SVG endpoints, and the root proving gate. Studio/dashboard
work is not on `main` until PR #47 is merged.

## NOT completed or verified

- Exact-head hosted CI and remote review reconciliation for the new branch head.
- PR #47 merge, Sites deployment, a public production URL, repository homepage update, or release.
- Full sequential keyboard-only traversal. Landmarks, names, labels, legends, live status, focus
  styling, and reduced motion were inspected, but the browser-control layer could not reliably move
  focus with Tab/Space.
- Live contribution behavior using a credential positively proved to be public-only.
- `@commit-atlas/github`, `@commit-atlas/static`, offline fixture transport, the bundled Node 24
  Action, and their clean-consumer/package/bundle proofs.
- Final API/CLI/Action/operator docs and npm registry publication.

## Residual risk

- [#45](https://github.com/Chris0Jeky/CommitAtlas/issues/45): bounded contribution history can make
  a displayed streak look like a lifetime best.
- [#46](https://github.com/Chris0Jeky/CommitAtlas/issues/46): synthetic demo SVG data is not yet
  visibly/accessibly labelled in every card.
- [#40](https://github.com/Chris0Jeky/CommitAtlas/issues/40): deferred route-contract gaps remain
  tracked rather than silently included.
- #28, #30, #32–#34, and #38 remain open and need release-impact triage.
- Dependabot #5/#6 should be reconciled after the feature dependency graph settles.
- Localhost Markdown is intentionally preview-only; it must be regenerated from the deployed origin.
- Keyboard-only traversal remains an explicit release check, not a pass.

## Next safe slice

1. Commit and push this documentation checkpoint with the four implementation commits.
2. Confirm PR #47 points to the exact pushed head, inspect hosted CI, and reconcile every remaining
   review thread once.
3. Keep the local production demo open for owner inspection. Apply only a confirmed CRITICAL/HIGH
   correction from that inspection; otherwise preserve the verified head.
4. After owner acceptance and the three-minute head-aging floor, merge PR #47 with a merge commit.
5. Continue the ordered static-generator/Action work in
   [STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md), then finish deployment and release.

## Clean resume commands

```powershell
Set-Location 'C:\Users\Cristian3\Documents\Codex\2026-08-18\i-x20\work\CommitAtlas'
git fetch --all --prune
git status --short --branch
git worktree list --porcelain
git rev-parse HEAD
git ls-remote --heads origin main feat/studio-dashboard
gh pr view 47 --repo Chris0Jeky/CommitAtlas --json headRefOid,baseRefOid,state,isDraft,mergeable,statusCheckRollup
npm.cmd ci
npm.cmd run check
npm.cmd run start
```

Open `http://localhost:3000/studio` and follow [DEMO_GUIDE.md](./DEMO_GUIDE.md). Never infer that an
old green check covers a moved base or a new head.
