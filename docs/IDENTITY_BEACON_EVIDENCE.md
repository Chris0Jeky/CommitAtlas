# Identity Beacon browser qualification

This receipt advances [#134](https://github.com/Chris0Jeky/CommitAtlas/issues/134) with synthetic
local-browser geometry and direct SVG image playback. It does not qualify GitHub raw/Camo,
profile adoption, hosted identity inputs or a final motion backend. The clean-source hosted
repeat and repository integration gate remain the publication checks for this patch.

## Measured defects and bounded repair

The previous compact `480x520` output placed the third matched project's disclosure label at a
bottom coordinate of `531px`. Its provenance line extended to `546.2px` and collided with the
OBSERVED badge; unmatched focus labels also collided with that line. A valid 80-character `W`
tagline ended at `1289.8px` in both the 480px and 860px layouts. These are browser-measured text
boxes at exactly one CSS pixel per source unit, rather than character-count estimates.

The repair keeps the shared frame title's existing clipping and prints the complete main name
in readable 28px wrapped lines. The complete tagline wraps at 16px; nearby word boundaries are
preferred without permitting an unbounded number of short lines. Every matched focus entry
retains its project body and full label. Compact output uses one 432px column; wide output uses
three 260px columns with 244px label slots. The grid and body region follow the identity lines,
unmatched labels follow the bodies, and the measurement, independent board timestamp, source
and OBSERVED badge have separate footer rows. Body size still uses the supplied issue/PR counts
relative to the matched peak; an observed all-zero board retains available minimum-size bodies.

Height follows the actual number of identity lines, body rows and unmatched labels. No compiler,
primitive or motion budget was raised. The measured worst case is `974px`, below the existing
1000px frame limit. Breathing remains centered on each widened body, and acquisition rotates
around the field mark in its local coordinates.

Identity remains static-config only: name is limited to 40 UTF-16 units, tagline to 80, and focus
to three entries of at most 24 units. The project board may contain six configured projects.
Full bounded identity and focus values remain escaped in the title/description and displayed
regions. Missing identity and stale/invalid observations keep their existing explicit refusal
or unavailable behavior; no public input route or allowlist was added.

## Repeatable browser oracle

`tests/identity-beacon-browser.mjs` uses externally supplied Playwright 1.57.0. It explicitly
selects that driver's installed Chromium unless the task-specific
`IDENTITY_BEACON_BROWSER_EXECUTABLE` override is provided; ambient `CHROME_BIN` is ignored.
`IDENTITY_BEACON_QA_OUTPUT` must name a new absolute directory. Source commit, dirty-tree state,
renderer/registry/fixture/capture-helper hashes, exact browser/executable, SVG hashes and actual frame times are recorded.

The geometry matrix has **576 cases**: four themes, intended source/display widths of 480 and
860px, six text fixtures, three font settings and four focus arrangements. The fixtures cover
maximum `W`, CJK and emoji lengths plus spaces below, at and above the 75% wrap threshold.
Native fonts, serif substitution and monospace substitution are measured. Matched, mixed,
all-unmatched and all-zero configurations preserve their bodies and labels. Checks include the
shared frame title and reference, full name/tagline reconstruction, body-slot text bounds,
all text pairs, frame boundaries and the unchanged maximum height. An error writes its SVG and
screenshot and stops qualification before playback.

The playback matrix has **20 rows**: both layouts and both CSS/SMIL backends, each with ambient,
cinematic, none, stale and explicit reduced-motion picture/none-twin controls. Each row uses an
unmodified generated SVG in an actual image, a fresh context, requested load-relative offsets
of 0, 2 and 6 seconds, and continuous video. Actual screenshot start/end times are retained;
the requested zero is the earliest observation, **not exact animation frame zero**. Structural
motion stripping remains the proof that animated base geometry equals `none`.

Local qualification in Chromium **141.0.7390.37**, driven by Playwright **1.57.0**, passed all
576 geometry cases and all 20 playback rows. Ambient and cinematic rows changed pixels; none,
stale and picture/none-twin controls remained identical. Every reduced picture selected the
hashed `none` source and matched the corresponding still output. Each row has three PNGs and
one WebM; the report verifies video magic, bytes and SHA-256, not parsed container duration.
The [local receipt](../tests/fixtures/identity-beacon/evidence/2026-10-26-local-browser.json)
preserves per-source hashes, actual frame timing, pixel differences and artifact hashes. It
records a dirty development checkout and is not relabelled as clean published-source evidence.

The dedicated `Identity Beacon browser evidence` workflow repeats this oracle using the pinned
driver's own Chromium. Its narrow renderer/harness/workflow path filter avoids rerunning captures
for a documentation or receipt-only commit. It uploads the raw report, source SVGs, layout samples,
60 PNGs and 20 WebMs for 14 days. No repository Playwright dependency is introduced.

## Existing motion semantics and reduced-motion limit

This repair preserves the current cinematic implementation: acquisition and body entrances are
one-shot; the delayed survey beam has a 12-second loop. It does not introduce a repeating whole
acquisition/entry sequence. The existing `github-readme` compiler target bounds looping motion to
45 seconds and removes the animation's contribution at rest. This run samples through six seconds;
it does not add a separate 45-second termination capture or claim to verify the complete loop.

Plain CSS SVG images under local Playwright `reducedMotion: reduce` remain **unqualified**.
An independent synthetic probe in the same Chromium 141 environment found the parent media query
and inline SVG in reduced mode, with disabled inline Beacon animation and zero pixel changes.
The identical tiny red/green media-query SVG painted its no-preference red state in both data-URL
and loopback-HTTP images, which continued animating; Beacon images also changed. This isolates a
local image-media emulation boundary, rather than demonstrating a compiler rule defect or native
OS preference behavior. The probe's source/report hashes and scope are retained in the local
receipt. No compiler/default change was made. The qualifying reduced controls explicitly select
the static `none` twin through `<picture>` in both backends; they are not labelled as passing
direct-CSS media-query tests. Any hosted pinned-browser result qualifies only the rows it exercises.
