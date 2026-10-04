# Evidence coverage implementation plan

**Goal:** Complete #133 with an opt-in, snapshot-grounded instrument and paired static output.
**Base:** main `250ee8e45cd4d0c9b4b3cbcb247f0ce49d3ebf3b`, recovered through the connector.
**Spec:** #133 and EXPANSION_PLAN.md section 7; existing motion and scene contracts remain binding.

- [x] Pin source-to-row mapping and negative cases in a failing scene test.
- [x] Add an optional static unavailable renderer to the engine. Preserve engine-owned accessible
      naming, unavailable identity, byte limits and zero animated elements. Existing scenes retain
      the default renderer; invalid projection/identity inputs never reach normal build/render.
- [x] Build calendar, mix, CI, release, line-change, private-activity and snapshot rows. Denominators
      count observed days, the four supplied mix fields, or declared projects, never productivity.
      Stale/unknown source states remain neutral; synthetic source status remains explicit.
- [x] Register the built-in lazily from the registry module so bundling cannot remove registration
      as an unused package side effect. No production fixture or hosted route is added.
- [x] Pass the seven shared contracts, four themes, two layouts and both backends; inspect renders.
- [x] Verify real static selection, paired hashes, dry-run and an executed Action output.
- [x] Reproduce and repair percentage, zero-activity, root-source, release-record and source-family
      review findings. Regenerate and execute the Action; remove all temporary build machinery.
- [ ] Complete final clean-head CI and independent review, merge only verified work, and record
      the resulting revision and remaining gates in #133 and programme tracker #111.

Ruling: the current generic unavailable renderer cannot preserve all seven dark rows. A bounded
optional `renderUnavailable` callback receives only the engine's unavailable record, context and
engine-owned accessibility text, never unchecked source data. Motion remains forbidden there.
Ruling: no row echoes arbitrary profile names, repository names, URLs or free-text upstream labels.
All visible source/state descriptions use closed vocabularies; unavailable data is not a zero.
Ruling: source `partial`/`stale` flags never become a fully current coverage claim. A partial
calendar uses the explicit window counts only when they are consistent; other incomplete source
families remain neutral where no honest denominator is available.

Ruling: snapshot mode is literal metadata, not a measurable fraction. Its row uses a neutral
badge rather than a misleading 1/1 completeness bar or a NOT OBSERVED label under LIVE.
Ruling: project-board partial mode can mean only one source family failed. CI and releases
retain independently validated per-project observations; stale or unknown provenance
downgrades both. Fractional public-profile annual percentages remain valid supplied fields.

Review rulings: annual percentages must total 99–101 or represent verified zero activity;
unknown root sources cannot authorize nested observations; published releases require complete
bounded records. Source families must match the producer: profile HTML supplies percentages,
GraphQL and synthetic fixtures supply exact counts, and REST or synthetic fixtures supply
project boards. These checks classify supplied evidence; they are not source authentication.

Latest builder evidence: run 37162975520 validated typecheck, lint, SVG/static tests, rebuilt
`action/dist` and executed its synthetic dry-run/write contract before committing `95c7c136`.
Focused local evidence is 26 scene tests; full locked-dependency validation remains Actions.
Synthetic CairoSVG previews are layout checks, not browser/Camo motion qualification.
