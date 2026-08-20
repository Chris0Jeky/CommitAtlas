# CommitAtlas project state

Last verified: 2026-08-20

## Shipped on `main`

- Product name, visual direction, public-by-default positioning, repository metadata, community
  health files, locked CI, Dependabot, secret scanning, and the canonical GPL-3.0-only licence.
- Sites-compatible Vinext/Cloudflare workspace with Windows-safe npm scripts and a responsive first
  product surface.
- `@commit-atlas/core` contracts for bounded GitHub inputs, UTC contribution calendars and streaks,
  activity, language bytes, explicit project lifecycle, and truthful CI freshness states.
- `@commit-atlas/svg` deterministic accessible renderers for profile, streak, activity, language,
  and project-summary cards across four themes. The package builds distributable JavaScript and
  declarations during packing and keeps project action links out of README SVGs.
- Truthfulness fixes for future-dated CI observations, as-of streak calculations, empty contribution
  calendars, missing profile/streak values, and credential-bearing URLs.

Feature baseline on `main` when this checkpoint was captured: merge commit `0061861` from
[PR #24](https://github.com/Chris0Jeky/CommitAtlas/pull/24).

## Saved implementation checkpoint

Active branch: `feat/github-api-hardened`

Saved review surface: draft [PR #25](https://github.com/Chris0Jeky/CommitAtlas/pull/25)

The branch contains the first versioned JSON routes for profile, contributions, projects, and
health, plus synthetic fixtures and rendered-route smoke tests. Two follow-up commits align
contribution, lifecycle, and CI observations with `@commit-atlas/core`; require an explicit lifecycle
for every live project; reject private repositories from the shared service; omit restricted
contribution counts; reject credential-bearing HTTPS URLs; and document `GITHUB_TOKEN` as a
server-only Worker binding.

This branch is a checkpoint, not a release candidate. Its latest local gate passed after merging
`main`: root typecheck, lint, production build, three rendered/API smoke tests, 11 core tests, and
9 SVG tests.

## Known incomplete seams

- The GitHub response limit still trusts `Content-Length`; streamed/chunked bodies need a bounded
  reader and malformed required metrics must fail closed instead of becoming zero.
- Project collection needs a request-wide deadline and bounded concurrency within Cloudflare's
  outbound-connection budget.
- Stable ETags and `If-None-Match` handling are not implemented; cache policy must distinguish
  canonical public responses from errors and token-backed/private-capable deployments.
- Synthetic contribution fixtures must honour the requested day window.
- Worker environment types and generated bindings need to make `GITHUB_TOKEN` explicit at runtime,
  followed by route-level public/private, malformed-response, size, timeout, URL, CI, and conditional
  request tests.
- The homepage still contains illustrative numbers and a non-functional form. Do not present either
  as live data before the Studio replaces them or labels them unmistakably as synthetic.

## Ordered next slices

1. Close release blockers [#13](https://github.com/Chris0Jeky/CommitAtlas/issues/13),
   [#18](https://github.com/Chris0Jeky/CommitAtlas/issues/18), and
   [#19](https://github.com/Chris0Jeky/CommitAtlas/issues/19); make the root gate execute and pack
   every package in [#14](https://github.com/Chris0Jeky/CommitAtlas/issues/14).
2. Finish and independently review the API-hardening seams above, then mark its pull request ready.
3. Add versioned SVG routes for profile, streak, activity, languages, and project summaries with
   canonical query parsing, security headers, bounded caching, ETags, and cross-package fixtures.
4. Build the accessible Studio/dashboard: real live-or-synthetic preview, selectable themes and
   projects, explicit lifecycle controls, copyable README Markdown, provenance/freshness, and real
   HTML Source/Docs/Install/Download/Release/CI actions. Never invent an absent action.
5. Add the static generator and GitHub Action for token-backed or private opt-in output, with a clear
   warning against committing private-derived data to a public repository.
6. Complete examples and operator/user documentation; generate one branded social image; run desktop
   and mobile visual, keyboard, accessibility, error-state, and live API checks.
7. Run the full local and hosted gates, reconcile Dependabot PRs #5 and #6 against the final base,
   deploy through Sites, set the repository homepage, create the first versioned release, and only
   then declare the project complete.

## Product decisions

- The public shared service is public-data-only. Private output belongs to explicit self-hosted or
  static-generation workflows; a token never enters a URL, fixture, log, rendered card, or tracked
  file.
- Project lifecycle is declared by the user or manifest and is never guessed from repository
  activity. CI includes unavailable, unconfigured, stale, pending, passing, and failing states;
  uncertainty never becomes green.
- README SVGs are portable summaries. Individual Docs/Install/Download links are real HTML controls
  in the dashboard because image-embedded links are not reliably interactive on GitHub.
- Project action URLs are display-only HTTPS links with no credentials. CommitAtlas does not fetch
  arbitrary user-provided URLs.
- npm remains the repository package manager because the Sites starter and target machine use it
  natively.

## Resume

1. Fetch `origin` and inspect live GitHub PR, check, issue, and review state before trusting this file.
2. Resume `feat/github-api-hardened`; its commits are intentionally incremental and preserve the
   original `feat(data)` API slice plus the two hardening slices.
3. Start with the first ordered slice above. Do not skip the listed API blockers or treat the current
   green smoke gate as proof of those unimplemented paths.

There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.
