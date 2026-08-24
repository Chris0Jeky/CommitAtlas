# CommitAtlas v0.1 implementation plan

Status: complete public demonstration and active release candidate, not a `v0.1.0` completion claim.
The bounded API, eight SVG surfaces, rich Atlas, Studio, public-profile source, responsive static
generator, and credential-free Node 24 Action are implemented on `main`, deployed, and exercised by
the live Chris0Jeky profile. npm publication, complete keyboard traversal, release-impact issue
reconciliation, and a GitHub release remain until directly verified.
Exact refs and evidence are in [PROJECT_STATE.md](./PROJECT_STATE.md). Start every resume by fetching
`origin` and inspecting live CI, issues, releases, deployment state, and unresolved PR review
threads.

## v0.1 definition of done

CommitAtlas v0.1 is complete only when all of the following are true:

- The bounded JSON API and all eight SVG surfaces are merged on `main` with exact-head CI and review.
- Atlas, profile, streak, breakdown, rhythm, activity, languages, and project-board cards work in demo
  and supported live modes.
- The Studio uses the shipped endpoints, handles partial/unavailable data truthfully, and passes
  desktop, mobile, keyboard, accessibility, action-link, copy, error, and cache behavior checks.
- The static generator and bundled local GitHub Action create the selected eight-card set plus optional
  same-snapshot Atlas companion and `projects.json`/`projects.md` catalogs, with a hash manifest and
  without exposing credentials or publishing anything automatically.
- README, architecture, security, API, CLI, Action, and operator documentation match real behavior.
- The production build is deployed through Sites, the exact public URL is browser-verified, and the
  repository homepage and social metadata use that real URL.
- Final local and hosted gates pass at the release commit; blocking issues are closed; retained
  nonblocking issues are explicitly named; and a GitHub `v0.1.0` release is created from that commit.
- npm availability is claimed only if registry publication is separately performed and verified.

## Ordered release-critical path

### 1. Close the API boundary — completed

PR #25 merged as `975b69429b6b5ec417e5868930c229ec6d7bd9cc` after exact-head CI, a fresh
security/truth review, and review-thread reconciliation. The shipped boundary preflights configured
credentials before public REST or GraphQL lookups, rejects unsafe token/scope combinations, prevents
private-repository existence oracles, binds CI to configured workflows, rejects normalized workflow
path traversal, and bounds upstream text.

Keep #30, #32, #33, #34, and #38 explicit. Fix a follow-up before release only if it can produce
wrong, unsafe, or materially misleading v0.1 output; otherwise retain it by name in release notes.

### 2. Ship bounded accessible SVG renderers — completed

PR #39 merged as `f1a8f74868a820d42e0909af52272bd7a849b7bf` after its corrected exact head
`5794d9e11ba3c975f0b7ec8d966e2f3cd5a700e0` passed the full local gate, clean-consumer package
proof, fresh independent review, hosted Quality gate, aging floor, and review-thread reconciliation.
The chronological activity summary now lives in the outer SVG accessible description and visual
cells are in chronological DOM order while remaining `aria-hidden`.

Required contracts:

- Every renderer remains deterministic, XML-safe, accessible at the card level, and free of
  credential-bearing URLs or HTML action anchors.
- A 366-day activity card remains below 30,000 UTF-8 bytes for the full valid core input range,
  including `count: 100000` and maximum ampersand, apostrophe, and emoji metadata.
- `renderLanguagesCard(aggregateLanguages(...))` works directly or through a first-class exported,
  documented adapter with a cross-package test. Never reject core's canonical bytes-plus-percentage
  result by accident.
- Activity labels remain in chronological DOM/accessibility order and expose date, count, and the
  word `contributions` without relying on colour.
- Layout breakpoints use normalized dimensions; minimum heights keep all optional content within the
  viewBox; non-finite stars are unavailable; an empty profile name falls back to login.
- The package still prepack-builds ES2020 JS and declarations and ships only the expected README,
  LICENSE, metadata, and `dist` files.

Issues #20, #21, #31, #36, and #37 closed through that merged PR after direct tests proved their
acceptance. Maximum 366-day activity outputs remained below the 30,000-byte contract for maximum
ampersand, apostrophe, and emoji metadata.

### 3. Add the eight versioned SVG surfaces — completed

PR #44 merged as `a876dc30ac34134f405b7b9a7d4ed3ae181e9407` after the corrected exact head
`dff9c8825d262e4ceb625e67c399be06a6c3640e` passed the full local gate, fresh independent review,
hosted CI, the aging floor, and review-thread reconciliation. It contains strict canonical query
parsing, secure byte-exact SVG response/ETag headers, shared snapshot adapters, all eight handlers,
and built-Worker route proof.

The reviewed fixes omit aggregate stars for truncated repository lists, reject truncated language
aggregates, require a complete contiguous requested contribution window, trim an older boundary day,
reject any future day, and preserve a genuinely complete zero calendar as zero. The superseded PR
#41 was closed and issue #42 closed through PR #44.

