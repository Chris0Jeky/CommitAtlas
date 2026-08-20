# CommitAtlas project state

Last verified: 2026-08-20 13:23 BST

This is a deliberate session checkpoint, not a completion or release claim. Every intentional
change is committed and pushed on the branches named below, both auxiliary worktrees have been
removed, and the sole remaining checkout is tracked-clean before this documentation update. Fetch
GitHub and re-read live CI and review state before resuming; live evidence outranks this file.

The detailed remaining build plan is in [V0_1_PLAN.md](./V0_1_PLAN.md).

## Shipped on `main`

Current baseline: `b6856d96d3cb73a9185b10a31086fc1f145e7c00`, merged by
[PR #27](https://github.com/Chris0Jeky/CommitAtlas/pull/27).

- Product identity, responsive Sites-compatible Vinext workspace, repository/community metadata,
  locked CI, Dependabot, secret scanning, and canonical GPL-3.0-only licensing.
- `@commit-atlas/core` contracts for bounded GitHub inputs, contribution calendars and streaks,
  activity, language bytes, explicit lifecycle, and truthful CI freshness.
- `@commit-atlas/svg` deterministic accessible renderers for profile, streak, activity, language,
  and project-summary cards across four themes.
- Both packages prepack ES2020 JavaScript and declarations, ship their README and licence, and can
  be imported by an ordinary clean Node consumer.
- The root quality gate covers typecheck, lint, core/SVG tests, both package dry-run packs, product
  build, and rendered smoke tests.

No deployment, versioned release, or npm publication has occurred.

## Saved remote implementation branches

### JSON API — hosted green, still blocked

- Branch: `feat/github-api-hardened`
- Pull request: [#25](https://github.com/Chris0Jeky/CommitAtlas/pull/25)
- Pushed head: `68dfbcc49623005e2aac9d326722cd7bf2dd9d68`
- Hosted Quality gate at that exact head: passed.
- Local full gate: passed; core 13, GitHub API 30, SVG 9, built-worker/API 8, both package
  dry-run packs, typecheck, and lint. `git diff --check` also passed.

The branch implements bounded versioned JSON profile, contribution, project, and health routes;
synthetic fixtures; request-scoped Worker token binding; one request-wide deadline; bounded GitHub
response streaming and concurrency; stable canonical ETags and 304s; and public/private cache
separation. The final saved commits are deliberately small:

- `2e5173f` proves a contribution token has only empty/`public_repo` classic scopes, checks GitHub's
  restricted-contribution fields, and fails closed before publishing unsafe data.
- `2fd91d5` carries each configured workflow through validation and queries only that workflow for
  CI health; it no longer treats an arbitrary newest workflow as CI.
- `68dfbcc` applies field-appropriate code-point bounds to GitHub text before snapshots reach HTML
  or SVG consumers.

Four P1 review threads remain unresolved. The first three correspond to those fixes and are waiting
for a fresh independent review before resolution. The fourth is a separate **HIGH merge blocker**:
profile/project REST routes can still use a deployment token capable of seeing private repositories,
so an anonymous caller could distinguish a guessed private repository from an inaccessible one.
Before merging, prove the service credential is public-only before *any* public GitHub lookup, or
make private/inaccessible responses indistinguishable. Add an explicit oracle regression test, run
the full gate, push, obtain fresh review, and resolve all four threads only with evidence.

Nonblocking API follow-ups remain [#30](https://github.com/Chris0Jeky/CommitAtlas/issues/30),
[#32](https://github.com/Chris0Jeky/CommitAtlas/issues/32),
[#33](https://github.com/Chris0Jeky/CommitAtlas/issues/33), and
[#34](https://github.com/Chris0Jeky/CommitAtlas/issues/34). Issue #34 now also records malformed
release payloads, canonical identifier schemas, safe-integer metrics, and worker cancellation.

### SVG hardening — both candidates parked

- Original branch: `fix/svg-release-hardening`, head
  `50db00664ddd7f8739228b4e508f72c519261ebc`, closed [PR #29](https://github.com/Chris0Jeky/CommitAtlas/pull/29).
- Replacement branch: `fix/svg-release-hardening-v2`, head
  `695e52cd7566129ea0e34d14385e3233e8dd6ee7`, closed [PR #35](https://github.com/Chris0Jeky/CommitAtlas/pull/35).
- Hosted Quality gate at both saved heads: passed.
- Replacement local evidence: root `npm run check`, SVG 14/14, package dry-run pack, and
  `git diff --check` passed.

Both branches are preserved remotely but must not be merged. Fresh independent review of PR #35
proved two HIGH release-contract defects despite green CI:

1. A valid 366-day card with `count: 100000` and maximum bounded metadata is 30,491 UTF-8 bytes
   with apostrophes and 30,087 bytes with ampersands, exceeding the documented sub-30 KB promise.
2. `renderLanguagesCard` rejects the canonical `aggregateLanguages()` result because core correctly
   returns both `bytes` and the derived `percentage`.

The complete replacement acceptance is saved in
[#37](https://github.com/Chris0Jeky/CommitAtlas/issues/37). Chronological activity exposure and
normalized project-board layout are [#36](https://github.com/Chris0Jeky/CommitAtlas/issues/36),
and minimum-height clipping is [#31](https://github.com/Chris0Jeky/CommitAtlas/issues/31). Issues
[#20](https://github.com/Chris0Jeky/CommitAtlas/issues/20) and
[#21](https://github.com/Chris0Jeky/CommitAtlas/issues/21) stay open until a safe replacement lands.
All PR #35 review threads were replied to and either tracked or promoted to #37 before the PR was
closed.

### Studio/dashboard — polished checkpoint, not integrated

- Branch: `feat/studio-dashboard`
- Pushed product head before this state-only update: `0ca0dd9e77d8d7d20d2a2564a264486f6a084b43`
- No pull request is open because the generated SVG endpoints do not exist yet.

The branch contains a responsive landing page and accessible Studio with live or explicitly
synthetic previews, four themes, card selection, up to six declared project configurations,
truthful partial-data handling, real HTML actions only when URLs exist, freshness/provenance, and
copyable README Markdown. Commit `6434d40` makes placeholder and localhost embed origins explicit;
commit `0ca0dd9` adds the original branded `public/og.png` social asset.

The current root `npm run check` passed on 2026-08-20: typecheck, lint, 13 core tests, 9 SVG tests,
both package dry-run packs, Vinext production build, and two rendered Studio/product smoke tests.
Earlier visual inspection at 1440x900 and 390x844 found no horizontal mobile overflow. That is
checkpoint evidence only and must be repeated after integration.

Repeated Vite hot reloads once logged React's "multiple renderers concurrently rendering the same
context provider" warning. It did not fail a production build, but the final production-server QA
must explicitly try to reproduce it. The social image must also be served and inspected through the
final deployed origin before metadata is considered complete.

## Durable product decisions

- The shared service is public-data-only. Private output is an explicit self-hosted/static mode;
  tokens never enter URLs, fixtures, logs, cards, or tracked files.
- Lifecycle is declared, never guessed. Missing or stale CI is never rendered as passing.
- README SVGs are portable summaries. Source, Docs, Install, Download, Release, and CI actions live
  in the HTML dashboard because links inside an image-embedded SVG are not reliable on GitHub.
- Action URLs are display-only HTTPS links without credentials; CommitAtlas never fetches them.
- Language percentages must name their basis. Repository-language share is not proficiency, and
  byte-weighted output must use the canonical core aggregate rather than silently changing meaning.
- npm is the package manager for this workspace. Repository releases and npm publication are
  separate claims and require separate proof.

## Closeout boundary

Changed and saved:

- Root Studio/social work is pushed on `feat/studio-dashboard`.
- API fixes are pushed on `feat/github-api-hardened`, with exact hosted CI and thread state recorded.
- Both SVG review branches are pushed; the unsafe replacement PR is closed and its findings are in
  #31, #36, and #37.
- The static generator, Action, route, QA, deployment, and release plans are now durable in
  [V0_1_PLAN.md](./V0_1_PLAN.md).
- Auxiliary API and SVG worktrees were removed after their tracked-clean status was confirmed.
  Only ignored, reproducible dependencies/build output was discarded.

Not verified or not completed:

- A fresh review of API head `68dfbcc`, the remaining private-repository oracle fix, and PR #25 merge.
- A safe SVG replacement, versioned SVG routes, static generator, bundled Action, final integration,
  production browser/accessibility pass, Sites deployment, public URL, GitHub homepage, v0.1.0
  release, or npm publication.
- Live contribution behavior with a real public-only Worker credential.

There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.
