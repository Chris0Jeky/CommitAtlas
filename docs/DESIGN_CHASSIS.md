# The shared chassis

The CommitAtlas web surface is built on a design system with exactly **one brand variable:
temperature**. Everything else — the 42px survey grid, mono-over-sans hierarchy, corner cuts,
section numerals, `REF:` chips — is chassis, and does not change between themes. That is what makes
four themes read as one system rather than four skins.

This document is the contract. The values live in [`lib/chassis.ts`](../lib/chassis.ts), which is the
single source of truth; [`app/globals.css`](../app/globals.css) emits them and
[`lib/chassis.test.ts`](../lib/chassis.test.ts) holds them to their contrast floors. The design this
was implemented from is in [`design_handoff_shared_chassis/`](../design_handoff_shared_chassis/) —
its `.dc.html` canvas needs a design-tool runtime to render, so read it as a spec by inspecting the
inline styles.

## Themes

Brightness and chrome are the only things a theme changes.

| Theme | Ground | Ink | Chrome | Notes |
| --- | --- | --- | --- | --- |
| **Fieldline** | `#0e0f0d` | `#edf0e2` | `#d9ff4a` | Default. Signal lime. |
| **Observatory** | `#11110f` | `#eee9e1` | `#ffd166` | The earlier warm revision. Its chrome *is* the gold hinge. |
| **Midline** | `#3a3d33` | `#f0f2e4` | `#e6ff70` | Mid-tone reading theme. |
| **Limestone** | `#e8ecd6` | `#23261c` | `#55651a` | Light, and deliberately not `#ffffff`. |

Limestone is not pure white because a 3.2%-opacity survey grid is invisible on white, and the whole
chassis collapses into an ordinary light page without it.

The theme is a user-facing setting on the web surface only. It persists in `localStorage` and is
applied to `<html>` before first paint by an inline bootstrap in the root layout. It is deliberately
**not** a cookie: the served HTML is otherwise identical for every visitor and therefore cacheable,
and fragmenting that cache per visitor to carry a preference that costs one attribute on the client
is a bad trade.

**The SVG card `theme=` query parameter is a different setting** — the chassis theme switch never
touches it. The four card themes keep their names, so every existing `theme=` URL still resolves,
but they were redrawn in this vocabulary in v0.3.0. See "The cards" below.

## The temperature scale

One instrument scale, not two brands:

```
#ff7a45 ember  →  #ffc857 gold  →  #ffd166 HINGE  →  #58e6be aqua  →  #b89bff violet
```

`#ffd166` is the hinge, and it stays byte-identical everywhere. A card embedded in a README and the
plate that frames it have to agree, which is the one thing this value exists to guarantee.

## Ink roles

An **ink role** is a temperature or status colour at the moment it is painted as *text or a small
mark* rather than as a large graphic.

On a dark ground the ink roles are the scale itself. On Limestone they cannot be: every value in the
temperature scale measures between **1.1:1 and 2.1:1** against that ground, which is unreadable as
text and under the 3:1 floor even for a graphical mark. The chassis already solves this once, for
chrome — Fieldline's signal lime becomes Limestone's olive, same hue, darkened for the ground. The
light ink roles are that same rule applied to the rest of the palette, so they are a *rendering* of
the scale on a pale ground rather than a second palette.

The scale bar itself keeps the raw ramp on every theme. It is a large swatch whose job is to show
the scale, and darkening it there would be showing something else.

Two floors apply, by what the role actually paints:

- **4.5:1** for every role that prints small text (the chassis sets its secondary copy at 9–11px).
- **3:1** for `--warm-line`, which only strokes the plotter trace, fills the density grid, and
  colours a 25px display italic — a graphic and large text.

`chassis.test.ts` asserts both floors against every theme's own ground *and* plate, and asserts that
a per-theme override only exists where the shared value genuinely failed. There is one such
override: Midline's failing red, which lands at 4.42:1 there.

## The six health states

`lib/health.ts`. Each state carries four independent channels, so the rack still reads with the
colours deleted:

