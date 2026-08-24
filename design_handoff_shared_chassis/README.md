# Handoff: Shared Chassis — CommitAtlas + developer-lens showcase

## Overview
A unified "shared chassis" visual system presenting two working open-source projects — **CommitAtlas** (distribution layer: embeddable SVG cards + project-health dashboard) and **developer-lens** (analysis layer: local-first retrospective) — as one body of work. Direction: **observatory / mission-telemetry chassis** with an industrial "Fieldline" trim (signal-lime chrome, `//` numerals, REF codes, ▼/■ marks, corner-cut panels). Temperature is the only brand variable: CommitAtlas runs warm (ember), developer-lens runs cool (violet), gold `#ffd166` is the shared hinge. Honesty is the aesthetic: six health states, evidence tiers, caveats as content.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look, motion, and behavior, NOT production code to copy directly. The task is to **recreate these designs in the target codebases' existing environments**:
- CommitAtlas web surface: Next.js on Cloudflare Workers (free plan — CSS/SVG/Canvas 2D only, no WebGL libs; worker < 3 MiB gzipped)
- developer-lens: React + Vite on GitHub Pages
- SVG cards: `packages/svg` theme objects (do not restyle the cards themselves)

`Shared Chassis Showcase.dc.html` is the master design canvas. It contains all artboards, newest at top, each with a visible badge id:
- **2A** Hero (Fieldline chassis, rev B — the reference hero; 1A is the earlier rev A, kept for comparison)
- **2B** Web-surface themes (Fieldline / Observatory / Midline / Limestone)
- **2C** Card gallery ("specimen tray")
- **3A** Health panel (six signal states + acquisition sequence)
- **3B** Evidence ladder + evidence drawer
- **4A** Method Trial page treatment
- **4B** Wrapped ruling + chapter plates + M9 transition
- **4C** Unified token set
- **4D** Mobile 390×844 (hero + gallery)
- **4E** OG cards (rendered PNGs in `assets/`)
- **4F** Favicon marks (standalone SVGs in `assets/`)

## Fidelity
**High-fidelity.** Colors, type values, spacing, copy, and motion specs are final and should be implemented as specified. All numbers and copy are the real synthetic-octocat values from the projects' own content — do not substitute placeholders.

## Design Tokens

### Chassis neutrals (Fieldline, default dark)
- Ground `#0e0f0d` · Plate/panel `#121310` (fascia fill `rgba(20,22,16,.6)`)
- Ink `#edf0e2` · Muted `#9aa08c` · Hairline `rgba(237,240,226,.13)` (11–13%)
- Survey grid: 42px × 42px, `rgba(255,255,255,.018)` 1px lines, layered under radial temperature blooms (`rgba(255,122,69,.05–.07)` warm corner, `rgba(184,155,255,.06)` cool corner)

### Temperature scale (one instrument scale, not two brands)
`#ff7a45` EMBER (STN A) → `#ffc857` gold → **`#ffd166` HINGE (shared, byte-identical in both codebases)** → `#58e6be` aqua → `#b89bff` VIOLET (STN B). Secondary cool: `#d9caff` violet-soft, `#8fd8d2` mid-aqua.

### Chrome (labels, badges, marks) per web theme
- **Fieldline** (default dark): chrome `#d9ff4a`, bg `#0e0f0d`, ink `#edf0e2`
- **Observatory** (warm dark, legacy rev A): chrome `#ffd166`, bg `#11110f`, ink `#eee9e1`
- **Midline** (mid-tone reading theme): chrome `#e6ff70`, bg `#3a3d33`, ink `#f0f2e4`
- **Limestone** (light — never pure white): chrome `#55651a`, bg `#e8ecd6`, ink `#23261c`
- SVG **card** themes (aurora/midnight/paper/ember) are UNCHANGED; `paper` stays for light README embeds.

### Status (shared, always shape + word + color)
- passing `#75d69b` — filled disc, ✓, solid trace
- failing `#ff7b7b` — filled diamond (45° square), ✕, spiked trace
- pending `#ffd166` — half-filled disc, ◐, pulsing (the ONLY state allowed to pulse)
- stale `#c9a35a` — frozen dashed clock, dotted trace, "last observed >72h"
- unconfigured — dashed empty square socket, dashed border, dashed flatline
- unavailable — "NO SIGNAL" bordered plate (rotate −3°), solid dim flatline, unlit steady lamp

### Type
- Sans: **Geist**; display weight 620, `letter-spacing:-.062em`, `line-height:.98` (mobile clamps to 42px, tracking −.055em)
- Mono: **Geist Mono**; labels 10–11px, `letter-spacing:.13em`, uppercase
- Accent gesture: the emphasised half of a headline switches to **Georgia italic** in the local temperature ink (ember on STN A, violet on STN B, chrome lime on chassis-level pages)

### Radius / depth (station trim, not brand)
- STN A (CommitAtlas): R0, flat hairline panels; chassis panels may take a 14–26px corner-cut `clip-path`
- STN B (developer-lens): R12/20/30, translucent panel `rgba(18,20,34,.78)`, shadow `0 24px 80px rgba(0,0,0,.28)`

