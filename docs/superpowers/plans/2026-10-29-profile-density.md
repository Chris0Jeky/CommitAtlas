# Reliable profile refresh and tiered contribution density

## Goal and design

Restore a recent one-year calendar without truncating the history used by streaks, make high-volume contribution days distinguishable, and deliver visible bounded motion in the actual profile assets. This executes the owner's 29 October request to investigate, implement, validate and merge safe improvements.

The display uses neutral empty days, copper for 1–200 contributions, gold for 201–700, violet for 701–1500, and a deterministic original vector glyph above 1500. Numeric ranges and cell titles carry the values independently of colour. Theme-specific tones preserve contrast. The source remains a contribution count, not a commit-only or productivity measure.

The selected architecture keeps full observed contribution history for streaks while deriving the displayed calendar and its density readings from the latest 365-day civil-date window. It does not invent recent zero days to hide a stale source. Decorative motion uses the existing compiler and the bounded README target; all readings remain complete without animation. The no-motion output remains available for reduced-motion embeds.

Alternatives considered: retaining percentile-only colours hides exceptionally busy days; extending the grid with streak history repeats the reported defect; GIF generation adds a new dependency before existing SVG playback has been qualified. Fixed numeric bands, a separate display window and compiled SVG motion directly meet the request.

## Constraints and review focus

- Preserve the longest and current streak across the 365-day display boundary.
- Never relabel unavailable or stale evidence as current, zero or healthy.
- Deterministic, escaped SVG; no scripts, remote images or fonts.
- Test 200/201, 700/701 and 1500/1501 tier boundaries and tiny grids.
- Qualify actual embedded-image playback, reduced motion and final still state.
- Publish through connected GitHub branches and draft PRs; merge only after exact-head CI and independent review.
- Reconcile profile consumer action pins and scheduled-refresh behavior with the merged producer.

## Work ledger

- [x] Inspect current GitHub default head, open issues/PRs and CI.
- [x] Compare all 477 uploaded source blobs with main `7dd3b2bfb3ef11bbb9c910d011667ba541e5ac36`: exact match.
- [x] Separate display calendar from historical streak evidence, with regression tests.
- [x] Implement numeric colour tiers, deterministic milestone glyphs and actual ambient motion.
- [x] Diagnose and repair the profile refresh pipeline; retain prior assets on failed generation.
- [x] Review the current dependency advisory graph in issue #447.
- [ ] Rebuild the Action, run focused and full gates, and inspect animated/static renders.
- [ ] Publish draft PRs, check exact-head CI, address review findings, merge safe changes and qualify deployment/profile refresh.
- [ ] Update issue and documentation receipts with observed results and remaining work.
