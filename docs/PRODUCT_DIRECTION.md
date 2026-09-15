# CommitAtlas product direction

**Last reconciled: 15 September 2026**

This page is the concise public map. [PROJECT_STATE.md](PROJECT_STATE.md) remains the shipped-state ledger. [EXPANSION_PLAN.md](EXPANSION_PLAN.md) contains implementation-level decisions, risks, phases, and seeded work. A design or issue is not a released surface.

## North star

CommitAtlas should make a developer’s public engineering story legible without making it less truthful.

It should combine source-backed instruments, deterministic graphics, explicit freshness, and owner-reviewed projections into a coherent visual identity system. Facts, derivations, owner declarations, research findings, and purely aesthetic scenes must remain visibly different.

The goal is not to maximize metrics or imitate a monitoring dashboard. It is to publish useful, attractive artifacts whose evidence boundary can still be understood months later.

## Portfolio role

CommitAtlas owns **public presentation**.

- **GitHub public evidence** supplies credential-free observed facts.
- **Developer Lens** may later supply explicit, owner-reviewed, redacted signatures from private/local analysis.
- **Developer Lens Lab** may supply bounded research findings through product-owned schemas.
- **Pulseboard** owns private operational evidence and should export only separately reviewed public capsules.
- **The profile repository** decides what is finally published and retains the generated artifacts and manifests.

CommitAtlas must not become a private-data ingestion service, a runtime bridge into local repositories, or a universal source of truth for neighboring products.

## Shipped foundation

The v0.4.0 product provides:

- a live Studio and eight hosted SVG routes;
- ten source/static card types through the CLI and pinned Node 24 Action;
- public GitHub profile, contribution, language, repository, named-workflow, lifecycle, and release evidence within declared limits;
- deterministic demo fixtures;
- dark/light variants from one snapshot;
- manifests and byte hashes;
- explicit stale/last-good behavior for eligible anonymous hosted requests;
- strict public-only configuration and path validation;
- deployed-origin verification;
- one bounded Developer Lens C0 method-trial explainer;
- a staged but inactive Observatory adapter with an empty endpoint.

## Product families

### Instruments

Compact factual modules: Atlas, Profile, Streak, Breakdown, Rhythm, Activity, Languages, Projects, Cadence, and Releases.

Observed and derived readings must be labelled. Configured project lifecycle and actions are owner intent, not discovered facts.

### Maps

Larger relationship views such as project terrain, lifecycle maps, release trains, or chronographs. Geometry may represent observed evidence; bands, thresholds, and interpretations must be labelled as hypotheses or configured intent.

### Signatures

Owner-reviewed Developer Lens projections such as development DNA, archetype, craft ring, or delivery loop. Every signature is derived, carries coverage and privacy notes, and is explicitly not a productivity score.

### Scenes

Aesthetic compositions whose deterministic seed may come from observed data. They are labelled `SCENE`. A visual pattern is not a numeric claim, and motion never carries information unavailable at frame zero.

### Findings

Research outputs projected through a product-owned schema. The frame must state data class, method, decision vocabulary, limitations, and unsupported claims. Research evidence never becomes profile evidence merely because it is attractive.

## Near-term priorities

### 1. Prove motion delivery before expanding it

The repository has conflicting evidence about animation inside SVGs rendered through GitHub README `<img>` elements. Measure the real delivery paths in a controlled browser protocol. Keep CSS and SMIL backends behind one primitive interface so evidence selects the backend.

Required invariants:

- readable and complete at frame zero;
- `prefers-reduced-motion` or an exact motion-free twin;
- deterministic bytes for identical inputs;
- no opacity/scale entrance state that hides a reading;
- bounded GitHub README loops;
- no remote script, font, image, stylesheet, `foreignObject`, or event handler;
- explicit budgets for nodes, bytes, duration, and motion primitives.

### 2. Build the visual grammar, not isolated spectacles

Create reusable frames, readings, badges, evidence labels, coverage bars, paths, orbits, terrain, particles, project nodes, and signal states. A second scene should reuse the same tested primitives instead of copying bespoke SVG fragments.

