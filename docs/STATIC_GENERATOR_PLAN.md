# CommitAtlas static generator architecture

Status: approved v0.1 implementation plan; not implemented or released.

Last reconciled: 2026-08-20. Recheck the linked GitHub platform contracts before implementing
because Action runtimes and token semantics can change.

This document preserves the architecture decision for the second real consumer of CommitAtlas's
GitHub data layer: a local CLI and repository-local GitHub Action that render the same five cards as
the hosted API without silently widening access to private data.

## Decisions

### Publish the shared GitHub boundary

Create `packages/github` as publishable `@commit-atlas/github`. Move the hardened transport,
response types, GitHub-specific validation, and snapshot-to-card adapters out of the app-only
`lib/github` boundary. The app and `@commit-atlas/static` must consume the package entry point; do
not duplicate security logic or import package source through a root alias.

The package owns:

- the GitHub host allowlist, one bounded request deadline, response-size cap, and concurrency limit;
- response-shape, URL, text, rate-limit, visibility, and public-credential validation;
- public snapshot types and the profile, streak, activity, language, and project adapters.

The package does not own app query parsing, Worker environment access, HTTP response headers/ETags,
static filesystem policy, fixtures, CLI parsing, or Action glue.

Before static generation, make two bounded shared-contract changes:

- `@commit-atlas/core`: reject duplicate normalized repository slugs and workflow identities with
  control characters or `.`/`..` path segments.
- `@commit-atlas/svg`: add an explicit unavailable-card renderer. Missing contribution access must
  never be represented as a zero streak or zero activity.

### Public and private modes

Public mode succeeds anonymously. It fetches public REST profile/project data, omits unavailable
profile contribution totals, and writes clearly labelled unavailable streak/activity cards when no
approved contribution credential exists.

If a token is supplied in public mode, reuse the shipped public-credential proof exactly:

- a non-empty `X-OAuth-Scopes` value may contain only `public_repo` entries;
- an empty-but-present scope header is accepted only for documented classic PAT/OAuth prefixes
  `ghp_` or `gho_`;
- an absent header, fine-grained PAT, Actions token, App token, user token, refresh token, or unknown
  token form fails closed.

Public mode also rejects private repository responses and any restricted-contribution signal. It
must not begin writing output before all credential, upstream, parse, and render checks pass.

Private CLI mode requires an explicit token and emits a non-sensitive warning that private-derived
cards must not be committed to a public repository. Private Action mode additionally verifies that
the current `GITHUB_REPOSITORY` is private before generation. Neither mode commits, pushes, uploads,
publishes, caches private data, or logs/serializes the token.

The policy derives from GitHub's current documentation for
[Actions `GITHUB_TOKEN`](https://docs.github.com/en/actions/concepts/security/github_token),
[workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions),
[OAuth scope headers](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps),
and the
[contribution collection](https://docs.github.com/en/graphql/reference/objects#contributionscollection).

### Configuration and manifests

Use a local, tracked JSON configuration and a local, tracked v1 project manifest. Do not fetch a
remote manifest.

```json
{
  "version": 1,
  "user": "octocat",
  "manifestPath": ".commitatlas.projects.json",
  "visibility": "public",
  "theme": "aurora",
  "days": 365,
  "asOf": "2026-08-20",
  "outputDir": "dist/commitatlas"
}
```

The static manifest keeps full `owner/repo` slugs and may intentionally span owners. The hosted
projects route remains one-owner in v0.1 because widening its public query surface has different
cache and privacy consequences.

An explicit CLI/Action output override wins over `config.outputDir`; otherwise the configured value
is required. Apply the same explicit-override rule to `asOf` and resolve the UTC date once. Config,
manifest, fixture, and output paths must be repository-contained; reject symlinks, traversal, and
untracked config/manifest inputs.

### Synthetic offline fixtures

`--fixture` installs an offline `fetch` implementation and cannot be combined with a token. Fixtures
are versioned, explicitly synthetic raw GitHub HTTP transcripts, not already-normalized snapshots.
They exercise the same parser and security boundary as live responses.

Each entry identifies method and GitHub path (plus GraphQL operation when applicable), response
status, a bounded allowlist of consumed headers, and either JSON or intentionally malformed UTF-8
body data. Reject duplicate request identities, unknown routes, non-GitHub targets, unsupported
encodings, non-synthetic provenance, and token/secret/authorization/cookie/password-like keys.

The allowed response headers are limited to those the transport consumes, currently
`content-type`, `content-length`, `retry-after`, `x-ratelimit-reset`, and `x-oauth-scopes`.

### Exact-five-file output

A successful generation writes only:

```text
profile.svg
streak.svg
activity.svg
languages.svg
projects.svg
```

Fetch, validation, normalization, rendering, output-size checks, and path checks all complete before
the output directory is changed. Stage all five payloads and atomically replace each destination;
preserve unrelated sibling files. Promise atomic replacement per file, not an unsupported
cross-file filesystem transaction. Any pre-write failure preserves the prior five cards.

A real, complete all-zero contribution calendar renders zero. Missing, partial, gapped, restricted,
or unapproved contribution data is unavailable or an error according to the mode; it is never
zero-filled.

## CLI and Action contracts

```text
commitatlas generate \
  --config .commitatlas.json \
  [--output-dir dist/commitatlas] \
  [--as-of YYYY-MM-DD] \
  [--fixture path/to/public-fixture.json]
```

There is no token argument or token-shaped config key. Live credentials are read only from the
process environment/Action input and retained in memory.

The repository-local Action uses a deterministically generated CommonJS bundle:

```yaml
runs:
  using: node24
  main: dist/index.cjs
```

Inputs are config, optional output directory, explicit matching visibility, optional `as-of`, and
optional `github-token` (required for private mode). Outputs are exactly the five repository-relative
card paths. The public example omits `github-token`; the Action never commits, pushes, uploads, or
publishes. Recheck GitHub's
[JavaScript Action metadata reference](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax#runs-for-javascript-actions)
before bundling.

## Workspace and commit sequence

Adopt npm workspaces for `packages/core`, `packages/svg`, `packages/github`, and `packages/static`.
Use normal publishable semver dependencies and explicitly build in that order. Do not ship `file:`,
deep-source, or root-alias dependencies.

Implement as these reviewable commits after the SVG routes and Studio are merged:

1. `fix(core): harden manifest uniqueness and workflow identity`
2. `refactor(github): publish hardened adapter package`
3. `feat(svg): render unavailable card state`
4. `feat(static): validate tracked config paths and raw fixtures`
5. `feat(static): generate five cards from shared adapters`
6. `feat(action): bundle Node 24 static generator action`
7. `test(pack): prove package consumers and Action bundle parity`
8. `docs(static): document verified CLI Action and privacy behavior`

## Required proof

- Existing GitHub transport regressions remain green after extraction.
- Public/private/token-type matrix, private repositories, and restricted contributions.
- Missing contributions versus a genuinely complete zero calendar.
- Deterministic offline output and strict fixture consumption.
- Exact five files, unrelated siblings preserved, and no writes on any pre-write failure.
- Token sentinel absent from outputs, captured logs/errors, fixtures, and the Action bundle.
- Path containment, symlink, tracking, malformed, oversized, and rate-limit cases.
- Dry-run packs for all four packages and a clean tarball consumer that invokes the CLI.
- Checked-in Action bundle exactly matches a clean regeneration.

Publication remains a separate release decision. Do not claim npm availability without a successful
registry publication and lookup.
