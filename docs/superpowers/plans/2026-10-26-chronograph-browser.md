# Chronograph release bounds and browser evidence

**Goal:** Complete issue #344's remaining layout and playback evidence without changing the hosted allowlist or the separate #113 transport qualification.

## Design

Keep the shipped 666/4662/19980 ms ring periods, 45-second README stopping policy, truthful stationary needle, provenance gates and numbered release markers. Bound each release legend's painted advance explicitly, with a conservative two-cell allowance for non-ASCII glyphs so fallback emoji fonts do not squeeze many wide glyphs into the dial. Full bounded tags remain in the accessible description.

The reproduced counterexample uses six same-instant releases, all-zero activity and 39 emoji code points per tag. Chromium 141.0.7390.37 paints the compact legend to x=205.75 despite its reserved edge at x=146.7. Near the left side of the dial the legend overlaps numbered markers. Ordinary ASCII controls fit. Measurements use each layout's actual viewBox size.

## Work and acceptance

- [x] Preserve the counterexample in focused regressions before changing rendering.
- [x] Bound legend advance and retain one row and one marker for every independently observed release.
- [x] Measure actual browser text boxes across every theme, both layouts, wide glyphs and coincident/near-coincident release positions.
- [x] Capture real CSS and SMIL playback as SVG images, including still/stale controls and the 45-second return to base geometry. Record elapsed load-relative times and decoded pixel differences; structural tests alone cannot satisfy playback acceptance.
- [x] Retain complete-calendar, release/provenance and frame-zero regressions, rebuild the Action and pass full CI at the PR head.
- [x] Document exact source/browser/artifact provenance and the distinction from GitHub raw/Camo evidence.

Browser tooling is supplied outside repository dependencies. This does not resolve or bypass the separately parked #115 dependency decision.
