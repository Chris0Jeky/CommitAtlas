# Annual density and motion qualification — 2026-10-29

This receipt qualifies the latest-year calendar layout and bounded decorative motion introduced
in [#452](https://github.com/Chris0Jeky/CommitAtlas/pull/452). The source commit is
`b9099fbef63f9b199e30b5d97e87bc80a48e20fd`; the merge is
`2c2a1af4985e2327e38b5e10d1d04a729b048283`.

## Source and execution

| Check | Receipt |
| --- | --- |
| Complete quality gate | [40807674405](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40807674405), 2,090 tests, clean rebuilt Action, zero findings in both dependency audits |
| Density browser qualification | [40807674398](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40807674398), clean native PR head |
| Appearance regression | [40807674425](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40807674425), success |
| Signature regression | [40807674433](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40807674433), success |
| Merged main quality gate | [40808392149](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40808392149), success |
| Production | [40808696362](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/40808696362), 21/21 checks against expected merge build at 02:50:50 UTC |

The browser report records Node 22.13.0, Playwright 1.57.0 and explicitly selected Chromium
143.0.7499.4 (revision 1200). An earlier run failed closed because an inherited browser executable
selected Chromium 156. The successful harness selects the pinned executable explicitly, records
its path and checks its version; no timing or visual threshold was relaxed.

## Archive integrity

The GitHub artifact ID is `12869346305`. Its downloaded ZIP is 4,234,997 bytes with SHA-256
`04ad59313a1dd6968726470e25e3979069d9552dd966505000fa0f82e5f56b7d`.
The complete archive contains 104 PNGs, 56 SVGs and the report. The preserved [report.json](./report.json)
is 67,150 bytes with SHA-256
`09ff32542c2f8d2852d71c326955c13002b67fa1cf091e4de6c4188a14f4a8ca`.

Independent verification checked the nine recorded source hashes, every PNG/SVG digest and all
72 pixel comparisons using a separate PNG decoder. The 64 layout cases were reproduced from
the accepted source and checked for reported overflow/collision; the largest SVG is 27,144 bytes.
The report preserves every actual before/after capture time. Maximum observed lateness was
382.5 ms within the unchanged 1,500 ms allowance. The first frame is an observed interval after
load, not an assertion of exact animation time zero.

## Results and interpretation

- Atlas and Activity show at most the latest 365 civil dates while totals and streaks retain the
  full valid observed history. The profile subsequently displayed a 596-day streak from 730 days
  of observed history alongside its 365-day grid.
- Absolute thresholds distinguish copper 1–200, gold 201–700 and violet 701–1,500. Original
  deterministic spark, diamond, crest, comet, crown and bolt glyphs distinguish higher days.
  Shape changes and numeric legends supplement color. These are contribution counts, not an
  assertion that every contribution is a commit.
- Eight ambient rows visibly move with CSS/SMIL and return exactly to their `none` controls at
  the final observation requested for 46 seconds. Sixteen static/control rows stay unchanged.
- All eight reduced-motion rows match the appropriate still control at every observed frame.
  The SMIL picture selects a separately generated still artifact; CSS also exercises its media
  query behavior. Profile adoption uses explicit still companions.
- Invalid, missing or stale evidence is not converted into healthy or zero activity. The final
  source review resolved a real cropped-calendar partial-total issue before merge.

## Scope limits

This is synthetic layout and direct-image/picture playback evidence. It does not qualify Firefox,
WebKit, raw GitHub delivery, GitHub/Camo rewriting, the complete #113 matrix or the bounded #180
diagnostic. The first successful profile refresh and subsequent stale-cache observation are
recorded separately in [PROJECT_STATE](../../PROJECT_STATE.md). Scene adoption and actual profile
browser captures remain the separate acceptance work for #144.

The complete browser archive is attached to the workflow run and is subject to GitHub artifact
retention. The preserved report retains exact source, SVG, PNG and timing identities after that
archive expires; it is not a substitute for the archive's images.
