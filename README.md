<div align="center">

# CommitAtlas

### Your GitHub work, mapped clearly.

One cohesive toolkit for contribution analytics, streaks, project health, README widgets, and a
live portfolio Studio.

[![CI](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-ff7a45.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-ffc857.svg)](tsconfig.json)

[Open the live Studio](https://commit-atlas.commit-atlas.workers.dev/studio) ·
[Run the demonstration](docs/DEMO_GUIDE.md)

</div>

> **v0.2.0 rebuilds the web surface on the shared chassis.** The landing page is now the product
> measuring itself: every number in the instrument fascia, the six-state health rack, and the new
> evidence drawer comes from the same `fetchPortfolioSnapshot` call the SVG routes use, so nothing
> on the front page is typed in and none of it costs a GitHub request. Four chassis themes, a
> complete reduced-motion page, and an evidence layer that lets every printed number answer
> "how do you know that". The contract is in [docs/DESIGN_CHASSIS.md](docs/DESIGN_CHASSIS.md).
>
> The hosted API, the eight-card static generator, and the bundled Node 24 Action are unchanged.
> Every push to `main` that passes CI deploys to Cloudflare Workers and is verified by probes
> against the origin it just published to.
>
> **npm publication is still not claimed.** The packages are built and pack-verified but are not on
> the registry, and the README will not say otherwise until a registry lookup succeeds.

## The complete operating picture

The primary Atlas condenses a full year of public activity into one `860 × 380` SVG:

- 365-day contribution heatmap, total, active-day density, daily average, and peak day;
- current and longest streak inside the displayed window;
- commit, pull-request, issue, and review mix from GitHub's calendar-year public-profile percentages
  when exact categorized counts are unavailable (the mix is labelled as not window-scoped);
- 12-bucket momentum, recent-versus-previous 28-day change, and a transparent rhythm score;
- source-backed language distribution and configured project CI health;
- four themes, wide/compact layouts, and `motion=none|subtle`; subtle load motion includes a
  `prefers-reduced-motion` override, while `none` emits no animation keyframes.

The rhythm score summarizes consistency and breadth inside the displayed window. It is deliberately
not presented as a universal GitHub ranking or a comparison with other developers.

## Pick only what you need

| Surface | What it shows | Hosted route / static file |
| --- | --- | --- |
| Atlas | Density, heatmap, streaks, collaboration mix, momentum, rhythm, languages, project health | `/api/v1/cards/atlas.svg` / `atlas.svg` |
| Profile | Public repositories, followers, following, stars, contribution total | `/api/v1/cards/profile.svg` / `profile.svg` |
| Streak | Current and longest-in-window streak, active days, last activity | `/api/v1/cards/streak.svg` / `streak.svg` |
| Breakdown | Window-scoped categorized counts when exact; otherwise calendar-year profile percentages labelled as not window-scoped | `/api/v1/cards/breakdown.svg` / `breakdown.svg` |
| Rhythm | Personal consistency from within-window density, streak, and momentum — not a GitHub rank | `/api/v1/cards/rhythm.svg` / `rhythm.svg` |
| Activity | Bounded daily contribution graph and exact date window | `/api/v1/cards/activity.svg` / `activity.svg` |
| Languages | Repository-language share, never guessed proficiency | `/api/v1/cards/languages.svg` / `languages.svg` |
| Projects | Up to six curated projects with declared lifecycle, named-workflow CI, release, and freshness | `/api/v1/projects.svg` / `projects.svg` (static: `projects.json`, `projects.md`) |
| Cadence | Contribution share by day of week on UTC boundaries, window-scoped | static-only: `cadence.svg` |
| Releases | The most recent published release per curated project, newest first; absence stated | static-only: `releases.svg` |

The cards are drawn in one hue per scale, never four: a density square's colour says *how much*,
and never *what kind*. The Studio emits each card as a `<picture>` pair keyed on
`prefers-color-scheme`, so a README serves a dark card to dark readers and a light one to light
readers from a single snippet.

The [Studio](https://commit-atlas.commit-atlas.workers.dev/studio) configures, previews, and copies
embeds. Project Docs, Install, Download, Release, Source, and CI actions live in its accessible HTML
dashboard: a README-embedded SVG is one linked image and cannot reliably contain independent links.

## Hosted examples

- [Rich Atlas — live public profile](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/atlas.svg?user=Chris0Jeky&demo=false&theme=ember&days=365&motion=subtle&layout=wide)
- [Streak — live public profile](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/streak.svg?user=Chris0Jeky&demo=false&theme=ember)
- [Breakdown — live public profile](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/breakdown.svg?user=Chris0Jeky&demo=false&theme=ember&days=365&motion=subtle)
- [Rhythm — live public profile](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/rhythm.svg?user=Chris0Jeky&demo=false&theme=ember&days=365&motion=subtle)
- [Activity — live public profile](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/activity.svg?user=Chris0Jeky&demo=false&theme=ember&days=365)
- [Profile — live public data](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/profile.svg?user=Chris0Jeky&demo=false&theme=ember)
- [Languages — live public data](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/languages.svg?user=Chris0Jeky&demo=false&theme=ember)
- [Project board — deterministic demo](https://commit-atlas.commit-atlas.workers.dev/api/v1/projects.svg?owner=octocat&repos=Hello-World,Spoon-Knife&states=Hello-World:active,Spoon-Knife:maintenance&demo=true&theme=paper)

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

## Deploy your own

CommitAtlas is a Cloudflare Worker with static assets and needs **no credentials** to serve every
documented surface, so the free Workers plan is enough:

```bash
npx wrangler login
npm run deploy
```

`npm run deploy` builds, publishes, reads the deployed origin out of Wrangler's own output, and
runs seventeen deterministic probes against it — health, the landing page, the Studio, all eight
synthetic cards asserted to be script-free SVG, the `motion=none` CSP path, and two invalid queries
proving each is rejected as a bounded `400` with `no-store`, plus `robots.txt`, `sitemap.xml`, and the
landing page's structured data. The origin is never hard-coded, so this
verifies *your* deployment. Push-to-deploy from GitHub Actions and the optional public-scope
`GITHUB_TOKEN` are covered in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Generate dependable profile assets

Static generation is credential-free. It reads the logged-out GitHub profile view and public REST
endpoints, renders every selected card from one snapshot, and writes a SHA-256 manifest. Selecting
Projects also writes source/config-labelled `projects.json` and `projects.md` catalogs. Copy the
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
come from calendar-year profile views and are labelled as public-profile percentages that are not
scoped to the requested contribution window; only an explicitly exact source is rendered as
window-scoped counts. A percentage is never presented as a count.

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
