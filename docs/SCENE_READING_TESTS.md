# Testing scene readings

The shared harness distinguishes two contracts:

- `readings` requires each string in the accessible description.
- `visibleReadings` additionally requires each string in SVG text that passes the existing declared-visibility scanner.

Declare both for primary readings that must be printed beside the geometry. A title or description that mentions a total does not prove the total is printed. `encodings` remains the accessible explanation of what the geometry means; it need not duplicate all that prose on the canvas.

```js
ready: {
  inputs: fixture,
  textFields: [],
  readings: ["4 PASSING", "1 STALE"],
  visibleReadings: ["4 PASSING", "1 STALE"],
  encodings: ["Bar length", "Neutral ink"],
}
```

`visibleReadings` is optional to preserve existing accessible-only contracts. When present, it must be an array of nonempty strings. An empty array is valid for a scene that deliberately prints no readings. Existing scenes do not gain a visible-text proof merely by leaving the field out.

The scanner excludes metadata and definition-only text, zero-opacity text/ancestors, unpainted fill, zero font size and aria-hidden subtrees under its existing presentation rules. The harness runs the extra assertion for every supported pack/profile/backend combination already exercised by the shared contract. It does not add a production renderer dependency or change SVG output.

The regression suite supplies metadata-only, transparent, unfilled, zero-font, hidden-parent and definition-only counterexamples, verifies malformed declarations fail rather than silently skip, preserves accessible-only readings, and opts the real evidence-coverage scene into visible checks for its primary readings. It is registered in the SVG package test command and therefore the root repository gate.

## What this does not prove

This is a structural text check, not an actual pixel-visibility oracle. It does not prove text fits the viewBox, avoid overlaps, contrast against a decorated background, local font glyph coverage, CSS/SMIL timing, or cross-origin browser/Camo playback. A string can pass this check and still need layout or browser repair. Retain both-layout/four-theme rendered inspection and the separate timed-motion evidence gates.

The activity-terrain repair illustrated the distinction: printed-reading tests caught metadata-only metrics, while static raster inspection and additional boundary tests were still needed to catch a clipped stale message and crowded release labels. New scene reviews should retain both kinds of evidence.
