# CommitAtlas v0.1 implementation plan

Status: active saved plan, not a completion claim. API step 1 is merged; SVG step 2 and the route
foundation for step 3 are saved on the exact branches in [PROJECT_STATE.md](./PROJECT_STATE.md).
Start every resume by fetching `origin` and inspecting live PR checks and unresolved review threads.

## v0.1 definition of done

CommitAtlas v0.1 is complete only when all of the following are true:

- The bounded JSON API and all five SVG endpoints are merged on `main` with exact-head CI and review.
- Profile, streak, activity, languages, and project-board cards work in demo and supported live modes.
- The Studio uses the shipped endpoints, handles partial/unavailable data truthfully, and passes
  desktop, mobile, keyboard, accessibility, action-link, copy, error, and cache behavior checks.
- The static generator and bundled local GitHub Action create the same five files without exposing
  credentials or publishing anything automatically.
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

### 2. Replace SVG hardening safely — active and blocked

Do not reopen or merge PR #29 or #35. PR #39 on `fix/svg-release-hardening-v3` carries the reviewed
replacement at `78a444a7f52ca1779cf738699fec97006be4690d`, but it must not merge yet. Merge the
current `origin/main` base, move the chronological activity summary into the outer SVG accessible
description, remove the ineffective nested group, add a root-description regression, and re-prove
the resulting head locally and in hosted CI before resolving the open review thread.

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

Close #20, #21, #31, #36, and #37 only after direct tests prove their acceptance. Run root
`npm run check`, the focused SVG suite, byte-level adversarial cases, `git diff --check`, and package
dry-run/clean-consumer import before exact-head CI and fresh review.

### 3. Add the five versioned SVG routes — foundation saved

The remote branch `feat/svg-card-routes` is saved at
`1179d301aa0a8a43ea02e9161b396b265d877d63`. Its two foundation commits provide strict canonical
query parsing and the secure SVG response/ETag/header helper; 20 focused tests and the full root gate
passed. It intentionally has no route handlers yet. Update it from `main` after PR #39 lands, then
continue with the surfaces below.

Create these exact public surfaces:

- `/api/v1/cards/profile.svg?user=&demo=&theme=`
- `/api/v1/cards/streak.svg?user=&demo=&theme=`
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

Every successful SVG response must include:

- `Content-Type: image/svg+xml; charset=utf-8`
- CORS suitable for public image embeds, `X-Content-Type-Options: nosniff`, cross-origin resource
  policy, no-referrer, and a strict no-script/no-object/no-frame SVG content security policy
- Stable ETag and identical security/cache headers on 304
- Public caching appropriate to volatility (profile/languages about 15 minutes, contributions about
  one hour, projects about five minutes); token/private paths are `no-store`

Invalid or unavailable requests return bounded JSON errors with `no-store`, never an error SVG that
looks like healthy data. Cover demo and live-shaped fixtures for all five routes, invalid/duplicate
queries, leap dates, empty languages, partial projects, 304 behavior, and credential rejection.

### 4. Integrate and prove the Studio

Merge current `main` into `feat/studio-dashboard`; preserve the union of package, API, route, and
rendered product tests. Update `projectUrl` to send each configured workflow. Bind all generated card
URLs to the real route contract and keep placeholder origins visibly marked until a preview succeeds.

Run a production server, not only Vite development mode, and verify:

- landing and Studio at 1440x900 and 390x844 with no overflow or clipped controls;
- demo Preview, live public profile/projects, and contribution-unavailable behavior without a safe
  token;
- invalid handles, invalid repositories, partial upstream data, and rate limits;
- add, remove, configure lifecycle/workflow/action links, theme and card selection;
- Markdown copy and every produced image URL; Docs/Install/Download/Source/Release/CI actions only
  when their HTTPS URLs exist;
- tab order, visible focus, keyboard-only operation, landmarks, labels, contrast, reduced motion,
  and screen-reader-relevant SVG summaries;
- ETag/304 and cache headers; direct `/og.png`; console and network errors; and an explicit attempt to
  reproduce the prior React multiple-renderer warning.

After a clean full gate and visual/accessibility review, open one ready PR and merge only at an
exact green reviewed head.

### 5. Build the static generator package

Add `packages/static` as `@commit-atlas/static`:

```text
packages/static/
  src/config.ts
  src/manifest.ts
  src/github.ts
  src/normalize.ts
  src/generate.ts
  src/cli.ts
  src/action.ts
  tests/static.test.mjs
  README.md
  LICENSE
  package.json
```

