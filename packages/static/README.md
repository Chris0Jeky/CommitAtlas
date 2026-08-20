# `@commit-atlas/static`

Generate a compact CommitAtlas dashboard and its individual SVG widgets from one public GitHub
snapshot. The CLI reads a tracked `.commitatlas.json`, fetches only logged-out public profile data,
and writes selected cards plus a hash manifest. The eight selectable cards are `atlas`, `profile`,
`streak`, `breakdown`, `rhythm`, `activity`, `languages`, and `projects`.

```powershell
commitatlas generate --config .commitatlas.json
commitatlas generate --config .commitatlas.json --dry-run
commitatlas generate --config .commitatlas.json --output-dir assets/commitatlas --as-of 2026-08-21
```

The generator sends no GitHub credential. GitHub's public profile view is the contribution source;
its activity mix comes from calendar-year profile views and is labelled as public-profile percentages
that are not window-scoped unless an explicitly exact source is available. A malformed, incomplete,
or unavailable upstream response fails generation before output is staged. The tracked v1 config selects any subset of the eight cards for one public owner and up to
six curated projects. `manifest.json` records the exact window, provenance, byte size, and SHA-256
hash of every generated artifact.

Set `"motion": "none"` for a static, keyframe-free output or `"motion": "subtle"` for short load
motion with an SVG `prefers-reduced-motion` override. Rhythm remains a personal consistency score,
not a GitHub rank, and Breakdown keeps its exact-count versus public-percentage basis visible.

Set `"responsiveAtlas": true` to render a companion layout from the same fetched snapshot. A wide
primary Atlas adds `atlas-compact.svg`; a compact primary adds `atlas-wide.svg`. Both variants share
the exact metrics, window, and generation time and are hashed in the same manifest, making them safe
to use in a responsive HTML `<picture>` without desktop/mobile data drift.

When `projects` is selected, the same snapshot also produces `projects.json` and `projects.md`.
The JSON is a bounded machine-readable catalog; the Markdown is a human-readable catalog with
observed and configured action links. With all eight cards and `responsiveAtlas: true`, the output
contains 11 payload artifacts (eight SVGs, one Atlas companion, and two project catalogs) plus
`manifest.json`, for 12 files total. A narrower card selection produces a correspondingly smaller
manifest.

Config and output paths must remain inside the repository and may not traverse symlinks. Every input,
metric, render, and output size is validated before staged per-file replacement; unrelated siblings
remain untouched. After successful replacement, known CommitAtlas filenames that are no longer in
the manifest are removed so a disabled card or prior responsive layout cannot remain stale. The
caller owns commits and deployment. The package has no private mode, fixture
mode, token argument, or publication side effect.
