<div align="center">

# CommitAtlas

### Your GitHub work, mapped clearly.

A modular toolkit for beautiful GitHub cards and a project dashboard that explains what is active,
what is healthy, and where people should go next.

[![CI](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-ff7a45.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-ffc857.svg)](tsconfig.json)

[Open the live Studio](https://commitatlas.jeky-tck.chatgpt.site/studio)

</div>

> **Public demonstration.** The typed API, five SVG endpoints, project dashboard, and Studio are
> deployed together at [commitatlas.jeky-tck.chatgpt.site](https://commitatlas.jeky-tck.chatgpt.site/).
> Static generation, packaged automation, and the `v0.1.0` release remain pre-release work.

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

## Available v0.1 surfaces

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

## Hosted examples

- [Profile card — live public data](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/profile.svg?user=Chris0Jeky&demo=false&theme=ember)
- [Languages card — live public data](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/languages.svg?user=Chris0Jeky&demo=false&theme=ember)
- [Streak card — synthetic fixture](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/streak.svg?user=octocat&demo=true&theme=aurora)
- [Activity card — synthetic fixture](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/activity.svg?user=octocat&demo=true&theme=midnight&days=120)
- [Project board — synthetic fixture](https://commitatlas.jeky-tck.chatgpt.site/api/v1/projects.svg?owner=octocat&repos=Hello-World,Spoon-Knife&states=Hello-World:active,Spoon-Knife:maintenance&demo=true&theme=paper)

## Quick start

Try the [hosted Studio](https://commitatlas.jeky-tck.chatgpt.site/studio), or run CommitAtlas locally.

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

For the complete production-build walkthrough, use the
[demonstration guide](docs/DEMO_GUIDE.md).

No GitHub token is required for the synthetic preview. Live contribution data requires the optional
`GITHUB_TOKEN` Worker secret (or an Action secret); set it with `npx wrangler secret put GITHUB_TOKEN`.
For the shared public route, classic tokens must expose only the empty or `public_repo` scope set;
the service refuses missing or broader scope proofs. A token is read only by server-side GitHub requests
— never put one in a URL, client-side setting, or committed file.

## Design and evidence

- [Architecture and security boundaries](docs/ARCHITECTURE.md)
- [Competitive research and product gap](docs/RESEARCH.md)
- [Complete local demonstration](docs/DEMO_GUIDE.md)
- [Studio production QA](docs/STUDIO_QA_2026-08-20.md)
- [Live project state](docs/PROJECT_STATE.md)
- [v0.1 implementation plan](docs/V0_1_PLAN.md)

CommitAtlas does not invent a universal developer rank, language proficiency, CI result, project
lifecycle, or download URL. It shows facts, configured intent, source availability, and freshness.

## Contributing

The repository is intentionally growing in independently reviewable slices. Each metric or renderer
must arrive with a fixture, focused tests, documentation, and a working example. See [AGENTS.md](AGENTS.md)
for the measured local commands and invariants; contributor and security policies land before v0.1.

## License

CommitAtlas is licensed under [GPL-3.0-only](LICENSE).
