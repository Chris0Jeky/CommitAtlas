# Motion compatibility evidence

Status: Phase 0 issue #113 is parked at the three-attempt ceiling on the WebKit hosted-discovery
blocker tracked in [#180](https://github.com/Chris0Jeky/CommitAtlas/issues/180). This ledger records
measured outcomes only; an unfilled cell is **not tested**, never a compatibility claim. The fixture
set and local capture tool live in
[`tests/fixtures/motion-probes/`](../tests/fixtures/motion-probes/). The public synthetic scratch
repository for the GitHub/Camo part of the protocol is
[Chris0Jeky/commitatlas-motion-probes](https://github.com/Chris0Jeky/commitatlas-motion-probes),
currently pinned for the complete hosted capture at
`039a0370b1a52fb6135e4414e04a11bff7ba21d0`.

## Answer first — 2026-08-29 checkpoint

- Direct Worker evidence is complete for this checkpoint: all 48 normal-motion rows and all three
  reduced-motion controls have five frames and a continuous WebM with more than three seconds of
  measured visible browser time. The compact recording ledger is
  [`2026-08-29-worker-recordings.json`](../tests/fixtures/motion-probes/evidence/2026-08-29-worker-recordings.json).
- The pinned GitHub diagnostic completed 14 rows: Chromium and Firefox each measured raw and Camo
  `css-enter` through both `<img>` and `<picture>`, both reduced-motion sources, and the known
  positive control. `css-enter` and the positive control animate; both reduced sources are frozen
  at frame zero. The compact partial ledger is
  [`2026-08-29-github-hosted-diagnostic.json`](../tests/fixtures/motion-probes/evidence/2026-08-29-github-hosted-diagnostic.json).
- WebKit hosted delivery is **not tested**. Discovery stopped before any WebKit row because the
  pinned raw SVG decoded as `400x133` rather than the harness's exact `360x120` identity guard.
  Issue #180 owns the one bounded identity-versus-intrinsic-sizing observation and one seven-row
  WebKit retry. If that passes, resume #113 at the unfiltered three-engine raw/Camo matrix.
- The #180 metadata-only observation proved that WebKit 26.0's `400x133` natural and
  `400x133.328125` rendered presentation is the same pinned SVG: the final raw response, tracked
  fixture, and matching Worker response all have SHA-256
  `85547254f52197d041123066c90d5df84d259dde67c9502473ce247a71c03945`. The compact observation is
  [`2026-08-30-webkit-metadata.json`](../tests/fixtures/motion-probes/evidence/2026-08-30-webkit-metadata.json).
  The single seven-row retry at CommitAtlas head `6578f1d` still failed closed before any discovery
  or row because its rendered-width bound rejected the live presentation. Its partial report hash
  and zero-row disposition are recorded in
  [`2026-08-30-webkit-diagnostic-attempt.json`](../tests/fixtures/motion-probes/evidence/2026-08-30-webkit-diagnostic-attempt.json).
  This is not animation evidence; #180 remains parked and the unfiltered matrix stays locked.
- No final backend is selected. Provisional only: `web` prefers CSS with an explicit SMIL override
  for `offset-path`; Studio keeps CSS and SMIL selectable; `github-readme` remains `none` / unselected
  until #113 completes.

## Protocol

Each SVG is deliberately tiny, synthetic, and readable at frame zero. It isolates one effect:
CSS enter, CSS breathe, CSS plot, the CSS `opacity: 0` / `fill-mode: both` control, SMIL transform,
SMIL plot, SMIL `animateMotion`, or CSS `offset-path`. `index.html` mounts each asset both as a
plain `<img>` and as a `<picture>` with colour-scheme and reduced-motion `<source>` elements.

Capture at 0, 250, 500, 2,000, and 5,000 ms. The 250 ms sample sits inside the shipped CSS-enter
effect (60 ms delay plus 380 ms duration), so a fresh-page run can observe it rather than jumping
past the effect. Decode each PNG to RGBA, then compare adjacent frames;
the pair notation below is `changed pixels / total channel delta`. A cell is `animates` only when
at least one pair has at least 16 changed pixels **and** a total channel delta of at least 1,000.
This discards the 3-pixel / 90-delta Firefox and 25-pixel / 964-delta WebKit capture noise rather
than mislabelling it as motion. A changed PNG encoding alone is not evidence.

Run a local direct measurement without adding a repository dependency:

```powershell
node tests/motion-probes/capture.mjs --browser 'C:\Program Files\Google\Chrome\Application\chrome.exe' --out C:\temp\commitatlas-motion
```

`--out` must name a new directory; the harness refuses to replace prior capture evidence. Both
capture CLIs require a platform-native absolute path and reject an existing directory before
launching a browser or creating screenshots, recordings, or browser profiles.
For a deployed Worker (or another authorized public synthetic host), pass its bare HTTPS asset
directory and a short host label. The page remains the local wrapper, while each image source is
resolved against the encoded `assetBase` query value; the report repeats the exact `assetBase` and
`hostLabel` values in its top-level metadata and rows:

```powershell
node tests/motion-probes/capture.mjs --browser 'C:\Program Files\Google\Chrome\Application\chrome.exe' --asset-base 'https://example.invalid/api/v1/probes/motion/' --host-label worker-direct --out C:\temp\commitatlas-motion-worker
```

`--asset-base` must be an absolute HTTPS URL ending in `/` with no credentials, query, or fragment.
`--host-label` is an ASCII label of at most 64 letters, numbers, `.`, `_`, or `-`; it defaults to
`local-direct`. Do not pass private URLs, tokens, or user data.

The cached Playwright 1.57.0 runner can instead be passed through `--playwright-engine` and
`--playwright-cli`. On Windows, `--playwright-cli` must name the package's `cli.js`, never its
`.cmd` launcher; the harness rejects the latter before starting a browser. This permits
Firefox/WebKit capture and `--reduced-motion` without changing `package.json` or `package-lock.json`.
Capture artifacts are deliberately untracked; their compact, dated pixel evidence is committed in
[`2026-08-29-local-direct.json`](../tests/fixtures/motion-probes/evidence/2026-08-29-local-direct.json).

Add `--record-video` to make each direct row one continuous Playwright context with a five-second
WebM as well as the five PNG deadlines. Recording requires the supplied Playwright API path and an
engine; the non-recording browser and CLI workflows above remain unchanged. The report verifies
WebM magic, byte size, and SHA-256. `measuredVisibleDurationMs` is browser time, not a parsed media
duration, and the report states that boundary explicitly. Set
`COMMITATLAS_PLAYWRIGHT_CLI` to the pinned Playwright package's absolute `cli.js` path, then run:

```powershell
$playwrightCli = $env:COMMITATLAS_PLAYWRIGHT_CLI
node tests/motion-probes/capture.mjs --playwright-cli $playwrightCli --playwright-engine chromium --record-video --asset-base 'https://commit-atlas.commit-atlas.workers.dev/api/v1/probes/motion/' --host-label worker-direct --out C:\temp\commitatlas-motion-worker-recorded
```

The pinned GitHub-page harness measures both repository-relative GitHub-raw images and absolute
Worker images rewritten through Camo. It first discovers the exact selected URL for each
engine/media/selector. Every measured row then gets a fresh context with service workers blocked;
the harness gates that exact request until the target load timestamp is armed, records a continuous
WebM, and takes element PNGs at absolute 0, 250, 500, 2,000, and 5,000 ms deadlines from image load.
Response body hashing happens after those timing-critical frames. It writes
`report.partial.json` after every completed row and creates `report.json` only after the entire
selected-engine plan succeeds:

```powershell
node tests/motion-probes/capture-github.mjs --playwright-cli $playwrightCli --playwright-engine chromium --out C:\temp\commitatlas-motion-github-chromium
```

Use a new output directory for every engine/run. Raw reports retain browser-observed response
headers for reproducibility and must remain untracked; only reviewed, synthetic-safe compact
evidence belongs in the repository.

Direct hosted capture also fetches every selected synthetic asset before browser launch and requires
`200 image/svg+xml`, the local fixture's exact SHA-256, and declared `360x120` bounds. A direct report
without an exact browser version is marked ineligible as compatibility evidence; it remains useful
only as a structural observation. When adjacent frames stay below the motion threshold, the harness
uses `frozen at frame zero` only with a verified frame-zero reference and otherwise records the
neutral verdict `no motion detected`.

For a bounded diagnostic run, `--host`, `--probe`, and `--embed` accept comma-separated allowlisted
values. Controls are omitted from a filtered plan unless explicitly requested with
`--include-positive-control` or `--include-reduced-controls`; an unfiltered run still requires all
35 rows per engine:

```powershell
node tests/motion-probes/capture-github.mjs --playwright-cli $playwrightCli --playwright-engine chromium --host github-raw-relative --probe css-enter --embed img --include-positive-control --out C:\temp\commitatlas-motion-github-smoke
```

## Measured local-direct results — 2026-08-29

The host was a loopback static fixture server. These rows do not test GitHub, Camo, a Worker, CSP,
or the GitHub sanitizer.

| Probe | Embed | Engine | Result | Pixel-pair evidence (0→250, 250→500, 500→2000, 2000→5000 ms) |
| --- | --- | --- | --- | --- |
| CSS breathe | `<img>` | Chromium 143.0.7499.4 | animates | 3673/204086, 4830/723774, 5410/748139, 6736/1618072 |
| CSS breathe | `<picture>` | Chromium 143.0.7499.4 | animates | 3606/177357, 4800/704335, 5339/728839, 6735/1617883 |
| CSS enter | `<img>` | Firefox 144.0.2 | animates | 7299/2973800, 7299/2973800, 0/0, 0/0 |
| CSS enter | `<picture>` | Firefox 144.0.2 | animates | 7780/3206916, 7780/3206916, 0/0, 0/0 |
| CSS enter | `<img>` | WebKit 26.0 | animates | 9005/3828905, 9005/3828905, 0/0, 0/0 |
| CSS enter | `<picture>` | WebKit 26.0 | animates | 9351/3872870, 9351/3872870, 0/0, 0/0 |

Reduced-motion picture selection was separately measured in Chromium: the static gold control
source was selected (`59,173` exact `#ffd166` pixels) and all four capture pairs were `0/0`.
That establishes the local fixture and runner path only.

## Measured direct Worker delivery — 2026-08-29

Answer first: through the deployed Worker SVG CSP, every CSS and SMIL probe animates in both
`<img>` and `<picture>` embeds in Chromium 143.0.7499.4, Firefox 144.0.2, and WebKit 26.0.
The sole exception is `css-offset-path`, which is frozen in all six normal-motion rows. With
`prefers-reduced-motion: reduce`, the `<picture>` source selects the static control in all three
engines. Chromium's four pairs are `0/0`; Firefox observed a sub-threshold `1/32` first pair and
WebKit a sub-threshold `8/259` first pair, with their remaining pairs `0/0`. These are capture noise,
not motion, under the declared `16 changed pixels / 1,000 channel delta` threshold (control pixels:
Chromium 59,173; Firefox 59,596; WebKit 59,256).

The complete five-frame direct-Worker pixel matrix is recorded in
[`2026-08-29-worker-direct.json`](../tests/fixtures/motion-probes/evidence/2026-08-29-worker-direct.json):
all 48 normal rows include the `0, 250, 500, 2,000, and 5,000 ms` captures and each adjacent
pixel pair. The reports were captured with Playwright 1.57.0 (Chromium 143.0.7499.4, Firefox
144.0.2, WebKit 26.0) against
`https://commit-atlas.commit-atlas.workers.dev/api/v1/probes/motion/`, deployed from merge
`f3d192f`. All nine fixed URLs returned `200 image/svg+xml; charset=utf-8` with the production
cache, CSP, CORS, CORP, and `nosniff` headers; their exact response values and hashes are in the
ledger.

The normal gate validates this older ledger's complete 48-row identity matrix, three reduced-motion
controls, thresholds, raw-report hashes, and all nine response ETags against the tracked fixture
SHA-256 values. It remains authoritative for its dated direct-Worker checkpoint only.

The matching recording ledger adds one WebM for each of those 48 normal rows and for one
reduced-motion `<picture>` row per engine. All 51 files have the WebM EBML marker, a recorded byte
size and SHA-256, and more than three seconds of measured visible browser time. Raw PNG and WebM
artifacts remain preserved outside the repository; the tracked ledger contains no binary or
absolute machine path. The harness does not parse container duration, so it makes no media-duration
claim beyond that measured browser interval.

## Direct Worker matrix — 2026-08-29

| Host | Plain `<img>` | `<picture>` / colour scheme | Reduced-motion source retained | Chromium | Firefox | WebKit |
| --- | --- | --- | --- | --- | --- | --- |
| Direct hosted Worker SVG with production SVG CSP | CSS/SMIL animate; `css-offset-path` frozen | CSS/SMIL animate; `css-offset-path` frozen | static control selected | complete | complete | complete |

The five-frame and recording matrix above is complete for the direct Worker host only. It is
evidence for that delivery target, not release authorization for GitHub README delivery.

## Measured GitHub README diagnostic — 2026-08-29

The measured page is the exact synthetic scratch commit
`039a0370b1a52fb6135e4414e04a11bff7ba21d0`, not a moving branch. The bounded diagnostic selected
seven rows per engine: raw and Camo `css-enter` in `<img>` and `<picture>`, one reduced-motion
`<picture>` for each host, and one known-animating public widget as a positive control. Chromium
143.0.7499.4 and Firefox 144.0.2 completed all 14 rows with five load-relative frames and a WebM
measuring more than three seconds of visible browser time for every row.

In both engines, raw and Camo `css-enter` animates in both embed forms, the positive control
animates, and both reduced-motion sources are frozen at frame zero. Each raw URL retained the full
scratch commit pin and redirected to a final `200 image/svg+xml` response; each Worker embed was
selected through `camo.githubusercontent.com` while retaining the Worker URL as its canonical
identity. The partial compact ledger records those identities, final response body hashes, request
gate counts and timings, frame hashes and differences, verdicts, and WebM metadata.

WebKit 26.0 failed closed during discovery before a target request was armed or any frame was
accepted. Its pinned raw `css-enter` image reported natural dimensions `400x133`, while the harness
required the fixture's exact `360x120`; therefore the ledger marks WebKit **not tested**, not frozen
or unsupported. Issue [#180](https://github.com/Chris0Jeky/CommitAtlas/issues/180) separates content
identity from intrinsic presentation sizing before one bounded WebKit retry.

An earlier Chrome-only structural observation remains in
[`2026-08-29-github-readme-chromium.json`](../tests/fixtures/motion-probes/evidence/2026-08-29-github-readme-chromium.json).
It established README sanitizer retention and reduced-source selection while the rendered image
URLs still used `/raw/main/`. The scratch commit recorded nearby does not pin those moving-head
assets, so this is moving-head structural evidence, not pinned compatibility evidence. The new
pinned diagnostic supersedes its earlier lack of a pixel sequence or recording for the 14 rows
above.

## Matrix checkpoint and exact resume

| Host | Plain `<img>` | `<picture>` / colour scheme | Reduced-motion source | Chromium | Firefox | WebKit |
| --- | --- | --- | --- | --- | --- | --- |
| Direct hosted Worker SVG with production SVG CSP | all probes measured | all probes measured | static control frozen | complete | complete | complete |
| Worker SVG in GitHub README through Camo | `css-enter` animates | `css-enter` animates | static control frozen | diagnostic complete | diagnostic complete | **not tested** |
| Relative scratch SVG through GitHub raw | `css-enter` animates | `css-enter` animates | static control frozen | diagnostic complete | diagnostic complete | **not tested** |

The full hosted plan is still 35 rows per engine (105 total): every probe under both hosted paths
and embed forms, two reduced-motion controls, and the positive control. #180 proved body identity
independently of intrinsic sizing, but its one authorized seven-row retry failed before capture on
the rendered-width guard. Do not rerun it without a new bounded authorization; the next useful step
is a metadata-only measurement of the exact harness selector/layout that records the rejected value,
followed by a reviewed bound change. Only a later green seven-row diagnostic can unlock #113's
unfiltered plan. The direct Worker matrix does not need rerunning.

## PR #77 reconciliation and provisional selection

PR #77's Chrome observation remains valid only for its exact minimal three-rect CSS-translation
probe. Its record did not pin a browser build, request URL or headers, load-relative timestamps,
captures, or a GitHub/Camo delivery path. It supports the existing readable-frame-zero and
fill-`none` delay guards, but cannot establish that Chromium or GitHub universally freezes CSS
animation.

The new direct-Worker recordings show motion for every tested CSS and SMIL probe in Chromium
143.0.7499.4, Firefox 144.0.2, and WebKit 26.0 except `css-offset-path`, which is frozen in all
three. The partial hosted run shows raw and Camo `css-enter` motion in Chromium and Firefox for
both `<img>` and `<picture>`. Because WebKit hosted identity and sizing is blocked by #180 and the
full 105-row matrix has not run, the `github-readme` backend remains unselected.

The only responsible interim guidance is provisional: `web` prefers CSS with an explicit SMIL
override for `offset-path`; Studio keeps both backends selectable; `github-readme` remains
`none` / unselected until #113 completes. This checkpoint does not change executable motion
defaults. Issue #125 owns that choice after the final evidence.
