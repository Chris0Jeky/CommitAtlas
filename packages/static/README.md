# `@commit-atlas/static`

Generate a compact CommitAtlas dashboard and its individual SVG widgets from one public GitHub
snapshot. The CLI reads a tracked `.commitatlas.json`, fetches only logged-out public profile data,
and writes selected cards plus a hash manifest. The ten selectable cards are `atlas`, `profile`,
`streak`, `breakdown`, `rhythm`, `activity`, `languages`, `projects`, `cadence`, and `releases`.

```powershell
commitatlas generate --config .commitatlas.json
commitatlas generate --config .commitatlas.json --dry-run
commitatlas generate --config .commitatlas.json --output-dir assets/commitatlas --as-of 2026-08-21
```

The generator sends no GitHub credential. GitHub's public profile view is the contribution source;
its activity mix comes from calendar-year profile views and is labelled as public-profile percentages
that are not window-scoped unless an explicitly exact source is available. A malformed, incomplete,
or unavailable upstream response fails generation before output is staged. The tracked v1 config selects any subset of the ten cards for one public owner and up to
six curated projects. `manifest.json` records the exact window, provenance, byte size, and SHA-256
hash of every generated artifact.

Set `"motion": "none"` for a static, keyframe-free output or `"motion": "subtle"` for short load
motion with an SVG `prefers-reduced-motion` override. Rhythm remains a personal consistency score,
not a GitHub rank, and Breakdown keeps its exact-count versus public-percentage basis visible.

Set `"responsiveAtlas": true` to render a companion layout from the same fetched snapshot. A wide
primary Atlas adds `atlas-compact.svg`; a compact primary adds `atlas-wide.svg`. Both variants share
the exact metrics, window, and generation time and are hashed in the same manifest, making them safe
to use in a responsive HTML `<picture>` without desktop/mobile data drift.

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

`projects.json` and `projects.md` are reserved CommitAtlas-managed names inside `outputDir`: a run
that selects `projects` overwrites whatever sits at those paths, so do not keep hand-written files
there. Reserving the names does not license deleting them. Stale-artifact cleanup removes a known
CommitAtlas filename only when the previous `manifest.json` in the same directory recorded
CommitAtlas as its writer, so a `projects.json` that predates your first run — or any file left by a
generator whose manifest CommitAtlas cannot read — is never removed. A missing, foreign, or
malformed `manifest.json` disables cleanup entirely rather than guessing.

Untrusted upstream text — release tags and workflow names — is rendered as a delimiter-safe
CommonMark code span. Backslash escapes are inert inside a code span, so the fence is instead grown
past the longest backtick run in the content and padded when the content starts or ends with a
backtick. `projects.md` deliberately emits no Markdown table: a `|` is structural only inside a table
row, and prose is escaped before it is written, so no upstream value can open a cell or a row.

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

With all ten cards and `responsiveAtlas: true`, the output
contains 13 payload artifacts (ten SVGs, one Atlas companion, and two project catalogs) plus
`manifest.json`, for 14 files total. A narrower card selection produces a correspondingly smaller
manifest.

Config and output paths must remain inside the repository and may not traverse symlinks. Every input,
metric, render, and output size is validated before staged per-file replacement; unrelated siblings
remain untouched. After successful replacement, known CommitAtlas filenames that the previous
manifest recorded and the new manifest no longer lists are removed, so a disabled card or prior
responsive layout cannot remain stale while an unowned file of the same name survives. The
caller owns commits and deployment. The package has no private mode, fixture
mode, token argument, or publication side effect.
