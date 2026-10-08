# Lifecycle and Studio scene delivery, 2026-10-07

This checkpoint separates source, built-browser, deployment and README evidence. It does
not close #141 or qualify the #113 three-engine raw/Camo motion matrix.

## Delivered source

- #333 completes #137's lifecycle map. The original #323 head
  `09b66d4993311e5e03a12dbde9f754c341028364` remains a parent; its unrepaired tree was not
  independently accepted. Final head `41b85a751e2d7a2f4c70665da1d44a299c5dffff`, merge
  `9a307e03b4c77043a7669f9ad0af1aa164bb7390`.
- #334 delivers the scene-preview portion of #141 and preserves #327's head
  `3ca64549616b48602df279b50132124c1abc71fa`. Final head
  `2c63ad4076da35bbc0696281654d875d7e4bd90e`, merge
  `bb3c1d659ab703c83b7a15fbd731e1c3140aeb39`.

Lifecycle renders declared positions independently of observed CI and release evidence.
Unknown, stale and contradictory signals do not become passing or confirmed absence.
Text and declared points remain static; optional animation affects geometry only. All
six configured projects have separate rows rather than colliding at the same station.

Studio now requires an actually loaded image of the exact bounded response that supplies
its renderer metadata. Stale or unavailable plates, broken images, HTML-200, unsupported
packs, obsolete attempts and still twins cannot authorize copying an unverified profile.
All three accepted scenes have reversible global and independent per-image controls.
An explicit shared catalogue binds hosted capabilities to the UI. Existing card previews,
dependency lockfile and private-data collection boundaries are unchanged.

## Reproducible verification

Lifecycle's initial 29-case regression set failed 26 cases against the old source. The
repair passes 31 focused cases and 32 synthetic static theme/layout/state variants.
Full locked CI [37614489654](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37614489654)
passed at its exact head, including the rebuilt Action and executed paired-theme scene.

Studio full locked CI
[37621631844](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37621631844) passed
at its final head; checkout `ebfe17d0b907c0574d37ffc7cd77c6c334b7f6d5` combines that head
with main `9a307e0`. Node 22.13.0, locked TypeScript 5.9.3. The gate includes 248
GitHub/API, 96 Studio, 312 SVG, 153 static, six executed Action and 63 built-product
checks, plus types, lint, existing component suites, packaging and a clean Action rebuild.
Main [37622782693](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37622782693)
also passed at `bb3c1d6`. Production-only audit is clean; the full-install audit still
reports 14 entries and remains separately tracked by #325.

## Built-Worker browser receipt

Run [37621733875](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37621733875)
used source `2c63ad4076da35bbc0696281654d875d7e4bd90e`, observed Chrome
154.0.8037.57 and an isolated Playwright 1.57.0 driver. Receipt time
`2026-10-07T12:33:02.850Z`, mode `built-worker-synthetic-https-proxy`.

Seven scenarios passed: decoded Blob/counters, reversible views, delayed-response
invalidation, broken-SVG/HTML rejection, unsupported packs without a request, all three
scenes with independent controls, and actual keyboard traversal. All 16 tool buttons
were reached with 46 Tab presses. Zero page errors. At 1440x1000, panels were 884px and
images 828px wide. At 390x844, panels were 278px and images 222px wide. No panel or page
horizontal overflow was observed. Screenshots were inspected, not merely generated.

Artifact `11483095268`, 1,289,689 bytes, ZIP SHA-256
`bdcbe3ee138c6259ba4229d6eecf5bc37b69e048f777c82cbfda73e1748c1135`.
The raw `receipt.json` SHA-256 is
`be90f4fcddc79aae01b00b84f9ef1bae8529a8fa7265a3145d21c02b9a90cc2e`.
These hashes were verified against both the downloaded ZIP and GitHub artifact metadata.
An earlier transcription of dimensions/digest in #334 was corrected from this evidence.
Artifact retention is short; source records retain its identity and bounded observations.

The first dev-server attempt stopped before hydration because Vite rejected its origin.
No browser/origin policy was disabled. The first built-Worker behavior pass then exposed
a tiny scene panel on visual inspection. The undefined `span-wide` was replaced by the
existing `span-full`; an SSR regression and actual rendered-width browser assertions
cover the correction. Those earlier attempts are not counted as final visual acceptance.

## Production browser and deployment qualification

The curated [production receipt](2026-10-07-studio-production.json) preserves the following
separate observations; it does not pretend to be the byte-identical raw browser receipt.

Production browser run [37622867294](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37622867294),
attempt 2, job `112798946988`, passed all seven scenarios against the actual production
origin at `2026-10-07T12:46:39.103Z`. Its checked-out QA source was `bb3c1d6`, Chrome
154.0.8037.57, Playwright driver 1.57.0. All production API requests used synthetic
`demo=true` evidence. Error injection was confined to the browser's own responses.
The same 16/16 keyboard traversal and desktop/mobile widths passed with zero page errors.
The production scene screenshot was inspected.

Production browser artifact `11482733171`, 1,287,276 bytes, ZIP SHA-256
`c300f17ff4c29b41e9fa0021d53dc8a30e6bc60199bd96357d59dc77f5bce3ab`;
raw receipt SHA-256 `2b1fc33a5c88c2dbbce1b8e43ae0170eb31f503a79fd7d0027dc33dce34fe2aa`.
Downloaded-byte hashes match GitHub's native artifact metadata.

Deployment [37623082908](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37623082908),
attempt 2, job `112800099561`, checked out exact main `bb3c1d6`, deployed Worker
`e083d230-3e27-4d37-ad64-24e65bc0c79b`, and passed **21/21 production HTTP checks** at
`2026-10-07T12:49:27.785Z`, including both new map metadata/body checks. The production
browser observation preceded this redeployment of the same git source; it does not
claim to identify that later Worker version from the UI.

Initial deployment attempt 1 uploaded Worker `9f847ccc-2b5c-4262-99a6-52f6d35acef8`,
then passed only 19/21 checks. The two new map responses lacked matching renderer
metadata. The first browser readiness attempt ended at 12:44:09 UTC, before that
deployment completed at 12:44:12 UTC, and reached no browser scenarios. Both unchanged
retries passed. These prior failures are retained, not relabelled as successes. The
observations are consistent with rollout timing but do not independently prove its cause.
No source changes, test weakening or cache nonce was used to turn the retries green.

## Remaining #141 acceptance

The scene slice is delivered, but existing card previews do not yet have the same
per-image tool/counter contract. Implement that as a distinct tested slice rather than
silently counting syntax or reusing a scene receipt for a card. Validate each requested
profile response, image-load failure, repeat attempt, unavailable state and independent
control. Keep actual rendered-image proof separate from compiler metadata.

A real GitHub README round-trip remains unverified. Do not add a `prefers-reduced-motion`
source or claim Camo playback without the #113 sanitizer/motion evidence. Still-twin
controls do not pause, scrub or emulate an OS preference. Preserve owner-gated collection
and cross-repository consent decisions. No independent review is claimed for this pass.
