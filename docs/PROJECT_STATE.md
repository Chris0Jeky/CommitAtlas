# CommitAtlas project state

Last verified: 2026-08-20 12:44 BST

This is a deliberate session checkpoint, not a completion claim. All useful work is committed and
the remote feature branches named below are the durable source of truth. Fetch GitHub and inspect
live checks/reviews before acting because CI and review state can move after this timestamp.

## Shipped on `main`

Current verified baseline: `b6856d96d3cb73a9185b10a31086fc1f145e7c00`, merged by
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

The release-foundation work closed #13, #14, #18, and #19. No deployment or versioned release has
been created yet.

## Saved remote implementation branches

### JSON API — blocked, do not merge

- Branch: `feat/github-api-hardened`
- Pull request: [#25](https://github.com/Chris0Jeky/CommitAtlas/pull/25)
- Saved head: `adafb8377c3c6633ed18ad865879f4c5ef821985`
- Hosted Quality gate at this head: passed.
- Local evidence: 13 core tests, 19 API tests, 9 SVG tests, both package dry-run packs, and four
  rendered/API product smokes passed.

The branch implements bounded versioned JSON profile, contribution, project, and health routes;
synthetic fixtures; request-scoped Worker token binding; a request-wide deadline; bounded GitHub
response streaming and concurrency; canonical public caching; stable ETags; conditional 304s; and
public/private cache separation.

Independent integrated review found one **HIGH merge blocker**. `lib/github/client.ts` currently
passes GitHub's `x-ratelimit-reset` UTC epoch timestamp through as a numeric HTTP `Retry-After`
delay. That can tell clients to wait decades. Prefer an upstream `Retry-After` when present;
otherwise calculate `max(0, resetEpoch - nowEpoch)` seconds. Add focused 403/429 regression tests,
run the scoped and root gates, push, obtain a fresh review of the logic fix, and restart the
three-minute head-aging window. The finding is also recorded on PR #25.

Nonblocking residual: [#30](https://github.com/Chris0Jeky/CommitAtlas/issues/30) tracks stable demo
profile/project ETags.

### SVG hardening — fix pushed, final gate pending

- Branch: `fix/svg-release-hardening`
- Pull request: [#29](https://github.com/Chris0Jeky/CommitAtlas/pull/29)
- Saved head: `50db00664ddd7f8739228b4e508f72c519261ebc`
- Hosted Quality gate after the final push: in progress when this checkpoint was written.

This branch hardens renderer bounds and card-specific semantics, adds source-backed profile stars,
tests package boundaries, and keeps a full contribution year below the SVG byte budget. Review
found that compact activity labels had lost the word `contributions`; commit `81a6107` restores
explicit labels and a 366-day regression. A full year now renders at 29,699 bytes, below 30 KB.

Local evidence at the saved head: root `npm run check` passed, SVG tests passed 14/14, the SVG
package dry-run pack passed, and `git diff --check` passed. Before merging, require hosted CI green,
a fresh focused review of the fix, and the three-minute post-push aging floor. The lower-severity
minimum-height layout concern remains tracked in
[#31](https://github.com/Chris0Jeky/CommitAtlas/issues/31).

### Studio/dashboard — committed and saved for later integration

- Branch: `feat/studio-dashboard`
- Studio implementation parent: `010c8d3b1ca7d82a8fddd37144ab5a7dab09fe64`
- The commit containing this state file is the final remote checkpoint for the branch.
- No pull request is open because its generated SVG URLs depend on routes that are not built yet.

The branch contains a polished responsive landing page and accessible Studio with live or clearly
labelled synthetic previews, four themes, card selection, up to six explicit project
configurations, truthful partial-data handling, real HTML actions only when their URLs exist,
freshness/provenance display, and copyable README Markdown.

The branch passed the then-current full root gate after merging `b6856d9`. It was visually inspected
at 1440x900 and 390x844; no horizontal mobile overflow was found. This is useful evidence, but it
must be rerun after the API/SVG/card-route integration. The local development server used for that
inspection was stopped during checkpoint cleanup.

At shutdown, repeated Vite hot reloads after dependency/build output logged React's "multiple
renderers concurrently rendering the same context provider" warning. It was not observed as a
production-build failure; explicitly try to reproduce it under the final production-server QA
instead of assuming it is harmless.

One known Studio polish item remains: treat the initial `your-commitatlas-host.example` base as a
placeholder in the helper message, not only `localhost`; after Preview it should bind to the actual
Studio origin. Do not invent a production domain.

## Ordered resume plan

1. Fetch `origin` and inspect PR #25, PR #29, their exact heads, hosted checks, review comments, and
   open issues. Live GitHub state outranks this checkpoint.
2. Finish PR #29's post-fix CI/review/aging gate and merge it with the exact head only if all remain
   green. Recheck the merged PR once for late review feedback.
3. Fix PR #25's rate-limit header blocker and regression tests. Merge current `main`, run the full
   gate, push, independently review the fix, wait for hosted CI and head aging, then merge exact.
4. Build versioned SVG routes for profile, streak, activity, languages, and project summaries.
   Canonicalize query parsing and cache keys; emit ETags/304s, strict SVG/CORS/security/cache
   headers; adapt JSON data through core computations into the SVG package; cover demo, live,
   invalid, partial, and conditional requests.
5. Merge current `main` into `feat/studio-dashboard`, preserving the union of API/card-route and
   rendered UI tests. Fix the placeholder-origin helper, run the full gate, then exercise Preview,
   live public data, contribution-unavailable behavior, invalid handles, add/remove/configure,
   theme/card selection, Markdown copy, actions, keyboard use, and mobile/desktop layouts in a
   production server before review and merge.
6. Add the static generator and GitHub Action for token-backed or private opt-in output. Keep tokens
   server-side, warn that generated private-derived cards must not be committed to a public repo,
   and provide an explicit output directory plus reproducible examples.
7. Finish the README, endpoint reference, configuration examples, architecture/operator/security
   docs, and one branded social image. Remove all placeholder URLs and claims.
8. Run all local and hosted gates from the final exact head. Reconcile Dependabot PRs #5 and #6,
   address or explicitly retain #28, #30, and #31, deploy through Sites, verify the public URL,
   set the GitHub repository homepage, and create the first GitHub versioned release. Package
   publication is separate and must not be claimed without registry proof.

## Product and security decisions

- The shared service is public-data-only. Private output is explicit self-hosted/static-generation
  behavior; tokens never enter URLs, fixtures, logs, cards, or tracked files.
- Project lifecycle is declared, never guessed. CI uncertainty is never rendered as green.
- README SVGs are portable summaries. Source/Docs/Install/Download/Release/CI actions belong to the
  HTML dashboard because links inside image-embedded SVGs are not reliable on GitHub.
- Project action URLs are display-only HTTPS links without credentials; CommitAtlas never fetches
  arbitrary user-provided action URLs.
- npm remains the package manager because it is native to the target workspace and host.

## Verification and cleanup boundary

Verified in this checkpoint:

- All three implementation branches have committed work; API and SVG are present on `origin`.
- PR #25's blocker and PR #29's fix evidence are recorded as durable GitHub comments.
- The Studio branch contains no uncommitted tracked changes before this state update.

Not verified in this checkpoint:

- PR #29's post-push hosted result or final fix review.
- Any hosted behavior, deployment, public contribution route with a real Worker token, static
  generator/Action, social image, release artifact, npm publication, or final cross-browser pass.
- The final integrated tree, because API, SVG, card routes, and Studio have not all landed together.

Residual tracked work: [#28](https://github.com/Chris0Jeky/CommitAtlas/issues/28),
[#30](https://github.com/Chris0Jeky/CommitAtlas/issues/30), and
[#31](https://github.com/Chris0Jeky/CommitAtlas/issues/31), plus the open API blocker above.

There is no `HUMAN_TODO.md`; `.agent-harness/tier.json` declares `human_todo: null`.
