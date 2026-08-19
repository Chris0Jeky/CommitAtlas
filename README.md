<div align="center">

# CommitAtlas

### Your GitHub work, mapped clearly.

A modular toolkit for beautiful GitHub cards and a project dashboard that explains what is active,
what is healthy, and where people should go next.

[![CI](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-ff7a45.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-ffc857.svg)](tsconfig.json)

</div>

> **Pre-release foundation.** The product shell and architecture are running locally. Typed data,
> card endpoints, the Studio, and static generation are being added as small verified commits.

## Why CommitAtlas

Existing README cards are excellent at individual visuals. CommitAtlas connects them into one
truthful portfolio surface.

| Principle | What it means |
| --- | --- |
| One toolkit | Profile, streak, activity, language, and project cards share contracts and themes. |
| Project signals | Explicit lifecycle, exact CI/release state, and Docs/Install/Download actions. |
| Honest unknowns | Missing, stale, and unavailable data never masquerade as healthy. |
| Two reliability modes | A cache-first hosted API for convenience; static generation for durability. |
| Public by default | Shared hosting uses public data. Tokens stay server-side or inside your Action. |
| Accessible output | Labeled SVGs, curated contrast, keyboard-friendly HTML, and reduced motion. |

## Planned V1

```text
/api/v1/cards/profile.svg     contribution and repository summary
/api/v1/cards/streak.svg      current + longest UTC streak
/api/v1/cards/activity.svg    bounded contribution trend
/api/v1/cards/languages.svg   repository-language distribution
/api/v1/projects.svg          compact project signal board
/api/v1/projects              source-backed project JSON
/studio                       configure, preview, and copy embeds
```

README project boards are visual summaries. Individual Docs, Install, Download, Release, and CI
links live in the HTML dashboard because an externally embedded SVG is one image link, not a
reliable group of buttons.

## Quick start

Requirements: Node.js 22.13 or newer and npm.

```bash
git clone https://github.com/Chris0Jeky/CommitAtlas.git
cd CommitAtlas
npm ci
npm run dev
```

Open `http://localhost:3000`. Run the local gate before contributing:

```bash
npm run check
```

No GitHub token is required for the synthetic preview. Live contribution data requires the optional
`GITHUB_TOKEN` Worker secret (or an Action secret); set it with `npx wrangler secret put GITHUB_TOKEN`.
It is read only by server-side GitHub requests — never put a token in a URL, client-side setting, or
committed file.

## Design and evidence

- [Architecture and security boundaries](docs/ARCHITECTURE.md)
- [Competitive research and product gap](docs/RESEARCH.md)
- [Live project state](docs/PROJECT_STATE.md)

CommitAtlas does not invent a universal developer rank, language proficiency, CI result, project
lifecycle, or download URL. It shows facts, configured intent, source availability, and freshness.

## Contributing

The repository is intentionally growing in independently reviewable slices. Each metric or renderer
must arrive with a fixture, focused tests, documentation, and a working example. See [AGENTS.md](AGENTS.md)
for the measured local commands and invariants; contributor and security policies land before v0.1.

## License

CommitAtlas is licensed under [GPL-3.0-only](LICENSE).