Implemented public surfaces:

- `/api/v1/cards/profile.svg?user=&demo=&theme=`
- `/api/v1/cards/streak.svg?user=&demo=&theme=`
- `/api/v1/cards/breakdown.svg?user=&demo=&theme=&days=&motion=`
- `/api/v1/cards/rhythm.svg?user=&demo=&theme=&days=&motion=`
- `/api/v1/cards/activity.svg?user=&demo=&theme=&days=`
- `/api/v1/cards/languages.svg?user=&demo=&theme=`
- `/api/v1/projects.svg?owner=&repos=&states=&workflows=&demo=&theme=`

Query contract:

- Reject unknown or duplicate keys; normalize one canonical query before data fetch and ETag work.
- Themes are `aurora`, `midnight`, `paper`, and `ember`; activity days are 7–365.
- Do not expose arbitrary width/height in v0.1.
- Projects keep explicit repository, lifecycle, and workflow identity. No workflow means
  `unconfigured`, never “use whichever run is newest.”

Data mapping:

- Profile snapshot maps to the profile card; missing values remain absent/unavailable.
- Contribution days pass through core parsing, `calculateStreaks`, and `calculateActivitySeries`.
  The `asOf` date is the latest valid UTC day. Missing contribution data never becomes a zero streak.
- Languages initially use the clearly documented repository-language share from the profile
  snapshot. If byte data is introduced, use `aggregateLanguages` and label the basis explicitly.
- Projects map declared lifecycle and configured workflow data into explicit CI states, releases,
  stars, and freshness. SVG remains summary-only; actions stay in HTML.

Every successful SVG response includes:

- `Content-Type: image/svg+xml; charset=utf-8`
- CORS suitable for public image embeds, `X-Content-Type-Options: nosniff`, cross-origin resource
  policy, no-referrer, and a strict no-script/no-object/no-frame SVG content security policy
- Stable ETag and identical security/cache headers on 304
- Public caching appropriate to volatility (profile/languages about 15 minutes, contributions about
  one hour, projects about five minutes); token/private paths are `no-store`

Invalid or unavailable requests return bounded JSON errors with `no-store`, never an error SVG that
looks like healthy data. Demo/live-shaped fixtures cover all eight surfaces, invalid/duplicate queries,
leap dates, empty languages, partial projects, 304 behavior, credential rejection, truncated
repository aggregates, and gapped contribution windows.

