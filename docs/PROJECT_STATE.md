# CommitAtlas project state

Last verified: 2026-08-24 19:05 BST

This is the authoritative checkpoint for the public demonstration. Git, hosted CI, Cloudflare
deployment state, and the live profile outrank this file after any ref or deployment moves.

The release path is in [V0_1_PLAN.md](./V0_1_PLAN.md), the static contract is in
[STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md), the walkthrough is in
[DEMO_GUIDE.md](./DEMO_GUIDE.md), and the complete evidence matrix is in
[RELEASE_CANDIDATE_QA_2026-08-20.md](./RELEASE_CANDIDATE_QA_2026-08-20.md).

## Public checkpoint

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
- Latest executable/static-producer checkpoint: `ff9a836cb80f51a98c0f5a28b63c5c36d4e4da4d`.
  Exact-head hosted [Quality gate run 32429814147](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/32429814147)
  passed. At the time, that follow-up changed only the generated project-catalog label and Action
  bundle, so the then-current Sites deployment stayed correctly bound to the preceding application
  source. This is a historical note; Sites is no longer the canonical host.
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
- Credential-free `@commit-atlas/static` CLI and Node 24 GitHub Action. One snapshot can create the
  eight canonical SVGs, an optional compact Atlas, `projects.json`, `projects.md`, and a byte/SHA-256
  manifest while removing only known stale CommitAtlas artifacts.
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
- The [Chris0Jeky profile](https://github.com/Chris0Jeky) now leads with the responsive Atlas, shows
  Breakdown and Rhythm visibly, retains the Project radar and four optional focused widgets, and
  renders a marker-bounded six-project catalog with observed/configured action links. Its daily
  workflow validates 11 payload artifacts and every manifest hash before updating README/assets.

## Verified

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

## NOT verified or released

- Every individual Tab keypress, observed as a keypress. The extension's synthetic Tab does not
  produce native focus traversal in this browser, so the sequence itself is unobserved. What was
  proved instead is the set of properties that *make* traversal correct — see Verified below. That
  is a stronger check than watching twenty-five presses, but it is a different one, and it is
  recorded as what it is.
- Token-backed private contribution history. The service and profile intentionally use public
  evidence and never request private repository details.
- npm registry publication or a GitHub `v0.1.0` release. Packages and the Action are built and used
  from immutable commits, but registry/release availability is not claimed.

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
- One reviewed 403 conflation is deliberately left alone and tracked separately: a genuine
  non-rate-limit 403, such as a blocked repository or an organisation restriction, is still
  reported as `github_rate_limited`. That predates this slice on every required lookup.
- That slice renames one public JSON field. `ProjectSnapshot.openIssues` and the generated
  `projects.json` entry key are now `openIssuesAndPullRequests`, because GitHub REST
  `open_issues_count` counts pull requests too; `projects.md` already said `open issues/PRs` and is
  unchanged. `PROJECT_CATALOG_VERSION` is therefore `2`. The consumer's only compatibility gate is
  that number, so leaving it at `1` would let a version-1 reader accept a shape it cannot validate.
  Version 2 covers the combined shape change: #53's added `host`/`external` action keys landed
  first, then #57 bumped the version once for both, so there is no second bump to make.
  The consumer in the profile repository must accept version 2 before the pinned Action SHA in its
  workflow is advanced; that ordering is tracked in #60 and is the one cross-repo obligation left.
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
