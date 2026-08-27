# Static generator and Action contract

Status: implemented release-candidate architecture.

Last reconciled: 2026-08-21. Recheck GitHub Action runtime and token contracts before a future
release because platform behavior can change.

## Shipped design

```text
tracked .commitatlas.json
          │
          ▼
@commit-atlas/static ──> @commit-atlas/github ──> logged-out GitHub profile + public REST
          │                         │
          └──────── one validated PortfolioSnapshot
                                    │
                                    ▼
                             @commit-atlas/svg
                                    │
 atlas.svg · profile.svg · streak.svg · breakdown.svg · rhythm.svg · activity.svg · languages.svg · projects.svg
 atlas-compact.svg / atlas-wide.svg · projects.json · projects.md
                                    │
                              manifest.json
```

`@commit-atlas/github` owns bounded GitHub transport, response validation, public snapshot types,
and snapshot adapters. `@commit-atlas/static` owns tracked configuration, repository-contained path
policy, snapshot orchestration, rendering, manifest hashes, and filesystem writes. The root Action
is a small bundled Node 24 caller of the static package.

The generator and Action are credential-free and public-only. They do not accept a token input,
read `GITHUB_TOKEN`, commit, push, upload, deploy, or publish. A consumer workflow may separately use
its built-in token to commit already-generated public assets.

## Configuration

`.commitatlas.example.json` is the runnable v1 shape:

```json
{
  "version": 1,
  "user": "Chris0Jeky",
  "theme": "ember",
  "days": 365,
  "motion": "subtle",
  "layout": "wide",
  "responsiveAtlas": true,
  "outputDir": "assets/commitatlas",
  "cards": ["atlas", "profile", "streak", "activity", "breakdown", "rhythm", "languages", "projects"],
  "projects": [
    {
      "repo": "Chris0Jeky/CommitAtlas",
      "label": "CommitAtlas",
      "lifecycle": "active",
      "workflow": "ci.yml",
      "links": {
        "docs": "https://github.com/Chris0Jeky/CommitAtlas#readme"
      }
    }
  ]
}
```

V1 deliberately limits a config to one GitHub owner and one to six explicitly curated projects.
The config must be a tracked regular JSON file below 64 KiB. Unknown fields, token-shaped additions,
duplicate cards/projects, invalid GitHub handles, control characters, `.`/`..` workflow identities,
absolute or traversing paths, and symlinked path components fail closed.

Lifecycle is owner-declared. CI is read only from the named workflow; a missing or unconfigured
workflow is never reported as passing. Project links are validated data for adjacent HTML actions,
not independent links embedded inside the SVG.

## CLI

```text
commitatlas generate
  [--config .commitatlas.json]
  [--output-dir assets/commitatlas]
  [--as-of YYYY-MM-DD]
  [--dry-run]
```

There is no token, visibility, private-mode, or fixture argument. `--output-dir` and `--as-of`
explicitly override config/current-date values. `--dry-run` performs fetch, validation, metrics, and
rendering without filesystem writes.

Contribution history comes from GitHub's logged-out public profile view. That view may contain
anonymous aggregates the account owner elected to display, but it exposes no private repository
details to CommitAtlas. Activity type data from calendar-year profile views is carried as
public-profile percentages and labelled as not window-scoped unless an exact categorized source is
present; a percentage is never rendered as an exact count. Rhythm is a
within-window personal consistency summary, not a GitHub rank. `motion: "none"` produces no
animation keyframes; `motion: "subtle"` produces short load motion with a reduced-motion override.
A malformed, incomplete, gapped, oversized, or unavailable response fails generation.

## Output semantics

The selected subset of these files is written:

```text
atlas.svg
atlas-compact.svg  # optional companion when a wide config enables responsiveAtlas
atlas-wide.svg     # optional companion when a compact config enables responsiveAtlas
profile.svg
streak.svg
activity.svg
breakdown.svg
rhythm.svg
languages.svg
projects.svg
projects.json      # emitted when projects is selected
projects.md        # emitted when projects is selected
```

`manifest.json` records the generator, user, source, exact date window, generation time, byte count,
and SHA-256 hash for every generated artifact. All upstream data, metrics, SVG/text contents, paths, and size
limits are validated before writing begins. Payloads are staged in the output directory and replaced
per file; unrelated sibling files are preserved. This is per-file atomic replacement, not a claim of
a cross-file filesystem transaction. After successful replacement, known CommitAtlas artifact names
that are absent from the new manifest are removed to prevent stale responsive or deselected cards.

All ten renderers consume one `PortfolioSnapshot`, so every card, project catalog, and the manifest
share one window and provenance. `responsiveAtlas` renders the alternate wide/compact layout from
that same snapshot and records it as `atlas-compact.svg` or `atlas-wide.svg`; no second GitHub fetch
can make the pair drift. With all ten cards, responsive Atlas, and Projects selected, there are
13 payload artifacts plus `manifest.json` (14 output files total). SVG and text validation rejects
scripts, external images, `foreignObject` content, and forbidden control characters.

## Action

The repository-root [`action.yml`](../action.yml) exposes `config`, `output-dir`, `as-of`, and
`dry-run`, plus paths for the manifest, ten card types, `projects.json`, `projects.md`, and optional
Atlas companion outputs. It runs the checked-in
`action/dist/index.js` bundle using `node24`.

The bundle must be regenerated by `npm run build:action`. `npm run test:action` checks metadata,
credential absence, runtime behavior, and byte parity with source. Consumers should pin an immutable
commit until a signed release/tag policy exists.

## Proving commands

```powershell
npm.cmd run test:github
npm.cmd run test:static
npm.cmd run test:action
npm.cmd run pack:github
npm.cmd run pack:static
npm.cmd run check
```

The package tarballs contain compiled JavaScript, TypeScript declarations, README, package metadata,
and the canonical GPL-3.0-only licence. npm registry publication remains a separate, unclaimed step.

## Deliberately deferred

- private-data generation;
- multi-owner project configs;
- offline raw-HTTP fixture transport;
- a cross-file transactional store;
- npm publication and a stable moving Action tag.

Those are future product decisions, not behavior implied by v1.
