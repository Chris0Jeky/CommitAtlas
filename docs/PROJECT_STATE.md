# CommitAtlas project state

Last verified: 2026-08-21 00:33 BST

This is the authoritative checkpoint for the public demonstration. Git, hosted CI, Sites deployment
state, and the live profile outrank this file after any ref or deployment moves.

The release path is in [V0_1_PLAN.md](./V0_1_PLAN.md), the static contract is in
[STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md), the walkthrough is in
[DEMO_GUIDE.md](./DEMO_GUIDE.md), and the complete evidence matrix is in
[RELEASE_CANDIDATE_QA_2026-08-20.md](./RELEASE_CANDIDATE_QA_2026-08-20.md).

## Public checkpoint

- Exact deployed application implementation: `1cdabfa37981866cfedad5571fb2221e9cb9d67e` on `main`.
- Latest executable/static-producer checkpoint: `ff9a836cb80f51a98c0f5a28b63c5c36d4e4da4d`.
  Exact-head hosted [Quality gate run 32429814147](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32429814147)
  passed; this follow-up changes only the generated project-catalog label and Action bundle, so Sites
  remains correctly bound to the preceding application source.
- Production: [commitatlas.jeky-tck.chatgpt.site](https://commitatlas.jeky-tck.chatgpt.site),
  including the [interactive Studio](https://commitatlas.jeky-tck.chatgpt.site/studio).
- Sites project `appgprj_6a872d3f98c481919ed37186cb4d0c30`, saved version 8
  `appgprj_6a872d3f98c481919ed37186cb4d0c30~appgver_ce7ba7650f4081918e20eb11349e7563`,
  successful deployment `appgdep_6a878b5c6cf081918fa41544eec87638`.
- The deployed archive is bound to `1cdabfa` with content hash
  `sha256:1a01930041b32ee65f2347cd47f85fbfcf10ffaad3f0f3c1c48c084e9d40d3bb`.
- Public profile repository head: `4651009639e23aad79e106cbdb6ec3bcd2749491`.
- Exact profile [refresh run 32429850680](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/32429850680)
  passed every generation, validation, catalog, commit, and push step and produced that bot snapshot.
- Repository description, production homepage, GPL-3.0-only licence, and 14 focused topics are
  published. There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.

## What now exists

- Eight selectable SVG surfaces: Atlas, Profile, Streak, Breakdown, Rhythm, Activity, Languages,
  and Projects. The landing page and Studio expose the complete suite instead of hiding the richer
  contribution views behind one overview.
- Atlas combines a 365-day density heatmap, total and active days, average and peak, current and
  window-bounded longest streaks, contribution mix, 28-day momentum, public-repository languages,
  project health, and the transparent Rhythm score.
- Breakdown distinguishes exact categorized counts from GitHub public-profile percentages. Public
  percentages are visibly and accessibly labelled as annual profile-view data, not requested-window
  counts. Rhythm is explicitly a personal consistency signal, not a GitHub rank.
- Wide 860x380 and compact 480x570 Atlas layouts plus responsive focused cards. Ember, Aurora,
  Midnight, and Paper themes support `motion=none|subtle`; subtle motion is transform-only, leaves
  essential content visible at frame zero, and includes a reduced-motion override.
- Responsive landing page and interactive Studio with synthetic and supported live-public modes,
  theme/layout/motion controls, bounded six-project configuration, lazy selected-card previews,
  provenance, errors, and copyable README Markdown.
- Versioned JSON/SVG endpoints with bounded validation, canonical queries, cache separation, stable
  ETags, accessible XML-safe SVG metadata, and strict script/object/frame blocking headers.
- Curated lifecycle and named-workflow CI signals. Source, Website, CI, Release, Release download,
  Docs, Install, and Download destinations appear only when observed or explicitly configured;
  individual action links remain in HTML/Markdown because an embedded README SVG cannot reliably
  expose multiple click targets.
- Credential-free `@commit-atlas/static` CLI and Node 24 GitHub Action. One snapshot can create the
  eight canonical SVGs, an optional compact Atlas, `projects.json`, `projects.md`, and a byte/SHA-256
  manifest while removing only known stale CommitAtlas artifacts.
- Buildable `@commit-atlas/core`, `@commit-atlas/github`, `@commit-atlas/svg`, and
  `@commit-atlas/static` packages with canonical GPL-3.0-only package metadata and clean-consumer
  pack/import proof.
- Four separated upstream failure meanings. A missing public resource returns `github_not_found`
  with HTTP 404 and one message that never says whether the resource is absent or private; a rate
  limit stays `github_rate_limited` with HTTP 429 and retry guidance; every other upstream failure
  stays `github_unavailable` with HTTP 502. Optional release and workflow lookups treat only 404 as
  absence, so a throttled optional lookup can no longer read as "no release" or a clean CI signal.
- The [Chris0Jeky profile](https://github.com/Chris0Jeky) now leads with the responsive Atlas, shows
  Breakdown and Rhythm visibly, retains the Project radar and four optional focused widgets, and
  renders a marker-bounded six-project catalog with observed/configured action links. Its daily
  workflow validates 11 payload artifacts and every manifest hash before updating README/assets.

## Verified

- Final `npm.cmd run check` passed at `1cdabfa`: core 20, GitHub/API 79, Studio 34, SVG 25,
  static generator 9, Action 2, packaging 3, rendered product/API 28, plus TypeScript, ESLint, four
  package builds/packs, Action bundle parity, and the production Vinext build.
- Two bounded review rounds closed the misleading public-percentage scope defects. A separate
  catalog security/truth review and exact-head profile consumer review found no remaining
  CRITICAL/HIGH blocker.
- Production version 8 returned 200 for health and all eight deterministic synthetic SVG routes.
  Every exercised SVG returned the intended cache policy and CSP; an unknown query returned bounded
  400 with `Cache-Control: no-store`.
- The production landing page exposes all eight real SVG responses. The Studio exposes eight
  selected previews, all controls, project evidence, and eight-line Markdown. Breakdown/Rhythm,
  Atlas, and the Studio gallery were visually inspected on the deployed site with no clipping at the
  available 798-pixel browser width.
- The public GitHub profile was inspected after the hosted refresh. GitHub wrapped the focused cards
  cleanly in the narrow profile column, loaded the Atlas and Project radar, and rendered the dynamic
  six-row action catalog with working destinations and no document-level horizontal overflow.
- Profile consumer tests pass 4/4; catalog replacement is idempotent and fail-closed; the final
  manifest contains exactly 11 expected artifacts whose committed byte counts and SHA-256 hashes
  match. All nine SVGs parse as XML and contain no script, `foreignObject`, event handlers, external
  resources, credentials, or private-data strings.
- The final QA pass corrected GitHub REST `open_issues_count` labelling to `open issues/PRs` in both
  generator and profile consumer. Static tests pass 9/9, Action tests 2/2, TypeScript and ESLint pass,
  and the public profile DOM exposes the corrected label.

## NOT verified or released

- Complete sequential keyboard-only traversal. Landmarks, names, controls, focus styling,
  accessible SVG text, reduced motion, and mouse interaction were exercised, but the available
  controller did not prove every Tab/Space transition.
- A fresh exact-head 1440x900 and 390x844 production screenshot pair. Those widths passed on the
  preceding responsive baseline; the final insight suite was visually exercised at the available
  798-pixel browser width and through its 720/480 SVG layouts and rendered tests.
- Token-backed private contribution history. The service and profile intentionally use public
  evidence and never request private repository details.
- npm registry publication or a GitHub `v0.1.0` release. Packages and the Action are built and used
  from immutable commits, but registry/release availability is not claimed.

## Residual risk and next slice

- Anonymous request-time GitHub availability remains bounded but intermittent. During final QA,
  live Profile returned 429 and live Breakdown returned 502 twice, while live Languages and every
  synthetic route succeeded. The scheduled, hash-checked profile snapshot is the deliberate
  last-known-good surface. Do not install a private-capable personal token merely to hide anonymous
  rate limits.
- GitHub Actions emits a non-failing warning that pinned Node 20 JavaScript actions are forced onto
  Node 24. The exact hosted gates pass; update those immutable pins only in a reviewed slice.
- Open nonblocking work is tracked in #48, #49, and #50. #50 covers stricter generated
  catalog boundaries; #49 covers direct package-renderer bounds. Do not reopen the completed
  demonstration review loop unless release-impact evidence promotes an item.
- #33 and #34 close the reviewed response-contract gaps. Two of those five items were already
  satisfied on `main` and are now regression-covered rather than reimplemented: the contribution
  window was already inclusive and exactly the requested UTC day count, and synthetic category
  totals were already bounded by the requested window in `8cb53ab`.
- The token-backed GraphQL path needed its own not-found handling. GitHub answers an unknown login
  with HTTP 200 carrying both `data.user: null` and a `NOT_FOUND` entry in `errors`, so the generic
  payload-error path claimed it as an outage first. GraphQL now classifies its own payload and
  emits the shared not-found contract, proven with a fixture matching that live shape.
- One reviewed 403 conflation is deliberately left alone and tracked separately: a genuine
  non-rate-limit 403, such as a blocked repository or an organisation restriction, is still
  reported as `github_rate_limited`. That predates this slice on every required lookup.
- That slice renames one public JSON field. `ProjectSnapshot.openIssues` and the generated
  `projects.json` entry key are now `openIssuesAndPullRequests`, because GitHub REST
  `open_issues_count` counts pull requests too; `projects.md` already said `open issues/PRs` and is
  unchanged. `PROJECT_CATALOG_VERSION` is therefore `2`. The consumer's only compatibility gate is
  that number, so leaving it at `1` would let a version-1 reader accept a shape it cannot validate.
  Version 2 is meant to cover the combined shape change including #53's added action keys, so #53
  must land under version 2 rather than bump again.
- The next bounded milestone is release preparation: finish keyboard QA if tooling permits,
  reconcile release-impact dependencies/issues, rerun exact-head proof/review, then decide the
  GitHub `v0.1.0` and optional npm publication separately.

## Clean resume commands

```powershell
Set-Location 'C:\Users\Cristian3\Documents\Codex\2026-08-18\i-x20\work\CommitAtlas'
git fetch --all --prune
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
gh run list --repo Chris0Jeky/CommitAtlas --workflow ci.yml --limit 5
npm.cmd ci
npm.cmd run check
```

Open the [public Studio](https://commitatlas.jeky-tck.chatgpt.site/studio), then the
[published GitHub profile](https://github.com/Chris0Jeky). Follow
[DEMO_GUIDE.md](./DEMO_GUIDE.md), beginning with synthetic `octocat` for deterministic visual QA
and using `Chris0Jeky` to inspect the honest live-public success, partial, rate-limited, or
unavailable state.
