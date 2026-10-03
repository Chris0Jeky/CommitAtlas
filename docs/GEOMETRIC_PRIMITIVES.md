# Survey geometric primitives

The additive `@commit-atlas/svg/primitives/geometric` entrypoint exports `orbit`,
`radar`, `terrain`, `timeline`, `projectNode`, `sparkline` and `DNA_AXES`. All return
static SVG fragments. Existing root and structural exports are unchanged. The
scene supplies an accessible SVG root, its frame, reading labels and any motion.

```ts
import { radar, terrain, DNA_AXES } from "@commit-atlas/svg/primitives/geometric";
const context = { theme: "paper", pack: "survey" } as const;
const radarFragment = radar(context, {
  axes: DNA_AXES, values: [0.2, 0.7, 0.4, 0.9, 0.3, 0.5], width: 320, height: 180,
});
const terrainFragment = terrain(context, {
  series: [0, 2, 4, 0, 0, 8, 3], peaks: [{ index: 5, label: "Synthetic release" }],
});
```

## Numeric and semantic boundary

Default local bounds are 320 by 180. Finite dimensions clamp to width 160–1600
and height 96–1000. A non-finite dimension throws because no safe viewport can be
inferred. Finite readings clamp to their documented domain and print GEOMETRY
CLAMPED when clipping occurs. NaN and infinities render neutral UNAVAILABLE
geometry; they never become zero readings. Structural errors (wrong types,
sparse arrays, impossible indices, unsupported themes/packs, oversized arrays)
throw rather than silently dropping entries. No network, clock, random state,
caller-supplied ink, IDs, classes or animation hooks are introduced.

The visible coordinates stay inside the local bounds. Text is truncated on a
conservative code-point budget; accessible fragment titles retain full escaped
labels. Supplied labels must contain 1–160 UTF-16 code units. Scene composition
still owns meaningful readings, units, layout between fragments and accessibility
at the SVG root. These are geometry mappings, not additional observed evidence.

## APIs

`orbit(context, { rings, bodies, width?, height? })` accepts at most eight radius
fractions in 0..1 and twelve bodies. A body names a zero-based ring index, an angle
in degrees (wrapped modulo 360), a radius `size` in 2..12 pixels (default 4), and
an optional label. Empty rings or non-finite readings are unavailable.

`radar(context, { axes, values, width?, height? })` accepts 3..8 unique axis labels
and exactly one value in 0..1 per axis. Generic axes retain input order. The full
six-key DNA set is reordered with its values to focus, shipping, collaboration,
consistency, breadth, stewardship, irrespective of input order. This maps supplied
values, not a score calculated by CommitAtlas.

`terrain(context, { series, peaks?, label?, width?, height? })` accepts at most
366 nonnegative samples clamped to 1,000,000,000 and at most twelve index/label
markers. Four contour traces use a three-sample mean for positive samples;
observed zero runs remain flat. An all-zero series, including one sample, draws
a visible basin labelled NO OBSERVED ACTIVITY IN WINDOW. An empty series is
unavailable. Markers must reference real sample indices; the caller decides
whether the marker's evidence falls inside the observed window.

`timeline(context, { stations, position?, width?, height? })` accepts at most
twelve declared labels, evenly spaced. Optional position is a normalized 0..1
location. It is not inferred time, release history or lifecycle. No stations is
unavailable; a single station is centered. Full labels remain in the title.

`projectNode(context, { label, disclosure, language?, size, state?, width?, height? })`
uses normalized size 0..1. Public and synthetic nodes have solid outlines;
private-alias and masked-alias nodes have dashed outlines and explicit disclosure
text. Optional language selects a deterministic theme palette index. Unknown
state/size uses neutral unavailable geometry without language ink. Disclosure is
presentation only, not authorization to publish a private label. Real-data
validation and owner review remain upstream responsibilities.

`sparkline(context, { series, label?, width?, height? })` accepts at most 366
nonnegative samples clamped to 1,000,000,000. It draws a direct trace with a
terminal marker, including one-sample input. A zero series is visibly labelled;
an empty or non-finite series is unavailable.

## Verification

`packages/svg/tests/geometric.test.mjs` covers all six primitives across four
themes, deterministic golden digests, bounded coordinates, hostile text, sparse
arrays, extreme finite inputs, non-finite readings, canonical DNA order and
minimum/fractional/dense viewports. Fixtures are synthetic and inspectable in
`geometric.fixture.mjs`; the checked-in per-theme SHA-256 snapshot file detects
unreviewed geometry drift. The runtime suite runs in `npm run test:svg`.

The continuation's local focused check passed 78 tests after isolated TypeScript
transpilation, and its four-theme CairoSVG contact sheet was visually inspected.
That is not a full typecheck or browser/Camo evidence. The exact published head's
complete repository gate remains required. No production scene was registered,
no static artifact list changed, and no browser compatibility gate was relaxed.
