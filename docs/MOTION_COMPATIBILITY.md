# Motion compatibility evidence

Status: Phase 0 is in progress. This ledger records measured outcomes only; an unfilled cell is
**not tested**, never a compatibility claim. The fixture set and local capture tool live in
[`tests/fixtures/motion-probes/`](../tests/fixtures/motion-probes/). The public synthetic scratch
repository for the GitHub/Camo part of the protocol is
[Chris0Jeky/commitatlas-motion-probes](https://github.com/Chris0Jeky/commitatlas-motion-probes),
currently pinned for the complete hosted capture at
`039a0370b1a52fb6135e4414e04a11bff7ba21d0`.

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

`--out` must name a new directory; the harness refuses to replace prior capture evidence.
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
duration, and the report states that boundary explicitly:

```powershell
$playwrightCli = 'C:\Users\jekyt\AppData\Local\npm-cache\_npx\0b9ff77863cb6e9f\node_modules\playwright\cli.js'
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
engines; its four frame pairs are `0/0` (Chromium: 59,173 control pixels; Firefox: 59,596;
WebKit: 59,256).

The complete five-frame direct-Worker pixel matrix is recorded in
[`2026-08-29-worker-direct.json`](../tests/fixtures/motion-probes/evidence/2026-08-29-worker-direct.json):
all 48 normal rows include the `0, 250, 500, 2,000, and 5,000 ms` captures and each adjacent
pixel pair. The reports were captured with Playwright 1.57.0 (Chromium 143.0.7499.4, Firefox
144.0.2, WebKit 26.0) against
`https://commit-atlas.commit-atlas.workers.dev/api/v1/probes/motion/`, deployed from merge
`f3d192f`. All nine fixed URLs returned `200 image/svg+xml; charset=utf-8` with the production
cache, CSP, CORS, CORP, and `nosniff` headers; their exact response values and hashes are in the
ledger.

The required three-second recordings were **not** captured. Therefore #113 remains open, the
GitHub Camo matrix is still pending, and these five-frame results do not justify a CSS or SMIL
backend default yet.

## Direct Worker matrix — 2026-08-29

| Host | Plain `<img>` | `<picture>` / colour scheme | Reduced-motion source retained | Chromium | Firefox | WebKit |
| --- | --- | --- | --- | --- | --- | --- |
| Direct hosted Worker SVG with production SVG CSP | CSS/SMIL animate; `css-offset-path` frozen | CSS/SMIL animate; `css-offset-path` frozen | static control selected | complete | complete | complete |

The five-frame matrix above is complete for the direct Worker host only. The required three-second
recordings remain outstanding, so the hosted result is evidence, not release authorization.

## Measured GitHub README delivery and source selection — 2026-08-29

GitHub's rendered scratch-repository README retained all nine relative SVG images and both
`<picture>` sources. In Chrome, temporary `prefers-reduced-motion: reduce` emulation selected the
relative static gold control; resetting to `no-preference` selected the dark-scheme SMIL fallback.
The temporary browser emulation was reset after the observation. The compact evidence is in
[`2026-08-29-github-readme-chromium.json`](../tests/fixtures/motion-probes/evidence/2026-08-29-github-readme-chromium.json).

The relative repository images are **not Camo-delivered**. The rendered DOM points at a
`github.com/.../raw/main/...` URL, which redirects to `raw.githubusercontent.com`; the inspected
response was `image/svg+xml` with
`Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`. Camo remains the
delivery path to test for the absolute Worker URL embedded in the README. This observation proves
sanitizer retention and source selection in Chrome, not animation: no GitHub-page pixel sequence
or recording has been captured yet.

## Matrix still required

| Host | Plain `<img>` | `<picture>` / colour scheme | Reduced-motion source retained | Chromium | Firefox | WebKit |
| --- | --- | --- | --- | --- | --- | --- |
| Local direct | partial rows above | partial rows above | local selection: yes | partial | partial | partial |
| Worker SVG in GitHub README through Camo | not tested | not tested | not tested | not tested | not tested | not tested |
| Relative scratch-repository SVG in GitHub README through GitHub raw | loaded; motion not tested | sources retained; motion not tested | selected static source in Chrome | structural/source-selection only | not tested | not tested |

The remaining matrix must run every probe under every host/embed/engine combination, retain the
five-frame captures and a three-second recording, and record the source URL, response headers,
browser version, capture hashes, and pixel-pair results. The scratch repository is public and
synthetic; the Worker test uses the same SVG CSP behaviour as
`svgResponse(..., { inlineStyles: true })` in `lib/http.ts`. The Worker five-frame capture is
complete; only its three-second recording and the GitHub Camo matrix remain here.

## Interpretation and next decision

The earlier PR #77 three-rect result remains a lead, not a replacement for this matrix. Current
motion coverage is still incomplete for release: direct Worker motion has now been pixel-measured
across all engines and embed forms, but its required three-second recordings and the GitHub/Camo
matrix are absent. GitHub raw delivery and Chrome source selection are observed, but GitHub-page
animation is not. The readable static base in every probe only makes a frozen outcome inspectable.
These rows do **not** reconcile PR #77 or justify a default CSS or SMIL backend for `github-readme`,
`web`, or `studio`; #125 must choose those defaults only after the recording and hosted
GitHub/Camo rows are complete.
