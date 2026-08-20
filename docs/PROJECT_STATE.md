# CommitAtlas project state

Last verified: 2026-08-20 13:56 BST

This is an intentional end-of-session checkpoint, not a completion or release claim. GitHub, Git,
CI, and unresolved review threads were re-read before this file was updated. Fetch again when
resuming because live evidence outranks this checkpoint.

The detailed remaining build plan is in [V0_1_PLAN.md](./V0_1_PLAN.md).

## Live repository snapshot

- `main`: `975b69429b6b5ec417e5868930c229ec6d7bd9cc`, the merge commit for
  [PR #25](https://github.com/Chris0Jeky/CommitAtlas/pull/25).
- Open implementation PR: [#39](https://github.com/Chris0Jeky/CommitAtlas/pull/39), SVG release
  hardening. It is deliberately blocked as described below.
- Open dependency PRs: [#5](https://github.com/Chris0Jeky/CommitAtlas/pull/5) and
  [#6](https://github.com/Chris0Jeky/CommitAtlas/pull/6). Reconcile them late, after feature branch
  integration, so their checks exercise the final dependency graph.
- No Sites deployment, repository homepage, versioned release, or npm publication exists yet.
- There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.

## Shipped on `main`

The baseline now includes:

- Product identity, responsive Sites-compatible Vinext workspace, repository/community metadata,
  locked CI, Dependabot, secret scanning, and canonical GPL-3.0-only licensing.
- `@commit-atlas/core` bounded inputs and truthful calculations for contribution calendars,
  streaks, activity, language bytes, lifecycle, and CI freshness.
- `@commit-atlas/svg` deterministic profile, streak, activity, language, and project-summary
  renderers across four themes. Release hardening remains in PR #39 and is not shipped.
- Versioned JSON profile, contribution, project, and health routes from PR #25, with bounded
  upstream transport, stable ETags, public/private cache separation, configured-workflow CI truth,
  public-only credential proof, and private-repository oracle regressions.
- Root checks for typecheck, lint, core/API/SVG tests, package dry-run packs, production build, and
  rendered Worker smoke tests.

PR #25 merged only after exact-head CI passed, a scoped security re-review passed, and all review
threads were reconciled. Its retained nonblocking work is tracked in
[#30](https://github.com/Chris0Jeky/CommitAtlas/issues/30),
[#32](https://github.com/Chris0Jeky/CommitAtlas/issues/32),
[#33](https://github.com/Chris0Jeky/CommitAtlas/issues/33),
[#34](https://github.com/Chris0Jeky/CommitAtlas/issues/34), and
[#38](https://github.com/Chris0Jeky/CommitAtlas/issues/38).

## Saved implementation branches

### SVG release hardening v3 — pushed, reviewed, blocked

- Former worktree: `work/CommitAtlas-svg-v3` (removed after the pushed head was verified)
- Branch: `fix/svg-release-hardening-v3`
- Pull request: [#39](https://github.com/Chris0Jeky/CommitAtlas/pull/39)
- Pushed head: `78a444a7f52ca1779cf738699fec97006be4690d`
- Hosted Quality gate at that head: passed.
- Local evidence: root `npm run check`; SVG 17/17; package dry-run; clean Node consumer import;
  `git diff --check`; and maximum 366-day activity outputs of 26,841 bytes (ampersand), 27,245
  bytes (apostrophe), and 26,437 bytes (emoji), all below the 30,000-byte contract.

Do not merge this head. `main` moved after PR #25 merged, so the branch needs a merge from current
`origin/main` and exact-head reproof. More importantly, both the connector review and an independent
fresh-context review found the same accessibility defect: the chronological date/count summary is
on a child of `<svg role="img">`, whose descendants are presentational to assistive technology.
Move that summary into the outer SVG's accessible description, remove the ineffective nested
group, and add a regression that checks the root description plus the worst-case byte budget.

PR #39 has one unresolved review thread for that defect. Its body currently closes #20, #21, #31,
#36, and #37; those issues must remain open until the corrected, current-base PR is proved and
merged. The lower review observation is that fill-grouped visual paths are not literally in date
order; because they are `aria-hidden`, this is not the current accessibility blocker, but the issue
#36 acceptance wording should be reconciled truthfully before closure.

### SVG route foundation — pushed, no PR

- Former worktree: `work/CommitAtlas-routes` (removed after the pushed head was verified)
- Branch: `feat/svg-card-routes`
- Base: current `main` at `975b69429b6b5ec417e5868930c229ec6d7bd9cc`
- Head: `1179d301aa0a8a43ea02e9161b396b265d877d63`
- Remote branch: `origin/feat/svg-card-routes` at the same head.
- Commits: `48b7f88` adds strict canonical query contracts and duplicate-key rejection;
  `1179d30` adds the secure SVG response helper with byte-exact SHA-256 ETags, 200/304 header
  parity, public/private cache modes, CORS/CORP, and restrictive SVG security headers.
- Evidence: focused query/HTTP tests 20/20; typecheck; lint; full `npm run check`; and
  `git diff --check` all passed.

This lane is intentionally foundation-only. It does not yet expose an SVG endpoint. Do not open a
PR until the renderer base is settled and the five thin routes are implemented.

### Studio/dashboard — pushed, not integrated

- Worktree: `work/CommitAtlas` (primary checkout)
- Branch: `feat/studio-dashboard`
- Parent of this checkpoint commit: `4159acdda5ccf98a3ced442e3df71440d4b8eb47`
- No pull request is open because the generated SVG endpoints do not exist yet.

This branch contains the responsive landing page and accessible Studio, synthetic and public-data
preview modes, four themes, selectable cards, up to six declared project configurations, truthful
partial-data handling, HTTPS HTML actions, copyable README Markdown, and the original branded
`public/og.png`. It is 21 mainline commits behind and has ten unique commits including this checkpoint;
merge current `origin/main` only after the SVG and route work lands, then preserve the union of all
tests. The Studio must also include each configured workflow in generated project URLs.

The previous root `npm run check` and 1440x900/390x844 visual pass were green before API/route
integration. They are historical evidence, not proof of the final product. Repeated Vite hot reloads
once logged React's “multiple renderers concurrently rendering the same context provider” warning;
production-server QA must explicitly attempt to reproduce it.

## Verification at this checkpoint

- Git was fetched from every remote and all three active worktrees were inventoried.
- API PR #25 is confirmed merged at `975b694`; its exact-head Quality gate passed.
- PR #39 is confirmed open at `78a444a`, with a passed Quality gate and one unresolved,
  non-outdated accessibility review thread.
- Open PRs are exactly #39, #6, and #5. Open issues are #20, #21, #28, #30–#34, and #36–#38.
- The SVG and route auxiliary worktrees were tracked-clean, contained only reproducible ignored
  dependencies/build output, and were removed without force after their remote SHAs matched.
- No secrets or private data were added to the saved state.

## Not completed or not verified

- A corrected, current-base SVG head; exact-head CI/review; and PR #39 merge.
- The five SVG HTTP routes, adapters, full demo/live-shaped route tests, or a route PR.
- Studio integration, production browser/accessibility/cache/error QA, or a final social metadata
  check through a deployed origin.
- The static generator package, bundled Node 24 Action, operator documentation, Sites deployment,
  public URL, GitHub homepage, `v0.1.0` GitHub release, or npm publication.
- Live contribution behavior with a real credential that the service can positively prove is
  public-only.
- The root form `npm pack --dry-run --workspace @commit-atlas/svg`; the repository does not declare
  npm workspaces. Package-local dry-run packing passed.

## Next safe slice

1. On `fix/svg-release-hardening-v3`, merge current `origin/main`, fix the outer SVG accessible
   description, add the focused regression, and re-run the full/local package checks.
2. Push that corrected head, reply to and resolve the single review thread with evidence, wait for
   exact-head hosted CI and the required aging window, obtain a fresh scoped review, then merge PR
   #39 with a merge commit.
3. Update `feat/svg-card-routes` from the new `main`; finish the adapters and five thin routes in
   small commits; run built-Worker route smokes and open one ready PR.
4. Merge the resulting mainline into `feat/studio-dashboard`, integrate real route URLs and
   workflows, then repeat the full production browser and accessibility pass.
5. Continue with `packages/static`, the bundled Node 24 Action, final docs, Sites deployment,
   repository metadata, and the `v0.1.0` release exactly as specified in V0_1_PLAN.md.

## Clean resume commands

```powershell
Set-Location 'C:\Users\Cristian3\Documents\Codex\2026-08-18\i-x20\work\CommitAtlas'
git fetch --all --prune
git status --short --branch
git worktree list --porcelain
gh pr list --repo Chris0Jeky/CommitAtlas --state open
gh pr view 39 --repo Chris0Jeky/CommitAtlas --json headRefOid,state,statusCheckRollup,mergeStateStatus,url
gh issue list --repo Chris0Jeky/CommitAtlas --state open --limit 100
```

Start by reading this file and `V0_1_PLAN.md`; do not infer that an old green check covers a moved
base or a new head. Recreate an auxiliary worktree from `origin/main` in detached state and switch
to the named saved branch before editing it.
