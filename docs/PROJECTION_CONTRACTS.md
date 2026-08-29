# Cross-project projection contracts

**Status: proposal for the producers, nothing implemented.** This document is CommitAtlas's
consumer-side specification of the two cross-repository seams the
[expansion programme](./EXPANSION_PLAN.md) depends on. The canonical schemas will be owned by
Developer Lens, as its own boundary documents require; this file states what CommitAtlas needs,
what it refuses, and the merge order both repositories must follow. When a producer schema lands,
this document is updated to point at it and stops being the shape of record.

The existing seam it generalizes — `DeveloperLensMethodTrialSummary.v1`, vendored under
`research-contracts/method-trial-summary/v1/` and validated by `lib/research-bridge.ts` — is the
template for everything below: a strict, versioned, closed-enum JSON instance; a pinned producer
commit; both schema and semantics validated at build/test time; no runtime request to the producer.

## Ownership matrix

| Seam | Producer / schema authority | Exporter | Consumer | Compatibility window |
| --- | --- | --- | --- | --- |
| `PublicLensProjection.v1` | Developer Lens: `research-contracts/lens-projection/v1/{schema.json, showcase.fixture.json, README.md}` | Developer Lens `export-profile` (headless, through the export sink) | CommitAtlas `packages/static` (tracked file), `lib/` + Studio (vendored C0 fixture only) | v1 is frozen once published (see "Versioning"); unknown `schemaVersion` fails closed at both ends |
| `ResearchFindingProjection.v1` | Developer Lens: `research-contracts/research-finding/v1/{schema.json, wbc1.fixture.json, README.md}` | Developer Lens Lab `dllab export finding <run-id>` | CommitAtlas `research-contracts/research-finding/v1/` (vendored, pinned) + `lib/research-bridge.ts` | v1 is frozen once published; the method-trial summary bridge is retired in the PR that vendors the first finding |

**Versioning.** Because every object rejects unknown properties, an "additive" change is not
backward-compatible for a pinned strict consumer. This is CommitAtlas's consumer posture, not a
rule imposed on the producers: CommitAtlas pins one exact published schema (by producer commit and
fixture hash) per seam and re-pins deliberately. The Lab's own CONTRACTS.md allows additive
changes within a major version; if a producer adds a field under the same `schemaVersion`,
CommitAtlas's reader rejects the new artifact until it re-pins — never silently accepting it. Until
the producer publishes, this document is a draft and may change freely.

**Casing.** The lens seam follows `PortableExportPayload` and is camelCase; the finding seam
follows the existing research contracts (`DeveloperLensMethodTrialSummary.v1`) and is snake_case.
One convention per schema, never mixed.

