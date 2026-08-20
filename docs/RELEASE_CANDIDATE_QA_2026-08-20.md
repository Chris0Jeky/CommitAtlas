# CommitAtlas complete demonstration QA

Started: 2026-08-20

Final verification: 2026-08-21

Application implementation: `1cdabfa37981866cfedad5571fb2221e9cb9d67e`

Static/profile producer checkpoint: `ff9a836cb80f51a98c0f5a28b63c5c36d4e4da4d`

Profile snapshot head: `4651009639e23aad79e106cbdb6ec3bcd2749491`

Production: [commitatlas.jeky-tck.chatgpt.site](https://commitatlas.jeky-tck.chatgpt.site)

Profile: [github.com/Chris0Jeky](https://github.com/Chris0Jeky)

## Outcome

The complete public demonstration passed its exercised build, API, deployment, responsive-layout,
static-generation, profile-consumer, hosted-refresh, and visual-inspection matrix. The sparse first
prototype has been replaced by a coherent eight-card system, a real Studio gallery, a dynamic
project/action catalog, and a resilient scheduled profile snapshot.

## Capability matrix

| Surface | Demonstrated output |
| --- | --- |
| Atlas | 365-day heatmap, total/active/density/average/peak, bounded streaks, activity mix, 28-day momentum, languages, project health, personal Rhythm |
| Profile | repositories, followers, following, contributions, and public stars |
| Streak | current and longest observed streaks with an explicit window boundary |
| Breakdown | exact categorized counts where available; otherwise annual public-profile percentages explicitly not scoped to the requested window |
| Rhythm | transparent personal consistency from density and current streak, plus weekly trend; explicitly not a GitHub rank |
| Activity | exact requested contribution window, total, chronological density graph, accessible day labels |
| Languages | public-repository byte-share distribution without proficiency claims; unavailable on incomplete evidence |
| Projects | curated lifecycle, named-workflow CI/freshness, stars, release evidence, and HTML/Markdown action destinations |
| Studio | synthetic/live source, four themes, two Atlas layouts, motion control, eight-card selection, six projects, preview, provenance, errors, and Markdown |
| Static/Action | one snapshot, eight SVGs, optional compact Atlas, project JSON/Markdown catalog, byte/hash manifest, bounded stale-output cleanup |

The displayed Rhythm score is a personal consistency score. It uses the documented density/streak
formula and never claims a global percentile, population ranking, or GitHub-provided grade.

## Local and hosted proof

| Gate | Result at `1cdabfa` |
| --- | --- |
| TypeScript and ESLint | passed |
| Core | 20 passed |
| GitHub transport, parsing, security, and API | 79 passed |
| Studio | 34 passed |
| SVG | 25 passed |
| Static generator | 9 passed |
| Node 24 Action and bundle parity | 2 passed |
| Packaging / clean consumer | 3 passed |
| Rendered product/API | 28 passed |
| Four package builds and dry-run packs | passed |
| Production Vinext build | passed |
| `git diff --check` | passed |

Hosted [Quality gate run 32427839557](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32427839557)
passed at that exact source. Two bounded review rounds closed the public-percentage scope blocker;
independent catalog and profile reviews found no remaining CRITICAL/HIGH blocker. The final
static-label-only producer checkpoint passed hosted
[Quality gate run 32429814147](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32429814147).

## Deployment proof

- Sites project: `appgprj_6a872d3f98c481919ed37186cb4d0c30`.
- Saved version 8:
  `appgprj_6a872d3f98c481919ed37186cb4d0c30~appgver_ce7ba7650f4081918e20eb11349e7563`.
- Successful deployment: `appgdep_6a878b5c6cf081918fa41544eec87638`.
- Exact source: `1cdabfa37981866cfedad5571fb2221e9cb9d67e`.
- Archive content hash:
  `sha256:1a01930041b32ee65f2347cd47f85fbfcf10ffaad3f0f3c1c48c084e9d40d3bb`.

## Production API and cache evidence

Version 8 returned 200 for `/api/v1/health` and each deterministic synthetic card route:

- `/api/v1/cards/atlas.svg`;
- `/api/v1/cards/profile.svg`;
- `/api/v1/cards/streak.svg`;
- `/api/v1/cards/breakdown.svg`;
- `/api/v1/cards/rhythm.svg`;
- `/api/v1/cards/activity.svg`;
- `/api/v1/cards/languages.svg`;
- `/api/v1/projects.svg`.

Every exercised SVG returned `image/svg+xml`, its intended public cache window, and a CSP. An
unknown parameter returned 400 with `Cache-Control: no-store`. Motion-enabled output includes only
presentation CSS plus a reduced-motion override; still output contains no keyframes. Neither mode
contains script.

Request-time live public data remains intentionally bounded by GitHub availability. During final QA,
live Languages returned 200, live Profile returned 429, and live Breakdown returned bounded 502
twice. These are honest upstream states, not grounds for adding a private-capable token.

## Visual evidence

Production application:

- The landing page shows eight real SVG previews with useful descriptions and visible synthetic
  provenance; it no longer relies on a sparse mock to represent product capability.
- The new Breakdown/Rhythm pair is compact, balanced, readable, and unambiguous at the available
  798-pixel browser width.
- Studio exposes eight selected previews, theme/layout/motion/source controls, project configuration,
  project evidence, and eight-line README Markdown. The Atlas and selected gallery were inspected
  without clipping or document overflow.
- The preceding responsive baseline passed 1440x900 and 390x844, and the individual card renderers
  were exercised at their 720/480 layouts. A new exact-head screenshot pair at those two page widths
  was not captured.

Published GitHub profile:

- The responsive Atlas remains first, with Breakdown and Rhythm visible immediately below it.
- GitHub cleanly wrapped both 420-pixel insight cards in the narrow live profile column.
- The Project radar stayed compact; Profile, Streak, Activity, and Languages remain in the optional
  details section.
- The generated six-row Selected work table rendered lifecycle, CI state, repository signals, and
  observed/configured Website, CI, Release, Download, and Docs links without page-level horizontal
  overflow.
- The repository count is truthfully labelled `open issues/PRs`, matching GitHub REST semantics that
  `open_issues_count` includes pull requests.

## Static profile publication proof

The profile workflow:

- runs daily at `23 5 * * *` and supports manual dispatch;
- pins `Chris0Jeky/CommitAtlas@ff9a836cb80f51a98c0f5a28b63c5c36d4e4da4d`;
- requests no data credential;
- validates the exact 11 payload filenames, byte counts, SHA-256 digests, compact Atlas output, and
  Breakdown/Rhythm/catalog Action outputs;
- validates and marker-replaces the generated README catalog before staging `README.md` and
  `assets/commitatlas`;
- preserves the last committed good snapshot when generation or validation fails.

Hosted [refresh run 32429850680](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/32429850680)
passed every step and produced bot snapshot `46510096`. The snapshot was generated at
`2026-08-20T23:43:55.273Z` for the exact 2025-08-21 through 2026-08-20 window. The profile manifest
contains exactly 11 artifacts; committed bytes and SHA-256 hashes match, and catalog replacement is
idempotent.

## NOT verified

- Complete sequential keyboard-only traversal. Semantic structure, labels, focus styling, reduced
  motion, and pointer interactions were exercised, but every Tab/Space step was not proved.
- A fresh exact-head 1440x900 and 390x844 screenshot pair.
- Token-backed private contribution history. No private-capable credential was installed in Sites or
  used for the profile.
- npm registry publication or a GitHub `v0.1.0` release.

## Residual risk

- Anonymous live GitHub quotas and response deadlines can produce truthful 429/502 responses. The
  deterministic synthetic path is the reliable demonstration, and the scheduled checked-in profile
  is the resilient public portfolio surface.
- Pinned JavaScript actions currently emit a non-failing Node 20-to-24 runtime warning. Both exact
  hosted workflows pass; pin upgrades remain reviewed release work.
- Nonblocking follow-up remains tracked in #33, #34, #48, #49, and #50. This demonstration is
  complete; the registry and `v0.1.0` release decision remain separate milestones.
