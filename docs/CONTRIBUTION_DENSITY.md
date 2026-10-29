# Contribution density and profile motion

## Calendar and history are separate

Atlas and Activity show observations within the latest **365-day civil-date window**. A longer fetched history does
not create additional calendar columns. Weekday alignment follows the dates; missing observations
are not invented as zeroes and the printed final date is the last observed date.

The Atlas header explicitly identifies its observed-history window. History totals, contribution
categories, current streak and longest observed streak use that full window. The calendar's own
date range, total, active days, density, daily average and peak are derived from the displayed
subset. With `days: "auto"`, the existing public source can supply up to two years; this is an
observed-window streak, not an all-time claim. A 730-day streak can therefore appear beside a
365-day calendar.

## Absolute daily tiers

| Daily contributions | Palette | Cell geometry |
| --- | --- | --- |
| 0 | Neutral socket | Square |
| 1–200 | Copper, four ordered shades | Square |
| 201–700 | Gold, four ordered shades | One cut corner |
| 701–1500 | Violet, four ordered shades | Two cut corners |
| 1501 and above | High-contrast ivory on dark cards; dark ink on paper | Spark, diamond, crest, comet, crown or bolt |

The darkest/brightest direction follows the background: increasing counts become brighter on
dark cards and darker on paper. The key prints the numeric boundaries, and shapes distinguish
tiers when colour differences are difficult to see. Counts are GitHub **contributions**, which
can include several activity categories; they are not labelled as commits alone.

Special silhouettes are original vector paths selected by a deterministic hash of the ISO date.
They do not change on every refresh or introduce a dependency on emoji fonts, image servers or
random generation. The variation within the special tier is decorative. Invalid, negative,
fractional or unsafe counts are never promoted into a high tier.

Paths are batched by band/shade/glyph so even a complete year of special days fits the instrument
budget of fewer than 30,000 UTF-8 bytes. Exact daily values live in the SVG description; the
calendar remains one image when embedded in a GitHub README.

## Visible ambient motion

`motion: "ambient"` gives Atlas three independently bounded decorative groups: a seven-second
beam across the header separator, a stepped scan in the calendar's column gaps and a rotating
compass ornament. Activity uses the scan and ornament. Text, dates, contribution cells and status
readings remain fixed and complete. `subtle` retains the short entrance behavior; `none` is still.

Both CSS and SMIL are supported by the renderer's `motionBackend` option. Hosted/profile output
defaults to SMIL and consequently needs no inline stylesheet permission. Card response metadata
counts the actual compiled groups, so Studio can display real motion counters. Public README
animation ends after 45 seconds and returns to the same base image as the `none` rendering.
Stale, unavailable, empty and entirely zero-count calendar inputs do not animate.

The density browser harness measures 64 synthetic layouts across themes, widths and calendar
shapes, then captures CSS/SMIL image playback, still/stale controls and reduced-motion picture
selection at requested 0, 1.5, 6 and 46 seconds. The first observation is load-relative, not a
claim of exact animation frame zero. Structural motion stripping separately proves base geometry.
The separate #113 raw/Camo/browser transport matrix remains outside this harness's scope.

## Static generation and reduced motion

Use these fields in `.commitatlas.json` alongside the existing user/project configuration:

```json
{
  "days": "auto",
  "motion": "ambient",
  "responsiveAtlas": true,
  "reducedMotion": true
}
```

The opt-in `reducedMotion` field adds `atlas-still.svg`, the selected responsive companion
(`atlas-compact-still.svg` or `atlas-wide-still.svg`) and `activity-still.svg` when those cards are
selected. Both colour schemes derive every artifact from the same snapshot and include the still
files' sizes and SHA-256 hashes in their manifests. Existing configurations keep their artifact
lists unchanged until they opt in.

Put reduced-motion `<source>` elements before animated ones, ordering combined light/compact
conditions ahead of broad reduced-motion conditions. Keep a direct still-image link for readers
whose embedding environment does not preserve media sources. The owner's profile consumer also
validates the complete expected manifest before committing anything.

## Keeping a profile current

The owner's profile renders committed artifacts. An upstream GitHub fetch failure preserves the
previous committed snapshot; it does not make that old snapshot current. Check the printed date,
manifest `generatedAt` and refresh workflow together.

The consumer refreshes on its twelve-hour schedule and on merged changes to its configuration or
refresh workflow. It no longer depends on public PushEvents, which are an incomplete basis for
calendar freshness. Asset-only bot commits do not trigger another refresh. The Action stays pinned
to a verified immutable producer commit. Public-calendar backend failures retain a classified error code
and numeric upstream HTTP status without including response bodies or credentials.
