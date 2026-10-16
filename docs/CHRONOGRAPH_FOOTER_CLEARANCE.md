# Chronograph stale footer clearance

Follow-up to #337. The renderer correction already landed in #340; this change adds regression coverage rather than claiming a new runtime fix.

At main `290f4d801ccb7a2040d453791c3cff6f597b125a`, the 480-unit-high SVG has footer baselines at 396, 412 and 428, a stale divider at 444 and the stale label at 464. The 12-unit reading font has a conservative 30% descender allowance plus an eight-unit clearance requirement. The label has its own top/bottom allowance. These structural bounds are not measured glyph bounds or browser playback evidence.

`packages/svg/tests/chronograph-footer.test.mjs` covers four themes, both layouts, public/synthetic sources, and root/contribution stale modes. Each case renders CSS/SMIL under none/subtle/ambient and requires the stale output to remain still without an OBSERVED badge. It verifies all three footer readings remain present and in root coordinates. A deliberately overlapping counterexample moves the last footer reading onto the divider and must fail the oracle.

The new test is included in the package's explicit normal test list. Local validation passed 33 new tests and the 36 existing chronograph tests, including the overlap counterexample. Exact-head full CI remains the merge gate.

The slow clock is now the 666/4662/19980 ms triple. Coincident release labels were already shipped. The needle stays on its true angle: a settle animation would replace the transform and show a false reading at frame zero. Timed browser captures are still absent, so issue 344 stays open. Neither slice changes the hosted allowlist. The hosted catalogue includes chronograph.
