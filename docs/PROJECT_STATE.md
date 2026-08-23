# CommitAtlas project state

Last verified: 2026-08-23 02:20 BST

This is the authoritative checkpoint for the public demonstration. Git, hosted CI, Cloudflare
deployment state, and the live profile outrank this file after any ref or deployment moves.

The release path is in [V0_1_PLAN.md](./V0_1_PLAN.md), the static contract is in
[STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md), the walkthrough is in
[DEMO_GUIDE.md](./DEMO_GUIDE.md), and the complete evidence matrix is in
[RELEASE_CANDIDATE_QA_2026-08-20.md](./RELEASE_CANDIDATE_QA_2026-08-20.md).

## Public checkpoint

- Exact deployed application implementation: the head of `main` at the time of the last successful
  Deploy run. The workflow publishes only a commit whose `CI` push run on `main` concluded
  successfully, and a manual dispatch runs the full gate itself before deploying, so the deployed
  commit is always a proven one.
- The preceding Sites checkpoint was `1cdabfa37981866cfedad5571fb2221e9cb9d67e` on `main`.
- Latest executable/static-producer checkpoint: `ff9a836cb80f51a98c0f5a28b63c5c36d4e4da4d`.
  Exact-head hosted [Quality gate run 32429814147](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32429814147)
  passed; this follow-up changes only the generated project-catalog label and Action bundle, so Sites
  remains correctly bound to the preceding application source.
- **Production: [commit-atlas.commit-atlas.workers.dev](https://commit-atlas.commit-atlas.workers.dev),
  including the [interactive Studio](https://commit-atlas.commit-atlas.workers.dev/studio).**
  Cloudflare Workers, free plan. Configuration is reproducible from
  [`wrangler.jsonc`](../wrangler.jsonc); the path is documented in [DEPLOYMENT.md](./DEPLOYMENT.md).
- The retired OpenAI Sites mirror `commitatlas.jeky-tck.chatgpt.site` (project
  `appgprj_6a872d3f98c481919ed37186cb4d0c30`, version 8, deployment
  `appgdep_6a878b5c6cf081918fa41544eec87638`, archive bound to `1cdabfa` with content hash
  `sha256:1a01930041b32ee65f2347cd47f85fbfcf10ffaad3f0f3c1c48c084e9d40d3bb`) still answers but is
  **no longer canonical**. It is not reproducible from this repository. The dated QA records name it
  because that is the origin those observations were actually made against.
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
- The [Chris0Jeky profile](https://github.com/Chris0Jeky) now leads with the responsive Atlas, shows
  Breakdown and Rhythm visibly, retains the Project radar and four optional focused widgets, and
  renders a marker-bounded six-project catalog with observed/configured action links. Its daily
  workflow validates 11 payload artifacts and every manifest hash before updating README/assets.

## Verified

- 2026-08-23: `main` was red because a test fixture pinned a workflow observation at
  `2026-08-18T23:00:00Z` while `calculateCiState` applies a 72-hour freshness window, so the fixture
  correctly decayed into `stale`. The rule was right and the fixture was wrong; PR #51 made the
  fixture relative and `main` is green again. No product behavior changed.
- 2026-08-23: the Cloudflare Workers deployment answers on every probed surface —
  `node scripts/verify-deployment.mjs https://commit-atlas.commit-atlas.workers.dev` passes 14/14,
  covering health, the landing page, the Studio (matched on its own title), all eight synthetic
  cards asserted script-free, the `motion=none` CSP branch, and two distinct bounded-`400` rejection
  paths.
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
- Open nonblocking work is tracked in #33, #34, #48, #49, and #50. #50 covers stricter generated
  catalog boundaries; #49 covers direct package-renderer bounds. Do not reopen the completed
  demonstration review loop unless release-impact evidence promotes an item.
- The next bounded milestone is release preparation: finish keyboard QA if tooling permits,
  reconcile release-impact dependencies/issues, rerun exact-head proof/review, then decide the
  GitHub `v0.1.0` and optional npm publication separately.

## Clean resume commands

```powershell
Set-Location 'C:\Users\Cristian3\OneDrive - Middlesex University\Desktop\repos\CommitAtlas'
git fetch --all --prune
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
gh run list --repo Chris0Jeky/CommitAtlas --workflow ci.yml --limit 5
npm.cmd ci
npm.cmd run check
```

Open the [public Studio](https://commit-atlas.commit-atlas.workers.dev/studio), then the
[published GitHub profile](https://github.com/Chris0Jeky). Follow
[DEMO_GUIDE.md](./DEMO_GUIDE.md), beginning with synthetic `octocat` for deterministic visual QA
and using `Chris0Jeky` to inspect the honest live-public success, partial, rate-limited, or
unavailable state.
