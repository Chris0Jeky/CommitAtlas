# `@commit-atlas/static`

Generate a compact CommitAtlas dashboard and its individual SVG widgets from one bounded GitHub
snapshot. The CLI reads a tracked `.commitatlas.json` and writes selected cards plus a hash
manifest. The eleven selectable cards are `atlas`, `profile`, `streak`, `breakdown`, `rhythm`,
`activity`, `languages`, `projects`, `cadence`, `releases`, and the opt-in `delivery` evidence card.

```powershell
commitatlas generate --config .commitatlas.json
commitatlas generate --config .commitatlas.json --dry-run
commitatlas generate --config .commitatlas.json --output-dir assets/commitatlas --as-of 2026-08-21
```

The original ten cards remain credential-free. They use GitHub's logged-out public profile view and
public REST endpoints; the activity mix comes from calendar-year profile views and is labelled as
public-profile percentages that are not window-scoped unless an explicitly exact source is
available. A malformed, incomplete, or unavailable upstream response fails generation before output
is staged.

`delivery` is deliberately opt-in because it needs GitHub's authenticated GraphQL search counts.
When selected, supply a short-lived token through the Action's `github-token` input or the
`GITHUB_TOKEN` environment variable. CommitAtlas first proves that every configured project is a
public repository owned by the configured user, then issues one aggregate-only GraphQL request whose
every search query explicitly names that configured repository set. It requests no pull-request
titles, bodies, comments, branches, commits, diffs, reviewer identities, or private repository
metadata, and it never writes the token or raw response to an artifact.

```yaml
- uses: Chris0Jeky/CommitAtlas@<full-commit-sha>
  with:
    github-token: ${{ github.token }}
```

The tracked v1 config selects any subset of the eleven cards for one public owner and up to six
curated projects. `manifest.json` records the exact contribution window, provenance, byte size, and
SHA-256 hash of every generated artifact.

The Atlas and Activity calendars display at most the latest 365 UTC dates through the last
observed date. A shorter history is displayed as observed. The `days` setting continues to control
the fetched history: `"auto"` can retain up to 731 days, and explicit windows can reach 730 days.
Current and longest streaks, history summaries, contribution breakdowns and the manifest keep that
full history. Activity totals and the Atlas calendar's local summaries describe the displayed
calendar, whose date range is labelled separately. Missing or future dates are never added to
make a stale snapshot appear current.

Set `"motion": "none"` for a static, keyframe-free output or `"motion": "subtle"` for short load
motion with an SVG `prefers-reduced-motion` override. Rhythm remains a personal consistency score,
not a GitHub rank, and Breakdown keeps its exact-count versus public-percentage basis visible.

Set `"responsiveAtlas": true` to render a companion layout from the same fetched snapshot. A wide
primary Atlas adds `atlas-compact.svg`; a compact primary adds `atlas-wide.svg`. Both variants share
the exact metrics, window, and generation time and are hashed in the same manifest, making them safe
to use in a responsive HTML `<picture>` without desktop/mobile data drift.

Set `"reducedMotion": true` to also emit still companions for the selected Atlas and Activity
cards. This defaults to `false`, so existing configurations keep their artifact inventory. The
additional files are `atlas-still.svg`, `activity-still.svg`, and, when `responsiveAtlas` is
enabled, `atlas-compact-still.svg` or `atlas-wide-still.svg`. Each companion uses `motion: "none"`
with the same snapshot, calendar, theme and geometry as its ordinary counterpart; all files are
included in that directory's hash manifest. Theme variants receive their own matching companions.

Select those still files explicitly for a reader's reduced-motion preference:

```html
<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="assets/commitatlas/atlas-still.svg">
  <img src="assets/commitatlas/atlas.svg" alt="GitHub contribution history and project signals">
</picture>
```

When combining theme and layout choices, place their reduced-motion `<source>` entries before
the animated choices. Turning the option off removes unchanged, previously managed companions;
unowned files and files changed since the prior manifest retain the existing publication protections.
This option covers Atlas and Activity cards. Scene outputs keep their separate motion contract.

To render a dark/light pair without fetching GitHub twice, add bounded `themes` entries to the v1
config. Each entry names an opposite-scheme card theme and an explicit contained output directory:

```json
{
  "theme": "ember",
  "outputDir": "assets/commitatlas",
  "themes": [{ "theme": "paper", "outputDir": "assets/commitatlas/light" }]
}
```

Theme names and output directories must be unique, and up to three variants are allowed. The primary
result and its v1 `manifest.json` stay at `outputDir`; each variant gets its own v1 manifest and
ownership-aware cleanup boundary. All variants are rendered and validated from the one fetched
snapshot before any output directory is written. The CLI `--output-dir` override applies to the
primary output; variant paths remain the explicit paths from `themes`.

