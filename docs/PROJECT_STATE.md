# CommitAtlas project state

Last verified: 2026-08-19

## Shipped

- Product name, visual direction, public-by-default positioning, and first local preview.
- Sites-compatible Vinext/Cloudflare workspace with Windows-safe npm scripts.
- T1 authority declaration and repository-specific Codex guide.
- `@commit-atlas/core` contracts for bounded GitHub inputs, UTC contributions, activity, languages,
  project lifecycle, and explicit CI freshness states, with focused fixtures.

## Building now

- Versioned GitHub data contracts and contribution calculations.
- XML-safe SVG design system and the first profile card endpoint.

## Next

- Streak, activity, languages, and project-board cards.
- Interactive Studio and live project dashboard.
- Static generator/action, full docs, CI, release automation, and hosted launch.

## Decisions

- Public shared service stays public-data-only; private output is a self-host/static-generation concern.
- Project lifecycle comes from an explicit manifest, never guessed from commit recency.
- CI states include unavailable/unconfigured/stale and never collapse uncertainty to green.
- npm is the repository package manager because the Sites starter and target machine use it natively.