Reviewed lower-priority route gaps remain retained in
[#40](https://github.com/Chris0Jeky/CommitAtlas/issues/40). Bounded-streak disclosure and synthetic
demo labelling remain explicit in #45 and #46; they must be decided from release evidence rather
than silently folded into a completed review round.

### 4. Integrate and prove the Studio — completed and deployed

PR #47's integration commits preserve the union of package, API, route, Studio shell, and rendered
product tests. Focused post-handoff commits bind output to current evidence, preserve the full
bounded project/workflow contract, restore Paper contrast, retire stale project snapshots, and put
configuration before the long preview on mobile. The current deployed implementation is `8372d65`;
exact evidence lives in [PROJECT_STATE.md](./PROJECT_STATE.md).

Production desktop/mobile browser QA covered:

- landing and Studio at 1440x900 and 390x844 with no overflow or clipped controls;
- demo Preview, live public profile/projects, and contribution-unavailable behavior without a safe
  token;
- invalid handles, invalid repositories, partial upstream data, and rate limits;
- add, remove, configure lifecycle/workflow/action links, theme and card selection;
- Markdown copy and every produced image URL; Docs/Install/Download/Source/Release/CI actions only
  when their HTTPS URLs exist;
- landmarks, labels, contrast, reduced motion, visible focus styling, and screen-reader-relevant SVG
  summaries; full sequential keyboard traversal remains unverified;
- ETag/304 and cache headers; direct `/og.png`; console and network errors; and an explicit attempt to
  reproduce the prior React multiple-renderer warning.

Current complete evidence and the browser-control limitation are in
[RELEASE_CANDIDATE_QA_2026-08-20.md](./RELEASE_CANDIDATE_QA_2026-08-20.md); the original Studio
integration checkpoint remains preserved in [STUDIO_QA_2026-08-20.md](./STUDIO_QA_2026-08-20.md).
The previously confirmed live contribution-card copy blocker and causally confirmed late-review
seams are closed in code and tests. PR #47 was merged. The historical `948c795` checkpoint closed
the late truncated-language P1; current version 7 and the responsive profile were re-proved at
`8372d65`. Two late P2 threads remain explicitly parked. Full keyboard-only traversal remains a
separate unverified pre-release check because the available browser controller could not reliably
prove the complete focus path.

### 5. Build the static generator package — completed and publicly exercised

`@commit-atlas/github` now owns the hardened transport and public snapshot contracts, and
`@commit-atlas/static` consumes it with `@commit-atlas/core` and `@commit-atlas/svg`. The tracked,
same-owner `.commitatlas.json` selects any subset of Atlas, profile, streak, activity, languages, and
projects. The CLI accepts `--config`, `--output-dir`, `--as-of`, and `--dry-run`.

The shipped boundary is narrower than the earlier plan: v1 is credential-free, public-only, and has
no private or fixture mode. It parses a complete logged-out GitHub profile contribution window,
retains public activity-type percentages as percentages, and fails before output for malformed,
gapped, unavailable, or inconsistent evidence.

All selected SVG payloads derive from one `PortfolioSnapshot`; `manifest.json` records their exact
window, bytes, and SHA-256 hashes. Optional `responsiveAtlas` output renders the alternate Atlas
layout from that same snapshot. Repository-contained/tracked-path and symlink checks run before
staged per-file replacement. After successful replacement, only stale filenames from the bounded
CommitAtlas-owned set are removed; unrelated output siblings are preserved. Static tests, full
package proof, a consumer workflow, and committed-manifest validation pass. The exact contract is in
[STATIC_GENERATOR_PLAN.md](./STATIC_GENERATOR_PLAN.md).

### 6. Add the repository-local GitHub Action — completed and publicly exercised

The root `action.yml` uses `runs.using: node24` with a reproducibly bundled
`action/dist/index.js`. Inputs are `config`, `output-dir`, `as-of`, and `dry-run`; outputs are the
manifest, eight canonical card paths, `projects.json`/`projects.md` catalog paths, and responsive
Atlas companion paths when requested.

The Action does not accept a credential and never commits, pushes, uploads, publishes, or deploys.
A consumer workflow owns those operations and may use its built-in `GITHUB_TOKEN` only for checkout
and git push. `npm run test:action` checks the metadata, no-token boundary, runtime behavior, and
bundle parity. The live profile pins immutable implementation `8372d65`, validates its generated artifact
hashes, and refreshes daily. Consumers should retain immutable pins until a stable release/tag
policy is published.

### 7. Finish the tagged release — demonstration documentation completed

README, package docs, architecture, the walkthrough, project state, and dated QA now describe only
behavior exercised at the demonstration head, including:

- preserve the real deployed quick-start URLs and all eight card examples;
- Studio workflow, API query/error/cache reference, manifest/config schemas, CLI and Action examples;
- public/private threat boundary, credential handling, rate limits, self-hosting, accessibility, and
  troubleshooting;
- architecture diagrams/text that match actual data flow; no guessed remote manifest fetches;
- keep the inspected `public/og.png` social image metadata bound to the real Sites origin.

Release work — all six items are discharged:

1. **Done.** Dependabot #5 and #6 landed with fresh greens, not stale ones. #63 could not be carried
   by Dependabot past a lockfile conflict and was reapplied directly as #68, with exact pins rather
   than the caret ranges `npm install` writes.
2. **Done.** #28, #30, #32–#34, #38 and #40 are all closed, as are #48, #49, #50 and #55. The four
   items deliberately left open are named in the release notes rather than quietly dropped: #62
   (403 conflated with rate-limited), #58 (bar geometry at absurd magnitudes), #54 (a Windows
   path-length environment failure), and #60 (the cross-repo catalog ordering).
3. **Done.** Full `npm run check` exits 0 from a clean `npm ci` at the release head, hosted Quality
   gate is green on `main`, and #66 took two independent reviews — one connector, one fresh-context
   adversarial — which between them found a false licence claim and four vacuous tests.
4. **Superseded.** Sites is retired and is no longer the canonical host. Cloudflare Workers is, and
   it re-proves itself on every push: CI green on `main` triggers a build, a deploy, and seventeen
   probes against the origin Wrangler reported for that deployment.
5. **Done, and now automatic.** The production smoke is the post-deploy probe set, which runs on
   every deployment rather than being repeated by hand after a release-impact change.
6. **Done.** Release `v0.1.0` is cut from the verified commit with the incremental history intact —
   merge commits throughout, no squashing. **No package tarballs are attached and npm publication is
   not claimed**: the packages are built and pack-verified but are not on the registry, and nothing
   will say otherwise until a registry lookup succeeds.

## Clean resume command set

```powershell
git fetch --all --prune
git status --short --branch
git worktree list --porcelain
git ls-remote --heads origin main
gh pr list --repo Chris0Jeky/CommitAtlas --state open
gh issue list --repo Chris0Jeky/CommitAtlas --state open --limit 100
```

Resume from `main`; inspect the exact remote head, current CI, Sites deployment, and unresolved review
threads. Continue with the static-generator plan. Keep the two answered P2 threads and #48 parked
unless release-impact evidence promotes them; do not reopen the completed Studio review loop for
cosmetic work.
