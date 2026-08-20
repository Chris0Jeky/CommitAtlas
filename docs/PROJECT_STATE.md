# CommitAtlas project state

Last verified: 2026-08-20 14:48 BST

This is an intentional end-of-session checkpoint, not a completion or release claim. GitHub, Git,
CI, branches, worktrees, and open work were re-read before this file was updated. Fetch again when
resuming because live evidence outranks this checkpoint.

The release-critical path is in [V0_1_PLAN.md](./V0_1_PLAN.md). The approved static generator and
Action architecture is in [STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md).

## Live repository snapshot

- `main`: `f1a8f74868a820d42e0909af52272bd7a849b7bf`, the merge commit for
  [PR #39](https://github.com/Chris0Jeky/CommitAtlas/pull/39).
- The `main` Quality gate at that exact commit passed in
  [run 32373584839](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32373584839).
- Open pull requests are only Dependabot
  [#5](https://github.com/Chris0Jeky/CommitAtlas/pull/5) and
  [#6](https://github.com/Chris0Jeky/CommitAtlas/pull/6). Their last listed checks were green, but
  they should be reconciled only after the feature dependency graph settles.
- Open issues are exactly [#28](https://github.com/Chris0Jeky/CommitAtlas/issues/28),
  [#30](https://github.com/Chris0Jeky/CommitAtlas/issues/30),
  [#32](https://github.com/Chris0Jeky/CommitAtlas/issues/32),
  [#33](https://github.com/Chris0Jeky/CommitAtlas/issues/33),
  [#34](https://github.com/Chris0Jeky/CommitAtlas/issues/34),
  [#38](https://github.com/Chris0Jeky/CommitAtlas/issues/38), and
  [#40](https://github.com/Chris0Jeky/CommitAtlas/issues/40).
- No Sites deployment, repository homepage, versioned release, or verified npm publication exists.
- There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.

## Shipped on `main`

The mainline now includes:

- Product identity, responsive Sites-compatible Vinext workspace, repository/community metadata,
  locked CI, Dependabot, secret scanning, and canonical GPL-3.0-only licensing.
- `@commit-atlas/core` bounded inputs and truthful calculations for contribution calendars,
  streaks, activity, language bytes, lifecycle, and CI freshness.
- `@commit-atlas/svg` deterministic, XML-safe, card-level accessible profile, streak, activity,
  language, and project-summary renderers across four themes. The package prepack-builds ES2020
  JavaScript and declarations and carries its GPL license.
- Versioned JSON profile, contribution, project, and health routes with bounded upstream transport,
  stable ETags, public/private cache separation, configured-workflow CI truth, public-only
  credential proof, rate-limit conversion, bounded upstream text, and private-repository oracle
  regressions.
- Root gates for typecheck, lint, core/API/SVG tests, package dry-run packs, production build, and
  rendered Worker smoke tests.

PR #39 merged only after the final head
`5794d9e11ba3c975f0b7ec8d966e2f3cd5a700e0` passed the full local gate, clean package-consumer
proof, fresh independent review, exact-head hosted CI, the aging floor, and review-thread
reconciliation. Its outer SVG descriptions now carry chronological activity summaries; the maximum
366-day adversarial fixtures remained below 30,000 UTF-8 bytes. Issues #20, #21, #31, #36, and #37
closed with that merge.

## Saved implementation branches

### Five SVG routes — pushed, no PR

- Former auxiliary worktree: `work/CommitAtlas-routes` (removed without force after remote proof)
- Branch: `feat/svg-card-routes`
- Remote head: `f76d097ff096f0988a14069268b033e984eb74cb`
- Current-main merge on the branch: `e581d69`
- Pull request: none

The branch implements:

- `/api/v1/cards/profile.svg`
- `/api/v1/cards/streak.svg`
- `/api/v1/cards/activity.svg`
- `/api/v1/cards/languages.svg`
- `/api/v1/projects.svg`
- strict duplicate/unknown query validation and canonical contracts;
- byte-exact ETags, 200/304 security-header parity, public cache policies, and private `no-store`;
- snapshot adapters and built-Worker demo/live-shaped route tests.

An independent review of prior head `418073d` found two direct truth defects: truncated repository
aggregates appeared complete, and absent contribution days were zero-filled. The single blocker-fix
commit `f76d097` now omits stars for truncated profiles, rejects truncated language distributions,
requires complete contiguous requested contribution windows, trims any older boundary day before
streak calculations, and preserves a complete all-zero calendar as a valid zero result.

Recorded exact-head local evidence at `f76d097`:

- `npm.cmd run typecheck` — passed
- `npm.cmd run lint` — passed
- `npm.cmd run test:github` — 45 passed
- built SVG Worker focused tests — 9 passed
- `npm.cmd run check` — passed: core 13, SVG 18, built Worker 19, both package dry-runs
- `git diff --check origin/main...HEAD` — clean

The corrected head has not received its required fresh post-fix review, hosted CI, aging window, or
PR merge. Do not claim it is shipped. Lower-priority reviewed gaps—canonical-query cache
fragmentation, omission of `lib/svg-routes.test.ts` from the root gate, and planned lifecycle mapping
to experimental—are explicitly retained in [#40](https://github.com/Chris0Jeky/CommitAtlas/issues/40).

The removed worktree's literal final ignored status was:

```text
!! .next/
!! .vinext/
!! .wrangler/
!! dist/
!! node_modules/
!! packages/core/dist/
!! packages/core/tsconfig.tsbuildinfo
!! packages/svg/dist/
!! tsconfig.tsbuildinfo
```

These were reproducible dependencies/build outputs; nothing was copied out or needed to survive.
The tracked status was clean and the remote SHA exactly matched before plain removal.

### Studio/dashboard — pushed, not integrated

- Worktree: `work/CommitAtlas` (primary checkout)
- Branch: `feat/studio-dashboard` (all checkpoint commits are pushed)
- Last product/plan head before the closeout-only state commits:
  `4159acdda5ccf98a3ced442e3df71440d4b8eb47`
- Pull request: none

This branch contains the responsive landing page and accessible Studio, synthetic and public-data
preview modes, four themes, selectable cards, up to six declared projects, truthful partial-data
handling, HTTPS HTML actions, copyable README Markdown, and the original branded `public/og.png`.
It is intentionally behind `main` while the routes are reviewed. After the route PR lands, merge the
new mainline into this branch, include each configured workflow in `projectUrl`, and bind all five
real SVG surfaces.

The earlier root gate and 1440x900/390x844 visual pass predate API/route integration and are
historical only. Production browser QA must explicitly try to reproduce the earlier development-only
React “multiple renderers concurrently rendering the same context provider” warning.

### Static generator and local Action — architecture saved

No implementation branch exists. The decisions that were previously only in an architecture-agent
report are now durable in [STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md): publish a shared
`@commit-atlas/github` boundary, distinguish unavailable contributions from zero, use strict raw
synthetic HTTP fixtures, keep config/output repository-contained, atomically replace exactly five
files, and bundle a non-publishing Node 24 Action with a fail-closed token policy.

## Verification at this checkpoint

- Fetched/read remote refs and confirmed `origin/main` at `f1a8f748`.
- Confirmed PR #39 merged, its exact-head and post-merge Quality gates passed, and no implementation
  PR remains open.
- Confirmed open PRs are #5 and #6 and open issues are #28, #30, #32–#34, #38, and #40.
- Pushed `feat/svg-card-routes` from `1179d30` to `f76d097`; `git ls-remote` then matched the local
  SHA exactly.
- Confirmed `feat/studio-dashboard` matched its remote before the checkpoint edits and pushed the
  new plan/state commits successfully.
- Removed the tracked-clean route auxiliary worktree without force after recording ignored output.
- No agents remain running and no secrets or private data were added to the checkpoint.

## Not completed or not verified

- Fresh review, ready PR, hosted CI, aging floor, and merge for the five SVG route branch.
- Studio/main integration and final production browser, accessibility, cache, error, copy, link, and
  responsive QA.
- `@commit-atlas/github`, the static generator, offline fixture system, bundled Node 24 Action, and
  their consumer/package proofs.
- Final operator/security/API/CLI/Action docs, Sites deployment, public URL, GitHub homepage,
  production social metadata, and GitHub `v0.1.0` release.
- Live contribution behavior with a credential that the service positively proves is public-only.
- npm registry publication; it remains optional and must not be claimed without direct proof.

## Next safe slice

1. Fetch `origin`, recreate `work/CommitAtlas-routes` detached from `origin/main`, switch to the
   existing `feat/svg-card-routes` branch, and confirm exact head `f76d097`.
2. Run one fresh scoped independent review of only the two corrected truth boundaries. If clean,
   open one ready PR, run exact-head hosted CI, observe the three-minute floor, reconcile review
   threads once, and merge with a merge commit.
3. Merge the resulting `origin/main` into `feat/studio-dashboard`, integrate workflows and all five
   route URLs, then run the full production desktop/mobile/keyboard/accessibility/error/cache pass.
4. Follow [STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md) in its recorded commit order.
5. Reconcile Dependabot, finish truthful docs, deploy through Sites, verify the exact public origin,
   update repository metadata, and create `v0.1.0` only from the final proved commit.

## Clean resume commands

```powershell
Set-Location 'C:\Users\Cristian3\Documents\Codex\2026-08-18\i-x20\work\CommitAtlas'
git fetch --all --prune
git status --short --branch
git worktree list --porcelain
git ls-remote --heads origin main feat/svg-card-routes feat/studio-dashboard
gh pr list --repo Chris0Jeky/CommitAtlas --state open
gh issue list --repo Chris0Jeky/CommitAtlas --state open --limit 100

git worktree add --detach '..\CommitAtlas-routes' origin/main
git -C '..\CommitAtlas-routes' switch feat/svg-card-routes
git -C '..\CommitAtlas-routes' status --short --branch
```

Start by reading this file, `V0_1_PLAN.md`, and `STATIC_GENERATOR_PLAN.md`. Never infer that an old
green check covers a moved base or a new head.
