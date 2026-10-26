# Developer Signature — CI evidence, 2026-10-26

[PR #449](https://github.com/Chris0Jeky/CommitAtlas/pull/449) merged as
`d4c9075f87baea2ce7ece9372fdd4edcbbedc68d`, completing the bounded C0 scene acceptance in
[#147](https://github.com/Chris0Jeky/CommitAtlas/issues/147). The browser jobs checked out clean
native head `b5c3df2200686e554b73a3229ccd615d8f3fd8dd`. That head, quality-gate test merge
`423ca132`, and the final merge have the same Git tree:
`db7b5432c020e301496aea6e7a26b1e50bfd3e63`.

The [scene guide](./SIGNATURE_SCENE.md) defines the data and rendering contract. This receipt
records the tested source, actual browser observations and artifact identities.

## Native CI and delivery

| Check | Receipt | Result |
| --- | --- | --- |
| Repository quality gate | [40403676106](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40403676106) | 2,058 tests; clean Action rebuild comparison; production dependency audit: zero vulnerabilities |
| Signature browser evidence | [40403676250](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40403676250) | 312 geometry cases and 14 playback/control rows; complete, no page errors |
| Gallery/Studio appearance | [40403676093](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40403676093) | Six Gallery layouts with 18 tiles; 14 Studio scenarios, 48 controls reached by Tab and 16 focus cases |
| Merged-main CI | [40404357062](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40404357062) | Passed on the merged source |
| Deployed-origin verification | [40404740015](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40404740015/job/121859468441) | 21/21 checks passed at `2026-10-26T21:29:47.5524278Z`, with merge `d4c9075f87baea2ce7ece9372fdd4edcbbedc68d` declared as the expected build |

The deployment target was `https://commit-atlas.commit-atlas.workers.dev`. The bundled Action
is exercised against synthetic network responses and an unchanged, tracked C0 fixture for fresh
ambient, stale, expired and dry-run paired outputs. Its generated manifests are checked against
actual file bytes and SHA-256. The bundle is 950,189 bytes, SHA-256
`0531a45effe483dfe656760015ed688503465448b2b53ab1714473c741e6b889`.

## Browser and text geometry

The Signature report began at `2026-10-26T21:22:16.310Z` on Linux with Node 22.13.0,
Playwright 1.57.0 and Chromium **143.0.7499.4**, selected explicitly from the pinned driver's
installation. The harness rebuilt the SVG package and its core/GitHub dependencies before
importing them. It records 22 source-file hashes and 37 built JavaScript hashes, and checks that
the built manifest stays unchanged through capture. All 22 source hashes match the qualified tree.

The 312 geometry cases combine 13 synthetic inputs, four themes, two widths and three font
settings: native, serif and monospace. Inputs include maximum CJK text, BMP pictographs and word
breaks, long Latin text, combined count/precision extremes, zero values, escaping, fresh, stale
and expired states. Complete expected readings and disclosures remain visible, with no frame
overflow or text collisions. The compact scale caption clears the bottom numbered axis and plot.
The largest measured body was 985px; the largest displayed frame, including its separate stale
strip, was 1013px. The contract remains a 1000px body plus at most a 28px engine-owned stale strip.

Chromium's `CSS.getPlatformFontsForNode` observations identify the fonts actually used:

| Glyphs | Browser-selected families in the measured cases |
| --- | --- |
| Latin | DejaVu Sans, Liberation Serif, DejaVu Sans Mono |
| CJK | WenQuanYi Zen Hei |
| BMP emoji | Noto Color Emoji |

The report also retains nine fontconfig glyph-availability probes and hashes of the files those
probes selected. Those hashes do **not** identify every browser-selected font file. In particular,
fontconfig selected FreeSans/FreeSerif/FreeMono for the emoji probe while Chromium used Noto Color
Emoji. The WenQuanYi fontconfig file hash is
`79c18ebe7b811951e8311bad7103ebeae8c337ed9988ea69e8a78a66cfe029b9`;
the report does not substitute a FreeFont hash for the browser's Noto selection.

## Playback and actual observation times

Four fresh ambient rows cover both widths with CSS and SMIL. Each changes pixels during the
early observations and matches its corresponding still control exactly at the final observation
requested for 46 seconds. Six still rows cover none, stale and expired output at both widths;
their CSS/SMIL source twins are byte-identical and every captured frame remains unchanged.
Four reduced-motion rows explicitly select the `motion=none` image through `<picture>` and
match their still controls. These are 14 rows with four PNGs each, plus ten representative PNGs.

The table shows actual screenshot start–completion intervals in milliseconds from the harness's
load anchor. The requested offsets were first observation, 1,000, 5,000 and 46,000ms.

| Ambient row | First observation | Requested 1s | Requested 5s | Requested 46s |
| --- | --- | --- | --- | --- |
| Wide CSS | 120.8–731.4 | 1029.0–1398.0 | 5006.5–5297.4 | 46003.9–46243.9 |
| Wide SMIL | 122.2–671.3 | 1009.3–1180.2 | 5013.7–5302.0 | 46010.1–46177.0 |
| Compact CSS | 153.8–571.1 | 1018.6–1190.8 | 5019.8–5174.2 | 46022.5–46247.7 |
| Compact SMIL | 137.5–436.6 | 1019.7–1215.4 | 5020.4–5226.8 | 46019.3–46144.5 |

Across all 56 timed PNGs, the largest completion lateness was **760.9ms**, on the wide expired
row's first observation, within the fixed 1500ms limit. The later local development report at
`319f14413773fab52daf8b4a2b56b1aa6e8cce6f` measured 489.7ms; that local value is not the CI result.
The earlier `1dd7339` reference run retains its own 698.3ms observation in the
[dated visual references](./evidence/appearance-2026-10-26/README.md).

All **50 pixel comparisons** were independently recomputed from decoded PNG pixels and agree
with the report. All 66 PNG, 38 SVG and four WebM hashes were independently checked, as were PNG
dimensions and WebM container signatures. The videos' container durations were not parsed.
The first observation is not an exact animation-frame-zero capture. Reduced controls establish
explicit still-image selection, not direct CSS media-query behavior inside an image.

## Artifact identities

| Artifact | Identity |
| --- | --- |
| [Signature archive](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40403676250/artifacts/12688359959) | `12688359959` |
| Signature ZIP SHA-256 | `9ae5ab49d3ca339fe8010188a2ff0931267d5dfe300206f74e3628354d59ea28` |
| Signature `report.json` SHA-256 | `0a149f77b71c7f794037e2816ce32d6f6ccd4b958a5f93e14d298431d4e121eb` |
| [Appearance archive](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40403676093/artifacts/12689892016) | `12689892016` |
| Appearance ZIP SHA-256 | `1a68b07b4b10de3efeae459b0fb45de0ea6b154ef87fcf79b4bb2997ad50cca5` |

The appearance report also records 12 Studio configuration-group measurements across desktop
and mobile: every group has 20px separation from preceding controls and 9px from its legend to
its choices. Its keyboard traversal reached all 48 controls in 85 Tab presses, with 16 Enter/Space
focus-preservation cases. The [retained 768px Limestone Gallery image](./evidence/appearance-2026-10-26/README.md#current-gallery-after-signature)
comes from this clean native-head run, with finite theme transitions settled.

This qualification covers the synthetic C0 scene, bundled generation and the recorded browser
surfaces. It leaves the separate GitHub raw/Camo matrix, broader browser/embed coverage and
profile adoption open. C1 publication remains disabled under Q-9 No; the fixture timestamp remains
`2026-09-01T12:00:00Z`. No hosted Signature endpoint or selectable Studio scene was added.
