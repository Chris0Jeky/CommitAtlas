# `@commit-atlas/static`

Generate a compact CommitAtlas dashboard and its individual SVG widgets from one public GitHub
snapshot. The CLI reads a tracked `.commitatlas.json`, fetches only logged-out public profile data,
and writes selected cards plus a hash manifest.

```powershell
commitatlas generate --config .commitatlas.json
commitatlas generate --config .commitatlas.json --dry-run
commitatlas generate --config .commitatlas.json --output-dir assets/commitatlas --as-of 2026-08-20
```

The generator sends no GitHub credential. GitHub's public profile view is the contribution source;
its activity mix is labelled as percentages rather than exact counts. A malformed, incomplete, or
unavailable upstream response fails generation before output is staged. The tracked v1 config selects
any subset of Atlas, profile, streak, activity, languages, and project cards for one public owner and
up to six curated projects. `manifest.json` records the exact window, provenance, byte size, and
SHA-256 hash of every generated card.

Set `"responsiveAtlas": true` to render a companion layout from the same fetched snapshot. A wide
primary Atlas adds `atlas-compact.svg`; a compact primary adds `atlas-wide.svg`. Both variants share
the exact metrics, window, and generation time and are hashed in the same manifest, making them safe
to use in a responsive HTML `<picture>` without desktop/mobile data drift.

Config and output paths must remain inside the repository and may not traverse symlinks. Every input,
metric, render, and output size is validated before staged per-file replacement; unrelated siblings
remain untouched. The caller owns commits and deployment. The package has no private mode, fixture
mode, token argument, or publication side effect.
