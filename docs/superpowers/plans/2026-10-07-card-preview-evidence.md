# Card preview evidence implementation plan

**Goal:** Finish #141's existing-card image tools without changing the renderer's artwork,
public collection scope, static defaults or README animation claims.

**Architecture:** Keep the existing scene wire receipt intact. Add a separate closed card
receipt, measured against the exact existing card stylesheet and actual unique targets.
Reuse the bounded response loader and decoded-image lifecycle for both image families.
Only a current, decoded profile image may approve its canonical Markdown URL. An Atlas
preview must display the selected layout, not approve an unseen responsive alternative.

**Spec:** Issue #141 and docs/STUDIO_SCENE_PREVIEWS.md. Existing card `ambient` is currently
an entrance-only compatibility profile; this work must not claim or introduce looping motion.

## Tasks

- [ ] Red route/Markdown/URL tests: all eight images, every profile, matching UTF-8 bytes,
      304, stale/unknown evidence, invalid receipts, unique targets and unchanged SVG bytes.
- [ ] Implement additive card measurement and response metadata. Preserve public caching,
      canonical redirects, CSP, body bytes and collection count. Metadata is not telemetry.
- [ ] Share bounded SVG loading and image lifecycle, with per-image/global controls,
      independent approval revocation, decode deadline, disposal and stale-attempt protection.
- [ ] Wire card approval to Markdown. Retained/failed JSON configurations remain uncopyable;
      deselect/reselect and repeat Preview cannot recycle a removed image's receipt.
- [ ] Prove focused, full locked gate and generated Action parity. Publish a draft, review
      the exact diff, then run built-Worker browser fault/keyboard/layout checks.
- [ ] Merge only qualified source; retain production verification and remaining README/Camo
      limitations. Keep #141 open until its separate acceptance surfaces are actually proven.

## Review focus

Failure after fetch but before image decode, late callbacks after replacement, equivalent
still URLs under different view choices, stale fallback headers, and Atlas layout selection
must not become current export authority. Partial evidence is named, not equated with healthy.
Opposite-scheme URLs are supported companions, not separately inspected images.