### Quirk vocabulary (chassis chrome)
`NN //` section numerals · `REF:` chips (1px chrome border) · `▼` header marker · `■ ■ □ □` index squares · oversized outlined watermark numerals (`-webkit-text-stroke` 1px chrome @ 13%) · hazard strip `repeating-linear-gradient(45deg, chrome 45% 0 6px, transparent 6px 13px)` · corner crop marks (L-shapes, 1.5px chrome) · panel screws (8px circles, hairline) · barcode strip (repeating-linear-gradient)

## Motion brief (M1–M9)
Hard rules from CONSTRAINTS.md: everything readable at frame zero (traces pre-drawn faintly beneath; values always printed as text); motion never load-bearing; full `prefers-reduced-motion` path = complete static page (inline styles ARE the final state; keyframes only animate FROM a start state); card SVGs keep `motion=none|subtle` (transform-only).

- **M1 Plotter**: bright momentum trace draws over 22%-opacity pre-drawn path; gold/lime pen dot rides `offset-path`. 5.5s draw / 9s cycle, `cubic-bezier(.4,0,.2,1)`, on load, infinite re-arm. `stroke-dasharray:100; stroke-dashoffset 100→0` with `pathLength="100"`.
- **M2 Rhythm needle**: −90° rest → overshoot 47° → 36° → settle 39.6° (=72/100 on a −90..90 gauge). 2.2s, `cubic-bezier(.33,1,.68,1)`, .3s delay, once, fill both, transform-only.
- **M3 Density fill**: heatmap cells visible dim (opacity .14) at frame zero, brighten in date order; 400ms ease-out each, 14ms stagger. Keyframe declares only `from{opacity:.14}` so each cell animates to its own inline final value.
- **M4 Radar/iris breathe**: DNA polygon (or reticle ring) scales 1→1.045, 4.5s ease-in-out infinite alternate, transform-only.
- **M5 Signal lamp**: 2.4s opacity pulse 1↔.35 — the "acquiring" idiom, reserved for pending; unavailable stays unlit and steady.
- **M6 Survey beam**: 70px gradient strip sweeps the flagship card plate L→R, 7s linear infinite; the card beneath never moves.
- **M7 Acquisition failure**: unavailable gauge needle hunts — rises to ~−34°, stutters (−44°/−28°/−50°), falls back to −90° rest; lamp never lights. 5.5s cycle, `cubic-bezier(.4,0,.3,1)`, transform-only. Plate reads NO SIGNAL from frame zero.
- **M8 Evidence drawer**: slides up 12px + settles, 260ms, `cubic-bezier(.2,.9,.3,1)`; trigger = click any dotted-underline number; ESC/outside closes. Reduced motion: appears in place fully drawn.
- **M9 Wrapped chapter handoff**: survey grid slides exactly one 42px cell left (320ms, `cubic-bezier(.2,.9,.3,1)`); outgoing needle parks; incoming chapter trace draws over its faint path (600ms). No crossfade. Scroll-snap kept. Reduced motion: instant cut between complete plates.
- **Scroll (page-level)**: 42px grid parallaxes at 0.85× scroll rate; instrument-scale pointer slides warm→cool crossing Atlas→Lens sections. Off below 768px.

## Screens / Views (implement from the canvas artboards)

### Hero (2A)
Console header strip (▼ title + REF chip left; STN A/B + ■ index right, 16px pad, hairline bottom). Headline block max-width 900px: chrome mono eyebrow with glowing 6px dot, 76px display headline with Georgia-italic second line in chrome, 19px/1.55 muted sub. Outlined `02//` watermark top-right. Instrument fascia (hairline border, corner-cut, lime hazard strip on left edge, 4 corner screws): grid `1.25fr 1fr 1fr 1fr` = M1 plotter / M2 gauge (0·50·100 tick labels, caption "EVENNESS · NOT A RANK") / M3 density grid (14×7, 9px cells, gap 3) / M4 six-axis DNA radar (axes FOC SHP COL CON BRD STW, dominant axes in aqua) resolving to "Force Multiplier · HYPOTHESIS · FROM 6 OBSERVED AXES". Below fascia: instrument-scale ramp rail with center hinge pointer. Two station tiles (warm R0 corner-cut vs cool R12 translucent) with real taglines + stats; STN A footer shows "0/2 CI PASSING · 2 UNAVAILABLE — SHOWN DARK, NEVER GREEN" with two unlit square lamps. Footer trust strip + barcode.

### Card gallery (2C)
Flagship plate: `#121310`, hairline border, 4 lime crop-mark corners, real `atlas-ember.svg` at native 860×380 with M6 beam, right meta column (ROUTE/SIZE/LIMITS/MOTION rows + caveat). 3-col grid of 8 plates (compact atlas + 7 ember cards at natural aspect), each: mono header `CARD NN // NAME` + size, the untouched SVG, footer note + "OPEN SVG ↗". Hover: translateY(−3px) + border brightens, 180ms. Theme filmstrip: atlas in aurora/midnight/paper/ember — paper displayed on a Limestone ground chip.

