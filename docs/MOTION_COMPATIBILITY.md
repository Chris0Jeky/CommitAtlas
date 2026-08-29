# Motion compatibility evidence

Status: Phase 0 is in progress. This ledger records measured outcomes only; an unfilled cell is
**not tested**, never a compatibility claim. The fixture set and local capture tool live in
[`tests/fixtures/motion-probes/`](../tests/fixtures/motion-probes/). The public synthetic scratch
repository for the GitHub/Camo part of the protocol is
[Chris0Jeky/commitatlas-motion-probes](https://github.com/Chris0Jeky/commitatlas-motion-probes).

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

The cached Playwright 1.57.0 runner can instead be passed through `--playwright-engine` and
`--playwright-cli`. On Windows, `--playwright-cli` must name the package's `cli.js`, never its
`.cmd` launcher; the harness rejects the latter before starting a browser. This permits
Firefox/WebKit capture and `--reduced-motion` without changing `package.json` or `package-lock.json`.
Capture artifacts are deliberately untracked; their compact, dated pixel evidence is committed in
[`2026-08-29-local-direct.json`](../tests/fixtures/motion-probes/evidence/2026-08-29-local-direct.json).

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
That establishes the local fixture and runner path only; it does not answer whether GitHub retains
the same `<source media="(prefers-reduced-motion: reduce)">` element.

## Matrix still required

| Host | Plain `<img>` | `<picture>` / colour scheme | Reduced-motion source retained | Chromium | Firefox | WebKit |
| --- | --- | --- | --- | --- | --- | --- |
| Local direct | partial rows above | partial rows above | local selection: yes | partial | partial | partial |
| Direct hosted Worker SVG with production SVG CSP | not tested | not tested | not tested | not tested | not tested | not tested |
| Worker SVG in GitHub README through Camo | not tested | not tested | not tested | not tested | not tested | not tested |
| Relative scratch-repository SVG in GitHub README through Camo | not tested | not tested | not tested | not tested | not tested | not tested |

The remaining matrix must run every probe under every host/embed/engine combination, retain the
four captures and a three-second recording, and record the source URL, response headers, browser
version, capture hashes, and pixel-pair results. The scratch repository is public and synthetic;
the Worker test must use the same SVG CSP behaviour as `svgResponse(..., { inlineStyles: true })`
in `lib/http.ts`.

## Interpretation and next decision

The earlier PR #77 three-rect result remains a lead, not a replacement for this matrix. Current
coverage is incomplete and confounded: each engine/embed conclusion comes from one probe, and the
host is only the loopback fixture server. It therefore cannot establish either engine or embed path
as the cause of a result. The readable static base in every probe only makes a frozen outcome
inspectable. These rows do **not** reconcile PR #77 or justify a default CSS or SMIL backend for
`github-readme`, `web`, or `studio`; #125 must choose those defaults only after the hosted
GitHub/Camo and Worker rows are complete.
