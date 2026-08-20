# `@commit-atlas/static`

Generate a compact CommitAtlas dashboard and its individual SVG widgets from one public GitHub
snapshot. The CLI reads a tracked `.commitatlas.json`, fetches only logged-out public profile data,
and writes selected cards plus a hash manifest.

```powershell
commitatlas generate --config .commitatlas.json
```

The generator sends no GitHub credential. GitHub's public profile view is the contribution source;
its activity mix is labelled as percentages rather than exact counts. A malformed, incomplete, or
unavailable upstream response fails generation before output is staged. The caller owns commits and
deployment.