| State | Word | Lamp shape | Trace | Colour |
| --- | --- | --- | --- | --- |
| unavailable | UNAVAILABLE | `NO SIGNAL` plate, rotated −3° | solid dim flatline | none |
| unconfigured | UNCONFIGURED | dashed empty socket | dashed flatline | none |
| stale | STALE | frozen dashed clock | dotted sawtooth | `#c9a35a` |
| passing | PASSING | filled disc | solid sawtooth | `#75d69b` |
| failing | FAILING | filled diamond | spiked sawtooth | `#ff7b7b` |
| pending | PENDING | half-filled disc | solid run into a dashed tail | `#ffd166` |

The two states that mean *nothing was observed* carry **no colour of their own**. Tinting them would
put them on the same channel as a real reading.

`pending` is the only state allowed to pulse. Pulsing is the acquisition idiom; `unavailable` stays
unlit and steady, because a gauge that animates while reporting nothing is theatre pretending to be
a signal.

The rack lists the three unknowns first. Sorted by good news they read as leftovers; sorted this way
they read as findings, which is what they are.

## The evidence layer

`lib/evidence.ts`. CommitAtlas already refuses to paint an unknown signal green. The evidence layer
is the same rule one level up: a number that was *counted* and a number that was *inferred* look
different, are labelled differently, and each carries its own caveat.

Three rungs, never a fourth:

- **observed** — it is in the data. Counted, not modelled. No formula, because there is none to show.
- **derived** — it follows from the data by a stated formula. The formula is printed in mono.
- **hypothesis** — CommitAtlas chose it. A band, a threshold, or a proxy. Dashed trim everywhere it
  appears.

Rung is encoded three ways — the word, the dot fill (solid / half / dashed), and the border style —
so it survives greyscale for the same reason the CI rack does.

**A tier is not a fixed property of a metric.** Two records change rung with their evidence:

- The **activity mix** is `observed` when GitHub returns exact categorised counts, and `hypothesis`
  when the only available source is the annual public-profile percentages — those describe a year
  the requested window does not cover. That distinction already existed inside
  `ContributionMetrics.breakdownBasis`; the evidence layer is where it becomes visible to a reader.
- The **star total** is `derived` normally (GitHub reports stars per repository, never per account,
  so the total is a summation) and `hypothesis` when the repository list came back truncated, where
  it is a lower bound rather than a total.

The **rhythm score** is `derived` — a stated formula over observed values. The **rhythm level**
("steady", "strong") is `hypothesis`, because nothing in GitHub's data says where one band ends and
the next begins. The word is a label on a threshold CommitAtlas invented, not a finding.

One shared drawer rather than a popover per number: there is only ever one question being asked, and
a single dialog is the only version of this that stays navigable by keyboard. It is a native
`<dialog>` opened with `showModal()`, so the browser supplies the focus trap, the backdrop, and
Escape — an earlier hand-rolled version declared `aria-modal="true"` without any of them, which
confined a screen-reader user while letting a keyboard user Tab straight out underneath the scrim.

`buildEvidence` describes more readings than the landing page prints, because some of them belong to
values the *cards* show and an SVG cannot host a button. `LANDING_EVIDENCE_IDS` in `lib/landing.ts`
declares the subset the page wires, the page prints that count, and `rendered-html.test.mjs` holds
the served `data-ev` attributes to exactly that list — so the count and the claim cannot drift apart
the way "every number on this page is a button" did.

## Motion

Two hard rules, and everything else follows from them:

**Everything is readable at frame zero.** Traces are pre-drawn beneath the animated stroke at 22%
opacity, and every value is printed as text beside its instrument.

**Every keyframe declares only a start state.** The inline value *is* the final state, so removing
the animation leaves the element exactly where it was always going to end up. That is why the
reduced-motion path needs no JavaScript gate: a single media query removes all animation and the
result is a complete page, not a degraded one.

| Ref | What | Spec |
| --- | --- | --- |
| M1 | Plotter | bright trace draws over a 22% pre-drawn path, pen dot rides `offset-path`; 9s cycle, `cubic-bezier(.4,0,.2,1)` |
| M2 | Rhythm needle | −90° → overshoot 47° → 36° → settle at the reading; 2.2s, `cubic-bezier(.33,1,.68,1)`, once, transform-only |
| M3 | Density fill | columns brighten in date order, 400ms ease-out, 14ms stagger; `from { opacity: .14 }` only |
| M4 | Iris breathe | reticle scales 1 → 1.045, 4.5s ease-in-out, transform-only |
| M5 | Signal lamp | 2.4s opacity pulse, `pending` only |
| M6 | Survey beam | 70px gradient sweeps the flagship plate, 7s linear; the card beneath never moves |
| M7 | Acquisition failure | needle hunts, stutters, falls back to −90°; the lamp never lights and the plate reads NO SIGNAL from frame zero |
| M8 | Evidence drawer | up 12px and settle, 260ms, `cubic-bezier(.2,.9,.3,1)`; ESC or click outside closes |
| — | Survey parallax | the grid drifts at 0.85× scroll via a scroll-driven CSS timeline, off below 768px. Browsers without `scroll()` timelines get a static grid, which is the reduced-motion state anyway |

