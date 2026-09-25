# @commit-atlas/svg

Small, dependency-free SVG renderers for GitHub portfolio cards. Renderers return a
complete SVG string and are safe to put in a README or a static site: user text is XML
escaped, links are restricted to `http`/`https`, and no scripts, images, or remote assets are
emitted. Subtle motion uses only a bounded inline presentation style.

The package includes ten renderers: a rich developer Atlas, profile, streak, contribution breakdown,
personal rhythm, activity, language, project signal-board (up to six projects), weekly cadence, and
latest releases. The hosted service exposes the first eight; Cadence and Releases are static-only.
Choose one of
the four built-in themes (`aurora`, `midnight`, `paper`, or `ember`) and provide plain presentation
data from your own GitHub adapter. The breakdown renderer preserves its basis: exact categorized
counts are rendered as window-scoped counts, while GitHub calendar-year public-profile activity
percentages remain visibly labelled as percentages and not window-scoped. Rhythm is a personal
within-window consistency summary, never a GitHub rank.

All renderers accept the shared `MotionProfile` vocabulary: `none`, `subtle`, `ambient`, and
`cinematic`. `none` emits no animation keyframes. In this compatibility slice, `subtle`, `ambient`,
and `cinematic` intentionally emit byte-identical bounded load motion with a
`prefers-reduced-motion: reduce` override. Hosted routes expose `none | subtle | ambient`; cinematic
remains available only to package and static-generator callers until a dedicated backend lands.
`motionRenderMetadata()` reports whether the current renderer output requires inline presentation
styles, so HTTP routes do not duplicate profile-to-CSP rules.

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
GitHub/core adapter values are far below these limits, so bounded inputs render unchanged.
Language cards use one
source basis per item: standalone inputs may use `name` plus bytes or percentages, while the
canonical `@commit-atlas/core` `aggregateLanguages()` result uses `language`, `bytes`, and the
derived `percentage` together and can be passed directly to `renderLanguagesCard`. Profile cards
render an optional source-backed aggregate `stars` value when supplied and leave it absent
otherwise. Partial bytes/percentage mixtures are rejected because their basis is ambiguous.

## Manual public pulse capsules

`renderPulseCard(data, { nowMs, theme?, motion? })` renders the separately validated
public-pulse projection. Supply the current rendering time explicitly in epoch milliseconds.
A previously adapted `live` card is not proof that its capsule is still live: the renderer
rechecks the original generation and expiry bounds on every call. At expiry it removes
probe rows; a missing or invalid clock or invalid time bounds produces an unavailable panel.
The renderer does not read the process clock, open files, fetch URLs, or install a timer.
A saved SVG is a snapshot, not a self-expiring live widget, and must not be served as current
evidence after its source expiry without rerendering.

The server-side `lib/pulse-capsule.ts` adapter accepts only operator-reviewed local files.
Its cache validates and owns a deep copy of each stored capsule and returns isolated copies.
Consumers must preserve the original expiry and enforce it when publishing or caching output.
Sampled checks retain their numerator/denominator, remain separate from CI, and are never
reported as time-weighted uptime. This package does not add a hosted route or remote ingestion.