### Health panel (3A)
Six equal bays, `repeat(6,1fr)`, gap 14. Order: unavailable, unconfigured, stale, passing, failing, pending. Each bay = state word + count/glyph header, lamp shape (64px zone), trace SVG (160×18), 3-line mono description. Encodings must survive greyscale. Below: M7 acquisition-sequence demo strip (gauge + explanation + spec line). Live synthetic reading in header: "0/2 CI PASSING · 0 ATTENTION · 2 UNAVAILABLE · 72H FRESHNESS WINDOW · calculateCiState()".

### Evidence layer (3B)
Left: 3-rung ladder connected by a gradient spine (aqua→violet→ink); rungs = observed (solid dot, aqua border), derived (half dot, violet), hypothesis (dashed dot + dashed border). Real rules: rhythm-observed, portfolio-gravity, orchestration-hypothesis. Right: closed state (number with dotted aqua underline = button) + open drawer (R12 translucent, tier pill + SYNTHETIC OCTOCAT pill, BASIS/FORMULA/CAVEAT rows in 86px/1fr grid, coverage footer). Drawer FORMULA row renders in mono violet-soft.

### Method Trial (4A)
"INVENTED C0 · OFFLINE" plate beside eyebrow; REJECTED stamp (2px `#ff7b7b` border, 22px mono, .3em tracking, rotate −4°) top-right at the same level as the headline. Paired scorecard: detection 75.0% = 75.0% tie (two equal bars, aqua vs violet), false alerts 2.9667 vs 4.2 (+41.6%, candidate bar in negative red). Stat row 54 / 5,616 / 5,346 / 270. Three method chips: baseline (aqua, KEPT), candidate (violet, REJECTED), PELT (dashed gold, DESCRIPTIVE ONLY — never online promotion). Acceptance ladder: ✓ equal detection, ✓ no worse calibration, ✕ fewer false alerts → one failed rung rejects. Reproduce line in mono.

### Wrapped (4B)
Ruling: ABSORB. Keep nine chapters and scroll-snap; chapters become chassis plates (hairline border + chapter-accent trim), per-chapter gradient pairs survive as a 4px accent bar per plate, blur-blob backgrounds retired in favor of the 42px grid. Hypothesis chapters get dashed trim. Transitions per M9.

### Mobile (4D)
390×844. Header strip compresses to ▼ + index. Display 42px. Fascia stacks: plotter full-width, then gauge row (number left, gauge right). Station chips 2-up. Gallery: compact 480×570 card leads, plates stack (no carousel). Hit targets ≥44px. Beam + parallax off; plotter + needle kept.

### OG cards (4E) & favicons (4F)
Final PNGs and SVGs in `assets/`. OG layout (shared, siblings): 10px temperature edge left, mono header (STN + domain), project name 40px, tagline 76px with Georgia-italic temperature half, right-side instrument (heat-cell block / reticle), mono footer with honesty line ("✓ UNKNOWN NEVER LOOKS FINE" / "✓ MISSING IS NEVER ZERO") in gold. Favicons: one 16px construction (2px-ish strokes), Atlas = square frame + ember quadrant + gold cell; Lens = ring + violet iris + aqua dot. On light tabs, frame stroke flips to `#23261c`, accents hold.

## Interactions & Behavior
- Every metric number: `cursor:pointer`, dotted underline in aqua, opens Evidence Drawer (M8); ESC/click-outside closes; focus ring 2px `--aqua`.
- Card plates: hover lift (M6 spec footer); "OPEN SVG ↗" links to the raw route.
- Health bays: static except pending pulse; tooltips optional but state word is always printed.
- Theme switch: chassis themes are a user-facing setting on the web surface only; persists; card `theme=` query param unchanged.
- Reduced motion: single media query removes all animation; no JS gating needed because final states are inline.

## State Management
Minimal: theme selection (persisted), evidence-drawer open target, wrapped chapter index (already exists as `--journey-progress` plumbing in developer-lens — reuse it for M9 and the scale pointer).

## Constraints recap (non-negotiable, from CONSTRAINTS.md)
Six distinguishable health states; unknown never looks fine; color never the only encoding; caveats are content and always visible; rhythm is not a rank; languages = byte share; Method Trial stays labelled invented C0; `paper` card theme stays; SVG cards: no script/foreignObject/handlers/external refs, <30 KiB, 860×380 / 480×570; Cloudflare free plan (CSS/SVG/Canvas 2D); everything readable at frame zero; complete reduced-motion page.

## Assets
- `assets/og-commitatlas-1200x630.png` — final OG card, CommitAtlas
- `assets/og-developer-lens-1200x630.png` — final OG card, developer-lens
- `assets/favicon-commitatlas.svg` — 16px map-quadrant mark
- `assets/favicon-developer-lens.svg` — 16px reticle mark
- Card SVGs referenced by the canvas are the projects' own live-fetched files (`cards/` in each repo / `uploads/` in this design project) — never restyle them.

## Files
- `Shared Chassis Showcase.dc.html` — the master canvas (all artboards, badges 1A–4F). It uses a design-tool runtime (`support.js`) and Google-hosted Geist; treat it as the visual reference, inspect inline styles for exact values.
