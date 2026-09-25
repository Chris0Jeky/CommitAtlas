<div align="center">

# CommitAtlas

### Your GitHub work, mapped clearly.

Source-backed GitHub analytics, README graphics, project-health views, and a live portfolio Studio — with explicit freshness, provenance, and no invented rankings.

[![CI](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Chris0Jeky/CommitAtlas/actions/workflows/ci.yml)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-ff7a45.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-ffc857.svg)](tsconfig.json)

[Open the live Studio](https://commit-atlas.commit-atlas.workers.dev/studio) ·
[Run the demonstration](docs/DEMO_GUIDE.md) ·
[Product direction](docs/PRODUCT_DIRECTION.md) ·
[Live project state](docs/PROJECT_STATE.md)

</div>

## What CommitAtlas is

CommitAtlas is the public presentation layer in a wider evidence-oriented developer-tool portfolio.

- It turns credential-free public GitHub evidence and explicitly configured project intent into deterministic SVGs, catalogues, and portfolio views.
- It states where every reading came from, what window it covers, how fresh it is, and what is unavailable.
- It can retain a validated last-good public representation during bounded upstream failure, but visibly marks it stale rather than painting it healthy.
- It does not infer private work, language proficiency, productivity, project success, or a universal developer rank.
- It complements **Developer Lens**, which owns private/local interpretation; **Pulseboard**, which owns private operational evidence; and the GitHub profile repository, which owns final publication choices.

The product direction is a deterministic, privacy-aware generative profile graphics engine: factual instruments today; evidence-labelled maps, signatures, scenes, and findings only when their contracts and rendering behavior are proven.

## Current product boundary

**Released:** v0.4.0.

- Eight hosted SVG routes and the live Studio run on the public Cloudflare Worker.
- Hosted URLs and the Studio accept `none | subtle | ambient`; the package and static generator also accept `cinematic`. In this compatibility slice, every non-`none` profile remains byte-identical to the existing subtle load motion.
- The source CLI and bundled Node 24 Action generate ten card types from one public snapshot: the hosted eight plus static Cadence and Releases cards.
- Dark and light bundles can be rendered from one fetch, with exact artifact validation and SHA-256 manifests.
- The optional design fascia, rack, and evidence ladder explain the visual system; they are not additional cards or a monitoring service.
- A bounded, pinned Developer Lens C0 method-trial summary can appear on the landing page. It is invented research evidence with explicit limitations, not a person-level signal.
- The Observatory adapter is staged but inactive: its endpoint is empty, so it creates no consent storage, timers, or collector requests. Collection is not a hidden side effect of publishing CommitAtlas.
- npm registry publication and a GitHub Marketplace listing are not claimed. Packages are built and pack-verified from source only.

**Planned, not shipped:** differentiated ambient/cinematic motion, a motion compiler, a scene engine, owner-reviewed Developer Lens projections, additional research finding projections, and broader visual families. The implementation programme is in [EXPANSION_PLAN.md](docs/EXPANSION_PLAN.md); none of those plans changes the current release boundary.

Every push to `main` that passes CI deploys to Cloudflare Workers and is checked against the origin produced by that deployment.

## The evidence model

CommitAtlas keeps four kinds of information visibly separate:

1. **Observed facts** — values obtained directly from the declared public source.
2. **Derived readings** — transparent calculations over those facts, such as density, momentum, or the personal rhythm summary.
3. **Configured intent** — owner-declared lifecycle, named workflow, or approved project links.
4. **Missing or stale evidence** — unavailable, restricted, expired, unsupported, or temporarily served from a marked last-good snapshot.

The rhythm score summarizes consistency and breadth inside the displayed window. It is not a GitHub rank and is never compared across people.

A scene may later use evidence as a deterministic visual seed, but spectacle must never carry an unstated claim. Everything remains readable at frame zero; unavailable never animates as healthy; identical inputs must produce byte-identical output.

## Shipped surfaces

| Surface | What it shows | Hosted route / static file |
| --- | --- | --- |
| Atlas | Density, heatmap, streaks, collaboration mix, momentum, rhythm, languages, project health | `/api/v1/cards/atlas.svg` / `atlas.svg` |
| Profile | Public repositories, followers, following, stars, contribution total | `/api/v1/cards/profile.svg` / `profile.svg` |
| Streak | Current and longest-in-window streak, active days, last activity | `/api/v1/cards/streak.svg` / `streak.svg` |
| Breakdown | Exact window counts when available; otherwise explicitly labelled public-profile percentages | `/api/v1/cards/breakdown.svg` / `breakdown.svg` |
| Rhythm | Personal consistency from density, streak, and momentum — not a rank | `/api/v1/cards/rhythm.svg` / `rhythm.svg` |
| Activity | Bounded daily contribution graph and exact date window | `/api/v1/cards/activity.svg` / `activity.svg` |
| Languages | Repository-language share, never guessed proficiency | `/api/v1/cards/languages.svg` / `languages.svg` |
| Projects | Up to six curated projects with lifecycle, named-workflow CI, release, and freshness | `/api/v1/projects.svg` / `projects.svg`, `projects.json`, `projects.md` |
| Cadence | Contribution share by UTC weekday, window-scoped | static-only `cadence.svg` |
| Releases | Latest published release per curated project, absence stated | static-only `releases.svg` |

The primary Atlas condenses a 365-day public activity window into one `860 × 380` SVG: contribution heatmap and totals, active-day density, peak day, streaks, public collaboration mix, twelve-bucket momentum, recent change, rhythm, language distribution, and configured project health.

Cards use one hue per quantitative scale. Colour says how much, not what kind. The Studio emits a `<picture>` pair for dark and light readers and keeps independent project actions in accessible HTML because a README-embedded SVG is one linked image, not a reliable mini-application.

## v0.4.0 highlights

- **Truthful last-good resilience.** Eligible public hosted responses may reuse a validated representation for seven days during a supported anonymous-GitHub failure. The response is visibly stale, timestamped, and short-cached. Cold, expired, token-backed, synthetic, or mismatched requests never borrow it.
- **Contribution fidelity.** GitHub’s Sunday-row geometry and supplied intensity levels are preserved, and an open final UTC day no longer erases a continuing streak.
- **One snapshot, two schemes.** Static dark/light outputs share the same source time and window while keeping independent manifests.
- **Readability and product clarity.** The Studio distinguishes hosted routes, static cards, source distribution, and optional design explanations.
- **Bounded research bridge.** A pinned Developer Lens C0 trial records a baseline/candidate result and unsupported claims without turning research into profile evidence.

## Try it

The deterministic examples make no GitHub request and separate renderer behavior from upstream availability:

- [Rich Atlas demo](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/atlas.svg?user=octocat&demo=true&theme=ember&days=365&motion=subtle&layout=wide)
- [Profile demo](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/profile.svg?user=octocat&demo=true&theme=paper&motion=none)
- [Project board demo](https://commit-atlas.commit-atlas.workers.dev/api/v1/projects.svg?owner=octocat&repos=Hello-World,Spoon-Knife&states=Hello-World:active,Spoon-Knife:maintenance&demo=true&theme=paper)

The [live public Atlas](https://commit-atlas.commit-atlas.workers.dev/api/v1/cards/atlas.svg?user=Chris0Jeky&demo=false&theme=ember&days=365&motion=subtle&layout=wide) depends on anonymous GitHub availability. During an eligible upstream failure, a retained representation carries a visible `STALE SNAPSHOT` strip and freshness headers. A cold or expired route returns the original bounded error.

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

Static generation is credential-free. It reads GitHub’s logged-out public profile view and public REST endpoints, renders selected cards from one snapshot, and writes a SHA-256 manifest. Selecting Projects also writes source/config-labelled catalogues.

```bash
cp .commitatlas.example.json .commitatlas.json
git add .commitatlas.json
npm run build:static
node packages/static/dist/cli.js generate --config .commitatlas.json
```

The v1 config is one-owner and public-only. It rejects unknown fields, credentials, absolute/traversing/symlinked paths, untracked config, duplicate outputs, and invalid workflow identities. Generation validates variants before staged per-file replacement and preserves unrelated files in the output directory.

The repository-root `action.yml` runs on Node 24 and only generates files. It never commits, pushes, uploads, or receives `GITHUB_TOKEN`. Pin it to an immutable CommitAtlas commit; let the consumer workflow own checkout and any reviewed commit/push step. A failed refresh leaves the last committed assets available.

See [STATIC_GENERATOR_PLAN.md](docs/STATIC_GENERATOR_PLAN.md) and [DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full contracts.

## Deploy your own

CommitAtlas serves all documented surfaces without credentials. Hosted last-good resilience additionally uses a Workers KV namespace.

```bash
npx wrangler login
npm run deploy
```

The deployment script builds, publishes, obtains the real origin from Wrangler output, and probes health, the landing page, Studio, all eight deterministic cards, CSP paths, bounded invalid queries, `robots.txt`, `sitemap.xml`, and structured data. The origin is not hard-coded.

## Public-data and privacy boundary

Credential-free cards use GitHub’s logged-out public profile and public REST evidence. That view may include anonymous aggregate private-contribution counts a user elected to display, but CommitAtlas requests no private repository names, commits, URLs, or details.

Some activity-type values come from calendar-year public-profile percentages rather than exact counts in the requested contribution window. CommitAtlas labels that distinction and never converts a percentage into a count.

A signed-in owner may see different totals because GitHub exposes a different evidence boundary. Compare public parity against a logged-out profile.

Hosted requests may optionally use a server-side classic public-only token, but the client requires positive scope evidence and rejects broader, fine-grained, Actions, App, unknown, or restricted-data credentials. Never place a token in a URL, browser setting, generated file, committed fixture, or tracked config.

Developer Lens projections follow a separate publication boundary. Private/local evidence is never fetched by the hosted product. Any future owner projection must be explicitly redacted, reviewed, committed by the owner, freshness-checked, and labelled as a derived signature—not silently inferred from GitHub.

## Direction

Near-term work is evidence-gated:

1. finish proving which SVG motion backend works through GitHub README `<img>` rendering before differentiating the compatibility motion profiles;
2. compile motion from one primitive model with frame-zero and reduced-motion invariants;
3. add deterministic maps and scenes without letting aesthetics imply facts;
4. keep Developer Lens C1 publication blocked on owner decision Q-9; when authorized, accept only product-owned schemas with visible coverage, privacy class, limitations, and freshness or expiry;
5. accept Lab research findings only through product-owned schemas with pinned provenance, decision vocabulary, limitations, and unsupported claims; do not invent coverage or expiry fields that the finding contract does not define;
6. keep hosted data public-only and keep any Observatory collection separately consented and inactive by default;
7. extend static/profile publication only after artifact lists, manifests, budgets, and consumer workflows are updated together.

Read [PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md) for the concise map and [EXPANSION_PLAN.md](docs/EXPANSION_PLAN.md) for implementation-level decisions and seeded work.

## Documentation

- [Product direction](docs/PRODUCT_DIRECTION.md)
- [Architecture and security boundaries](docs/ARCHITECTURE.md)
- [Live project state](docs/PROJECT_STATE.md)
- [Expansion programme](docs/EXPANSION_PLAN.md)
- [Projection contracts](docs/PROJECTION_CONTRACTS.md)
- [Design chassis and evidence ladder](docs/DESIGN_CHASSIS.md)
- [Competitive research and product gap](docs/RESEARCH.md)
- [Demonstration guide](docs/DEMO_GUIDE.md)
- [Studio production QA](docs/STUDIO_QA_2026-08-20.md)

CommitAtlas does not invent a global developer rank, language proficiency, CI result, project lifecycle, release, download URL, or private evidence. It shows source-backed facts, explicitly configured intent, transparent derivations, availability, and freshness.

## License

CommitAtlas is licensed under [GPL-3.0-only](LICENSE).