When `projects` is selected, the same snapshot also produces `projects.json` and `projects.md`.
The JSON is a bounded machine-readable catalog; the Markdown is a human-readable catalog with
observed and configured action links.

When `delivery` is selected, each theme produces `delivery.svg` and the same deterministic
`delivery.json`. The JSON carries the exact configured-public-repository scope, lifetime and
7/30/90/365-day pull-request counts, formulas, null states, benchmark source/date/population,
comparability caveats, generation time, and limitations. The SVG's focal reading is latest-seven-day
merged pull requests per week, supported by resolved merge conversion, 30-day integration balance,
current open work, and top-two repository concentration. It permanently labels the result
`activity flow · not quality or impact`; it does not claim a productivity score, global percentile,
equivalent headcount, code quality, effort, or delivered user value.

`projects.json`, `projects.md`, and `delivery.json` are reserved CommitAtlas-managed names inside
`outputDir`: a run that selects the corresponding card overwrites whatever sits at those paths, so
do not keep hand-written files there. Reserving the names does not license deleting them.
Stale-artifact cleanup requires the previous v1 `manifest.json` in that directory to identify
CommitAtlas as the writer and record a valid byte size and SHA-256 for the artifact. The current
path must be a regular file with one link, and its actual size and digest must match that entry.
Every theme passes this preflight before any stale deletion or selected-output replacement. Changed
contents, directories, symlinks, hard links, or other special entries stop publication and preserve
the previous visible payloads and manifests. A stale file already missing from disk is harmless.

Legacy name-only records and entries with missing or invalid integrity metadata do not authorize
deletion. Their files stay in place for manual review and cleanup; a new manifest records only the
newly selected outputs. Missing, foreign, or unreadable manifests and duplicate artifact paths
disable cleanup entirely. Regenerating a selected artifact still uses the existing overwrite
contract and records its new size and digest; this cleanup policy does not protect edits to an
artifact that remains selected. The v1 writer still uses a path-based rename/unlink sequence, so
changes after preflight can race publication. It does not provide concurrent-writer isolation or
crash-atomic publication, and it does not activate the test-only v2 store.

Untrusted upstream text — release tags, workflow names, and benchmark presentation text — is escaped
for its target format. Project Markdown uses delimiter-safe CommonMark code spans: backslash escapes
are inert inside a code span, so the fence is grown past the longest backtick run in the content and
padded when the content starts or ends with a backtick. `projects.md` deliberately emits no Markdown
table: a `|` is structural only inside a table row, and prose is escaped before it is written, so no
upstream value can open a cell or a row.

A rendered link is not an outbound data fetch. CommitAtlas still fetches only from GitHub-owned
hosts and never requests any catalogued URL. The two link sources have different boundaries:

- **Configured** `links` (`docs`, `install`, `download`) stay **restricted**. `ProjectLinkSchema` in
  `@commit-atlas/core` accepts HTTPS on the fixed `ALLOWED_LINK_HOSTS` allowlist only, so a link on
  a project's own domain is rejected at config-parse time, not merely labelled. Widen that allowlist
  if a host belongs there; do not expect the catalog to carry an arbitrary configured host.
- **Observed** repository homepages come from `repo.homepage` and may point **anywhere** an HTTPS URL
  can. Constraining them would break real project websites, so that boundary is disclosure rather
  than restriction.

Either way the destination is made visible: every action in `projects.json` carries its `host` and
an `external` flag, and `projects.md` appends `external host <hostname>` to any destination outside
GitHub's own hosts — including allowlisted-but-not-GitHub ones such as `www.npmjs.com`.

The test is the **hostname**, not who authored what it serves. The unlabelled set is a fixed list of
hostnames GitHub operates and a repository owner cannot choose; `<anything>.github.io` is labelled
because that hostname *is* owner-chosen. So an unlabelled destination is not a safety claim about
what is behind it: `github.com/<owner>/<repo>`, a gist, and a release asset on
`objects.githubusercontent.com` are all owner-supplied and all go unlabelled, because a repository
catalog is expected to link to the owner's own repository. The label reports only the thing a reader
would not otherwise assume — that a destination is not on GitHub at all.

With all eleven cards and `responsiveAtlas: true`, one output directory contains 15 payload
artifacts (eleven SVGs, one Atlas companion, two project catalogs, and one delivery evidence JSON)
plus `manifest.json`, for 16 files total. A narrower card selection produces a correspondingly
smaller manifest.

Config and output paths must remain inside the repository and may not traverse symlinks. Every input,
metric, render, and output size is validated before staged per-file replacement; unrelated siblings
remain untouched. Cleanup of disabled cards, scenes, and prior responsive layouts follows the
manifest and content checks above. The caller owns commits and deployment. The package has no
private-data mode, hidden token fallback, fixture publication mode, or publication side effect.

