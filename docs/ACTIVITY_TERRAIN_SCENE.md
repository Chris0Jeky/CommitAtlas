# Activity terrain

`activity-terrain` is a survey-pack map of the complete public contribution calendar, with independent latest-release markers and a window-scaled current-streak ridge. It uses the shared scene renderer and map budgets. It does not infer code quality, effort, impact, or individual project activity.

## Delivery

The scene is opt-in in an existing static configuration: add `activity-terrain` to `scenes` and use `scenePack: "survey"`. It emits `scene-activity-terrain.svg` through the existing static manifest and Action machinery. Default static artifact selection is unchanged.

It is also hosted because its family is `map`:

```text
/api/v1/scenes/activity-terrain.svg?user=octocat&demo=true
/api/v1/scenes/activity-terrain.svg?user=octocat&demo=true&days=730&layout=compact
```

These URLs are explicitly synthetic examples. Non-demo collection retains the existing public-only credential, source, cache, CSP and error contracts. Survey is the only supported pack. `none` and `subtle` are still; `ambient` requests only the decorative survey scan. Cinematic is not hosted.

## Readings and evidence boundaries

The total, peak weekly sum, longest quiet run in weekly columns, and current streak in days are printed beside the geometry and repeated in the accessible description. Sunday-start UTC columns match the calendar geometry. Boundary weeks may be partial; the composition states that limitation.

The ridge is stationary. Its length is `current streak / declared window days`, with no arbitrary 30-day cap. A zero streak has no lit ridge segment. The exact day count is still printed; an open left boundary carries `+` and an explicit at-least explanation.

A calendar is accepted only when its inclusive bounds, declared day count, observed-day count, boolean completeness flag and raw dates agree. Every date must be valid, unique and inside the window; counts must be bounded nonnegative safe integers. Supported complete windows include 365, 366, 730 and 731 days. Missing dates never become invented zero-activity days, and repeated dates never inflate sums.

Unknown or contradictory provenance, stale/unavailable data and a partial contribution calendar produce a themed, non-animated unavailable plate. Stale timestamps and the stale/current distinction remain visible without clipping in either layout. Synthetic sources print `SYNTHETIC PREVIEW`; accepted public snapshots print their source, exact UTC bounds and observation timestamp. A partial overall snapshot may retain an independently complete current calendar while release evidence remains blocked.

## Releases are independent observations

Only the latest release from each configured project is available. The legend explicitly says this is not complete release history. Confirmed absence requires `releaseState: "none"` and a null release record; stale, unavailable, malformed or contradictory records remain blocked evidence, not absence.

A published marker requires a real UTC instant within the inclusive calendar dates and no later than the board observation. Next-day midnight is excluded. Invalid dates, normalized impossible dates and invalid time components are rejected. Same-week releases retain separate numbered markers and legend rows. A valid release remains visible on a flat zero-activity basin; the marker never changes terrain elevation.

## Verification checkpoint, 7 October 2026

Final integrated source and generated Action were tested at `38187c448c39d2e26ca58ff77027d4bb6675e7f8` in [run 37565462452](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37565462452). The downloaded artifact `terrain-isolated-final` (ID `11458269530`) has SHA-256 `09384e7f4441683cb5ebaf96668c5cde0c6c23ca7184c9f900ee26dbc9417475`. Its source blob `e98fa5238b4db5c4fdcd852206a40a07419f9810` matches the locally reviewed source byte for byte.

The full locked `npm run check` passed, including:

- 267 SVG tests, with 30 focused terrain tests;
- 231 GitHub/API tests, including 16 terrain route cases across four themes, two layouts and 365/730-day synthetic windows, plus the route-discovery guard;
- 153 static tests, four Action tests and the clean generated-bundle comparison;
- packaging, typecheck, lint and 63 built-product tests.

Local regression evidence separately showed the clipped unavailable message and crowded edge number failing before the layout repair (27 pass, two fail), then 29 passing. The missing stationary ridge subsequently failed its new test, then all 30 focused tests passed. Earlier fixture-construction failures were corrected by supplying the core metric function's required breakdown inputs; those failures are not evidence of renderer defects.

Static visual review used 32 synthetic SVG variants: active, all-zero, stale and maximum-length/six-release cases, in both layouts and four themes. CairoSVG rasterization exposed the clipped stale message and edge-number collision before repair. This is static layout inspection, not a recorded browser-motion or Camo verdict. The local rasterizer lacked CJK glyph coverage for the maximum-label fixture; that case verifies bounded source/layout, not cross-platform font rendering.

The shared branch changed during final validation. Its expected-head guard refused to overwrite that change. This isolated integration descends from the cleanup commit and preserves removal of the shared temporary workflow; its own temporary builder is also absent from the final diff. PR #321 contains the original scene and repair history. Final clean-head CI and merge/deployment receipts belong on the integrating PR.

No live non-demo GitHub collection, three-engine timed animation capture, Camo compatibility or production deployment is claimed by this source-validation checkpoint. Existing browser evidence gates remain separate.
