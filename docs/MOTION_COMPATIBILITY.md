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

Capture at 0, 500, 2,000, and 5,000 ms. Decode each PNG to RGBA, then compare adjacent frames;
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
`--playwright-cli`; it permits Firefox/WebKit capture and `--reduced-motion` without changing
`package.json` or `package-lock.json`. Capture artifacts are deliberately untracked; their compact,
dated pixel evidence is committed in
[`2026-08-29-local-direct.json`](../tests/fixtures/motion-probes/evidence/2026-08-29-local-direct.json).

## Measured local-direct results — 2026-08-29

The host was a loopback static fixture server. These rows do not test GitHub, Camo, a Worker, CSP,
or the GitHub sanitizer.

| Probe | Embed | Engine | Result | Pixel-pair evidence (0→500, 500→2000, 2000→5000 ms) |
| --- | --- | --- | --- | --- |
| CSS breathe | `<img>` | Chromium 143.0.7499.4 | animates | 5367/748141, 5367/748191, 6733/1613328 |
| CSS breathe | `<picture>` | Chromium 143.0.7499.4 | animates | 5396/743627, 5396/743727, 6730/1613316 |
| CSS enter | `<img>` | Firefox 144.0.2 | frozen at frame zero | 3/90, 0/0, 0/0 |
| CSS enter | `<picture>` | Firefox 144.0.2 | frozen at frame zero | 0/0, 0/0, 0/0 |
| CSS enter | `<img>` | WebKit 26.0 | frozen at frame zero | 25/964, 0/0, 0/0 |
| CSS enter | `<picture>` | WebKit 26.0 | frozen at frame zero | 0/0, 0/0, 0/0 |

Reduced-motion picture selection was separately measured in Chromium: the static gold control
source was selected (`59,173` exact `#ffd166` pixels) and all three capture pairs were `0/0`.
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

The earlier PR #77 three-rect result remains a lead, not a replacement for this matrix. These local
rows demonstrate that engine and delivery path matter, and the readable static base in every probe
means a frozen outcome is still inspectable. They do **not** reconcile PR #77 or justify a default
CSS or SMIL backend for `github-readme`, `web`, or `studio`; #125 must choose those defaults only
after the hosted GitHub/Camo and Worker rows are complete.
