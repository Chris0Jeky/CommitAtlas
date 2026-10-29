# Identity Beacon browser qualification

The clarified static-scene acceptance for [#134](https://github.com/Chris0Jeky/CommitAtlas/issues/134)
is qualified by the clean-source browser receipt below and the static configuration regressions.
The scope is synthetic text geometry and direct SVG-image playback. GitHub raw/Camo, profile
adoption, hosted identity inputs and a final motion backend remain separate decisions and checks.

## Clean-source hosted receipt

[Run 40272735298](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40272735298) at
`9f44d15c66ea50dc9a7629fc7a4f0a90aad40434` passed with Playwright 1.57.0 and its explicitly selected
Chromium 143.0.7499.4 binary. The source checkout was clean and no private fontconfig override
was active. All **864 geometry cases** passed, including 288 adaptive wide-layout cases; the
maximum frame height was 974px. All **20 playback rows** passed: eight ambient/cinematic rows
changed pixels, while twelve none/stale/picture-none controls stayed unchanged. The wide timed
rows include the mixed emoji/Latin label that exposed the earlier body-slot defect.

The [tracked receipt](../tests/fixtures/identity-beacon/evidence/2026-10-26-browser.json) retains
all 14 recorded source hashes, frame times, pixel differences and media hashes. Independent
verification rechecked the complete geometry matrix, all 60 PNG hashes and dimensions, 44 decoded
pixel comparisons, and all 20 WebM hashes, sizes and magic bytes. The source and still SVG hashes
also match the independently reviewed controlled local run. Actual frame-completion lateness
was at most 292.1ms; requested zero is still not an exact animation-frame-zero observation.
WebM container duration was not parsed, so only the recorded capture interval and file integrity
are claimed.

The [quality gate on the same code head](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40272741155)
passed 2,029 tests with no failures or skips, including 671 SVG and 356 static tests, and verified
the rebuilt Action against its committed bundle. Production dependency auditing found zero
vulnerabilities. Its actual tested merge `edf1d504de6aee3b62d71c4a89be00ce3f0d7336` has parents
`20bb165bc10bd3a707ab1f3e6370036a049df724` and the code head above, with the same
`830a414b2360b6821da704b4570ff0a406e9befe` tree.

The raw artifact is `12628053870`, ZIP SHA-256
`6c85bc09153de1efa767b10545bbb67a142de51d992b7a348f62a2f62a6b4dde`; its report SHA-256 is
`35bc0d070ecfd93bf158fbfb85688ef69279f9ee19a47d52157a04a6c99ee703`.
Actions retains raw captures until November 9, 2026; the compact receipt is committed. The earlier
failed clean run remains recorded below and is not relabelled as passing.

## Measured defects and bounded repair

The previous compact `480x520` output placed the third matched project's disclosure label at a
bottom coordinate of `531px`. Its provenance line extended to `546.2px` and collided with the
OBSERVED badge; unmatched focus labels also collided with that line. A valid 80-character `W`
tagline ended at `1289.8px` in both the 480px and 860px layouts. These are browser-measured text
boxes at exactly one CSS pixel per source unit, rather than character-count estimates.

The repair uses the shared frame title's bounded clipping described below and prints the complete main name
in readable 28px wrapped lines. The complete tagline wraps at 16px; nearby word boundaries are
preferred without permitting an unbounded number of short lines. Every matched focus entry
retains its project body and full label. Compact output uses one 432px column; wide output normally
uses three 260px columns with 244px label slots, or two 398px columns when the bounded label's
fallback-aware advance needs more space. The grid and body region follow the identity lines,
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

The current geometry matrix has **864 cases**: four themes, intended source/display widths of 480
and 860px, nine text fixtures, three font settings and four focus arrangements. The fixtures cover
maximum `W`, CJK, astral and BMP emoji lengths, the exact mixed 13-watch/11-W label counterexample,
and spaces near the wrap threshold, including emoji spaces that exercise four-line lookahead.
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

The initial local qualification in Chromium **141.0.7390.37**, driven by Playwright **1.57.0**, passed all
576 geometry cases and all 20 playback rows. Ambient and cinematic rows changed pixels; none,
stale and picture/none-twin controls remained identical. Every reduced picture selected the
hashed `none` source and matched the corresponding still output. Each row has three PNGs and
one WebM; the report verifies video magic, bytes and SHA-256, not parsed container duration.
The [local receipt](../tests/fixtures/identity-beacon/evidence/2026-10-26-local-browser.json)
preserves per-source hashes, actual frame timing, pixel differences and artifact hashes. It
records a dirty development checkout and is not relabelled as clean published-source evidence.
That initial local font environment did not cover the wider fallback exposed by the rejected
clean run below.

## Rejected clean fallback run and bounded follow-up

[Run 40270510543](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40270510543), at source
`92fa040`, used the pinned driver's Chromium 143.0.7499.4 and rejected **32 of 576** layouts before
any playback. Under its serif/monospace emoji fallback, a compact shared 22px header reached
`569.541px`, the main 28px name line reached `513.165px`, and the 16px tagline reached `523.119px`
inside a 480px plate. The [failed-run receipt](../tests/fixtures/identity-beacon/evidence/2026-10-26-hosted-fallback-failure.json)
preserves the exact source, artifact/report hashes, failing identities and original assertions.
This failed run supplies no playback or issue-complete claim.

The shared frame title/ref now reserve two cells for non-ASCII fallback and use an ellipsis;
their full text remains in the accessible title. ASCII header output is unchanged. Main identity
text remains complete at 28px/16px: the observed Ubuntu emoji advance of about 1.25em uses a 1.3em
allowance, while ordinary/CJK characters keep 1.05em. This is a margin for the exercised fonts,
not a universal font guarantee. Soft breaks are accepted only if hard-wrap lookahead can still
fit all remaining text in at most four lines. No line-four overflow, text dropping or smaller
font is used. Body-column selection also reserves 1.05em for ASCII, since the exact mixed
13-BMP-emoji/11-W label painted wider than the original 260px slot under serif fallback.
The oracle derives slot widths from emitted primitive geometry, rather than assuming the
renderer chose a particular column count. Wide timed rows exercise the adaptive mixed-label slot.

A private, charset-specific fontconfig setup with Ubuntu's `fonts-noto-color-emoji` 2.047 package
reproduced all three original overflow bounds exactly. The local controlled follow-up then passed
**864 geometry cases and all 20 playback rows**, retaining the 974px maximum and both 260px/398px
wide slots. The [controlled local receipt](../tests/fixtures/identity-beacon/evidence/2026-10-26-local-browser-fallback.json)
records source hashes, exact package/font/fontconfig hashes, actual frame timing and artifact
hashes. Raw sidecars retain the font package, TTF, charset-specific config, license and provenance
for reconstruction; no system font or generated SVG webfont was installed. An earlier overly
broad private alias produced CJK missing-glyph artifacts and is explicitly recorded as a rejected
misconfigured probe, not a production CJK finding or a passing qualification.

The dedicated `Identity Beacon browser evidence` workflow repeats this oracle using the pinned
driver's own Chromium. Its narrow renderer/harness/workflow path filter avoids rerunning captures
for a documentation or receipt-only commit. It uploads the raw report, source SVGs, layout samples,
60 PNGs and 20 WebMs for 14 days. No repository Playwright dependency is introduced.

## Static configuration acceptance

The static adapter matches focus strings to configured project labels by associating each
observed project with its complete, canonically parsed repository identity. It copies only the
Beacon input; shared card and other scene inputs retain their original names and bytes. Literal
focus text remains case-sensitive. A selected duplicate label is rejected as ambiguous at config
parse and programmatic render, while duplicate labels outside the focus remain valid. Unknown,
duplicate or malformed observed repository identities produce an unavailable Beacon instead of
borrowing counts from a coincidentally matching display name or repository basename.

The static regressions exercise tracked configuration through `generateStatic` with normal-shaped
mock GitHub responses. They keep the fetched name `atlas` and prove that a configured `Atlas Friendly`
focus becomes a body without manually renaming the snapshot. They also cover reordered repositories,
foreign owners with the same basename, unchanged caller/card/other-scene data, and matched labels
containing markup. The injection case preserves the escaped literal, observed 2/8 counts and the
project board's independent timestamp/source. This adapter evidence is separate from the synthetic
direct-image browser matrix; both are needed for the static scene's acceptance.

## Partial public observations

A current public project board can be partial when an optional CI or latest-release lookup is
unavailable even though GitHub supplied valid repository metadata and open-issue/PR counts.
Beacon retains those observed counts when either the root or the board has public `partial`
freshness. It prints `PARTIAL SNAPSHOT · ISSUE/PR COUNTS OBSERVED` in the reserved footer and
explains in its accessible description that CI and release health are not represented. Other
cards, Coverage, catalog records and the original snapshot keep their independent health states.
An observed empty board or entirely unmatched focus list instead says `PARTIAL SNAPSHOT · NO
MATCHED COUNTS`, with the same distinction in its accessible description.

This does not relax the provenance or reading boundary: root and board still require known,
consistent public sources and canonical UTC dates; board observations must remain within the
existing 72-hour age and 60-second forward-skew bounds of the snapshot clock. Stale or unavailable
observations, malformed counts and synthetic/public mode mismatches remain unavailable, with no
observed badge or motion. Complete live and valid synthetic output retains its existing bytes.

The source regressions exercise both partial inputs and the unchanged rejection boundaries.
Mock public GitHub responses pass through the real client and assembly paths, and the executed
Action covers both an unavailable CI lookup and an unavailable release lookup. Both themes retain
the identity, counted bodies, partial disclosure and integrity-checked `none` companions. This
extends the source and bundled-delivery contract; the earlier synthetic browser receipt above
does not qualify the new partial footer or real-profile transport.

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
