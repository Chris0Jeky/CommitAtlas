# Evidence coverage scene

Issue #133 adds `evidence-coverage`, the first opt-in production scene. It is a
survey-pack instrument with wide (720px) and compact (480px) layouts, using the
existing `none`, `subtle`, and `ambient` profiles. It does not accept cinematic
motion, fetch additional data, read projections, or add a hosted route.

Add the following fields to an otherwise complete static configuration:

```json
{ "scenes": ["evidence-coverage"], "scenePack": "survey", "motion": "ambient" }
```

The default selection remains `[]`. The primary output and every theme variant
receive `scene-evidence-coverage.svg`, hashed in manifest v1 and included in the
Action's aggregate `scenes` output. Consumers with exact artifact allowlists must
add that filename before enabling it. Dry-run reports the same paths but writes
no artifacts. Existing standalone card selections are unchanged.

## What each row says

| Row | Snapshot input | Meaning of the bar |
| --- | --- | --- |
| Contribution calendar | `contributions.freshness` and `metrics.window.days`, `observedDays`, `complete` | Observed days in the requested window, not contribution volume. A complete zero calendar is still observed. |
| Activity mix | `contributions.freshness`, `breakdownBasis`, `commits`, `issues`, `pullRequests`, `reviews` | Presence of all four bounded, consistent fields. Public-profile percentages, including fractional weighted percentages, are explicitly annual and not window-scoped. Exact counts are labelled separately. |
| CI | `projects.freshness` and each `projects[].ci.state` | Current passing, failing or pending observations divided by declared projects. Stale, unconfigured and unavailable states are named but never counted as current. Complete coverage does not imply passing CI. |
| Releases | `projects.freshness`, each `releaseState` and validated `release` record | Published releases or observed absence divided by declared projects. Unavailable lookups never become a claim that no release exists. |
| Line changes | The public snapshot collection contract | NOT OBSERVED. No line-change total is inferred from contributions. |
| Private activity | The public snapshot collection contract | NOT REQUESTED. No private source is fetched or projected. |
| Snapshot | `freshness.mode` | A neutral literal mode badge, not a manufactured completeness fraction. |

The root snapshot must name a known source before any row can be authorized.
Calendar coverage additionally requires unique, valid UTC day records within the
core calendar bounds (at most 400 records, counts 0–100,000, optional levels 0–4).
The declared window dates and inclusive span must agree with its day count, and
its observed-day count must equal the raw records inside that window. Missing
days are never filled as zero. The same raw validation guards zero-activity mix.
Contribution rows require the producer's exact source/basis combination: profile
HTML with annual percentages, or GraphQL/synthetic demo with exact counts.
REST is not a contribution producer. Project boards require REST or synthetic
demo provenance; contribution-only sources cannot authorize project observations.
Boards must also contain one to six valid repository identities, unique after
case-insensitive normalization as in the canonical project manifest. Duplicate
or malformed identities invalidate both board denominators, not unrelated
contribution observations.
Annual percentages must total 99–101, matching producer rounding; the all-zero
exception requires both an observed zero contribution total and a nonempty zero
calendar. Exact counts are not percentage-normalized. Published releases require
a non-array record with bounded tag/name, a valid UTC publication timestamp,
credential-free HTTPS URL and a null or well-formed optional download record.
Malformed release evidence cannot erase independently observed CI states.

Known source identities and consistent counts are required before observations
receive coverage ink. Unknown provenance, unavailable sources and stale source
families remain neutral. A consistent partial calendar can show its explicit
observed-day fraction. A partially degraded project board preserves independently
observed CI and release states: failure to fetch releases does not erase current
CI evidence, and vice versa. An empty board means not configured/requested, never
a perfect 0/0 score. Synthetic provenance in the snapshot or its nested sources
is labelled SYNTHETIC PREVIEW visibly and in the description.

Each row's complete literal reading appears in the root description and its
nested title. Fixed-vocabulary labels are wrapped rather than silently dropped.
No owner name, repository name, upstream free-text label, URL or identity text is
needed by this instrument. OBSERVED identifies the evidence rung; coverage is
neither a derived productivity score nor a statement about all of a person's work.

## Finished geometry and unavailable rendering

The ambient scan touches only the four source-observation rows that contain at
least one current observation, uses one shared looping group, and is decorative.
Unknown, stale and collection-scope rows remain static. `none` and `subtle` retain
the complete geometry without a scan animation. Removing emitted motion produces
the same finished geometry as `none`. README backend defaults and byte budgets
remain provisional until their separate browser/host evidence gates qualify them.

An unavailable snapshot retains all seven neutral rows instead of becoming a
blank graphic. The scene engine's additive optional `renderUnavailable` callback
receives only the validated unavailable record, render context and engine-owned
accessible text. It cannot request motion, change the accessible contract, exceed
the selected budget, or omit the visible UNAVAILABLE marker. Existing definitions
without the callback retain the engine's generic unavailable composition. Invalid
identity or projection inputs still cannot reach normal model construction.

The registry loads built-ins lazily inside its public accessors. Registration is
therefore retained when the package is bundled with `sideEffects: false`, rather
than depending on an import-only side effect. The integration's synthetic example
remains test-only and cannot be selected by the production Action.

## Verification boundaries

The scene tests pin every input-to-row mapping and exercise all four themes,
both layouts/backends, the seven shared contracts, zero/absent/stale/partial data,
unknown provenance, fractional annual percentages, independent project families,
and the guarded unavailable extension. Static tests verify paired hashes, dry-run
and the unavailable composition. An executed Action test intercepts every network
request with a closed synthetic fixture and verifies both dry-run and written
paired outputs from the actual checked-in bundle.

CairoSVG raster previews are layout checks only, not browser/Camo motion evidence.
Full source lint, packaging, Action bundle reproducibility and repository-wide
validation are the published head's CI gate. No deployment, profile adoption,
release, private projection approval or completion of the expansion programme
follows from this scene implementation.
