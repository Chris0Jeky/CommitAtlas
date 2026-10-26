# Appearance and interaction quality — 2026-10-26

## Goal and evidence

Give the existing visual work enough room to read, make preview controls stable and
clear, and introduce the first bounded C0 Signature composition. The owner requested
an appearance-focused development pass and delegated design choices and safe merges.

Baseline: main `05fb0497a2cd5145f49c9b7e86faf2993dfd01cc`. A live Gallery capture
shows four narrow columns with eight metadata rows preceding small SVGs. On the live
Studio, pressing Enter on Developer atlas / Replay leaves `document.activeElement`
at `BODY`: the image-attempt key currently remounts its toolbar too.

## Adopted design

Stay within the survey grid, mono chrome, corner treatment, four chassis themes and
temperature palette. The Gallery becomes a specimen catalogue: strong page hierarchy,
family index, substantial artwork stage, compact semantic metadata, truthful destination
labels and explicit synthetic/state words. Keep the existing SVGs still. Motion on
interactive chrome is brief, restrained and removable through reduced-motion preference.

Studio keeps its article and toolbar mounted while only the image request subtree
restarts. Selected view receives a surface treatment; focus retains its own ring. Use
44px controls, explain the still twins, reduce nested mobile padding and reserve modest
loading space without pretending every image has the same aspect ratio. Count cards and
scenes together where they share a preview gallery.

Developer Signature uses a large six-axis radar with an asymmetric archetype and readings
panel. Exact readings, the two strongest axes and complete Lens disclosures are visible
from the first frame. Only decorative calibration/overdraw may animate. It is C0-only,
`survey`, `none | ambient`, static/Action first, and a separate feature PR. Prefer this
bounded composition before Constellation: the latter needs a new selector and a deliberate
change to the current 20-second primitive-duration limit.

## Delivery plan

1. **Gallery / isolated worktree.** Change `app/gallery/page.tsx`, its CSS and presentation
   metadata; keep registry coverage, provenance, rungs, states, SVG strings and destinations.
   Update semantic HTML assertions and destination tests where behavior changes.
2. **Studio / isolated worktree.** Reproduce local-button focus loss in the existing browser
   harness, fix component lifetime, and verify Enter/Space focus through loading and decoded
   completion. Apply control and workspace polish without changing receipt identity or copy
   approval. Run focused Studio, type and lint checks.
3. **Integration / PR #448.** Combine the independent presentation changes. Remove the
   temporary source-export workflow. Inspect desktop/mobile, dark/light and reduced-motion
   output; run built-product and full repository gates. Review the exact diff independently,
   publish through GitHub-native objects, and merge only the verified head.
4. **Signature / separate worktree and PR.** Add the scene, registry, full-projection safety
   coverage and static paired outputs. Classify signature-family Gallery items as derived.
   Verify canonical tuple rejection, missing/legacy/expired unavailable states, full text
   retention, deterministic bytes, theme/width text bounds and actual CSS/SMIL image playback.
   Rebuild the tracked Action bundle and run the full gate before merge.
5. **Receipts and deployment.** Record exact-head CI and measured browser evidence, update
   issue scope and current project inventory, and verify deployed pages after safe merges.

## Boundaries

- Unknown, stale and unavailable data never become healthy-looking readings.
- The September 1 showcase timestamp remains unchanged; current demo output is stale.
- Q-9 remains No: no C1 publication, owner-profile adoption or public projection input.
- Gallery presentation does not alter card motion defaults or bypass #113 for #126/#127.
- A still twin is neither a live animation pause nor a captured exact frame zero.
- Direct browser evidence is not a GitHub/Camo transport claim. #141 remains open for
  its remaining production/README acceptance unless separately established.
- No new production dependency, arbitrary styling input or motion-compiler budget expansion.

## Acceptance evidence

Use meaningful behavior and contract tests, not CSS implementation mirrors. Review at
least one wide map and compact instrument in the Gallery, a card and scene in Studio,
keyboard selected/focus states, 390px layout, a dark theme and Limestone. For Signature,
measure both layouts and all four renderer themes, maximum disclosure text, and moving,
still, stale and expired controls. Keep requested capture times distinct from actual
observations. Record exact tested source identity and remaining limitations in the final
receipts; passing source tests alone do not establish appearance or playback quality.
