# CommitAtlas expansion programme

**Status: accepted development backlog, nothing shipped.** Written 2026-08-29 from an owner brief
and verified against the code at `2969032`. Shipped state stays in
[PROJECT_STATE.md](./PROJECT_STATE.md); this document says where the product is going and why,
in enough detail that an agent can pick any seeded issue and start. Tracking issue:
[#111](https://github.com/Chris0Jeky/CommitAtlas/issues/111). Cross-project seams are specified in
[PROJECTION_CONTRACTS.md](./PROJECTION_CONTRACTS.md).

Read order for an implementing agent: this file → the issue → the files the issue names →
[DESIGN_CHASSIS.md](./DESIGN_CHASSIS.md) for the visual and motion vocabulary the work must speak.

## 1. The brief

The owner wants three things from CommitAtlas that it does not deliver today:

1. **A profile that feels alive.** The cards on the live profile do not visibly animate.
2. **More to display**, including outputs whose purpose is aesthetic rather than metric.
3. **Developer Lens and Developer Lens Lab brought in** — their interpretations and research
   findings, rendered on a GitHub profile without breaking either project's privacy model.

The direction that fell out of the brainstorm, and which this document adopts, is that CommitAtlas
becomes **a deterministic, privacy-aware generative profile graphics engine** rather than another
statistics-card generator: GitHub facts in, verifiable projections beside them, and a scene grammar
plus a motion system that can render spectacle without ever letting the spectacle carry a claim.

## 2. Dissection of the brainstorm against the code

Every claim the brainstorm made was checked. This table is the reconciliation; the rest of the
document builds only on the corrected rows.

| Claim | Finding | Evidence |
| --- | --- | --- |
| The Atlas already animates, but only a 5px one-shot rise over ~0.4s, so nobody sees it. | **Partly right, and it hides the real problem.** `atlasMotionStyle` emits `atlas-rise` (5px, .32–.55s, one-shot) and the standalone cards emit `card-enter` (4px, .38s). But PR #77 recorded an empirical probe in which Chromium held an `<img>`-delivered SVG at its keyframe `from` state, and the code now carries the comment "Chromium never runs CSS animations inside an SVG rendered through `<img>`". Public README widgets (typing banners, contribution snakes) are widely reported to animate on github.com in Chromium — a report this repository has not verified itself. Both observations cannot be unconditionally true. | `packages/svg/src/index.ts` (`atlasMotionStyle`, `cardMotionStyle`); PROJECT_STATE "Post-release fix e17e866"; commit `16bc4e0` |
| The public motion model is only `none \| subtle`. | **True**, and it is enforced at four layers: `RenderOptions.motion`, `parseMotion`/`parseStandaloneMotion`, the static config schema, and Studio state. | `packages/svg/src/index.ts:108`, `lib/svg-routes.ts:179-189`, `packages/static/src/config.ts`, `app/studio/studio-client.tsx:146` |
| Atlas defaults to `subtle`; standalone cards default to `none`. | **True.** | `parseMotion` vs `parseStandaloneMotion`; `studio-urls.ts:117,124` |
| The web chassis already has richer motion (scan, plotter, breathe, beam, pulse, acquisition failure) that stops at the card boundary. | **True.** M1–M8 exist in `app/globals.css`; DESIGN_CHASSIS says "The card SVGs keep `motion=none\|subtle` … Nothing here changes them." | `app/globals.css:369-430`; DESIGN_CHASSIS "Motion" |
| The profile pipeline is a daily Action, SHA-256 manifest, commit-only-on-change. | **True**, and it also validates an *exact expected artifact list*, so every new output needs a consumer change. | `Chris0Jeky/Chris0Jeky/.github/workflows/commitatlas.yml` |
| Hosted routes canonicalize, ETag, short-cache, and enable inline styles only for animated output. | **True.** `inlineStyles: query.motion === "subtle"` flips CSP `style-src` from `'none'` to `'unsafe-inline'`. Any new animated profile must flip it too, and a SMIL backend needs no style at all. | `lib/http.ts:8,37`; `app/api/v1/cards/atlas.svg/route.ts:35` |
| Developer Lens's portable export already carries repositories with disclosure, six-axis DNA, archetype, themes, narratives, and coverage. | **True.** The field names in §8 and PROJECTION_CONTRACTS come from that file, not from memory. | `developer-lens/src/lib/portableExportPayload.ts` |
| "The Action can also export Developer Lens projections locally." | **Wrong.** Developer Lens is local-first, authenticates through the owner's `gh` session, scans only explicitly supplied local roots, and its roadmap rules out any hosted mode. Its export sink accepts only pre-redacted C0/C1 views and a local source requires an explicit redaction acknowledgement. The projection is therefore an **owner-run, reviewed export committed as a tracked file**; the Action only reads that file. | `developer-lens/README.md` "Headless export"; `docs/data-charter.md` "Sink contract"; `ROADMAP.md` "Not planned" |
| A research-finding projection with decisions like `baseline-retained`, `inconclusive`. | **Adjust to the Lab's vocabulary.** An EvaluationBundle decision is only `reject`, `revise_once`, or `benchmarked`; it can never say `ship`, and `benchmarked` is still research evidence, never promotion. Canonical presentation schemas are product-owned (Developer Lens) and the Lab exports into them — exactly the pattern the existing `DeveloperLensMethodTrialSummary.v1` bridge already follows. | `developer-lens-lab/docs/PRODUCT_BOUNDARY.md`, `docs/CONTRACTS.md`; `lib/research-bridge.ts` |
| Scene family names: Observatory, Surveyor, Spectral, Terminal. | **Rename the pack ids.** `Observatory` is already a web chassis theme. Scene packs are `orbital`, `survey`, `spectral`, `terminal` (§7). | DESIGN_CHASSIS "Themes" |
| Ship an animated GIF fallback. | **Defer and gate.** CommitAtlas has no rasterizer; adding one is a dependency and determinism decision, and if Phase 0 shows SVG animating reliably the GIF is unnecessary. | §14 D-09 |
| The Studio should compare Chromium/Firefox/WebKit captures. | **Split.** The Studio gets preview controls a person uses; CI gets a browser capture harness that proves motion. | §10 |
| Hosted endpoints can render Lens scenes. | **Only from the vendored C0 showcase fixture.** Developer Lens's `public` sink permits C0 only, and hosted routes must never accept a projection URL or body. | `developer-lens/shared/privacy.ts` (`SINK_CLASS_ALLOWLIST.public`) |

The single most important correction: **do not build the motion system on the assumption that CSS
animation works through `<img>` on github.com, and do not build it on the assumption that it does
not.** Phase 0 measures it under a controlled protocol, and the motion compiler is written with two
backends (CSS keyframes and SMIL) behind one primitive API so the measurement selects a backend
instead of forcing a rewrite.

## 3. Product thesis and vocabulary

> A generative visual identity system for software developers, powered by verifiable engineering
> signals.

"Card" stays the word for the ten shipped instruments. Everything new is one of five **families**,
and each family has a fixed relationship to the evidence ladder in DESIGN_CHASSIS:

| Family | What it is | Evidence rung and label rule |
| --- | --- | --- |
| **Instruments** | Compact factual modules: the ten existing cards plus small new ones | `observed`/`derived` per reading, exactly as today |
| **Maps** | Large visualizations of relationships: terrain, lifecycle map, release train, chronograph | Geometry is `observed`; any band or threshold is printed as `hypothesis` |
| **Signatures** | Interpretations imported from Developer Lens: DNA, archetype, craft ring, delivery loop | Always `derived`, always stamped `DERIVED SIGNATURE · not a productivity score`, always carrying the projection's coverage and privacy note |
| **Scenes** | Aesthetic compositions that use observed data as a seed: nebula, city, reactor, river | Stamped `SCENE`; no numeric claim is printed unless it is also printed as an instrument reading beside it |
| **Findings** | Research results from Developer Lens Lab via a product-owned projection | Data class (`C0` invented synthetic, `C1` aggregated) printed in the frame with limitations and unsupported claims, never as profile evidence |

Three **orthogonal axes** configure any output, and no axis may leak into another:

- **Theme** — colour and typography. The four card themes (`ember`, `aurora`, `midnight`,
  `paper`) and their dark/light pairing are unchanged.
- **Scene pack** — visual grammar: frame style, grid, marker vocabulary, default motion textures.
  `orbital`, `survey`, `spectral`, `terminal`. Default `survey`, because it is the chassis's own
  cartographic-instrument grammar.
- **Motion profile** — behaviour: `none`, `subtle`, `ambient`, `cinematic` (§5).

Invariants carried forward unchanged, because they are what make the product worth extending:

- Everything is readable at frame zero. Motion never carries the fact.
- An unknown, missing, stale, restricted, or unavailable signal is never displayed as healthy.
  `unavailable` never animates; `pending` is the only state that pulses.
- Renderers are deterministic: identical input produces byte-identical SVG.
- User text is schema-bounded and XML-escaped; no scripts, remote images, fonts, `foreignObject`,
  event attributes, or external CSS; outbound hosts stay GitHub-owned.
- Private data and tokens never enter fixtures, logs, query strings, or tracked files in this
  repository. The one place the programme touches that line is the owner's redacted C1 lens
  projection, which would live as a tracked file in the owner's *own* public profile repository:
  that is an owner-directed publication, irreversible once pushed (git history keeps it), and it
  is gated by Q-9 — never assumed, never a CommitAtlas fixture, never hosted.

## 4. Target architecture

```text
GitHub public evidence ─────► @commit-atlas/github ─────► PortfolioSnapshot ─────────────┐
                                                                                          │
Developer Lens (owner's machine) ──export-profile──► PublicLensProjection.v1 ──┐          │
   redacted C1 aggregates, acknowledged, tracked file    (validated, fresh?)    │          │
                                                                                ▼          ▼
Developer Lens Lab ──dllab export finding──► ResearchFindingProjection.v1 ──► scene engine (@commit-atlas/svg)
   C0 fixture, product-owned schema, vendored + pinned                        primitives · motion compiler (css|smil)
                                                                              scene registry · budgets · seeds
                                                                                          │
                                        ┌─────────────────────────────────────────────────┼──────────────────────┐
                                        ▼                                                 ▼                      ▼
                         static CLI / Node 24 Action                          hosted /api/v1/scenes/*.svg     Studio motion lab
                         scene-*.svg + manifest v1 (additive)                 GitHub-only scenes, demo lens   preview · replay · frame zero
```

The engine lives inside `packages/svg` until a second consumer needs it elsewhere (global law 8:
structure arrives with the second item):

```text
packages/svg/src/
  index.ts            existing renderers and public exports (unchanged surface, additive exports)
  seed.ts             stable hash + seeded PRNG (mulberry32 over SHA-256 of the canonical model)
  motion/
    profile.ts        MotionProfile enum, per-target defaults, budget constants
    compiler.ts       primitive → backend encoding, namespaced ids, reduced-motion handling
    css.ts  smil.ts   the two backends
  primitives/         Frame, Metric, Badge, EvidenceLabel, CoverageBar, Sparkline, Timeline, Orbit,
                      Radar, Terrain, ParticleField, Scanline, PlotterPath, ProjectNode, SignalPulse
  scene.ts            SceneDefinition, RenderContext, registry, budget enforcement
  scenes/<id>.ts      one file per scene
```

Adapters stay where they are: `lib/svg-adapters.ts` for the hosted app and
`packages/static/src/render.ts` for the generator both build scene inputs from the same snapshot.

## 5. Motion system

### 5.1 Profiles

| Profile | Behaviour | Where allowed | Notes |
| --- | --- | --- | --- |
| `none` | No keyframes, no `<animate*>`, no `<style>` | everywhere | The reduced-motion twin of every other profile; byte-for-byte the geometry of frame zero |
| `subtle` | One-shot entrance only, ≤ 0.6s, transform-only | everywhere | Today's behaviour, kept for compatibility, unchanged: the whole-render guard from commit `16bc4e0` (no `both`/`backwards`, no opacity or scale `from` states) stays exactly as it is for this profile |
| `ambient` | Indefinitely repeating slow textures: breathe, scan, orbit, plotter glint, particle drift, pending pulse | hosted + static | Web and Studio may loop indefinitely; the `github-readme` target uses the bounded interval in D-15 |
| `cinematic` | A 10–20s repeating sequence: acquisition → nodes appear → scan → plot → rest → reset | static only in Phase 1; hosted after budgets are measured | Hero scenes only, never small instruments; the `github-readme` target uses the bounded interval in D-15 |

Hosted routes accept `none|subtle|ambient` after Phase 1; the canonical query, ETag, last-good
cache key, and CSP toggle all include the profile. Static config accepts all four.

### 5.2 Two backends, one primitive API

| Primitive | Meaning | CSS encoding | SMIL encoding |
| --- | --- | --- | --- |
| `enter` | one-shot translate into place | offset entrance keyframe; final underlying/base geometry during delay; `fill-mode: none`, delay ≥ 60ms (the PR #77 lesson) | `animateTransform` with `begin` offset, `fill="remove"` |
| `stagger` | index-based delay | `animation-delay` per class | `begin` offsets |
| `breathe` | scale 1 → 1.045 loop | M4 | `animateTransform type="scale"` |
| `scan` / `sweep` | marker or gradient traverses a field | M3 / M6 | `animateTransform type="translate"` or `animate` on `x` |
| `rotate` / `orbit` | continuous rotation about a point | `transform-origin` + rotate | `animateTransform type="rotate"` |
| `plot` | stroke draws itself | `stroke-dashoffset` (M1) | `animate attributeName="stroke-dashoffset"` |
| `flow` | a mark travels along a path | `offset-path` (poorly supported in SVG-as-image; expect `unsupported`) | `animateMotion` (the native, best-supported form) |
| `pulse` | the signal-lamp idiom | M5 — `pending` lamps only; nothing else may pulse (chassis rule) | `animate attributeName="opacity"` |
| `twinkle` | slow opacity loop on pure decoration | `scene`-family decoration only (particles, stars); never on a lamp, socket, reading, or label; floor 0.35 so nothing vanishes at any frame | `animate attributeName="opacity"` |
| `acquisitionFailure` | needle hunts and falls back | M7 | `animateTransform` values list |

Rules the compiler enforces rather than documents:

- Every primitive has both encodings or declares itself `unsupported` for a backend, in which case
  it is omitted — never approximated with a different effect.
- A primitive that changes opacity or scale may only be attached to elements marked *decorative*;
  elements carrying text or a reading may only translate. For `enter`, the element's underlying or
  base state remains the finished geometry during the delay; the offset entrance keyframe starts
  only after that delay, with no `backwards` or `both` fill. The existing guard
  (`packages/svg/tests/svg.test.mjs`, a whole-render regex
  rejecting `both`/`backwards` and any opacity/scale `from` state, added in `16bc4e0` after the
  invisible-header defect on the live profile) is **not** loosened: it keeps applying verbatim to
  every instrument card under `subtle`. For `ambient`/`cinematic` output the compiler enforces the
  same intent structurally — opacity/scale keyframes may exist only in the `<style>`/`<animate*>`
  blocks it emitted for elements it marked decorative, never with a `from` below the 0.35 floor —
  and a test proves that stripping those blocks yields the `none` render (the frame-zero test).
- Every generated id, class, and keyframe name is prefixed by the validated caller-supplied
  `instanceNamespace` and the scene id so two instances inlined on one page cannot collide; the
  composition supplies stable, distinct namespaces for its scene slots.
- Reduced motion: the CSS backend emits the `prefers-reduced-motion: reduce` override. SMIL cannot
  read a media query, so for the SMIL backend the reduced-motion answer is the `none` twin, and the
  Studio Markdown offers it through `<picture><source media="(prefers-reduced-motion: reduce)">`
  if Phase 0 confirms GitHub's sanitizer keeps that media query.
- Per-scene budget counters: animated elements, concurrently looping groups, and UTF-8 bytes; a
  scene over budget fails the render (and its test), never silently truncates.

### 5.3 Discipline

One focal animation, one ambient texture, at most six concurrently looping groups, readable at
frame zero, reduced-motion path, no fact carried only by movement. The chassis's M-series stays
the reference vocabulary (M1–M9, where M9 is the survey parallax `app/globals.css` already
defines); scenes may add new refs (M10 onward) only through DESIGN_CHASSIS.

Target behavior is explicit: web and Studio previews may keep their loops indefinite and expose
replay and, where the embedding surface supports it, pause/resume controls. A `github-readme`
embed is an `<img>` with no pause/stop
control, so D-15 bounds `ambient` and `cinematic` to a default 45-second interval, encoded with
CSS `animation-iteration-count` and SMIL `repeatDur`; after the interval, the animation stops and
the fill-none/base state leaves the output at frame zero. The reduced-motion twin remains the
immediate static path for readers who request it.

### 5.4 Budgets (hypothesis until Phase 0 measures)

| Class | UTF-8 bytes | Animated elements | Looping groups |
| --- | --- | --- | --- |
| instrument (existing cards) | ≤ 30 KiB (unchanged) | ≤ 24 | ≤ 3 |
| map / signature / finding | ≤ 80 KiB | ≤ 64 | ≤ 6 |
| scene / hero composition | ≤ 120 KiB | ≤ 96 | ≤ 6 |

These are `hypothesis`-rung numbers and are printed as such in the plan until Phase 0 measures
README render cost and Camo behaviour; the constants live in `motion/profile.ts` with the test that
holds every scene to them.

## 6. Scene engine contract

```ts
interface SceneInputs {
  readonly snapshot: PortfolioSnapshot;               // always present
  readonly lens?: PublicLensProjection;               // Phase 2, validated and freshness-checked
  readonly findings?: readonly ResearchFindingProjection[]; // Phase 3, vendored and pinned
  readonly identity?: IdentityConfig;                 // static config only, schema-bounded text
}

interface RenderContext {
  readonly theme: ThemeName;
  readonly pack: ScenePack;                           // "orbital" | "survey" | "spectral" | "terminal"
  readonly motion: MotionProfile;                     // "none" | "subtle" | "ambient" | "cinematic"
  readonly backend: MotionBackend;                    // "css" | "smil", chosen per target from the matrix
  readonly layout: "wide" | "compact";
  readonly instanceNamespace: string;                 // caller-supplied XML-safe namespace, e.g. [A-Za-z][A-Za-z0-9_-]{0,31}
  readonly seed: string;                              // sha256 of the canonical model JSON
}

interface SceneDefinition<Model> {
  readonly id: string;                                // kebab-case, also the artifact and route name
  readonly family: "instrument" | "map" | "signature" | "scene" | "finding";
  readonly supportedPacks: readonly ScenePack[];
  readonly supportedMotion: readonly MotionProfile[];
  readonly budget: BudgetClass;
  buildModel(inputs: SceneInputs): Model | SceneUnavailable;   // unknown in → explicit unavailable model, never a blank card
  render(model: Model, context: RenderContext): string;
  accessibility(model: Model): { title: string; description: string };
}
```

Every `signature` scene requires a validated `lens` input and must carry the common
`lens.coverage` and `lens.privacyNote` fields into its model and rendered frame, even when its
scene-specific data uses only a subset of the projection. The accessibility contract covers every
nondecorative data encoding — printed text and readings, geometry, colour, position, stroke, and
motion state — not only the values printed as readings.

Contract tests every scene must pass, written once in a shared harness and run per scene:

1. Two renders of the same model and `RenderContext` are byte-identical; a one-field change in the
   model changes the seed and the output. A composition supplies stable, distinct
   `instanceNamespace` slots to each scene instance.
2. `motion: "none"` output equals the `ambient`/`cinematic` output with `<style>` and `<animate*>`
   nodes removed — the frame-zero guarantee, checked structurally.
3. Well-formed XML; the shared injection fixture in every text field; no `script`, `foreignObject`,
   `on*`, `href` to non-allowlisted hosts, `@import`, or external/unknown references. The only
   permitted `url(#...)` references are generated, validated targets in the same SVG and the same
   `instanceNamespace`; all other URL references are rejected.
4. Byte, animated-element, and looping-group budgets for the scene's class.
5. `<title>` and `<desc>` carry every nondecorative data encoding; the description of an
   unavailable state says so.
6. An "everything unavailable" fixture renders the explicit unavailable composition, not a blank
   or a healthy default.
7. No `Date.now`, `Math.random`, or `crypto.randomUUID` in `packages/svg/src` — an ESLint
   restriction, not a review convention.

## 7. Scene catalogue

Each row is one seeded issue. Data basis names the *only* inputs the scene may read.

### Phase 1 — GitHub-only (no projection needed)

| Scene id | Family | Data basis | Focal motion / ambient texture | Notes |
| --- | --- | --- | --- | --- |
| *(atlas, ambient)* | instrument | existing `AtlasCardData` | M3 density scan / M6 survey beam, M4 reticle breathe | The first visible fix for the brief; ports the chassis motion into the flagship card |
| *(standalone cards, ambient)* | instrument | existing card data | one texture each: plotter head (activity), needle settle (rhythm), pending pulse (projects), beam (profile) | Each card keeps its exact geometry |
| `identity-beacon` | scene | `identity` config + configured projects + freshness | survey beam crossing the field / three-to-four project bodies breathing | Static-only in Phase 1: free text never comes from a query string |
| `evidence-coverage` | instrument | contribution source and basis, per-project CI state, `releaseState`, freshness mode | scan illuminates available rows and leaves unavailable rows dark | Makes the product's honesty visible: `PUBLIC PROFILE · COMPLETE`, `LINE CHANGES · NOT OBSERVED` |
| `activity-terrain` | map | contribution days, releases, streaks | survey line traverses the contours | Weekly activity → elevation; releases → peaks; nothing observed → flat basin, labelled |
| `chronograph` | map | contribution days, releases, streak | rings turn at different rates; streak needle settles | Inner days, middle weeks, outer months; release markers on the rim |
| `lifecycle-map` | map | configured lifecycle, CI, release, freshness | markers breathe; pending pulses | `planned → active → maintenance → paused → archived` as a metro line; lifecycle is an owner declaration and is labelled as one |
| `release-train` | map | bounded release history per project (new fetch) | a packet moves along the track between stations | Needs the release-history slice; prereleases are sidings; unavailable history is a blocked signal, not an empty track |

### Phase 2 — Developer Lens projection

| Scene id | Family | Data basis | Focal motion / ambient texture | Notes |
| --- | --- | --- | --- | --- |
| `constellation` | signature | `lens.repositories` (attention, activeWeeks, momentum, disclosure, language) | slow orbital rotation; a survey beam crosses the selected body | One lens per render (`attention`, `flow`, `continuity`), top 8–12 bodies; private aliases are dashed bodies; "attention ≠ impact" is printed |
| `signature` | signature | `lens.dna`, `lens.archetype`, `lens.coverage` | radar draws itself; calibration ring turns | `DERIVED SIGNATURE · not a productivity score · coverage NN%` |
| `craft-ring` | signature | `lens.themes` | segmented iris; segment glint | building / repairing / explaining / proving / refining / maintaining / optimising / reverting, plus an explicit `other` segment so a supplied share is never discarded or redistributed |
| `delivery-loop` | signature | `lens.delivery`, `lens.summary` | particles show the observed merged sample and its open/censored state; proposal, review, revision, and release are unobserved sockets | Censored and open work stay visibly incomplete; no stage or release evidence is inferred |
| `narrative` | signature | `lens.narratives` | plotter underline; nothing else | Up to three bounded, evidence-bearing statements with their limitation line |
| *(coverage, lens extension)* | instrument | `lens.coverage.warnings` | as Phase 1 | Adds the projection's own warnings and age to `evidence-coverage` |

### Phase 3 — findings, aesthetic scenes, packs

| Scene id | Family | Data basis | Focal motion / ambient texture | Notes |
| --- | --- | --- | --- | --- |
| `research-instrument` | finding | a vendored `ResearchFindingProjection.v1` | two traces; motion and labels branch on `decision.outcome` — `reject`: the candidate trace fades while the retained baseline stays lit, `BASELINE RETAINED`; `revise_once`: both traces stay lit with a dashed revision marker, `REVISE ONCE`; `benchmarked`: both stay lit, `BENCHMARKED · research evidence, not promotion` | Data class, decision, limitations, and unsupported claims in the frame; frame zero already prints the outcome word |
| `nebula` | scene | contribution days, repositories, languages, releases; seed | twinkle on decorative stars only | Positions from the seed; changes only when the snapshot changes |
| `spectrogram` | scene | per-project weekly commit series (new fetch, Q-7) plus daily totals | thin scan line | Bands per project, interference where projects overlap in a week; **parked** until Q-7 — the current snapshot has daily totals and category aggregates only, so no cross-project band can be observed today |
| `system-weather` | scene | derived from snapshot trends (and `lens` if present) | atmosphere drift | Trends seed a metaphor only; every line is stamped `hypothesis`, never presented as a signature or measurement |
| `pipeline-telemetry` | map | named-workflow CI plus its latest run's jobs (new fetch, Q-8) | packets through the observed job sequence; a failed job gets M7 | **Parked** until Q-8 — the snapshot records one overall workflow state, so stages cannot be drawn from it; the fallback composition is the single observed state, never invented stages |
| `branch-river` | scene | needs branch/merge evidence CommitAtlas does not fetch today | flow particles | Blocked on a data decision (§14 Q-5) |
| `contribution-city` | scene | projects, contribution days, releases, CI | windows light on active days; a beacon per release | Flagship spectacle; parallax only in `cinematic` |
| `reactor` | scene | projects, languages, releases, CI | particles converge; a controlled flare per release | Spectacle with data-controlled composition |
| `quiet-craft` | signature | `lens.themes` (tests, docs, refactor, chore) | maintenance-bay idiom | A second composition of craft-ring data; decide after craft-ring ships |

### Scene packs

| Pack | Grammar | Default textures |
| --- | --- | --- |
| `survey` | bone-white plates, graphite grid, hazard-orange markers, cold-cyan telemetry, plotter traces | scan, plot, beam |
| `orbital` | deep ground, orbital rings, constellations, reticles | orbit, breathe, twinkle |
| `spectral` | theme-resolved ground and luminous-gradient roles (no literal palette) | flow, breathe |
| `terminal` | monospace, pixel structures, diagnostic displays | stagger, pulse, scan |

A pack never introduces a colour that fails the chassis contrast floors for the active theme; the
pack supplies geometry and motion defaults, the theme supplies ink. In particular, `spectral`
gradient roles resolve through the active theme tokens; a pack cannot embed a literal palette.

## 8. Cross-project projections

Ownership follows the two sibling repositories' own boundaries, not this repository's convenience:

| Seam | Producer (canonical schema) | Exporter | Consumer | Delivery |
| --- | --- | --- | --- | --- |
| `PublicLensProjection.v1` | Developer Lens (`research-contracts/lens-projection/v1/`) | Developer Lens `export-profile` through its export sink | CommitAtlas static generator via a tracked, contained, size-capped file; hosted/Studio via the vendored C0 showcase fixture only | Owner runs the export locally, reviews it, commits it to the profile repository |
| `ResearchFindingProjection.v1` | Developer Lens (product owns presentation contracts) | Developer Lens Lab `dllab export finding <run-id>` | CommitAtlas vendors pinned C0 fixtures under `research-contracts/research-finding/v1/` and validates them at build/test time | Same path as the existing `DeveloperLensMethodTrialSummary.v1` bridge, which it generalizes |

Freshness is a first-class part of the lens seam: a projection carries `generatedAt`; older than
`lens.maxAgeDays` (default 45) renders every lens scene with a `STALE PROJECTION` strip and the age
in the description; older than twice that refuses the lens scenes and renders their explicit
unavailable composition. The GitHub-only cards are never affected by a projection in any state.
Findings are the opposite kind of artifact — immutable pinned evidence that prints its
`generatedAt` and producer commit and never ages; it is replaced only by vendoring a new one.

Field shapes, bounds, denied content, fixtures, tests, and the required merge order are in
[PROJECTION_CONTRACTS.md](./PROJECTION_CONTRACTS.md).

## 9. Delivery

| Model | Use | Constraint |
| --- | --- | --- |
| Hosted endpoint (`/api/v1/scenes/<id>.svg`) | public adoption, previews, Studio | GitHub-only scenes and `demo=true` lens scenes; Camo caching; anonymous rate limits; CSP toggle for animated profiles |
| Committed asset (`assets/commitatlas/scene-<id>.svg`) | the owner's canonical profile and any consumer wanting reproducibility | manifest v1 stays additive; the profile workflow's expected-artifact list is a consumer contract and changes with a consumer PR |
| Hybrid | recommended | hosted for others and previews, committed for the owner, `<picture>` pairs for static output, a single `<img>` for an animated hero until Phase 0 says `<picture>` is safe |

Camo notes from GitHub's documentation: return a correct `image/svg+xml` content type and consider
`Cache-Control: no-cache` when a recently changed hosted image does not refresh. The stale strip
and its description must survive every scene and motion profile.

## 10. Studio motion lab and verification harness

**Studio (a person's tool):** motion profile and pack selectors; replay (re-mount the preview);
pause/resume when the selected preview backend and embedding surface support it;
reduced-motion preview (renders the `none` twin); frame-zero view; byte size, animated-element and
looping-group counts read from the rendered SVG; a `<picture>`/single-`<img>` Markdown choice with
the reduced-motion source when supported; dark/light embedding preview; mobile width.

**CI (a machine's proof):** a Playwright harness (Chromium, Firefox, WebKit; two workers on this
Windows machine) that loads each scene through an `<img>` on a fixture page, captures at
≈500ms, 5s, 10s and under `prefers-reduced-motion: reduce`, and asserts (a) frames differ when
motion is on — animation actually occurs, (b) the reduced-motion capture equals the `none` render
— information survives without motion. For CSS, the reduced-motion capture exercises the
`prefers-reduced-motion` override. SMIL cannot read a media query, so the SMIL branch must load
the `none` twin through the `<picture>` selection (or an equivalent backend-specific fixture
branch) before making the same equality assertion; a directly loaded SMIL image is not expected
to honor the preference. The embedded SVG's clock starts when the image loads and cannot be
paused from outside, so a visual "t = 0" capture is not a reliable assertion; the frame-zero
guarantee is proven structurally instead (§6 test 2: the `none` render equals the animated render
with animation nodes removed), and the harness's earliest capture is only evidence that nothing
hides content, never a pass/fail gate. It runs nightly and on PRs labelled `motion` or `scene`,
not inside `npm run check`, so the proving gate stays fast.

## 11. Security and truth invariants added by this programme

- `identity` text: `name ≤ 40`, `tagline ≤ 80`, `focus ≤ 3 × 24`; static config only; XML-escaped
  at the renderer; a hosted request carrying identity text is rejected in v1.
- Projections: tracked file, contained path, ≤ 256 KiB, strict schema with unknown fields
  rejected, closed enums for every code, bounded prose, no URLs except allowlisted literal hosts
  in provenance, `generatedAt` mandatory, sums validated, freshness enforced. Never fetched.
- Pack, motion, backend are closed enums. No CSS, keyframe, colour, or path is ever accepted from
  a user.
- Budgets fail closed at render time and in tests.
- Chassis rules hold in every scene: `unavailable` is unlit and steady; only `pending` pulses; the
  two nothing-observed states carry no colour of their own.
- Hosted last-good keys include pack, motion, and scene id so variants cannot cross-serve.

## 12. The owner's profile at the end of the programme

Five flagship compositions replace "every card on the page"; the written project sections stay.
The phase in which each becomes available is stated so the profile consumer never expects an
artifact before it exists:

1. **Identity Beacon** (P1) — name, tagline, three current systems, survey beam, `ambient`.
2. **Developer Atlas** (P1) — the existing Atlas under `ambient` (density scan, beam, breathe).
3. **Project Constellation + Lifecycle Map** (P2; the lifecycle map alone is P1) — the ecosystem story.
4. **Developer Signature + Craft Ring** (P2) — the derived pair, labelled as derived.
5. **Research Instrument** (P3) — one Lab-backed finding: `BASELINE RETAINED · C0 · reproducible`.

Evidence Coverage sits under the Atlas as the honesty strip. Everything else stays available in the
Studio and in the "More public signals" disclosure.

Adoption is a consumer change each time: extend `.commitatlas.json`, extend the workflow's expected
artifact list, and commit the reviewed lens projection under `.commitatlas/` in the profile
repository. The Action never commits.

## 13. Phases, definitions of done, issue map

| Phase | Milestone | Done when |
| --- | --- | --- |
| P0 · Ground truth | [P0](https://github.com/Chris0Jeky/CommitAtlas/milestone/1) | `docs/MOTION_COMPATIBILITY.md` records the measured matrix and reconciles the PR #77 probe; budgets are measured; the §14 decisions are recorded as taken or declined |
| P1 · Alive | [P1](https://github.com/Chris0Jeky/CommitAtlas/milestone/2) | `ambient` ships on the hosted Atlas and on the profile; the scene engine, primitives, and at least Identity Beacon, Evidence Coverage, and Activity Terrain render from static config; the capture harness proves motion in three engines |
| P2 · Lens projections | [P2](https://github.com/Chris0Jeky/CommitAtlas/milestone/3) | `PublicLensProjection.v1` is produced by Developer Lens, validated here, and Constellation plus Signature are live on the profile from an owner-reviewed export |
| P3 · Scenes, findings, packs | [P3](https://github.com/Chris0Jeky/CommitAtlas/milestone/4) | `ResearchFindingProjection.v1` replaces the pinned method-trial bridge; the four packs and the aesthetic scene family exist; a gallery shows them; gated extras have a recorded decision |

The complete dependency-ordered issue list is maintained in the tracking issue #111 (the issues
are the source of truth for scope; this document is the source of truth for intent).

## 14. Decisions and open questions

Decisions taken in this document (reversible unless stated):

| Id | Decision | Reason | Reversible by |
| --- | --- | --- | --- |
| D-01 | Measure animated-SVG behaviour on github.com before building on either belief | The repository's record and public evidence disagree | n/a — it is a measurement |
| D-02 | Motion compiler with `css` and `smil` backends behind one primitive API | Backend becomes a per-target selection instead of a rewrite | delete one backend after the matrix is stable |
| D-03 | Profiles `none \| subtle \| ambient \| cinematic`; hosted takes the first three | `cinematic` byte cost is unmeasured | one enum change plus route tests |
| D-04 | Scene engine lives in `packages/svg` | Law 8: no package until a second consumer exists | extract later |
| D-05 | Scene pack ids `orbital`, `survey`, `spectral`, `terminal`; default `survey` | Avoids colliding with the `Observatory` web theme | rename before any pack ships |
| D-06 | Hosted scenes under `/api/v1/scenes/<id>.svg`, additive within v1 | Nothing existing breaks | move to v2 if a breaking change appears |
| D-07 | Lens projection is an owner-run, acknowledged Developer Lens export, committed by the owner as a tracked file in the owner's profile repository; the Action only reads it | Developer Lens's sink contract and roadmap | the *mechanism* follows from the producer's boundary; the *publication* is irreversible (git history) and is therefore not decided here — Q-9 |
| D-08 | Findings are vendored C0 fixtures referenced by id in config (`findings: ["wbc1"]`) | Same path as the existing bridge; no path input to validate in v1 | add a `path` form later |
| D-09 | GIF export deferred and gated on Phase 0 | No rasterizer today; may be unnecessary | reopen if the matrix shows SVG motion is unreliable |
| D-10 | Capture harness is Playwright, nightly + labelled PRs, outside `npm run check` | Keeps the proving gate fast | fold into `check` when it is fast enough |
| D-11 | `identity` text is static-config only | A query string is an injection and caching surface | allow bounded hosted text after the sanitizer is tested |
| D-12 | Existing `DeveloperLensMethodTrialSummary.v1` bridge stays until the finding projection is vendored, then is retired in the same PR | No double-rendering window | keep both if a consumer needs it |
| D-13 | CommitAtlas pins one exact published schema (producer commit + fixture hash) per seam and re-pins deliberately; an additive change the producer makes under the same version is rejected until re-pinned | CommitAtlas's reader is strict; the Lab's CONTRACTS.md allows additive changes within a major, and that is the producer's policy to keep | re-pin |
| D-14 | One C-axis only: `classification`/`dataClass` is the sibling repositories' data class (C0 invented, C1 aggregated); there is no separate "evidence grade", and C2 (local identifiers and provenance) can never appear in an exported artifact | Both siblings define exactly one C-axis and mark C2 local-only; an invented second axis would let an agent print "C2" on a public profile | none — it matches the producers' policy |
| D-15 | `github-readme` `ambient` and `cinematic` motion runs for a bounded default 45-second interval, then rests at frame zero; web and Studio keep indefinite loops with replay and, where supported, pause/resume controls | A README `<img>` has no pause/stop control, and a reduced-motion twin serves only readers whose system preference requests it | change the target timing policy after measuring README behavior |

Open questions for the owner (each has a `needs-decision` issue):

| Id | Question | Default if unanswered |
| --- | --- | --- |
| Q-1 | Add Playwright as a dev dependency for the capture harness? | Yes, pinned, nightly only |
| Q-2 | Fetch bounded release history (up to 10 per project) for Release Train, at the extra REST cost? | Yes, 10, with `unavailable` semantics identical to `releaseState` |
| Q-3 | Should `cinematic` ever be hosted? | No until budgets are measured |
| Q-4 | Accept a GIF rasterizer dependency if Phase 0 shows SVG motion is unreliable? | Decide after Phase 0; static SVG twin is the fallback meanwhile |
| Q-5 | Fetch branch/merge evidence for Branch River (branches list + merged PR counts)? | No; the scene stays parked |
| Q-6 | Raise the static project cap above six for the lifecycle map and constellation? | Constellation reads the projection (up to 12); the config cap stays six |
| Q-7 | Fetch per-project weekly commit series (GitHub `stats/commit_activity`, public, cold responses return 202) for the spectrogram? | No; the scene stays parked |
| Q-8 | Fetch the latest run's jobs for each declared workflow (`actions/runs/{id}/jobs`) for pipeline telemetry? | No; the scene stays parked and its fallback is the single observed state |
| Q-9 | Publish an owner-reviewed, redacted C1 Developer Lens projection as a tracked file in the public profile repository? (Irreversible once pushed; aliases are not anonymity.) | No; lens scenes render only from the C0 showcase fixture, and the profile shows none of them |

## 15. Agent operating notes

- Work strictly in milestone order; inside a milestone, in the dependency order the tracking issue
  lists. One issue per PR, one PR per issue. Use `small-safe-slice`.
- Proving checks for a scene PR: `npm run typecheck && npm run lint`, `npm run test:svg`, the
  scene's contract tests, and `npm test` when the hosted surface changed. A PR that adds a static
  artifact also runs `npm run test:static` and `npm run test:action` and says which consumer change
  the profile needs.
- Never claim motion works from a screenshot; cite the capture harness or the Phase 0 matrix.
- Update the row of this document's catalogue and DESIGN_CHASSIS's M-series when a scene or a
  motion primitive ships; update PROJECT_STATE only with verified facts.
- Cross-repo work follows the `cross-repo-contract` skill: producer first, consumer second,
  synthetic fixtures only, both ends executed before either claims compatibility.
