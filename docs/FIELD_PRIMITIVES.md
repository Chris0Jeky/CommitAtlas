# Compiler-backed survey field primitives

`@commit-atlas/svg/primitives/field` exports `particleField`, `scanline`,
`plotterPath`, `signalPulse`, and `compileFieldPrimitives`. Factories return
immutable recipe handles, not self-compiled SVG. The assembler registers every
application with the active scene's single motion plan, then returns both an
overlaid `fragment` and a keyed `fragments` record for independent placement.

Inside a scene's render callback:

```ts
const dust = particleField(context, { key: "dust", count: 24 });
const trace = plotterPath(context, { key: "trace", d: "M8 140L80 60L160 100L312 20" });
const status = signalPulse(context, { key: "status", state: "unavailable" });
const output = compileFieldPrimitives(context, [dust, trace, status], { target: "web" });
// Include output.motion.style once as a direct child of the accessible SVG root.
// Include each output.fragments entry exactly once, or use output.fragment once.
// Static parent <g transform="translate(...)"> wrappers may place individual fields.
```

Factories accept a theme and survey pack (omission means survey). Bounds use the
same 320 by 180 default and finite clamping as geometric primitives. The factory
captures finished geometry and its theme, not a live caller-owned object.
Compilation rejects forged handles, duplicate field keys, mismatched themes and
extra applications targeting reserved field wrappers. Keys are 1–48 ASCII
letters/digits/underscores/hyphens, starting with a letter. Generated target keys
and actual IDs remain within the existing compiler's bounded namespace scheme.

## Field behavior

`particleField(context, { key, count, seed?, ink?, width?, height? })` derives
positions and delays from `seededRandom`, using `seed` or the scene-model seed.
The seed must be a 64-character hexadecimal hash. A nonnegative safe-integer
count is capped at 96; the handle exposes the actual `count` and `capped` flag.
Zero means no decorative particles, not missing observations. Ink is a closed
choice of chrome (default), muted or density. No raw colours are accepted.
Twinkle applications are decorative and share one loop group per field. The
existing compiler requires scene-family decoration for twinkle; smaller families
must not bypass that restriction or their element budgets.

`scanline(context, { key, orientation?, width?, height? })` produces a decorative
vertical beam translated horizontally, or a horizontal beam translated vertically.
Its base geometry and both translation endpoints stay within the declared local
bounds. It uses the compiler's stepped scan carrier, not a custom style encoder.

`plotterPath(context, { key, d, width?, height? })` accepts a bounded absolute M/L
polyline with 2–366 points, at most 24,000 input characters and at most 10,000 units
of measured length. Coordinates must be finite and inside the local bounds.
Relative commands, curves, close commands, malformed paths and zero-length traces
are rejected. The path is canonicalized before interpolation into SVG. A complete
22%-opacity trace remains outside the animated bright stroke. Thus the untraced
future is visible while plotting, and removing motion restores finished geometry.

`signalPulse(context, { key, state, width?, height? })` accepts pending, passing,
failing, unavailable, unconfigured or stale. Only a pending lamp pulses. Its
literal state label is always outside the animated wrapper. Unknown-data states
use neutral, unlit dashed lamps with no IDs, classes or animation applications.
They never borrow passing/failing/pending signal ink.

## One compiler, explicit limits

`compileFieldPrimitives(context, recipes, { target, applications? })` may also
include ordinary reading entrances in the same plan. The caller renders those
extra bindings using the returned motion object. Field targets are reserved to
preserve the factory's state semantics. A scene can compile only once; calling
this helper after another scene motion plan is an error.

None and subtle retain static field geometry without ambient texture applications.
Ambient and cinematic request the existing compiler's encodings. Per-scene byte,
animated-element and loop-group budgets remain enforced across all recipes. A
96-particle field exhausts the scene animated-element budget: adding a beam or
pulse fails instead of silently omitting evidence or raising the budget.

CSS output retains the compiler's reduced-motion override. SMIL still requires a
separate none twin for reduced motion. README loops retain the compiler's bounded
45-second interval and remove behavior. These are implementation contracts, not a
new claim that GitHub/Camo/WebKit compatibility has been measured. No production
scene or hosted backend selection changes in this increment.

## Verification

`packages/svg/tests/field.test.mjs` exercises the real scene boundary and shared
scene-contract harness. It checks deterministic seeds, particle caps and bounds,
all themes/profiles, both encoders, complete dim traces, pending-only pulses,
neutral unknown states, namespacing, compound budgets, independent placement and
reading entrances. The local focused suite passed 94 tests after isolated
transpilation. Full repository validation is the published head's Actions gate.
