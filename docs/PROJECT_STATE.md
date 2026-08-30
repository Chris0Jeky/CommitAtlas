# CommitAtlas project state

Last verified: 2026-08-30 (v0.4.0 released, production and profile evidence current)

This is the authoritative checkpoint for the public demonstration. Git, hosted CI, Cloudflare
deployment state, and the live profile outrank this file after any ref or deployment moves.

The release path is in [V0_1_PLAN.md](./V0_1_PLAN.md), the static contract is in
[STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md), the walkthrough is in
[DEMO_GUIDE.md](./DEMO_GUIDE.md), and the complete evidence matrix is in
[RELEASE_CANDIDATE_QA_2026-08-20.md](./RELEASE_CANDIDATE_QA_2026-08-20.md).

## Public checkpoint

- **Released: [v0.4.0](https://github.com/Chris0Jeky/CommitAtlas/releases/tag/v0.4.0).** The
  release is tagged at merge `87bc329`, marked latest, and is neither a draft nor a prerelease. The
  private root package version is `0.4.0`; the workspace packages remain `0.1.0` because they are
  still source-installed and their standalone public API versions did not move. Reliability,
  contribution fidelity, cadence and releases, one-snapshot theme variants, product clarity, the
  bounded Developer Lens bridge, and the standalone-card readability floor are all included. npm
  registry and GitHub Marketplace publication remain explicitly outside this release.
- **The current released executable checkpoint is `87bc329`.** Main CI run
  [33131396554](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/33131396554)
  passed, Deploy run
  [33131465188](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/33131465188)
  published that exact merge and passed its 17 deterministic probes, and the same 17/17 verifier
  passed independently from this checkout. Browser inspection confirmed the landing workflow map,
  Studio entry point, and the optional research bridge on the Workers origin after deployment.
- **The real profile consumes the final readable renderer.** Profile PR
  [#9](https://github.com/Chris0Jeky/Chris0Jeky/pull/9) merged at `d9b6f23`, pins the single
  CommitAtlas invocation to `5b6b38c`, and refresh run
  [33130748322](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/33130748322)
  generated bot commit `9107b81`. Both 13-artifact manifests have the same
  `2026-08-28T00:45:58.115Z` generation time and `2025-08-29..2026-08-28` window; every SVG theme
  hash differs while the two catalogs are identical. The live Atlas reports 29,313 public
  contributions, 201 active days, and a 38-day current streak, matching GitHub's logged-out public
  total at inspection. Breakdown, Rhythm, Cadence, and Releases were opened on the rendered profile;
  their larger text is readable and the cadence footer is not clipped.
- **Developer Lens is integrated as a research source, not as an inflated feature claim.** Producer
  PR [#303](https://github.com/Chris0Jeky/developer-lens/pull/303) owns the versioned summary at
  `425708e`; CommitAtlas PR [#101](https://github.com/Chris0Jeky/CommitAtlas/pull/101) vendors and
  semantically validates one pinned C0 artifact without a runtime fetch. The page says exactly what
  the invented offline trial supports: equal measured detection, higher candidate false alerts,
  both selections nonviable, reject BOCPD, retain rolling median/MAD. It also prints the unsupported
  real-repository, person-level, model-promotion, and online-PELT claims.

- **Hosted public snapshots now fail honestly and retain confirmed last-good evidence.** PR #86
  added a public-only, seven-day Workers KV fallback for validated canonical JSON/SVG responses;
  quota and availability failures can reuse that evidence with explicit stale headers, timestamps,
  accessible SVG marking, and a short cache lifetime. Cold, expired, corrupt, synthetic,
  token-backed, and cross-key requests keep their original bounded response. A matching public
  `304 Not Modified` now refreshes only KV retention when the request, response, canonical key, and
  stored ETag agree, while preserving the original stored/observed timestamps. Missing or
  mismatched evidence is never revived and KV failures cannot replace the route response. This
  closes the retention gap tracked in #87 without presenting cache survival as fresher GitHub data.
- **Contribution freshness and calendar fidelity are fixed, deployed, and live on the profile.**
  [PR #83](https://github.com/Chris0Jeky/CommitAtlas/pull/83) merged as `1062a87`; the exact reviewed
  producer head was `63278f5`. An in-progress final day is now explicit rather than silently treated
  as a closed zero, so a scheduled run during the UTC day no longer resets an otherwise continuing
  streak to zero. The contribution grid is Sunday-aligned and preserves GitHub's supplied intensity
  levels instead of grouping the arbitrary 365-day start into row zero and recalculating quartiles.
  Hosted CI, [Deploy run 33119202170](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/33119202170),
  and an independent post-deploy 17/17 endpoint probe are green at the merged SHA.
- **The public boundary and profile composition now match the shipped product.** The landing page
  distinguishes eight available hosted routes, ten static card types, source-only distribution,
  and an optional design explainer that is collapsed by default. The profile leads with the
  full-width Atlas and Project radar; the four secondary views are full-width, purpose-labelled,
  and collapsed under `More public signals`. [Profile PR #6](https://github.com/Chris0Jeky/Chris0Jeky/pull/6)
  merged as `3a14cbe`, pinned both generation passes to `63278f5`, and dispatched
  [refresh run 33119356827](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/33119356827).
  The run passed every generation, validation, catalog, and commit step and produced bot snapshot
  `ce59d76`: 29,217 contributions, 200 active days, and a 37-day current streak through
  2026-08-27. Chrome inspection confirmed that GitHub's own total was also 29,217 at that checkpoint.

- **Two new card types shipped and are live on the profile: `cadence` and `releases`**
  ([PR #80](https://github.com/Chris0Jeky/CommitAtlas/pull/80), merged as `4a6b1c4`, hosted CI green
  at every head). Weekly cadence shows contribution share by day of week (Monday-first, UTC
  boundaries, window-scoped, busiest day named, empty windows stated); Latest releases lists the
  most recent published release per curated project, newest first, with unreleased projects counted
  rather than hidden. Both are static-only — no hosted route — drawn from data the snapshot already
  fetches, and covered by the frozen-motion, well-formedness, and 30 KiB gates. Review: one
  fresh-context adversarial pass plus eight Codex P2s triaged (six fixed across `a6e5551`/`7e44801`,
  two declined on-thread with reasons). Profile wiring landed via
  [Chris0Jeky/Chris0Jeky#5](https://github.com/Chris0Jeky/Chris0Jeky/pull/5): pin moved to
  `4a6b1c4`, both configs select ten cards, both validations expect 13 artifacts, and dispatched
  [run 32762878305](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/32762878305) passed every
  step and committed the bot snapshot `3a914a9`. Both cards were then verified rendering on the
  live profile in Chrome.
- **Post-release fix `e17e866` (PR #77) is merged, deployed, and proven on the profile.** The
  v0.3.0 atlas motion faded in from `opacity:0` / `scaleY(.08)` with fill-mode `both`; Chromium
  never runs CSS animations inside an SVG delivered through `<img>` and pins such a card to its
  `from` state, so on GitHub the redesigned atlas rendered with an invisible header, density grid,
  and momentum row. This was measured empirically (a three-rect probe embedded via `<img>`: no
  delay froze off-position, `both` froze off-position, only fill-mode none plus a delay showed
  final geometry), and subtle motion is now delayed fill-none translation with tests rejecting
  `both`/`backwards` and any opacity or scale keyframe. The same PR drops `★ 0` from the projects
  card and `0 stars · 0 forks` from the Markdown catalog while keeping both keys in
  `projects.json` at any value. One Codex finding was fixed in `cedded1` (frozen bars misaligned
  against static tracks); a second, post-merge suggestion to remove the delay was declined with
  the probe evidence — the delay is what keeps GitHub correct. Deploy published `e17e866` and
  [issue #78](https://github.com/Chris0Jeky/CommitAtlas/issues/78) tracks rendering a theme pair
  from one snapshot fetch.
- **The public profile now serves every card as a dark/light pair from the fixed renderer.**
  [Chris0Jeky/Chris0Jeky#4](https://github.com/Chris0Jeky/Chris0Jeky/pull/4) pinned the refresh
  workflow to `e17e866`, added a paper-theme pass into `assets/commitatlas/light/` with its own
  manifest validation, wrapped all eight README cards in `<picture>` with `prefers-color-scheme`
  sources, retired the last `chatgpt.site` links, and omitted zero-valued star/fork counts from
  the generated table. The dispatched refresh run
  ([32758988123](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/32758988123)) generated and
  validated both bundles and committed them, and the rendered profile was inspected in Chrome
  afterwards: density grid, momentum bars, and header all present.
- **Released: [v0.3.0](https://github.com/Chris0Jeky/CommitAtlas/releases/tag/v0.3.0)**, tagged at
  `4ec77d7724dd22637a85cc3c89b8dc417091778a` on `main` — the merge of PR #75, marked latest, not a
  draft and not a prerelease. Hosted CI concluded success at that commit, the Deploy workflow
  published it, and its post-deploy probes reported 17/17 against the origin Wrangler returned. The
  probes were re-run independently from this checkout afterwards: 17/17 again.
- **v0.3.0 is verified on the live origin, not just deployed.** The served atlas card was fetched
  from production and checked directly: all four single-hue ramp steps present, the neutral socket
  present, exactly four mix bars in one ink, both section numerals, the density key, no `Inter` in
  any font stack, and every `font-family` value free of the double quote that produced malformed
  XML on the first attempt. Tag structure is balanced at 54 open / 54 close / 72 self-closing.
- All eight cards measured against the 30 KiB budget on the live origin: atlas 19,987, activity
  24,321, rhythm 5,527, breakdown 5,273, languages 4,164, profile 3,764, projects 3,371, streak
  3,332. The largest has 6.2 KiB of headroom.
- **Released: [v0.2.0](https://github.com/Chris0Jeky/CommitAtlas/releases/tag/v0.2.0)**, tagged at
  `5fea6e625616a0df9ecd8e14a75f9eae74ea8500` on `main` — the merge of PR #72, with the branch's five
  commits intact and nothing squashed. Not a draft, not a prerelease, and marked latest. No package
  tarballs are attached and npm publication is still not claimed.
- **The web surface is rebuilt on the shared chassis.** The design handoff in
  `design_handoff_shared_chassis/` is implemented on the landing page and the Studio: four chassis
  themes with a persisted switch, an instrument fascia whose four readings come from the same
  `fetchPortfolioSnapshot` call the SVG routes use, a six-bay CI state rack, and a new evidence
  layer. The contract is recorded in [DESIGN_CHASSIS.md](./DESIGN_CHASSIS.md). No SVG card, route,
  package, or response contract changed; the four workspace packages stay at `0.1.0` because none of
  their public APIs moved.
- **v0.2.0 is deployed and self-proved.** Hosted CI concluded success at `5fea6e6`, the Deploy
  workflow published from that exact commit, and its post-deploy probes reported 17/17 against the
  origin Wrangler returned. Re-run independently afterwards from this checkout against
  `https://commit-atlas.commit-atlas.workers.dev`: 17/17 again. The live landing page was then
  probed directly and serves the chassis it was built to serve — ten wired evidence readings and a
  printed count that matches, the four-theme switch and its pre-paint bootstrap, all six state
  words, the real synthetic readings (88, 77.8%, 1.1k, 284, 731), the honest
  `0/2 CI PASSING · 0 ATTENTION · 2 UNCONFIGURED` line, and the drawer as a real `<dialog>`.
- **Released: [v0.1.0](https://github.com/Chris0Jeky/CommitAtlas/releases/tag/v0.1.0)**, tagged at
  `ee24f80c19642232e6914efe163dbeb230ec2f99` on `main` — 235 commits with the merge history intact,
  nothing squashed. Hosted CI concluded success at that exact commit, the Deploy workflow published
  it, and the post-deploy probe set reported 17/17 against the live origin.
- The release is not a draft and is not a prerelease. **No package tarballs are attached and npm
  publication is not claimed**; the packages are built and pack-verified but are not on the registry.
- Not yet done, and it is the one thing an agent cannot do: listing the Action on the GitHub
  Marketplace. `action.yml` satisfies every requirement — name, description, and `branding` icon and
  colour — and the repository is public with a README, but publication requires accepting the
  Marketplace Developer Agreement and ticking a checkbox on the release page. No API exposes either.
- **Push-to-deploy is live and demonstrated by real runs, not just reviewed.** `CLOUDFLARE_API_TOKEN`
  and `CLOUDFLARE_ACCOUNT_ID` are configured as repository secrets, and the Deploy workflow has
  published from `main` several times: it checks out the exact commit whose `CI` push run concluded
  successfully, builds, deploys, and then runs the post-deploy probes against the origin Wrangler
  reported, all green.
- The gated-skip path is demonstrated too, from before the secrets were installed:
  [run 32718000929](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32718000929) resolved
  credentials as absent, skipped all seven deploying steps, emitted a notice, and concluded
  **success**. An unconfigured fork gets a clean skip, not a red workflow.
- The fork-provenance guard is still evidence-free by construction: no fork has opened a pull
  request, so the four-clause `if` that checks `head_repository.full_name` has never been exercised
  by a real fork event. It is reviewed, not demonstrated.
- The preceding Sites checkpoint was `1cdabfa37981866cfedad5571fb2221e9cb9d67e` on `main`.
- Latest executable/static-producer checkpoint: `5b6b38cd6b1c8d60260f86dcfbbd0c4e6199c39a`
  (PR #104), proven by main CI, Workers deployment, the profile consumer test/refresh chain,
  manifest reconciliation, and live browser inspection recorded in the current checkpoint above.
  The older `e17e866` and `ff9a836` checkpoints are superseded historical evidence.
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
- Public profile repository head: `9107b81` — the bot commit produced by final-renderer refresh
  [33130748322](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/33130748322).
- The preceding checkpoints, both superseded the same day: paired-theme bot head `d9f03f1` from
  [run 32758988123](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/32758988123) (both
  generation passes, both bundle validations, catalog, commit, and push all passing), and before
  that `4651009` from
  [run 32429850680](https://github.com/Chris0Jeky/Chris0Jeky/actions/runs/32429850680).
- Repository description, GPL-3.0-only licence, and 20 focused topics are published. The homepage
  now points at the Workers origin; it previously still named the retired Sites mirror.
- The public surface is discoverable and self-describing: `/robots.txt`, `/sitemap.xml`, schema.org
  JSON-LD on the landing page, per-page canonical URLs, a favicon, and a theme colour. The
  canonical origin is a Wrangler `vars` entry rather than a constant, so a fork advertises itself
  rather than this deployment.
- `/robots.txt` is served by the Worker alone. Before the route existed, Cloudflare's edge answered
  that path itself with a 1248-byte managed Content Signals Policy block, and the documented
  behaviour for a 200 from the origin is that the managed block is prepended to it. Measured after
  the first deploy, it is not: the body is 253 bytes and is exactly the Worker's output. The
  synthesised block appears only when the origin serves no robots.txt of its own.
- There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.

## What now exists

- A chassis theme is a user-facing setting on the web surface: Fieldline (default), Observatory,
  Midline, and Limestone. It persists in `localStorage` and is applied before first paint by an
  inline bootstrap that only ever writes a value from a bounded allowlist. It is deliberately not a
  cookie, so the served HTML stays identical for every visitor and therefore cacheable. The SVG card
  `theme=` query parameter is a separate setting and is unchanged.
- The landing page renders no typed-in numbers. `landingSnapshot()` calls the same
  `fetchPortfolioSnapshot` the SVG routes use, in demo mode, so the front page costs no GitHub
  request and cannot drift from what the routes render. `lib/evidence.test.ts` pins the readings the
  design was measured against: 1,142 contributions, 284 active days, 77.8% density, rhythm 72, 88
  over the recent 28 days, −1.1% against the prior 28.
- The hero's fourth instrument reports the portfolio honestly. Both declared demo projects have no
  named workflow, so both lamps are empty sockets and the tile reads `0/2 CI PASSING · 0 ATTENTION ·
  2 UNCONFIGURED — shown dark, never green`. Configuring a workflow would have lit two lamps green;
  the front page is where that shortcut most needed refusing.
- An evidence layer. Every printed metric is a button that opens one shared drawer carrying the
  reading's tier, basis, formula, and caveat. Three rungs — observed, derived, hypothesis — and a
  tier is not fixed per metric: the activity mix is observed when GitHub returns exact categorised
  counts and a hypothesis when the only source is the annual public-profile percentages, and the
  star total demotes from derived to hypothesis when the repository list came back truncated. The
  rhythm *score* is derived; the rhythm *level* is a hypothesis, because CommitAtlas chose the
  thresholds and nothing in GitHub's data draws them.
- Contrast is now a tested property rather than a taste. `lib/chassis.test.ts` measures every ink
  role against every theme's own ground and plate, at 4.5:1 where the role prints small text and
  3:1 where it only strokes or fills, and asserts that a per-theme override exists only where the
  shared value genuinely failed.

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
- Studio live evidence is confirmed per preview run, not per configuration. While a retry of an
  unchanged live configuration is in flight, and after that retry fails, the prior preview stays
  visible and labelled retained, but contribution- and language-backed cards are withheld from the
  card picker and from copyable README Markdown until a run confirms them. Synthetic mode is
  unaffected.
- Versioned JSON/SVG endpoints with bounded validation, canonical queries, cache separation, stable
  ETags, accessible XML-safe SVG metadata, and strict script/object/frame blocking headers.
- Curated lifecycle and named-workflow CI signals. Source, Website, CI, Release, Release download,
  Docs, Install, and Download destinations appear only when observed or explicitly configured;
  individual action links remain in HTML/Markdown because an embedded README SVG cannot reliably
  expose multiple click targets.
- Credential-free `@commit-atlas/static` CLI and Node 24 GitHub Action. One snapshot can create ten
  selected SVG types, an optional compact Atlas, `projects.json`, `projects.md`, and a byte/SHA-256
  manifest — up to 14 output files — while removing only known stale CommitAtlas artifacts. Optional
  bounded `themes` entries render opposite-scheme outputs into explicit directories from that same
  snapshot; each directory retains its own v1 manifest and ownership-aware cleanup boundary.
- Generated catalog boundaries are pinned by adversarial fixtures: untrusted release tags and
  workflow names use delimiter-safe CommonMark code spans (fence grown past the longest backtick
  run, padded at backtick edges) and `projects.md` emits no Markdown table, so no upstream value can
  open a link, a cell, or a row. `projects.json`/`projects.md` are reserved managed names, and
  cleanup deletes a known filename only when the previous `manifest.json` recorded CommitAtlas as its
  writer, so a pre-existing unowned file survives. Cleanup runs before the new manifest is installed,
  so an interrupted run leaves the ownership record intact and the next run finishes the collection.
  Observed repository homepages are disclosed rather than restricted, while configured `links` stay
  on the core `ALLOWED_LINK_HOSTS` allowlist: every action carries `host` and `external`, and
  `projects.md` labels any non GitHub-owned host, which keeps legitimate project websites working
  without presenting them as GitHub-owned.
- Buildable `@commit-atlas/core`, `@commit-atlas/github`, `@commit-atlas/svg`, and
  `@commit-atlas/static` packages with canonical GPL-3.0-only package metadata and clean-consumer
  pack/import proof.
- Four separated upstream failure meanings. A missing public resource returns `github_not_found`
  with HTTP 404 and one message that never says whether the resource is absent or private; a rate
  limit stays `github_rate_limited` with HTTP 429 and retry guidance; every other upstream failure
  stays `github_unavailable` with HTTP 502. Optional release and workflow lookups treat only 404 as
  absence, so a throttled optional lookup can no longer read as "no release" or a clean CI signal.
- The [Chris0Jeky profile](https://github.com/Chris0Jeky) now leads with the responsive Atlas, then
  Taskdeck, the Project radar, and the marker-bounded six-project catalog. Breakdown, Rhythm,
  Cadence, and Releases remain available as full-width focused views under one collapsed,
  purpose-labelled disclosure; Profile, Streak, Activity, and Languages are omitted from the README
  because the Atlas already carries those signals. Its daily workflow invokes CommitAtlas once;
  that one snapshot renders the primary and opposite-scheme variant directories, then the consumer
  validates 13 payload artifacts, matching manifest time/windows, and every hash before updating
  README/assets. A failed refresh leaves the previous committed assets intact.

## Verified

- **2026-08-27: freshness, product-boundary, and profile-consumer rollout is closed.**
  `npm.cmd run check` passed at producer head `63278f5` (all 332 focused tests plus typecheck, lint,
  four package builds, Action parity, and production build). A fresh-context adversarial review and
  the Codex connector found no blocker. Main CI and deployment are green at merge `1062a87`; the
  deployed origin passed 17/17 probes. The profile consumer passed 10/10 focused tests and its
  hosted test, merged at `3a14cbe`, then regenerated and hash-validated both colour schemes in
  `ce59d76`. Browser inspection verified the landing boundary, the profile hierarchy, the collapsed
  secondary views, and exact agreement with GitHub's 29,217 contribution total at the checkpoint.

- 2026-08-24: `npm.cmd run check` passes at the chassis head — TypeScript, ESLint, deploy tooling 5,
  core 20, chassis 46, GitHub/API 93, Studio 49, SVG 30, static 14, Action 2, packaging 3, and
  rendered product/API 47, plus four package builds and Action bundle parity.
- 2026-08-24: the reduced-motion path was verified by reading computed styles with animations
  disabled, not by inspection. Every instrument rests in its final state: the plotter trace at
  `stroke-dashoffset: 0`, the pen dot at `offset-distance: 100%`, the rhythm needle at its settled
  39.6°, every density column at opacity 1, the pending lamp at full opacity, the survey grid
  untransformed, the beam removed, and the acquisition gauge at its −90° rest stop with the plate
  still reading NO SIGNAL.
- 2026-08-24: the 390-wide layout was measured in a same-origin frame, because the available browser
  window would not shrink below 1440. `scrollWidth` equals `clientWidth` at 371 CSS pixels with no
  element extending past the viewport, so there is no document-level horizontal overflow.
- 2026-08-24: all four chassis themes were inspected on the running surface, including the light
  theme, which is what exposed the ink-role problem below.
- **2026-08-24: keyboard QA is closed on both pages, against production.** Landing page: 51
  reachable controls, Studio: 60. On both, every reachable control resolves a non-empty accessible
  name, no element carries a positive `tabindex` (so DOM order *is* tab order), and there are zero
  non-native widgets — 32 links, 15 buttons and 4 radios on the landing page; links, buttons,
  radios, text and url inputs, selects, a textarea, and disclosure summaries on the Studio. That
  last point is the one that matters: because every control is a native element, Enter and Space
  are handled by the browser rather than by a handler that could implement only one of them.
- 2026-08-24: focus order follows reading order. Six DOM-order against geometry inversions were
  measured and every one falls inside a multi-column grid — the three-column specimen tray, whose
  compact plate spans two rows, and the two-column evidence grid. That is column-major order, not
  a fault.
- 2026-08-24: both skip links move focus, not just scroll position. `#main` on the landing page and
  `#configure` on the Studio each report as `document.activeElement` after activation, which is
  what the added `tabindex="-1"` buys.
- 2026-08-24: every reachable control resolves a visible focus indicator. The first Studio
  measurement reported 58 controls without one; that was the measurement, not the page. Chrome
  matches `:focus-visible` on programmatic focus only when the last interaction was a keypress, and
  after one real Tab the same probe reported 53 of 60. The remaining seven are inside a *collapsed*
  disclosure and the browser refused to focus them at all — correctly unreachable until it opens.
- 2026-08-24: Enter inside a Studio text field submits the intended action. All five in-form
  buttons declare an explicit `type`, and the first submit in DOM order is Preview atlas — not
  Remove, which is what an implicit type on a destructive button would have caused.
- **2026-08-24: the two card defects are fixed and the eight cards are redesigned.** The density
  ramp is one hue at four steps plus a neutral socket, asserted monotonic with a ≥1.25× separation
  at every step so it survives greyscale, and `densityFill` resolves a non-finite level to the
  socket rather than to the maximum. The contribution mix is one ink with bar length as the only
  variable. Every theme names a partner in the opposite colour scheme, and the Studio emits a
  `<picture>` block so a README serves the reader's own scheme. Verified by rendering all eight
  cards as `<img>` on both GitHub grounds, which is how they are actually consumed.
- 2026-08-24: two faults were caught by looking rather than by testing. The font stacks first
  shipped with double quotes around multi-word families, which closed `font-family="` early and
  produced malformed XML — `assertWellFormedXml` failed five suites at once, exactly as designed.
  And the hazard strip, fine on a 1440px fascia, was the loudest element on a 720px card repeated
  down a README while carrying no information; it is edge texture now.
- **2026-08-24: the 1440x900 pair is captured, on production.** This machine's display is 1440x810
  with 762 usable, so a native 1440x900 viewport cannot exist here — which is why this stayed
  unverified rather than being quietly claimed. Measured in a true 1440x900 same-origin frame
  against the live origin: scrollWidth equals clientWidth, nothing overflowing, and every desktop
  breakpoint resolving (fascia four-up at 390/312/312/312, stations two-up at 652.5, tray three-up
  at 429.7, rack six-up at 209.8).
- 2026-08-24: two fresh-context reviews ran independently against the chassis branch — one
  adversarial correctness pass, one accessibility pass. Neither found a CRITICAL. Both found the
  same defect: the evidence drawer declared `role="dialog" aria-modal="true"` with no focus trap
  and nothing inert behind it, so a screen-reader user was confined while a keyboard user could Tab
  straight out under the scrim. It is now a native `<dialog>` opened with `showModal()`, verified in
  a browser: `:modal` matches and focusing an element outside it is refused.
- 2026-08-24: the drawer's three exit paths were each exercised in a browser after that change —
  Escape, the close button, and pressing the open trigger a second time. All three close the dialog
  and return focus to the trigger. The first attempt did not: focus was restored while the document
  was still inert and was silently dropped to `<body>`, which is why restoration now runs after
  `dialog.close()`.

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
- Sites version 8 returned 200 for health and all eight deterministic synthetic SVG routes. Every
  exercised SVG returned the intended cache policy and CSP; an unknown query returned bounded 400
  with `Cache-Control: no-store`. That evidence is dated 2026-08-20 against the retired mirror; the
  Cloudflare Worker was re-proved independently on 2026-08-23 (see above).
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

## NOT verified or published

- Every individual Tab keypress, observed as a keypress. The extension's synthetic Tab does not
  produce native focus traversal in this browser, so the sequence itself is unobserved. What was
  proved instead is the set of properties that *make* traversal correct — see Verified below. That
  is a stronger check than watching twenty-five presses, but it is a different one, and it is
  recorded as what it is.
- Token-backed private contribution history. The service and profile intentionally use public
  evidence and never request private repository details.
- A formal cold-load Core Web Vitals trace. Direct browser, keyboard, responsive, contrast, and
  visual checks are recorded, but this environment did not expose the Chrome DevTools performance
  connector needed for a reproducible LCP/INP/CLS trace.
- npm registry publication or GitHub Marketplace listing. Packages and the Action are built and
  used from immutable commits, but registry and Marketplace availability are not claimed.

## Residual risk and next slice


- Two review findings were triaged as non-blocking and left as they are, on purpose. The portfolio
  reticle SVG stays `aria-hidden`: its per-project breakdown is printed in full in the health-rack
  headline, so nothing is lost page-wide and announcing it twice would be noise. And three readings
  render two triggers each — the same reading shown in the fascia and again on the evidence ladder —
  so opening one visibly marks both. That is what they are: one reading, shown twice.
- **The Languages surface never computed byte share.** The README, `ARCHITECTURE.md`, and the design
  handoff all described it as a repository-language *byte* share. `toLanguagesCard` is fed by the
  profile snapshot, whose `share` is `repositories / total` — a distribution over repositories. The
  labels are corrected rather than the code, because moving to byte share needs a per-repository
  `/languages` call and that is a rate-limit cost belonging to its own slice. `@commit-atlas/svg`
  already renders byte share when given `bytes`, and `@commit-atlas/core` already computes it in
  `aggregateLanguages`; nothing currently supplies either. The dated QA record from 2026-08-20 still
  says "byte-share" and is deliberately left alone, because it records what was observed then.
- The survey-grid parallax uses a scroll-driven CSS timeline, so it is inert in engines without
  `animation-timeline: scroll()`. That degrades to a static grid, which is the reduced-motion state
  anyway, so there is nothing to fall back to.

- Anonymous request-time GitHub availability remains bounded but intermittent. During final QA,
  live Profile returned 429 and live Breakdown returned 502 twice, while live Languages and every
  synthetic route succeeded. The scheduled, hash-checked profile snapshot is the deliberate
  last-known-good surface. Do not install a private-capable personal token merely to hide anonymous
  rate limits.
- GitHub Actions emits a non-failing warning that pinned Node 20 JavaScript actions are forced onto
  Node 24. The exact hosted gates pass; update those immutable pins only in a reviewed slice.
- The reviewed hardening slice is closed in full. #49 closed the direct package-renderer bounds,
  #50 the generated catalog boundaries, #33/#34 the response-contract gaps, #48 the same-key
  Studio refresh evidence window, and #55 the same bounds class on `renderAtlasCard`: breakdown
  window labels and rhythm level/basis truncate at the `@commit-atlas/svg` boundary, valid
  adapter inputs render byte-identically, a preview run confirms live card evidence per
  configuration rather than only for the newest one, and on the atlas card the momentum strip is
  bucket-bounded while non-finite `window.days`, `trend.changePercent`, and `projects.*` values
  can no longer reach visible text. A negative `projects.*` count is bounded there too, because
  `finite()` clamps it to a plausible zero and would otherwise render corrupt input as a clean
  tally. Do not reopen the completed demonstration review loop unless release-impact evidence
  promotes an item.
- #33 and #34 close the reviewed response-contract gaps. Two of those five items were already
  satisfied on `main` and are now regression-covered rather than reimplemented: the contribution
  window was already inclusive and exactly the requested UTC day count, and synthetic category
  totals were already bounded by the requested window in `8cb53ab`.
- The token-backed GraphQL path needed its own not-found handling. GitHub answers an unknown login
  with HTTP 200 carrying both `data.user: null` and a `NOT_FOUND` entry in `errors`, so the generic
  payload-error path claimed it as an outage first. GraphQL now classifies its own payload and
  emits the shared not-found contract, proven with a fixture matching that live shape.
- The previous 403 conflation is closed by PR #88. GitHub `403` responses are classified as rate
  limits only when retry/reset headers or an explicit rate-limit/abuse message support that meaning;
  other 403s remain unavailable, and optional release/workflow evidence cannot become observed
  absence or healthy state through that path.
- That slice renames one public JSON field. `ProjectSnapshot.openIssues` and the generated
  `projects.json` entry key are now `openIssuesAndPullRequests`, because GitHub REST
  `open_issues_count` counts pull requests too; `projects.md` already said `open issues/PRs` and is
  unchanged. `PROJECT_CATALOG_VERSION` is therefore `2`. The consumer's only compatibility gate is
  that number, so leaving it at `1` would let a version-1 reader accept a shape it cannot validate.
  Version 2 covers the combined shape change: #53's added `host`/`external` action keys landed
  first, then #57 bumped the version once for both, so there is no second bump to make.
  The consumer in the profile repository accepted version 2 before the pinned Action SHA advanced;
  #60 is closed, and refresh run 33119356827 proves the producer/consumer contract end to end.
- Operational resilience and response-boundary follow-ups #85, #62, #58, and #82 are complete.
  The static dark/light fetch duplication tracked by #78 is addressed by the config-level theme
  variants described above, and profile PR #7 completed the atomic consumer migration. npm
  publication and Marketplace listing remain separate owner decisions. v0.4.0 is released and the
  release path tracked by #102 is complete.

## Next programme (planned, not shipped)

- **2026-08-29: the expansion programme is documented and seeded.** [EXPANSION_PLAN.md](./EXPANSION_PLAN.md)
  reconciles the owner's brief against the code, fixes the motion model, scene engine, delivery
  path, and cross-project projection seams, and records fourteen decisions plus nine owner questions.
  It was merged in PR #112 as `680886d`, with successful main CI run
  [33261722057](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/33261722057) and successful
  Deploy run [33261802287](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/33261802287).
  Eighteen accepted post-merge review corrections then landed in PR #173 as `1da5fde`, with
  successful main CI run
  [33264954687](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/33264954687) and successful
  Deploy run [33265011752](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/33265011752).
  [PROJECTION_CONTRACTS.md](./PROJECTION_CONTRACTS.md) is the consumer-side specification of
  `PublicLensProjection.v1` and `ResearchFindingProjection.v1`. Tracking issue
  [#111](https://github.com/Chris0Jeky/CommitAtlas/issues/111) holds the dependency-ordered issue
  map across four milestones (P0 ground truth → P1 alive → P2 lens projections → P3 scenes,
  findings, packs). Issue #174's fixed synthetic Worker/CSP probe route is merged and deployed.
  The #113 checkpoint now retains five-frame captures and recordings for all 51 direct-Worker rows,
  plus 14 completed Chromium/Firefox GitHub-raw and Camo diagnostic rows. WebKit hosted delivery is
  explicitly not tested: discovery stopped on a `400x133` versus `360x120` intrinsic-size guard, so
  #113 is parked at the three-attempt ceiling on [#180](https://github.com/Chris0Jeky/CommitAtlas/issues/180).
  Issue #183's browser-free hardening is complete: the normal gate runs the evidence tests, both
  capture CLIs fail closed on unsafe output and arguments, direct hosted assets require exact
  synthetic identity before capture, and static results require a verified frame-zero reference to
  claim `frozen at frame zero`. Resume with #180 by proving WebKit asset identity independently of presentation size, rerunning its
  seven-row diagnostic once, then running #113's unfiltered three-engine raw/Camo matrix. The owner
  gates in #115–#122 and #170 remain open, and no motion behaviour from the programme is on `main`.

## Clean resume commands (from checkout root)

```powershell
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