CLI contract:

```text
commitatlas generate \
  --config .commitatlas.json \
  --output-dir dist/commitatlas \
  [--as-of YYYY-MM-DD] \
  [--fixture path/to/public-fixture.json]
```

There is no token CLI argument. Read only `GITHUB_TOKEN`; reject configuration keys that resemble
tokens, secrets, or credentials. Version 1 config contains a valid user, tracked manifest path,
`public` or explicit `private` visibility, one shipped theme, 7–365 days, optional UTC `asOf`, and a
repository-relative output directory. Resolve `asOf` exactly once per run.

The manifest uses core's versioned parser, contains at most six projects, and remains tracked in Git.
Public mode rejects private repository responses. Private mode requires a token and emits a prominent
warning that private-derived cards must not be committed to a public repository.

Always atomically write exactly these files without deleting unrelated output:

```text
profile.svg
streak.svg
activity.svg
languages.svg
projects.svg
```

Fixture mode must be offline, synthetic-safe, and byte-deterministic for identical config, theme,
fixture, and `asOf`. Live output is truthfully non-reproducible as GitHub state changes. Reuse the
hardened GitHub transport boundaries: GitHub-only hosts, one deadline, 1.5 MB cap, bounded parsing,
safe response validation, concurrency limit, and no private-response projection.

Tests cover valid/invalid config and manifests, tracked-file enforcement, public/private boundaries,
token-sentinel absence from every output/log/error/fixture, exact five-file output, deterministic
fixtures, malformed/oversized/rate-limited API fixtures, atomic/path behavior, renderer constraints,
package dry-run contents, and an ordinary clean Node/CLI consumer.

### 6. Add the repository-local GitHub Action

Add `.github/actions/static-generator/action.yml` plus a deterministically bundled entry generated
from `packages/static/src/action.ts`. Use `runs.using: node24`: the current
[GitHub Action metadata reference](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax#runs-for-javascript-actions)
supports Node 24, and GitHub's
[Node 20 deprecation notice](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)
directs Action maintainers to migrate to it. Recheck those primary sources at implementation time
if the runner contract changes again.

Inputs: config, output directory, visibility, optional `as-of`, and `github-token`. The token is passed
only through the environment. The Action validates tracked config/manifest, never echoes or serializes
the token, never commits/pushes/uploads/publishes, and exposes only non-sensitive output paths. Its
example workflow uses read-only `contents` and `actions` permissions.

Bundle verification must prove the checked-in entry matches source and contains no token-like fixture
or source secret. Pin release examples to immutable `v0.1.0`; a moving major tag is a separate release
decision.

### 7. Documentation, deployment, and release

Update README and package docs only with behavior that exists at the final head:

- real deployed quick-start URLs and all five card examples;
- Studio workflow, API query/error/cache reference, manifest/config schemas, CLI and Action examples;
- public/private threat boundary, credential handling, rate limits, self-hosting, accessibility, and
  troubleshooting;
- architecture diagrams/text that match actual data flow; no guessed remote manifest fetches;
- the original `public/og.png` social image wired through metadata using the real Sites origin.

Then:

1. Reconcile Dependabot PRs #5 and #6 against current `main` without weakening checks.
2. Decide #28, #30, #31–#34, #36, and #37 from actual release impact; close only proven work and name
   every retained item in release notes.
3. Run the final local full gate from a clean exact head and obtain hosted CI plus independent review.
4. Build successfully, create/configure one Sites project, commit its real project identifier, save a
   version, deploy with the required visibility approval, and poll to terminal success.
5. Open the exact deployment URL, repeat production browser checks, verify `/og.png` and metadata,
   then set the GitHub repository homepage to that URL.
6. Create GitHub release `v0.1.0` from the verified commit, preserving the incremental commit history.
   Attach package tarballs only if their contents were freshly proved. Do not claim npm publication
   without a successful registry lookup.

## Clean resume command set

```powershell
git fetch --all --prune
git status --short --branch
git worktree list --porcelain
gh pr view 25 --repo Chris0Jeky/CommitAtlas --json headRefOid,state,statusCheckRollup,mergeStateStatus,url
gh issue list --repo Chris0Jeky/CommitAtlas --state open --limit 100
npm.cmd ci
npm.cmd run check
```

Use a fresh detached-from-`origin/main` worktree and create a branch before any isolated API/SVG
writer commits. Preserve one writer per checkout, use small present-tense commits, and tear down
auxiliary worktrees after their clean pushed heads are recorded.
