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
alter that allowlist. Timed browser captures are still absent, so issue 344 stays open.
