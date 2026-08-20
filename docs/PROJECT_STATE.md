# CommitAtlas project state

Last verified: 2026-08-20 21:23 BST

This is the authoritative checkpoint for the complete public demonstration. Git, hosted CI,
deployment state, and the live profile outrank this file after any ref or deployment moves.

The release path is in [V0_1_PLAN.md](./V0_1_PLAN.md), the static generator contract is in
[STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md), the repeatable walkthrough is in
[DEMO_GUIDE.md](./DEMO_GUIDE.md), and current end-to-end evidence is in
[RELEASE_CANDIDATE_QA_2026-08-20.md](./RELEASE_CANDIDATE_QA_2026-08-20.md). The earlier Studio
closeout remains preserved in [STUDIO_QA_2026-08-20.md](./STUDIO_QA_2026-08-20.md).

## Public checkpoint

- Exact deployed application implementation: `8372d655870ba1ef33d439a9449f904d1471db82`
  on `main`. The documentation-only closeout commit is intentionally later than this source.
- Exact-head hosted [CI run 32412470845](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32412470845)
  passed.
- Production: [commitatlas.jeky-tck.chatgpt.site](https://commitatlas.jeky-tck.chatgpt.site),
  including the [interactive Studio](https://commitatlas.jeky-tck.chatgpt.site/studio).
- Sites project `appgprj_6a872d3f98c481919ed37186cb4d0c30`, saved version 7
  `appgprj_6a872d3f98c481919ed37186cb4d0c30~appgver_aa0dad6a718881919b27472bb76a6c43`,
  successful deployment `appgdep_6a875f25a1a08191850475c5975fbc2c`.
- The deployed archive is bound to `8372d65` with Sites content hash
  `sha256:679a81adf2387aa90480781d1a57b9927e3226a58ba298eb8f2e24fdce448bcb`.
- Public profile repository head: `99f681b5a0a9c9d940d8cdd25cee0fd083f81e55`.
- Exact cleanup-head profile [refresh run 32413498275](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/32413498275)
  passed and produced that final bot snapshot commit.
- Repository description, homepage, GPL-3.0 licence, and 14 focused topics are published.
- There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.

## What now exists

- A rich Atlas card with a 365-day contribution heatmap, contribution density, total and active
  days, average and peak, current and window-bounded longest streak, public activity-type mix,
  28-day momentum, public-repository languages, project health, and a transparent personal rhythm
  score. Rhythm is explicitly not represented as a GitHub rank.
- Wide 860x380 and compact 480x570 Atlas layouts. A static run can generate both from one exact
  `PortfolioSnapshot`; no second GitHub fetch can make the responsive pair drift.
- Profile, streak, activity, language, Atlas, and project-board SVGs in Ember, Aurora, Midnight,
  and Paper themes, with optional subtle load motion and a no-motion mode.
- Responsive landing page and interactive Studio with synthetic and supported live-public modes,
  theme/layout/motion controls, bounded project configuration, preview, provenance, errors, and
  copyable README Markdown.
- Versioned JSON and SVG endpoints with bounded validation, cache separation, stable ETags,
  accessible SVG metadata, XML sanitisation, and script/object/frame blocking headers.
- Curated project lifecycle and named-workflow CI signals. Source, Docs, Install, Download,
  Release, and CI actions are available in HTML where their validated URLs exist.
- Credential-free `@commit-atlas/static` CLI and Node 24 GitHub Action. They generate selected
  cards plus a byte/SHA-256 manifest, remove only stale CommitAtlas-owned artifacts, and never
  commit, push, publish, or deploy for the consumer.
- Buildable `@commit-atlas/core`, `@commit-atlas/github`, `@commit-atlas/svg`, and
  `@commit-atlas/static` packages with GPL-3.0-only package metadata and dry-run pack proof.
- The [Chris0Jeky profile](https://github.com/Chris0Jeky) uses a responsive `<picture>` Atlas,
  project radar, and expandable individual widgets. A scheduled workflow refreshes all seven
  assets from one public snapshot and validates every manifest hash before committing.

## Verified

- Full `npm.cmd run check` passed at `8372d65`:
  - core 19, GitHub/API 69, Studio 28, SVG 20, static generator 5, Action 2, and rendered
    product/API 23 tests;
  - TypeScript, ESLint, four package builds and dry-run packs, Action bundle parity, and production
    Vinext build.
- Independent reviews found and closed one stale responsive-companion HIGH defect, then found no
  remaining CRITICAL/HIGH blocker in the generator cleanup or final profile publication.
- Production version 7 returned 200 for health, profile, contributions, projects, Atlas, four
  focused stat cards, and the project board. Invalid input returned bounded 400/no-store.
- The synthetic Atlas returned a stable ETag and 304 on `If-None-Match`; its deterministic demo
  timestamp is stable within the UTC day. SVGs expose CSP and accessible title/description data.
- Subtle SVGs contain animation keyframes and a reduced-motion override; `motion=none` contains no
  keyframes or script.
- Browser QA passed at 1440x900 and 390x844. The Studio is side-by-side on desktop, configuration
  precedes the long preview on mobile, and neither production page has document overflow.
- Ember, Aurora, Midnight, and Paper wide Atlas cards were visually inspected, as was the compact
  layout. Project, profile, streak, activity, and language cards were expanded and inspected on the
  real profile.
- GitHub serves the 860x380 Atlas at desktop width and the 480x570 companion at mobile width. Six
  CommitAtlas profile images completed, with no document overflow. The responsive cards share the
  same description and generation timestamp.
- The profile manifest contains exactly seven expected artifacts and matches committed and Windows
  worktree bytes. Generated files are pinned to LF to keep those hashes reproducible.

## NOT verified or released

- Full sequential keyboard-only traversal. Structure, labels, focus styling, accessible SVG text,
  reduced motion, and mouse interaction were exercised, but the available controller did not prove
  every Tab/Space transition.
- Token-backed private contribution history. The shipped service and profile deliberately use
  credential-free public evidence and never request private repository details.
- npm registry publication or a GitHub `v0.1.0` release. The packages and Action are built and
  exercised from immutable commits, but no registry/release availability is claimed.

## Residual risk and next slice

- A fresh request-time live `Chris0Jeky` Atlas returned bounded 502/no-store because GitHub did not
  respond before the Sites deadline. Synthetic endpoints remain deterministic; the scheduled
  checked-in profile snapshot is the resilient last-known-good surface. Do not add a private-capable
  token to hide anonymous upstream availability limits.
- GitHub Actions emits a non-failing warning that pinned `actions/checkout@v4` and
  `actions/setup-node@v4` target Node 20 while the runner forces Node 24. Track the upstream major
  transition; do not replace immutable pins without review.
- Issues #28, #30, #32-#34, #38, #40, #45, #46, #48, and remaining dependency updates are not
  silently completed by this demonstration milestone. Reclassify them against release impact
  before tagging v0.1.0.
- The next bounded slice is release preparation: complete keyboard QA if tooling permits, reconcile
  release-impact issues/dependencies, rerun the exact-head gate/review, then decide the GitHub
  `v0.1.0` and optional npm publication separately.

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
and using `Chris0Jeky` to inspect the honest live-public success or unavailable state.
