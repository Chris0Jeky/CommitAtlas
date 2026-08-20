# CommitAtlas project state

Last verified: 2026-08-20 16:13 BST

This is an intentional stop checkpoint, not a completion, deployment, or release claim. GitHub,
Git, CI, branches, worktrees, and open work were re-read before it was committed. Fetch again when
resuming because live evidence outranks this checkpoint.

The release-critical path is in [V0_1_PLAN.md](./V0_1_PLAN.md). The approved static generator and
Action architecture is in [STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md).

## Exact live snapshot

- `main`: `a876dc30ac34134f405b7b9a7d4ed3ae181e9407`, the merge commit for
  [PR #44](https://github.com/Chris0Jeky/CommitAtlas/pull/44).
- The `main` CI run for that exact commit passed in
  [run 32380339084](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32380339084).
- Saved Studio branch: `feat/studio-dashboard`; its last code head before this docs-only checkpoint
  is `022dd5d72c5989ec056b273aecbcdb7ff1acf9d4` and was verified byte-for-byte after push.
- Ready [PR #47](https://github.com/Chris0Jeky/CommitAtlas/pull/47) targets `main`, is mergeable, and
  has a passing exact-head Quality gate in
  [run 32384234212](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32384234212).
- Production desktop/mobile browser QA was completed and is preserved in
  [STUDIO_QA_2026-08-20.md](./STUDIO_QA_2026-08-20.md). A fresh independent review then found one
  HIGH copy-truth blocker, so PR #47 is intentionally open and unmerged.
- Open pull requests are Studio [#47](https://github.com/Chris0Jeky/CommitAtlas/pull/47) and
  Dependabot [#5](https://github.com/Chris0Jeky/CommitAtlas/pull/5) and
  [#6](https://github.com/Chris0Jeky/CommitAtlas/pull/6).
- Open issues are [#28](https://github.com/Chris0Jeky/CommitAtlas/issues/28),
  [#30](https://github.com/Chris0Jeky/CommitAtlas/issues/30),
  [#32](https://github.com/Chris0Jeky/CommitAtlas/issues/32),
  [#33](https://github.com/Chris0Jeky/CommitAtlas/issues/33),
  [#34](https://github.com/Chris0Jeky/CommitAtlas/issues/34),
  [#38](https://github.com/Chris0Jeky/CommitAtlas/issues/38),
  [#40](https://github.com/Chris0Jeky/CommitAtlas/issues/40),
  [#45](https://github.com/Chris0Jeky/CommitAtlas/issues/45), and
  [#46](https://github.com/Chris0Jeky/CommitAtlas/issues/46).
- No Sites deployment or GitHub `v0.1.0` release has been verified. npm publication remains an
  optional separate decision and must not be claimed without registry proof.
- There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.

GitHub REST, GraphQL, and Git were all available during this closeout. PR #47 had no posted reviews,
inline comments, or review threads; GraphQL reported 1,063 remaining requests at the snapshot. The
independent local review finding remains binding even though GitHub currently reports the PR as
mergeable.

## Shipped on `main`

The mainline now includes:

- Product identity, responsive Sites-compatible Vinext workspace, repository/community metadata,
  locked CI, Dependabot, secret scanning, and canonical GPL-3.0-only licensing.
- `@commit-atlas/core` bounded inputs and truthful calculations for contribution calendars,
  streaks, activity, language bytes, lifecycle, and CI freshness. PR #43 additionally rejects
  duplicate normalized full slugs and unsafe workflow identities.
- `@commit-atlas/svg` deterministic, XML-safe, card-level accessible profile, streak, activity,
  language, and project-summary renderers across four themes. The package prepack-builds ES2020
  JavaScript and declarations and carries its GPL license.
- Versioned JSON profile, contribution, project, and health routes with bounded upstream transport,
  stable ETags, public/private cache separation, configured-workflow CI truth, public-only
  credential proof, rate-limit conversion, bounded upstream text, and private-repository oracle
  regressions.
- Five secure SVG endpoints: profile, streak, activity, languages, and projects. PR #44 binds
  contribution calculations to a complete requested UTC window, rejects future upstream days, and
  preserves 200/304 header parity and fail-closed JSON errors.
- Root gates for typecheck, lint, core/API/Studio/SVG tests, package dry-run packs, production build,
  and rendered Worker smoke tests.

The route sequence landed as reviewed fixed head
`dff9c8825d262e4ceb625e67c399be06a6c3640e` and merge commit `a876dc3`. The superseded route PR #41
was closed; issue #42 closed through PR #44. Reviewed nonblocking route/card gaps remain tracked in
#40, #45, and #46 rather than being silently folded into the blocker round.

## Saved Studio/dashboard milestone

The primary checkout is the sole remaining registered worktree:

- Path: `work/CommitAtlas`
- Branch: `feat/studio-dashboard`
- Last implementation head before this checkpoint commit:
  `022dd5d72c5989ec056b273aecbcdb7ff1acf9d4`
- Current-main integration commit: `64ad6a6ad82da9416235755d2d12d01baf8f4227`
- Focused integration commit: `69ecd13 fix(studio): bind workflows to shipped card routes`
- Production-QA fix commit: `022dd5d fix(studio): close production QA blockers`
- Pull request: [#47](https://github.com/Chris0Jeky/CommitAtlas/pull/47), ready and intentionally
  unmerged pending the contribution-card copy fix

The branch contains the responsive landing page and accessible Studio, synthetic and public-data
preview modes, four themes, selectable cards, up to six declared projects, truthful partial-data
handling, HTTPS HTML actions, copyable README Markdown, and the branded `public/og.png`.

The focused integration adds one tested URL builder for all five shipped card paths, keeps the JSON
and SVG project paths distinct, includes only aligned nonblank configured workflows, preserves
theme/demo/activity-day semantics, and keeps the placeholder host until an API preview succeeds.
The QA fix contains the landing glow at mobile widths and makes failed previews disclose that the
prior preview remains visible. The merge resolution preserved the union of Studio shell tests and
all API/transport regressions.

Exact-head local evidence at `022dd5d`:

- `npm.cmd ci` — passed; 483 packages, zero reported vulnerabilities
- `npm.cmd run test:studio` — 7 passed
- `npm.cmd run typecheck` — passed
- `npm.cmd run lint` — passed
- `npm.cmd run check` — passed: core 15, GitHub/API 48, Studio 7, SVG 18, rendered HTML/SVG 22,
  package builds and dry-run packs
- `git diff --check origin/main...HEAD` — clean
- `git ls-remote --heads origin feat/studio-dashboard` — exactly matched `022dd5d`
- Exact-head hosted Quality gate — passed
- Production desktop/mobile, live/synthetic, copy/action, error, SVG, ETag/304, `/og.png`, overflow,
  and console checks — passed as detailed in [STUDIO_QA_2026-08-20.md](./STUDIO_QA_2026-08-20.md)

The route auxiliary worktree was tracked-clean, remotely preserved, merged, and removed without
force. Its ignored dependency/build outputs were reproducible and needed no copy-out.

The only registered Git worktree is the primary checkout. Reproducible scratch directories remain
outside the repository at `review-artifacts`, `work/cf-types`, `work/workers-types-latest`,
`work/package-review`, `work/svg-consumer`, and the three detached review clones under `work`. A
read-only inventory found no unique source or dirty tracked files; an optional recursive cleanup was
rejected by the sandbox policy and was not bypassed. They do not affect repository status and may be
removed in a later user-approved local cleanup.

## Static generator and local Action

No implementation branch exists. The approved design is durable in
[STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md). Its first prerequisite—core manifest and
workflow hardening—is now merged. Remaining work starts by extracting the existing hardened GitHub
transport/adapters into publishable `@commit-atlas/github`, then adds an explicit unavailable SVG
state, repository-contained static config and raw synthetic fixtures, exact-five-file generation,
and a deterministic non-publishing Node 24 Action.

## NOT completed or verified

- The focused fix for the confirmed HIGH review blocker: live public Markdown must omit Streak and
  Activity while contribution data is unavailable instead of generating two 503 image URLs.
- Full sequential keyboard traversal, which the available browser-control layer could not prove.
- Post-fix production regression QA, fresh independent review, exact-head hosted CI, renewed aging
  floor, final thread reconciliation, and merge for PR #47.
- `@commit-atlas/github`, `@commit-atlas/static`, offline fixture transport, the bundled Node 24
  Action, and their clean-consumer/package/bundle proofs.
- Final API/CLI/Action/operator docs, Sites deployment, exact public URL, production social metadata,
  repository homepage, and GitHub `v0.1.0` release.
- Live contribution behavior with a credential that the service positively proves is public-only.
- npm registry publication.

## Residual risk

- #45: bounded contribution history can still make a displayed streak look like a lifetime best.
- #46: synthetic demo SVG data is not yet labelled visibly/accessibly in every card.
- #40: deferred route contract/canonicalization gaps remain explicit.
- #28, #30, #32–#34, and #38 remain open and must be triaged against actual release impact.
- Dependabot #5/#6 should be reconciled only after the feature dependency graph settles.
- PR #47 currently copies two broken contribution-card URLs in a supported live/no-token state;
  leave it unmerged until the bounded fix and post-fix proof are complete.
- Keyboard semantics and focus styling were inspected, but a complete keyboard-only traversal is
  still not verified due the browser-control limitation.

## Next safe slice

1. Fetch and confirm PR #47 still points to the saved branch; inspect any newer commit rather than
   assuming this checkpoint is current.
2. Implement only the contribution-card availability/copy fix specified in
   [STUDIO_QA_2026-08-20.md](./STUDIO_QA_2026-08-20.md).
3. Rerun focused and full gates plus the affected production browser paths, push the fix, obtain a
   fresh exact-head independent review and hosted CI, reconcile threads, observe the renewed aging
   floor, and merge PR #47 with a merge commit only when every gate is green.
4. Repeat the full keyboard-only traversal with a capable driver or a real keyboard before release.
5. Address #45 and #46 before release unless direct product evidence proves they are nonblocking.
6. Continue the remaining ordered commits in `STATIC_GENERATOR_PLAN.md`; then reconcile dependencies,
   finish truthful docs, deploy through Sites, browser-verify the public origin, and release `v0.1.0`.

## Clean resume commands

```powershell
Set-Location 'C:\Users\Cristian3\Documents\Codex\2026-08-18\i-x20\work\CommitAtlas'
git fetch --all --prune
git status --short --branch
git worktree list --porcelain
git rev-parse HEAD
git ls-remote --heads origin main feat/studio-dashboard
gh api --paginate 'repos/Chris0Jeky/CommitAtlas/pulls?state=open&per_page=100'
gh api --paginate 'repos/Chris0Jeky/CommitAtlas/issues?state=open&per_page=100'
gh pr view 47 --repo Chris0Jeky/CommitAtlas --json headRefOid,baseRefOid,state,isDraft,mergeable,statusCheckRollup
npm.cmd ci
npm.cmd run check
```

Start by reading this file, `V0_1_PLAN.md`, and `STATIC_GENERATOR_PLAN.md`. Never infer that an old
green check covers a moved base or a new head.