The card SVGs keep `motion=none|subtle` and stay transform-only. Nothing here changes them.

## Where this departs from the handoff

Both deliberate, both recorded so the next reader does not "fix" them back:

- **The languages plate reads REPOSITORY SHARE, not BYTE SHARE.** That route is fed by the profile
  snapshot, whose `share` is a distribution over repositories — see `toLanguagesCard`. Printing the
  wrong basis on the one card whose entire purpose is that it makes no proficiency claim would be the
  exact failure this product exists to avoid. Moving to byte share would need per-repository language
  calls, which is a separate slice with its own rate-limit cost.
- **The mobile station tiles stack rather than pairing two-up.** Artboard 4D pairs the station
  *chips*; these tiles carry a headline, three readings, and four destinations each, which is 163px
  per tile at 390 and not a chip.

The shared-chassis hero in the handoff presents two stations, CommitAtlas and developer-lens. This
repository is one of them, so the second tile names CommitAtlas's own distribution surfaces instead.
None of developer-lens's vocabulary appears on this surface, and `rendered-html.test.mjs` asserts
that it does not.


## The cards

`packages/svg`. Eight SVG surfaces, drawn in the same vocabulary as the web surface: corner-cut
plates, section numerals, mono chrome labels, square swatches, dashed sockets for an unconfigured
probe.

They are rendered inside an `<img>` on GitHub, which sets two hard constraints the web surface does
not have. **No webfont can load**, so the cards use a system stack and have to survive substitution
on whatever machine renders them — an embedded `@font-face` would spend the whole 30 KiB budget
before any data was drawn. And **the card carries its own opaque background**, so it is a plate on
the reader's page rather than part of it.

### The density ramp

One hue at four steps, plus a neutral socket for a day with nothing observed.

Never four hues. Hue carries no order — nothing about orange, green and yellow says *more* — and
the ramp this replaced also borrowed `accent`, `positive` and `warning`, which are the three colours
the contribution mix prints one panel to the right. A square's colour therefore named a category it
did not mean. In greyscale that ramp inverted between levels 3 and 4, so it failed outright for
anyone reading without colour.

`densityFill` is the only place a level becomes a colour, and a non-finite level resolves to the
socket rather than indexing past the end of the ramp: an unreadable signal must never paint as the
busiest day. `svg.test.mjs` asserts monotonic luminance, a ≥1.25× separation at every step, and that
no step collides with the mix ink or a status colour.

The direction follows the ground. On a dark card more activity is **brighter**; on a light card it
is **darker**. The socket stays neutral either way, because a pale tint of the activity colour reads
as a little activity and a day with none had none.

### The contribution mix

One ink, four rows. The bar's *length* is the variable, so its colour is free to stay constant — and
holding it constant is what stops the mix handing the reader a second, contradictory colour
vocabulary beside the density grid.

### The dark/light pair

Every theme names a partner in the opposite colour scheme: `paper` is the light partner for all three
dark themes, and `ember` is the dark partner for `paper`.

`buildStudioMarkdown` uses that pairing to emit a `<picture>` block keyed on `prefers-color-scheme`,
so a README serves whichever card matches the reader rather than pinning one and being wrong for
half the audience. The `<img>` fallback names the theme the user actually chose, so a renderer
without `<picture>` support still shows their selection.

| Theme | Scheme | Ground | Partner |
| --- | --- | --- | --- |
| `ember` | dark | `#121310` | `paper` |
| `aurora` | dark | `#09131f` | `paper` |
| `midnight` | dark | `#05070d` | `paper` |
| `paper` | light | `#dfe4c9` | `ember` |

`paper` is Limestone rather than white, so the light card still reads as a card on a white page.
