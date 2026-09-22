# @commit-atlas/svg

Small, dependency-free SVG renderers for GitHub portfolio cards. Renderers return a
complete SVG string and are safe to put in a README or a static site: user text is XML
escaped, links are restricted to `http`/`https`, and no scripts, images, or remote assets are
emitted. Subtle motion uses only a bounded inline presentation style.

The package includes eleven renderers: a rich developer Atlas, profile, streak, contribution breakdown,
personal rhythm, activity, language, project signal-board (up to six projects), weekly cadence, and
latest releases, and delivery evidence (scoped pull-request flow with a dated benchmark comparison). The hosted service exposes the first eight; Cadence, Releases, and Delivery are static-only.
Choose one of
the four built-in themes (`aurora`, `midnight`, `paper`, or `ember`) and provide plain presentation
data from your own GitHub adapter. The breakdown renderer preserves its basis: exact categorized
counts are rendered as window-scoped counts, while GitHub calendar-year public-profile activity
percentages remain visibly labelled as percentages and not window-scoped. Rhythm is a personal
within-window consistency summary, never a GitHub rank.

All renderers accept `motion: "none" | "subtle"`. `none` emits no animation keyframes; `subtle`
adds a short load transition plus a `prefers-reduced-motion: reduce` override that disables it.

```ts
import { renderProfileCard } from "@commit-atlas/svg";

const svg = renderProfileCard({
  name: "Ada Lovelace",
  login: "ada",
  repositories: 12,
  followers: 420,
  following: 18,
}, { theme: "aurora" });
```

## Deterministic scene seeds

Procedural presentation code can derive stable placement from the exact model it renders:

```ts
import { canonicalJson, seededRandom, stableHash } from "@commit-atlas/svg";

const seed = stableHash(canonicalJson({
  card: "atlas",
  snapshot: { days: 365, theme: "paper" },
}));
const random = seededRandom(seed);
const x = random(); // always in [0, 1), and repeatable for the same seed
```

`canonicalJson` recursively sorts plain-object keys, preserves array order, emits no optional
whitespace, and rejects values that would make the model ambiguous: non-finite numbers,
`undefined`, functions, symbols, bigints, accessors, sparse arrays, cycles, and non-plain objects.
`stableHash` returns the lowercase SHA-256 digest of the exact UTF-8 text. `seededRandom` consumes
a 64-character SHA-256 digest and runs Mulberry32 from its first 32 bits. The hash uses Node's
synchronous crypto implementation, which is also available in the deployed Worker through the
repository's pinned `nodejs_compat` flag.

Built package artifacts contain compiled JavaScript and TypeScript declarations in `dist`. The
package is source-installable but is not currently published to npm.

Renderer inputs are bounded for portable README use: dimensions clamp to renderer-safe ranges,
accessible title and description labels are length-limited, and activity cards accept up to a
full 366-day window while remaining below the 30KB SVG output budget. Caller-supplied prose on
the insight cards is bounded the same way: breakdown `window.from` and `window.to` truncate to 24
characters, and rhythm `rhythm.level` and `rhythm.basis` truncate to 24 and 120 characters. The
atlas card bounds `window.from`, `window.to`, and `rhythm.level` to 24 characters too, and keeps
at most the 26 most recent `trend.buckets` in its momentum strip. Every truncation appends a
visible `…` rather than dropping text silently and never splits a surrogate pair. Non-finite
numerics never reach visible atlas text: a non-finite `window.days` clamps like every other count,
a non-finite `trend.changePercent` renders `trend change unavailable`, and a `projects` tally with
any non-finite count renders `Project health unavailable` rather than a fabricated zero. Valid
GitHub/core adapter values are far below these limits, so bounded inputs render unchanged. Delivery evidence renders unknown ratios as `UNAVAILABLE` and unknown counts as `UNKNOWN`, never as healthy readings, and prints the literal `activity flow · not quality or impact` non-claim instead of any productivity, quality, effort, or impact claim.
Language cards use one
source basis per item: standalone inputs may use `name` plus bytes or percentages, while the
canonical `@commit-atlas/core` `aggregateLanguages()` result uses `language`, `bytes`, and the
derived `percentage` together and can be passed directly to `renderLanguagesCard`. Profile cards
render an optional source-backed aggregate `stars` value when supplied and leave it absent
otherwise. Partial bytes/percentage mixtures are rejected because their basis is ambiguous.
