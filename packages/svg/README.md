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

## Motion compiler

`MotionPlan` is an additive primitive compiler; existing card renderers still use their unchanged
compatibility motion. It performs no DOM edits, fetches, timers, or model generation. A scene binds
each returned `id` and `className` to an **identity-transform wrapper** around its finished base
geometry, with wrapper base opacity 1, adds `style` once, and inserts `children` inside the matching wrapper. Keep those bindings
in the `none` twin too: removing only `<style>` and `<animate*>` nodes then reproduces that twin
byte-for-byte. Put existing positioning transforms on a child, and use a zero-origin SVG viewBox.

```ts
import { MotionPlan } from "@commit-atlas/svg";

const motion = new MotionPlan({
  instanceNamespace: "profileHero", // stable and distinct for every inline scene slot
  sceneId: "survey",
  family: "scene",
  profile: "ambient",
  target: "github-readme",
  backend: "smil", // optional; selects the provisional per-target default when absent
}).add({
  primitive: "breathe", target: "reticle", decorative: true,
  params: { cx: 120, cy: 80 },
});
const bindings = motion.compile().bindings;
// Render finished geometry with these bindings, then measure its exact UTF-8 size.
const compiled = motion.compile({ baseBytes: finishedGeometryBytes });
// Return compiled.style + bound base geometry with each binding.children inserted.
```

Every generated wrapper ID, class, keyframe, and animation ID has a length-delimited namespace
and scene prefix. `instanceNamespace` accepts `[A-Za-z][A-Za-z0-9_-]{0,31}`; scene IDs accept
lowercase kebab case up to 48 characters. Logical target and loop-group keys accept the same
identifier alphabet up to 64 characters. Caller namespaces must be distinct when inlining multiple
instances. Reusing the same namespace, scene, options, and ordered applications is deterministic.

| Primitive | CSS | SMIL | Defaults and restrictions |
| --- | --- | --- | --- |
| `enter` | translate keyframe | `animateTransform` translate | 400 ms, delay at least 60 ms; finished base during delay; fill none/remove |
| `stagger` | delayed translate keyframe | delayed `animateTransform` | M3: 400 ms, 14 ms per index, plus the 60 ms entrance delay |
| `breathe` | scale about an explicit origin | compensated translate plus additive scale | M4: 4.5 s, 1 → 1.045 → 1; decorative |
| `scan` | translate marker | `animateTransform` translate | 5.6 s; default x offset 100 |
| `sweep` | translate beam | `animateTransform` translate | M6: 7 s; default x offset 70 |
| `rotate` / `orbit` | rotation with viewBox origin | rotation with user-coordinate center | 12 s; decorative |
| `plot` | stroke-dashoffset | `animate` stroke-dashoffset | M1: 9 s; caller supplies the dash array and an already-visible underlying trace |
| `flow` | **unsupported**, omitted and reported | `animateMotion` | 9 s; decorative; 2–32 bounded numeric coordinate pairs, no raw path/CSS input |
| `twinkle` | opacity keyframe | `animate` opacity | 7 s; scene-family decoration only; minimum opacity 0.35 |
| `pulse` | opacity keyframe | `animate` opacity | M5: 2.4 s; decorative lamp with explicit `state: "pending"`; default floor 0.45 |
| `acquisitionFailure` | relative needle rotation sequence | `animateTransform` values list | M7: 1.2 s one-shot hunt/stutter/return; decorative needle, steady NO SIGNAL base |

Parameters are closed, bounded numbers; no arbitrary CSS, easing, markup, or path strings are
accepted. Durations are integer 60–20,000 ms, delays integer 0–44,999 ms (entrances ≥60 ms),
coordinates ±10,000, scale 1–1.1, and opacity 0.35–1. Inputs are copied; later caller mutations do
not alter the plan. Text/reading wrappers may only translate; `plot` animates the overlay of an
already-readable trace. Different properties may animate on one wrapper, but conflicting properties
and inconsistent decorative classification throw. `subtle` accepts only enter/stagger up to 600 ms;
`cinematic` requires the scene/hero budget class. Renderers remain responsible for declaring which
profiles their individual compositions support and for keeping unavailable signals steady.

README looping motion under `ambient` or `cinematic` ends at the exported
`README_MOTION_INTERVAL_MS` (45 seconds from document load), accounting for each application’s delay.
CSS uses a possibly fractional iteration count; SMIL uses `repeatDur`. Both remove the animation
effect afterward, returning to the finished base. Web and Studio loop indefinitely. One-shot
effects stay one-shot. The compiler rejects a README delay/duration that would overrun the interval.

CSS emits a reduced-motion media override and reports `inlineStyles: true` when a style is present.
SMIL reports `inlineStyles: false` and `reducedMotion: "none-twin-required"`: it cannot honor the
media preference itself. A consumer must select a static twin on a supported embedding surface.
No GitHub sanitizer, CSS/SMIL playback, or pause-control compatibility is implied by this compiler.
Until [#113](https://github.com/Chris0Jeky/CommitAtlas/issues/113) completes its matrix,
`MOTION_DEFAULTS_PROVISIONAL` stays true: `github-readme → smil`, `web/studio → css` are placeholders.

`MOTION_BUDGETS` names the provisional instrument/map/scene classes: respectively <30,000 / ≤80 KiB /
≤120 KiB total UTF-8 bytes, 24/64/96 animated elements, and 3/6/6 looping groups. Instrument retains
the stricter existing card gate. Map, signature, and finding families use map; scene and hero use
scene. An optional `budgetClass` may narrow the family's default limits, never increase them;
for example a compact signature scene may select instrument. `MOTION_BUDGETS_PROVISIONAL` remains
true pending measured render cost. `counters` count
distinct emitted targets, distinct emitted looping `loopGroup` keys (defaulting to each target),
and the exact UTF-8 bytes of emitted style/animation nodes. Stable binding attributes are part of
`baseBytes`, not bytes added relative to the `none` twin. Always supply the complete measured base
size at final compilation: the compiler cannot measure caller-owned geometry. Over-budget plans
throw instead of truncating. Unsupported applications emit no animation and contribute no counters.

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

Delivery cards accept `benchmark: null`. An absent reference renders `BENCHMARK UNAVAILABLE`
even when a direct caller supplies a retained numeric multiple. No publisher, reference rate,
or comparison is invented; all independent flow readings remain visible.