Neither seam treats commit or checksum provenance as a cross-repository identity key or as
promotion authority (this mirrors the Lab's own CONTRACTS.md wording).

## Shared rules

- **Data classes.** Both sibling repositories define exactly one C-axis — the field/data class of
  Developer Lens's data charter and the Lab's data policy: C0 invented synthetic, C1
  low-identifiability aggregates after suppression, C2 local identifiers and provenance
  (local-only, never exported), C3/C4/X never leave a process. There is no separate "evidence
  grade". Lens artifacts carry `dataClass`; finding artifacts carry `classification`; neither
  seam uses `data_class`. Each value is C0 or C1 and describes both the artifact and the evidence
  it summarizes; C2 and above can
  never appear. Developer Lens's `public` sink permits C0 only, so anything CommitAtlas hosts or
  vendors for the Studio is C0. An owner's personal lens projection is C1; whether it may be
  published at all is the owner's decision (EXPANSION_PLAN Q-9), it is never committed to
  CommitAtlas, and it is never a fixture.
- **Canonical hash.** `projectionHash` and `bundle_hash` are SHA-256 over the artifact serialized
  with [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785) (sorted
  keys, shortest round-trip numbers, no insignificant whitespace, UTF-8, no BOM) with the hash
  field itself removed from `provenance` before serialization. Producers and consumers implement
  the same algorithm and test it against one published vector in the schema README.
- **Denied content, both seams:** repository names for non-public repositories, URLs other than
  the literal allowlisted provenance hosts, exact dates other than `generatedAt`, pull-request or
  issue titles, commit subjects, raw events, weekly series with absolute dates, person identifiers,
  scores that rank people, effort/productivity/quality metrics, file paths, seeds, tokens.
- **Strictness.** `additionalProperties: false` everywhere; every code is a closed enum paired with
  its display text (as the method-trial summary does today), so a producer cannot change a label
  without a schema change and a consumer cannot render text it has not reviewed.
- **Bounds.** Every string has a maximum length; every number is finite and bounded; every array
  has a maximum length; each share is finite and in `0..1`, and shares sum to at most `1.0001`.
- **Freshness.** `generatedAt` is a canonical UTC `Z` timestamp and is mandatory on both seams.
  The age policy in EXPANSION_PLAN §8 applies to the lens seam only, because a lens projection
  describes a moving window of the owner's activity. A research finding is immutable pinned
  evidence: it never becomes stale, it prints its `generatedAt` and pinned producer commit in the
  frame, and it is replaced only by vendoring a new artifact deliberately.
- **Never fetched.** CommitAtlas reads projections from a tracked, contained, ≤ 256 KiB file or
  from its own vendored fixture. There is no URL form.
- **Fixtures are synthetic.** Producer round-trip tests and consumer golden tests use the C0
  showcase fixture only. The owner's real projection is never a fixture anywhere.

## `PublicLensProjection.v1`

Derived from Developer Lens's existing `PortableExportPayload` (`src/lib/portableExportPayload.ts`),
narrowed to what the Phase 2 scenes read. Field names follow the source so the producer is a
projection, not a re-computation.

```ts
interface PublicLensProjectionV1 {
  schemaVersion: "PublicLensProjection.v1";
  dataClass: "C0" | "C1";
  scope: "public-demo" | "redacted-local";          // C0 ⇔ public-demo; C1 ⇔ redacted-local
  generatedAt: string;                              // UTC, "Z"
  range: "6m" | "12m";
  rangeLabel: string;                               // ≤ 40, relative wording only ("last 12 months")
  repositoryRedaction: "synthetic" | "private-aliases" | "all-aliases";
  privacyNote: string;                              // ≤ 240

  summary: {                                        // integers, 0 ≤ n ≤ 1_000_000
    commits: number; mergedPullRequests: number; reviews: number; issues: number;
    activeDays: number; activeWeeks: number; repositories: number;
  };

  dna: Array<{                                      // exactly 6, keys unique
    key: "focus" | "shipping" | "collaboration" | "consistency" | "breadth" | "stewardship";
    value: number;                                  // 0 ≤ v ≤ 1
  }>;

  archetype: { name: string; description: string }; // ≤ 40, ≤ 160

  repositories: Array<{                             // ≤ 12, ordered by attentionShare desc
    label: string;                                  // ≤ 40; must be an alias unless disclosure is public-name or synthetic
    disclosure: "synthetic" | "public-name" | "private-alias" | "masked-alias";
    primaryLanguage?: string;                       // ≤ 32
    attentionShare: number;                         // 0..1, sum ≤ 1.0001
    activeWeeks: number;                            // integer
    momentum: number;                               // -1..1
    mergedPullRequests: number;                     // integer
    reviews: number;                                // integer
  }>;

  themes: Array<{                                   // ≤ 9, keys unique, each share 0..1, sum ≤ 1.0001
    key: "feat" | "fix" | "docs" | "test" | "refactor" | "chore" | "perf" | "revert" | "other";
    share: number;                                  // finite 0..1; the PRODUCER folds every other conventional-commit type
  }>;                                               // (style, wip, deps, …) into "other" before export, because
                                                    // ThemeMetric.key is an open string in Developer Lens

  delivery?: {                                      // NEW producer-computed block, not in PortableExportPayload today;
                                                    // observed aggregate only: no per-stage or release evidence
    mergedSamples: number;                          // integer — absent block = not exported, never zeros
    medianMergeHours: number | null;                // follows summary.medianMergeHours; null = unavailable, never 0
    openAtRangeEnd: number;                         // integer
    censored: boolean;                              // true when open work is excluded from the median
  };

  narratives: Array<{                               // ≤ 3, orders unique
    order: 1 | 2 | 3;
    title: string;                                  // ≤ 80
    body: string;                                   // ≤ 280
    limitation: string;                             // ≤ 200
  }>;

  coverage: {                                       // counts follow PortableExportPayload.coverage
    complete: number; partial: number; unavailable: number; total: number;   // integers
    score: number;                                  // producer-owned scale; current main serializes rounded 0..100
    warnings: Array<{ code: CoverageWarningCode; display_text: string }>; // ≤ 8, closed registry; the producer
  };                                                // maps its free-text DashboardMeta.warnings onto codes

  provenance: {
    producer: "developer-lens";
    producerVersion: string;                        // semver
    producerCommit: string;                         // 40 hex
    inputHash: string;                              // "sha256:" + 64 hex
    projectionHash: string;                         // "sha256:" + 64 hex, over the canonical body excluding this field
    showcaseUrl?: "https://chris0jeky.github.io/developer-lens/";
  };
}
```

`CoverageWarningCode` is a closed v1 registry the producer publishes in its README beside the
schema (for example `local_git_unavailable`, `private_activity_aggregated`, `line_changes_partial`,
`range_truncated`); each code has exactly one display text and consumers render only that text.

`coverage.score` is producer-owned. Developer Lens main currently serializes `coverageScore` as a
rounded `0..100` value, while an earlier CommitAtlas draft described `0..1`; CommitAtlas must not
invent a conversion or count formula. Developer Lens issue #304 must publish the canonical scale,
semantics, and fixture vectors. Until that contract is pinned and resolved, CommitAtlas rejects the
artifact rather than treating either scale as interchangeable.

Consumer semantic checks beyond the schema: `dataClass`/`scope` agree; `dataClass: "C0"` implies
`repositoryRedaction: "synthetic"` and every repository `disclosure` is `synthetic` (a C0 artifact
may carry no real name and no alias of a real repository); a `private-alias` or `masked-alias`
label matches Developer Lens's alias pattern and is not a real repository name the snapshot also
lists; `dna` keys are exactly the six; every `themes[].share` is finite and in `0..1` and their
sums are bounded; `narratives` contain no URL, `@handle`, or `#number`;
`generatedAt` is not in the future relative to the snapshot's `generatedAt`.

Producer command shape (Developer Lens decides the exact CLI; today's headless entry point is
`npm run export:artifacts`, and a local export already requires `--source local` together with
`--acknowledge-redaction`):

```powershell
npm run export:artifacts -- --source local --acknowledge-redaction --range 12m --repository-redaction private-aliases --artifact lens-projection --out .commitatlas
```

The producer runs the same post-write privacy scan its headless export runs today and refuses to
write a file that fails it.

Consumer configuration (`.commitatlas.json`, additive to version 1):

```json
{ "lens": { "path": ".commitatlas/lens-profile.v1.json", "maxAgeDays": 45 } }
```

## `ResearchFindingProjection.v1`

Generalizes `DeveloperLensMethodTrialSummary.v1` so a second finding does not need a second
hand-written schema. The vocabulary is the Lab's: a decision is `reject`, `revise_once`, or
`benchmarked`; `benchmarked` is research evidence, never promotion.

```ts
interface ResearchFindingProjectionV1 {
  schema_version: "ResearchFindingProjection.v1";
  classification: "C0" | "C1";                      // the single data-class axis, as in the existing summary; C0 only until the Lab's activation preconditions hold
  subject_class: "software-system" | "repository" | "instrument" | "aggregate-window";
  generated_at: string;                             // UTC, "Z"

  finding: {
    id: string;                                     // ≤ 40, e.g. "wbc1"
    title: string;                                  // ≤ 120
    question: string;                               // ≤ 240
  };

  methods: {                                        // codes from the closed MethodCode registry; display_name is the registry's text
    baseline: { method_code: MethodCode; display_name: string };
    candidate: { method_code: MethodCode; display_name: string };
  };                                                // baseline and candidate codes must be distinct

  decision: {
    outcome: "reject" | "revise_once" | "benchmarked";
    retained_fallback: MethodCode | null;           // must equal methods.baseline.method_code when outcome is "reject"
    summary: string;                                // ≤ 240
  };

  metrics: Array<{                                  // 1..6, keys unique, from the closed MetricCode registry
    key: MetricCode;
    label: string;                                  // exactly the registry's label for key
    unit: "rate" | "count_per_year" | "hours" | "count" | "ratio"; // exactly the registry's unit
    better_when: "lower" | "higher";              // exactly the registry's direction
    baseline: { status: "measured"; value: number } | { status: "unavailable" };
    candidate: { status: "measured"; value: number } | { status: "unavailable" };
  }>;                                               // value bounds by unit: rate/ratio 0..1; count 0..1_000_000 integer;
                                                    // count_per_year 0..10_000; hours 0..100_000; all finite

  gates?: Array<{ code: GateCode; label: string; passed: boolean | null }>; // ≤ 8, ordered, closed registry; null = not evaluated

  limitations: Array<{ code: LimitationCode; display_text: string }>;           // 1..8, closed registry
  unsupported_claims: Array<{ code: UnsupportedClaimCode; display_text: string }>; // 1..8, closed registry

  provenance: {
    producer: "developer-lens-lab";
    source_lab_commit: string;                      // 40 hex
    source_product_contract_commit: string;         // 40 hex
    bundle_hash: string;                            // "sha256:" + 64 hex
    public_url?: string;                            // allowlisted literal host only (the Developer Lens Pages origin)
  };
}
```

Every code is a closed registry published in the schema README with exactly one display text:
`MethodCode` (starting from `rolling_median_mad`, `bocpd_gaussian`, `pelt_offline`), `MetricCode`
(starting from `detection_rate`, `false_alerts_per_year`), `GateCode` (the Lab's seven ordered
gates), `LimitationCode` and `UnsupportedClaimCode` (the four-plus-four the current summary
carries). Registries grow only by schema version. The initial `MetricCode` registry binds all
three semantic fields, not just the code:

| MetricCode | `label` | `unit` | `better_when` |
| --- | --- | --- | --- |
| `detection_rate` | `Detection rate` | `rate` | `higher` |
| `false_alerts_per_year` | `False alerts per year` | `count_per_year` | `lower` |

Consumer semantic checks reject a finding whose metric `label`, `unit`, or `better_when` differs
from its registry entry, and reject equal baseline and candidate `method_code` values. Every
display text equals the registry text for its code; an `outcome` of `reject` requires at least one
metric where the candidate is measurably worse under `better_when` or at least one gate with
`passed: false`; `retained_fallback` equals the baseline code on `reject` and is `null` otherwise;
`benchmarked` never renders the word "promoted"; an `unavailable` metric renders as `NOT MEASURED`,
never as zero; the renderer branches its labels and motion on `outcome` (EXPANSION_PLAN §7).

Consumer configuration (`.commitatlas.json`, additive to version 1, ids only in v1 — see
EXPANSION_PLAN D-08):

```json
{ "findings": ["wbc1"] }
```

## Tests each end must run

| End | Test | Data |
| --- | --- | --- |
| Producer | round-trip: build → serialize → parse against the published schema → deep-equal | C0 showcase / WB-C1 smoke |
| Producer | privacy scan on the written file; denied-content fixtures are rejected | invented |
| Consumer | golden: vendored fixture parses and renders byte-identically (snapshot test) | C0 |
| Consumer | rejection: unknown field, unknown code, out-of-range value, over-size file, untracked or escaping path | invented |
| Consumer (lens) | freshness: stale `generatedAt` follows the age policy and is rejected after the hard limit | invented |
| Consumer (finding) | `generated_at` is immutable pinned evidence and is not rejected for age; replacement requires deliberate re-vendoring | C0 |
| Both | contract canary: the consumer's vendored fixture hash equals the producer's published fixture hash at the pinned commit | C0 |

## Merge order

1. Developer Lens: schema, C0 fixture, README with the code registries, round-trip test. (Issue in
   `developer-lens`, label `cross-repo`.)
2. Developer Lens Lab (finding seam only): `dllab export finding` writing into the product schema,
   conformance test against the pinned schema. (Issue in `developer-lens-lab`.)
3. CommitAtlas: consumer validator, vendored pinned fixture, golden and rejection tests, config
   fields with defaults that leave every existing config valid.
4. CommitAtlas: renderers and scenes.
5. Profile repository: owner runs the export, reviews it, commits it beside the config, extends the
   workflow's expected-artifact list.

A lens consumer PR that lands before the `PublicLensProjection.v1` schema is published must vendor
a fixture marked `"dataClass": "C0"` and `"scope": "public-demo"` that the producer's later
schema is tested against. This pre-schema marker rule is lens-only. A finding consumer that lands
before the `ResearchFindingProjection.v1` schema is published instead uses the finding shape with
`"classification": "C0"`; it must not invent a `scope` field. If either published schema and its
fixture disagree, the producer's schema wins and the consumer re-vendors.

## Compatibility risks

- Developer Lens may choose different field names when it publishes; this document follows its
  existing payload names to minimize that, and the consumer is written against the published
  schema, not this file.
- The WB-C1 metrics are currently literal in the CommitAtlas validator (the seven gates exist
  only in the Lab's `DeveloperLensMethodTrialView.v1`, which CommitAtlas does not vendor);
  loosening the literals to bounded enums must not drop the semantic cross-checks that make a
  `reject` verifiable.
- The owner's C1 projection is a public artifact once committed to the profile repository, and
  git history retains it after removal. Aliases reduce identification but are not anonymity; the
  `privacyNote` is rendered, not hidden. That publication is the one irreversible step in the
  programme and is gated by the owner's answer to EXPANSION_PLAN Q-9; until then the lens scenes
  render only from the C0 showcase fixture.