Theme, scene pack, and motion profile remain orthogonal. A colour choice must not change evidence semantics. A scene pack must not silently alter the source model.

### 3. Add owner-reviewed Developer Lens projections

A projection is a tracked, schema-validated publication artifact—not a hosted fetch into the owner’s machine.

The owner must explicitly:

- select the repositories and period;
- choose a public-compatible redaction class;
- acknowledge irreversible Git publication;
- review the exact payload;
- commit it to the intended consumer repository.

CommitAtlas validates schema, freshness, disclosure, coverage, privacy note, and unsupported claims. It does not infer missing fields or upgrade disclosure.

### 4. Keep research bounded

Developer Lens Lab exports into product-owned presentation schemas. Lab decisions such as `reject`, `revise_once`, or `benchmarked` retain their research meaning. `benchmarked` is not `shipped`, and synthetic C0 evidence is never represented as a real-repository result.

### 5. Preserve publication reliability

Every new output changes the artifact contract. Static generation, expected-file validation, manifests, consumer workflows, README references, deployment budgets, and last-good semantics must move together.

A failed refresh must leave the last committed public artifact available. A new output must not delete unowned files or weaken path/symlink/config protections.

## Evidence rules

- Unknown, missing, unavailable, restricted, or expired is not zero.
- Stale is visible and timestamped.
- A percentage is not a count.
- Public-profile calendar-year activity mix is not silently relabelled as window-scoped.
- Repository language share is not skill or proficiency.
- A named workflow result is not whole-project health.
- Configured lifecycle is intent, not an inferred verdict.
- A release absence is stated, not hidden.
- A deterministic scene is not analysis.
- A private/local projection is not public GitHub evidence.
- One method trial is not a general claim about a person or repository.

## Privacy and authority

Hosted CommitAtlas remains public-data-first. It must not accept projection URLs, arbitrary projection bodies, private tokens in client-visible locations, or local repository access.

Optional integrations remain separately governed:

- the Observatory adapter has no endpoint until a reviewed activation explicitly supplies one;
- any collection notice, vocabulary, retention, and consent behavior belongs to that activation, not to the base renderer;
- owner projections require deliberate publication rather than ambient synchronization;
- the Action only generates and never commits, pushes, uploads, or receives the consumer’s token;
- the profile repository owns final publication and removal decisions.

## Measures that matter

- source and freshness clarity at first read;
- parity with declared public evidence;
- deterministic output and manifest integrity;
- successful refreshes without destructive side effects;
- readability at real README sizes and both colour schemes;
- accessibility and reduced-motion behavior;
- projection rejection when privacy, coverage, schema, or freshness is insufficient;
- whether readers can distinguish observed, derived, configured, synthetic, and aesthetic content;
- operating cost and failure behavior of hosted routes;
- actual use of Studio, generated assets, and embeds—not raw endpoint traffic alone.

## Non-goals

CommitAtlas is not currently:

- a developer ranking system;
- a productivity score;
- a private repository analytics service;
- a hosted Developer Lens;
- a monitoring, alerting, or incident-response platform;
- a generic telemetry collector;
- a package already published to npm or Marketplace;
- proof that a developer knows a language because repositories contain it;
- proof that a project is healthy because one named workflow passed;
- a motion demo whose animation is more important than its evidence.

## Horizons

### H1 — dependable public instruments

Continue hardening public-source fidelity, last-good behavior, Studio usability, static publication, documentation, and consumer contracts.

### H2 — proven motion and maps

Land a measured motion backend, reusable primitives, deterministic maps, budgets, frame-zero/reduced-motion proofs, and real GitHub rendering evidence.

### H3 — reviewed signatures and findings

Publish owner-controlled Developer Lens signatures and bounded Lab findings through explicit schemas and privacy/freshness gates.

### H4 — generative visual identity

Offer coherent themes, scene packs, motion profiles, maps, signatures, scenes, and findings without blurring their evidence class.

### H5 — selective public ecosystem bridges

Accept only small, reviewed, expiring public capsules from neighboring tools where the reader benefits and the source boundary remains visible.

These are horizons, not release promises. [PROJECT_STATE.md](PROJECT_STATE.md) is the source of truth for what has shipped.
