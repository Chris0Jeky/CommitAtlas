# CommitAtlas complete demonstration QA

Date: 2026-08-20

Application implementation: `8372d655870ba1ef33d439a9449f904d1471db82`

Profile snapshot head: `99f681b5a0a9c9d940d8cdd25cee0fd083f81e55`

Production: [commitatlas.jeky-tck.chatgpt.site](https://commitatlas.jeky-tck.chatgpt.site)

Profile: [github.com/Chris0Jeky](https://github.com/Chris0Jeky)

## Outcome

The complete public demonstration passed its exercised build, API, deployment, desktop, mobile,
theme, responsive-profile, static-generation, and hosted-refresh matrix. The sparse first profile
prototype has been replaced by a rich Atlas, four focused stat widgets, and a project board. The
published profile remains readable when the live GitHub endpoint is unavailable because its seven
assets are generated, hash-checked, and committed daily from one public snapshot.

## Capability matrix

| Surface | Demonstrated output |
| --- | --- |
| Atlas | total and active days, density, average/day, peak, heatmap, current/longest streak, activity mix, momentum, languages, project health, rhythm score |
| Profile | repositories, followers, following, contributions, and public stars |
| Streak | current streak, window-bounded longest streak, total and active days |
| Activity | exact requested date window, contribution total, chronological density graph, accessible day labels |
| Languages | public-repository byte-share distribution with explicit unavailable state for incomplete evidence |
| Projects | curated lifecycle, named-workflow CI, stars, release metadata, and HTML action links |
| Studio | synthetic/live source, four themes, two layouts, motion control, card selection, up to six projects, preview, provenance, errors, and README Markdown |
| Static/Action | one public snapshot, selected SVGs, optional responsive companion, manifest byte/hash proof, bounded stale-artifact cleanup |

The displayed `Rhythm 77/100` on the current profile is CommitAtlas's transparent personal
consistency score. It is intentionally labelled as not being a GitHub rank; no opaque global
ranking is invented.

## Local and hosted proof

The full repository gate passed at the exact application implementation:

| Gate | Result |
| --- | --- |
| TypeScript and ESLint | passed |
| Core | 19 passed |
| GitHub transport, parsing, security, and API | 69 passed |
| Studio | 28 passed |
| SVG | 20 passed |
| Static generator | 5 passed |
| Node 24 Action and bundle parity | 2 passed |
| Built Worker and rendered product/API | 23 passed |
| Four package builds and dry-run packs | passed |
| Production Vinext build | passed |
| `git diff --check` | passed |

Hosted [CI run 32412470845](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32412470845)
passed at exact SHA `8372d65`. A first responsive-generator review found a realistic stale companion
defect; the fix deletes only known CommitAtlas-owned outputs after successful replacement. The
bounded post-fix review was clean. A separate final profile review found no CRITICAL/HIGH blocker.

## Deployment proof

- Sites project: `appgprj_6a872d3f98c481919ed37186cb4d0c30`.
- Saved version 7:
  `appgprj_6a872d3f98c481919ed37186cb4d0c30~appgver_aa0dad6a718881919b27472bb76a6c43`.
- Successful production deployment: `appgdep_6a875f25a1a08191850475c5975fbc2c`.
- Exact source: `8372d655870ba1ef33d439a9449f904d1471db82`.
- Sites archive content hash:
  `sha256:679a81adf2387aa90480781d1a57b9927e3226a58ba298eb8f2e24fdce448bcb`.

## Production API and cache evidence

Version 7 returned 200 for:

- `/api/v1/health`;
- synthetic profile, contribution, and project JSON;
- Atlas, profile, streak, activity, languages, and project-board SVG.

Every exercised SVG included `image/svg+xml`, its intended public cache window, and a
Content-Security-Policy. An unknown parameter returned 400 with `Cache-Control: no-store`. Two
identical synthetic Atlas requests proved byte-stable caching: the first returned an ETag and the
conditional second returned 304. The deterministic synthetic footer is fixed at UTC midnight for
the day.

The animated Atlas contains keyframes plus a `prefers-reduced-motion` override. The no-motion
variant contains neither keyframes nor script. Both variants expose `role="img"`, title, and
description metadata.

## Visual evidence

Production Studio:

- 1440x900: configuration and preview render side by side, with an 814-pixel displayed Atlas and no
  document overflow.
- 390x844: configuration starts before the long preview; the document client and scroll widths are
  both 375 pixels.
- Ember, Aurora, Midnight, and Paper wide cards were individually opened and visually inspected.
- The compact 480x570 card was inspected separately. Labels, density cells, activity bars, score,
  and footer remain inside the viewBox.

Published GitHub profile:

- Desktop selects `assets/commitatlas/atlas.svg`: natural 860x380, displayed 846x374.
- Mobile selects `assets/commitatlas/atlas-compact.svg`: natural 480x570, displayed 293x348.
- Mobile document client and scroll widths are both 375 pixels.
- Six CommitAtlas images completed at both widths.
- The project board and the expanded profile, streak, activity, and language widgets were visually
  inspected on the real profile, along with Selected Work links.
- The current Atlas visibly reports `27k` contributions, 194 active days, 53.2% density,
  74.8/day, 30-day current and 53-day window-bounded longest streaks, public activity mix,
  recent momentum, `Rhythm 77/100`, public languages, and 4/6 configured CI workflows passing.

## Static profile publication proof

The profile workflow:

- runs daily at `23 5 * * *` and supports manual dispatch;
- uses one immutable-pinned `Chris0Jeky/CommitAtlas` Action call;
- requests no token for GitHub data;
- validates the exact seven filenames, byte counts, SHA-256 digests, and compact Action output;
- stages only `assets/commitatlas` and preserves the last good snapshot if generation fails.

[Refresh run 32413498275](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/32413498275)
passed from exact cleanup head `87e491d` and produced bot snapshot `99f681b`. Wide and compact Atlas
files share the same accessible description and generation timestamp. The superseded second config
and split output directory are absent, and generated SVG/manifest paths are LF-pinned so Windows
worktree hashes match the manifest.

## NOT verified

- A complete sequential keyboard-only traversal. Semantic structure, labels, focus styling,
  reduced motion, and direct interactions were exercised, but the controller did not prove every
  Tab/Space transition.
- Token-backed private contribution history. No private-capable credential was installed in Sites
  or used for the profile.
- npm registry publication or a GitHub `v0.1.0` release.

## Residual risk

- A fresh live `Chris0Jeky` request returned 502/no-store with `github_unavailable` because GitHub
  did not respond before the production deadline. This is a truthful transient live state. The
  checked-in scheduled snapshot is the deliberate resilience layer.
- GitHub Actions currently warns that some pinned v4 actions target Node 20 while the runner forces
  Node 24. Both exercised workflows pass; upgrading those immutable pins remains a reviewed release
  task.
- Open release/dependency issues remain tracked. This demonstration is complete; the registry and
  `v0.1.0` release decision are separate milestones.