### Test-only v2 control-store lock lifecycle

`src/publication-control-store.ts` is an internal storage prototype imported only by tests. The
public package entry point, v1 writer, CLI and Action do not activate it.

`acquireLock()` can fail after creating a lock, including when its quarantine scan fails or finds
retained recovery evidence. Once the store has proved the created file's identity, `releaseLock()`
on that same instance can release it even though acquisition failed. Publication mutations remain
blocked until acquisition succeeds. A failure before file identity is known cannot be cleaned up
through `releaseLock()` and requires explicit recovery. Foreign locks and quarantine files are
never reclaimed automatically.

A failed release retains its ownership state until the control directory flush succeeds. Retrying
checks both the original lock path and its remembered quarantine: a replacement must still pass
ownership checks, while two absent paths allow completion after an unlink that persisted before
reporting an error. Windows `EACCES`, `EPERM` and `EBUSY` failures have the same bounded retry window
as status replacement (`sharingRetryMs`, 100 ms by default; zero disables retries). Each retry
rechecks containment and ownership. Other errors and exhausted retries remain visible to the caller.

### Shared delivery presentation

The static `delivery.svg` delegates to `@commit-atlas/svg`'s `renderDeliveryCard`; there is no
second presentation implementation. Its wide and compact defaults are 860×400 and 480×580,
with all four windows, lifetime counts, bounded accessible provenance, and the shared
motion/frame-zero policy. The direct static rendering API retains its `aurora` default theme;
configured generation passes its chosen theme explicitly. Paired artifacts are checked against
the shared renderer byte-for-byte. This presentation consolidation does not change
`delivery.json` or introduce any new data fetch.

### Delivery benchmark availability

Ordinary generation does not enable an external benchmark. `delivery.json` carries
`benchmark: null` and `derived.benchmarkMultiple7: null`; the shared SVG renderer prints
`BENCHMARK UNAVAILABLE` while retaining the observed flow metrics. Explicit programmatic
references require caller-verified provenance. No source URL is fetched; see #245 before
introducing a built-in numeric reference.

## Optional synthetic Lens projection

The source registry contains seven scenes: `evidence-coverage`, `activity-terrain`, `chronograph`,
`lifecycle-map`, `identity-beacon`, `nebula`, and `signature`. All require `scenePack: "survey"`.
The first four accept `none | subtle | ambient`; Identity Beacon accepts `none | ambient | cinematic`
and requires `identity`; Nebula and Signature accept `none | ambient`.

Add `"lens": { "path": ".commitatlas/lens-profile.v1.json", "maxAgeDays": 45 }` to a v1 config
to validate a Developer Lens `PublicLensProjection.v1` export before any output write. The path
must be a contained Git-tracked regular file, with no symlink component, at most 256 KiB. URLs and
hosted projection bodies are not supported. `maxAgeDays` is optional (45 by default), integer
1..3650. The reader preserves the producer's exact `scorePercent` and `displayText` fields,
non-null optional delivery block, privacy rules and canonical content hash; it accepts no aliases.

The current publishing adapter permits C0 synthetic projections only. C1 local exports are rejected
with `LENS_C1_PUBLICATION_DISABLED` under the operative Q-9 No policy recorded in #170.
No personal projection belongs in CommitAtlas fixtures. Select `"scenes": ["signature"]` with
`"scenePack": "survey"` and `"motion": "none"` or `"ambient"` to render the first registered
Signature scene from the complete validated projection. It prints six exact readings, the supplied
archetype and top-two dimensions, plus all derived coverage, warnings, privacy and freshness.
With the default age limit, through day 45 is fresh, beyond 45 through 90 is stale with a visible
strip and accessible age, and beyond 90 is unavailable before model building. Historical output
stays still. Missing Lens input also produces an explicit unavailable Signature; existing configs
without a selected Signature keep their output behavior.
All projection/file failures expose bounded `LENS_*` codes; never log the body or Zod diagnostics.

Each selected theme receives `scene-signature.svg` with actual bytes and SHA-256 in its manifest.
The shared static/Action source implements that delivery and the Gallery shows derived evidence
with a separate stale state. Signature has no hosted endpoint or selectable Studio scene.
Executed-bundle tests verify fresh ambient, stale, expired and dry-run outputs in both themes,
including actual file bytes and SHA-256 manifests. The
[visual references](../../docs/evidence/appearance-2026-10-26/README.md) state the direct-browser scope. See
[SIGNATURE_SCENE.md](../../docs/SIGNATURE_SCENE.md) for layout, motion and capture details.

The pinned producer contract and fixture receipt are documented in
[`research-contracts/lens-projection/v1/README.md`](../../research-contracts/lens-projection/v1/README.md).
