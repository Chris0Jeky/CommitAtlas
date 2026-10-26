# Chronograph evidence boundary

The chronograph consumes a complete, unique UTC contribution calendar and the supplied
streak model. It never fills missing dates with zeros or substitutes contribution counts
for an unavailable streak. Supported calendars include the existing 730-day explicit and
731-day automatic bounds. The final declared date cannot be later than the contribution
observation date.

## Provenance and stale output

Root and contribution freshness require a known source, known mode and valid UTC timestamp.
Unknown, missing, mixed public/synthetic or partially observed calendar provenance renders
an explicit unavailable plate. The image prints synthetic/public status, source, observation
time and the exact date window. Stale evidence remains labelled and still in both CSS and
SMIL; it does not receive an OBSERVED badge. A zero-streak needle rests at -90 degrees in
neutral ink rather than displaying a lit zero reading.

Project release evidence is separately qualified. Stale, unavailable or unrecognized board
provenance cannot authorize release ticks. Valid independent releases on a partial board
remain visible, with a blocked-signal indication for failed/contradictory entries. A
publication timestamp must describe an actual UTC calendar instant no later than the
project-board observation. A `none` state accompanied by a release is contradictory, not
confirmed absence. Releases outside the declared calendar are omitted only after their
record has been validated.

Release ticks show only the latest published release per configured project, not complete
release history. Long rim labels are bounded inside the compact plate; their bounded full
text remains in the accessible description. Coincident releases keep separate numbered
rim markers and legend rows, so labels that share a timestamp no longer sit on one anchor.

## Scope of the October 8 repair

The first 33-case regression pass against main 826c5f0 had 21 failures and 12 controls.
Additional tests cover long rim labels, the contribution observation-date boundary and
mixed provenance. Thirty-six focused tests pass after repair, with existing full-calendar
and frame-zero tests retained. A local CairoSVG static review covers four themes, both
layouts and fresh/stale/blocked/zero states. It is not timed-browser or Camo evidence.

This repair does not claim the complete #136 motion brief. The slow clock is the slowest
exact integer 1:7:30 triple that fits the compiler's 60..20000 ms range: 666 ms, 4662 ms
and 19980 ms (SMIL 0.666s, 4.662s and 19.98s). That triple replaces the earlier
0.6/4.2/18-second periods. The M2 needle-settle sequence is deliberately not implemented:
the rotate primitive always runs 0 to 360 and replaces transform, so animating the needle
would show a false reading at frame zero. The needle stays on the true streak angle and
has no animation child. Coincident release labels already ship as separate numbered rim
markers and legend rows. The hosted catalogue includes chronograph; this change does not
alter that allowlist. The October 26 qualification below supplies the remaining local-browser
text and playback evidence; it does not qualify the separate #113 raw/Camo matrix.


## Unicode release bounds and browser qualification, October 26

A real-browser counterexample exposed a gap in the earlier character-count estimate. With
six coincident releases, all-zero activity and long emoji tags, Chromium 141.0.7390.37 painted
the compact legend through x=205.75 even though its reserved right edge is x=146.7. Tags
overlapped numbered markers at left-side release positions. The equivalent wide layout also
overflowed. ASCII controls fit. This was measured at each layout's actual viewBox size.

Legend labels now reserve two monospace cells for non-ASCII characters, truncate visibly with
an ellipsis and set a bounded SVG text advance with `textLength`/`spacingAndGlyphs`. The
conservative allowance keeps wide fallback glyphs readable without crossing into the dial.
Every release retains its numbered marker and legend row; the original bounded tag stays in
the accessible description. The calendar, provenance, needle and ring timing contracts are
unchanged.

`tests/chronograph-browser.mjs` accepts an externally installed Playwright driver. It measures
actual text boxes for four themes, compact/wide layouts, Latin/CJK/emoji tags, twelve release
angles and coincident/one-minute-separated timestamps: 576 cases. It also loads six independent
SVG images for CSS/SMIL ambient, no-motion and stale states, records a continuous WebM for
each, and compares decoded pixels at requested 0/250/1000/5000/46000 ms offsets. Actual
start/end times are retained for every screenshot; the first captured image is not claimed
to be the exact animation frame zero. Existing canonical frame-zero regressions remain the
proof of the base reading.

Local qualification used Playwright 1.57.0 and Chromium 141.0.7390.37. All 576 measured layouts
fit without label/marker/footer collisions. Both ambient rows changed pixels during playback
and returned exactly to their no-motion control at 46 seconds. All four no-motion/stale
controls remained pixel-identical throughout. The six rows include five PNGs and one WebM
each. The local report records a dirty working tree and per-source-file hashes; it is
development evidence, not a claim about a published commit.

The `Chronograph browser evidence` workflow repeats this synthetic check with externally
pinned Playwright 1.57.0 and its Chromium binary, and uploads raw geometry, SVGs, PNGs, videos
and a source-bound report for 14 days. CI receipt and exact-head full-gate results must be
recorded before closing #344. No repository Playwright dependency, hosted scene expansion,
GitHub transport verdict or backend-default change is introduced.
