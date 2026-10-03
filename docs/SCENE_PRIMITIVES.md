# Structural scene primitives

The survey-pack chassis is available through the additive
`@commit-atlas/svg/primitives` entrypoint. Existing card exports and the production
scene registry are unchanged. These are fragments, not standalone accessible cards.

```ts
import { frame, metric, badge, evidenceLabel, coverageBar } from "@commit-atlas/svg/primitives";

const context = { theme: "paper", pack: "survey", layout: "wide" } as const;
const fragments = [
  frame(context, { title: "Synthetic survey", ref: "01", family: "scene" }),
  metric(context, { label: "Observed commits", value: 0, x: 24, y: 90 }),
  badge(context, { label: "Synthetic example", x: 360, y: 90 }),
  evidenceLabel(context, "observed", { x: 24, y: 180 }),
  coverageBar(context, { state: "partial", observed: 4, total: 12 }, { x: 24, y: 230 }),
].join("");
// A registered scene supplies the SVG root and meaningful accessibility text,
// then inserts these fragments inside its finished base geometry.
```

A full `RenderContext` is accepted. For isolated composition, only `theme` is
required; omitted pack/layout mean survey/wide. Other packs are intentionally
rejected until #156. Every theme, ink role, system-font stack, and XML text escape
comes from the existing SVG vocabulary, not caller-supplied colours or markup.

## Reading and evidence semantics

`frame` draws an opaque corner-cut plate, family stamp, reference, title and
optional static stale strip. Families are instrument, map, signature, scene, and
finding. Signatures also display “not a productivity score”. The default size is
720 by 320, or 480 by 320 for compact layout. Width is bounded to 320–1600 and
height to 140–1000. Reserve the header above y=74 and the bottom 36 pixels when
using the stale strip or signature disclaimer.

`metric` renders a supplied reading, not a derived score. Numeric zero remains
zero. Null produces a neutral UNAVAILABLE reading without its unit. Non-finite
numbers and unsupported value types are rejected. A derived reading's formula,
coverage and limitations remain the scene's responsibility.

`badge` is a neutral annotation, not a health assessment. Long visible labels are
truncated while a nested title retains their full escaped text. All supplied
text is bounded to 160 UTF-16 code units; shared XML escaping also replaces
characters forbidden by XML 1.0. Primitives do not fetch fonts or other resources.

`evidenceLabel` uses three redundant channels: OBSERVED with a solid dot and
single border, DERIVED with a half-filled dot and double border, HYPOTHESIS with
an empty dashed dot and dashed border. All three use the same neutral ink, so
neither colour nor animation is required to distinguish the rungs.

`coverageBar` accepts complete or partial observations with integer counts
`0 <= observed <= total <= 1,000,000` and `total >= 1`. Complete requires equal
counts; partial requires fewer observations. Unavailable and not-observed states
must contain no counts. Unavailable uses a static NO SIGNAL plate and flatline;
not-observed uses a dashed socket. Neither borrows signal ink or represents zero
as an observation. An empty expected population must be modelled explicitly by
the scene rather than passed as a misleading 0/0 complete fraction.

## Composition and verification

Fragments contain no IDs, classes, style blocks, or animation hooks. They are
byte-identical regardless of motion profile; unavailable indicators must remain
outside animated wrappers. Scenes own spacing, root title/description, and any
allowed decorative motion on separate wrappers. Primitive translation is bounded
to ±4096; dimensions and counts are validated before geometry is emitted.

`packages/svg/tests/primitives.test.mjs` verifies all four themes with the shared
scene XML scanner and injection fixture, greyscale evidence structure, neutral
unknown states, zero/null distinctions, bounds and contrast floors. Body ink is
at least 7:1 and small-text ink at least 4.5:1 on both chassis surfaces. Run
`npm run typecheck && npm run lint && npm run test:svg` for the issue gate.
This foundation does not ship a scene, change static artifact lists, or establish
browser/Camo motion evidence.
