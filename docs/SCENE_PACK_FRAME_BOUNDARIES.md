# Scene-pack frame boundaries

The first pack implementation varies the frame, not every primitive or every scene. This
repair keeps that scope explicit: it does not advertise a pack as supported by a scene
that still declares only Survey. Existing closed route/config/capability checks stay intact.

## Geometry and text

Non-Survey grids and markers are background geometry. They are painted after the opaque
plate but before its border, family stamp, reference, title and stale/privacy text. Their
coordinates stay inside x=20..width-20 and y=84..height-44, reserving header and footer space
at every accepted frame size, including the 140px minimum height. Small frames bound the
marker size/offset rather than placing it outside its reserved area. Reference text also
clears the corner cut, not just the rectangular viewBox.

Survey still emits no pack decoration. A golden test pins its exact bytes across four
themes, four widths, two stale modes and two representative families: 64 combinations.
The other packs keep their existing frame corners, grid pitches, marker vocabulary and
theme-supplied ink. No palette, opacity rule, route or artifact selection changes.

The exported lookup rejects unknown, inherited and non-string keys without coercing a
caller object. Its TypeScript union does not replace validation for JavaScript callers.

## Verification and remaining scope

The first eight new regressions fail against the pre-repair source: four inherited keys, one object
coercion case, and three pack decoration/layout cases. The repaired suite additionally
pins Survey byte compatibility. Static review then exposed the Orbital reference entering
its clipped corner; an additional failing regression pins the repaired placement. Bounds cover widths 320/480/720/1600 and heights
140/320/1000. Existing four-pack contract, unavailable, determinism and contrast tests remain.

These structural checks establish protected frame text regions, not readability of arbitrary
body compositions. Scene authors still own body label placement and supported-pack declarations.
A CairoSVG static preview is layout evidence, not timed motion or a cross-browser guarantee.
Full pack-family geometry/default-texture delivery and any community-pack format remain
separate work; this repair does not close those broader acceptance items.
