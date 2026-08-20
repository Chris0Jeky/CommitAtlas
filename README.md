<div align="center">

# CommitAtlas

### Your GitHub work, mapped clearly.

One cohesive toolkit for contribution analytics, streaks, project health, README widgets, and a
live portfolio Studio.

[![CI](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-ff7a45.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-ffc857.svg)](tsconfig.json)

[Open the live Studio](https://commitatlas.jeky-tck.chatgpt.site/studio) ·
[Run the demonstration](docs/DEMO_GUIDE.md)

</div>

> **v0.1 release candidate.** The hosted API and Studio, six-card static generator, and bundled
> Node 24 Action are implemented. The GitHub `v0.1.0` release and npm publication are still separate
> release decisions and are not claimed here.

## The complete operating picture

The primary Atlas condenses a full year of public activity into one `860 × 380` SVG:

- 365-day contribution heatmap, total, active-day density, daily average, and peak day;
- current and longest streak inside the displayed window;
- commit, pull-request, issue, and review mix from GitHub's public profile percentages;
- 12-bucket momentum, recent-versus-previous 28-day change, and a transparent rhythm score;
- source-backed language distribution and configured project CI health;
- four themes, wide/compact layouts, and optional subtle load motion with reduced-motion support.

The rhythm score summarizes consistency and breadth inside the displayed window. It is deliberately
not presented as a universal GitHub ranking or a comparison with other developers.

## Pick only what you need

| Surface | What it shows | Hosted route / static file |
| --- | --- | --- |
| Atlas | Density, heatmap, streaks, collaboration mix, momentum, rhythm, languages, project health | `/api/v1/cards/atlas.svg` / `atlas.svg` |
| Profile | Public repositories, followers, following, stars, contribution total | `/api/v1/cards/profile.svg` / `profile.svg` |
| Streak | Current and longest-in-window streak, active days, last activity | `/api/v1/cards/streak.svg` / `streak.svg` |
| Activity | Bounded daily contribution graph and exact date window | `/api/v1/cards/activity.svg` / `activity.svg` |
| Languages | Repository-language byte share, never guessed proficiency | `/api/v1/cards/languages.svg` / `languages.svg` |
| Projects | Up to six curated projects with lifecycle, named-workflow CI, release, and freshness | `/api/v1/projects.svg` / `projects.svg` |

The [Studio](https://commitatlas.jeky-tck.chatgpt.site/studio) configures, previews, and copies
embeds. Project Docs, Install, Download, Release, Source, and CI actions live in its accessible HTML
dashboard: a README-embedded SVG is one linked image and cannot reliably contain independent links.

## Hosted examples

- [Rich Atlas — live public profile](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/atlas.svg?user=Chris0Jeky&demo=false&theme=ember&days=365&motion=subtle&layout=wide)
- [Streak — live public profile](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/streak.svg?user=Chris0Jeky&demo=false&theme=ember)
- [Activity — live public profile](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/activity.svg?user=Chris0Jeky&demo=false&theme=ember&days=365)
- [Profile — live public data](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/profile.svg?user=Chris0Jeky&demo=false&theme=ember)
- [Languages — live public data](https://commitatlas.jeky-tck.chatgpt.site/api/v1/cards/languages.svg?user=Chris0Jeky&demo=false&theme=ember)
- [Project board — deterministic demo](https://commitatlas.jeky-tck.chatgpt.site/api/v1/projects.svg?owner=octocat&repos=Hello-World,Spoon-Knife&states=Hello-World:active,Spoon-Knife:maintenance&demo=true&theme=paper)

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
git clone https://github.com/Chris0Jeky/CommitAtlas.git
cd CommitAtlas
npm ci
npm run dev
```

Open `http://localhost:3000`. Run the complete local gate with:

```bash
npm run check
```

## Generate dependable profile assets

Static generation is credential-free. It reads the logged-out GitHub profile view and public REST
endpoints, renders every selected card from one snapshot, and writes a SHA-256 manifest. Copy the
example, curate the projects, track the config, then generate:

```bash
cp .commitatlas.example.json .commitatlas.json
git add .commitatlas.json
npm run build:static
node packages/static/dist/cli.js generate --config .commitatlas.json
```

The v1 config is intentionally one-owner and public-only. It rejects unknown fields, credentials,
absolute/traversing/symlinked paths, untracked config, duplicate cards/projects, and invalid workflow
identities. Generation validates all upstream data and SVG payloads before staged per-file
replacement; unrelated files in the output directory are preserved.

## Refresh with GitHub Actions

The repository-root `action.yml` runs on Node 24 and only generates files. It never commits, pushes,
uploads, or receives `GITHUB_TOKEN`. Pin it to an immutable CommitAtlas commit in consumer workflows:

```yaml
name: Refresh CommitAtlas
on:
  workflow_dispatch:
  schedule:
    - cron: "23 5 * * *"

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Chris0Jeky/CommitAtlas@COMMIT_SHA
        with:
          config: .commitatlas.json
      - name: Commit changed public assets
        shell: bash
        run: |
          if git diff --quiet -- assets/commitatlas; then exit 0; fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -- assets/commitatlas
          git commit -m "chore(profile): refresh CommitAtlas"
          git push
```

The workflow's built-in token is used only by checkout/git push. It is not passed to CommitAtlas's
data layer. A failed refresh leaves the last committed profile assets available.

## Public-data and privacy boundary

Credential-free contribution cards use GitHub's logged-out public profile view. That view can include
anonymous aggregate contribution counts a user has elected to display, but CommitAtlas requests no
private repository names, commits, URLs, or other private details. Activity-type values from that view
are labelled as percentages, not fabricated exact counts.

Hosted requests may optionally use a server-side classic public-only token, but the client requires
positive scope evidence and rejects broader, fine-grained, Actions, App, unknown, or restricted-data
credentials. Never place a token in a URL, browser setting, config, generated file, or committed fixture.

## Design and evidence

- [Architecture and security boundaries](docs/ARCHITECTURE.md)
- [Competitive research and product gap](docs/RESEARCH.md)
- [Complete demonstration guide](docs/DEMO_GUIDE.md)
- [Static generator and Action contract](docs/STATIC_GENERATOR_PLAN.md)
- [Studio production QA](docs/STUDIO_QA_2026-08-20.md)
- [Live project state](docs/PROJECT_STATE.md)
- [v0.1 release plan](docs/V0_1_PLAN.md)

CommitAtlas does not invent a global developer rank, language proficiency, CI result, lifecycle,
release, or download URL. It shows source-backed facts, explicitly configured intent, source
availability, and freshness.

## License

CommitAtlas is licensed under [GPL-3.0-only](LICENSE).
