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
| `PublicLensProjection.v1` | Developer Lens: `research-contracts/lens-projection/v1/{schema.json, showcase.fixture.json, README.md}` | Developer Lens `export-profile` (headless, through the export sink) | CommitAtlas `packages/static` (tracked file), `lib/` + Studio (vendored C0 fixture only) | v1 additive only; unknown `schemaVersion` fails closed at both ends |
| `ResearchFindingProjection.v1` | Developer Lens: `research-contracts/research-finding/v1/{schema.json, wbc1.fixture.json, README.md}` | Developer Lens Lab `dllab export finding <run-id>` | CommitAtlas `research-contracts/research-finding/v1/` (vendored, pinned) + `lib/research-bridge.ts` | v1 additive only; the method-trial summary bridge is retired in the PR that vendors the first finding |

Neither seam treats commit or checksum provenance as a cross-repository identity key or as
promotion authority (this mirrors the Lab's own CONTRACTS.md wording).

## Shared rules

- **Data classes.** Only C0 (invented synthetic) and C1 (low-identifiability aggregates after
  suppression) may appear. Developer Lens's `public` sink permits C0 only, so anything CommitAtlas
  hosts or vendors for the Studio is C0; the owner's personal projection is C1 and is committed by
  the owner to the profile repository, never to CommitAtlas.
- **Denied content, both seams:** repository names for non-public repositories, URLs other than
  the literal allowlisted provenance hosts, exact dates other than `generatedAt`, pull-request or
  issue titles, commit subjects, raw events, weekly series with absolute dates, person identifiers,
  scores that rank people, effort/productivity/quality metrics, file paths, seeds, tokens.
- **Strictness.** `additionalProperties: false` everywhere; every code is a closed enum paired with
  its display text (as the method-trial summary does today), so a producer cannot change a label
  without a schema change and a consumer cannot render text it has not reviewed.
- **Bounds.** Every string has a maximum length; every number is finite and bounded; every array
  has a maximum length; shares sum to at most `1.0001`.
- **Freshness.** `generatedAt` is a canonical UTC `Z` timestamp and is mandatory. Consumers enforce
  the age policy in EXPANSION_PLAN §8.
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
  classification: "C0" | "C1";
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

  themes: Array<{                                   // ≤ 9, keys unique, shares sum ≤ 1.0001
    key: "feat" | "fix" | "docs" | "test" | "refactor" | "chore" | "perf" | "revert" | "other";
    share: number;
  }>;

  delivery?: {                                      // optional block; absent means not exported
    mergedSamples: number;                          // integer
    medianHoursToMerge: number | null;              // null = unavailable, never 0
    openAtRangeEnd: number;                         // integer
    censored: boolean;                              // true when open work is excluded from the median
  };

  narratives: Array<{                               // ≤ 3, orders unique
    order: 1 | 2 | 3;
    title: string;                                  // ≤ 80
    body: string;                                   // ≤ 280
    limitation: string;                             // ≤ 200
  }>;

  coverage: {
    score: number;                                  // 0..1
    warnings: Array<{ code: CoverageWarningCode; display_text: string }>; // ≤ 8, closed registry
  };

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

Consumer semantic checks beyond the schema: `classification`/`scope` agree; a `private-alias` or
`masked-alias` label matches Developer Lens's alias pattern and is not a real repository name the
snapshot also lists; `dna` keys are exactly the six; sums; `narratives` contain no URL, `@handle`,
or `#number`; `generatedAt` is not in the future relative to the snapshot's `generatedAt`.

Producer command shape (Developer Lens decides the exact CLI):

```powershell
npm run export:profile -- --range 12m --repository-redaction private-aliases --acknowledge-redaction --out .commitatlas/lens-profile.v1.json
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
  schemaVersion: "ResearchFindingProjection.v1";
  classification: "C0" | "C1" | "C2";               // evidence grade; producers emit C0 only until the Lab's activation preconditions hold
  subjectClass: "software-system" | "repository" | "instrument" | "aggregate-window";
  generatedAt: string;                              // UTC, "Z"

  finding: {
    id: string;                                     // ≤ 40, e.g. "wbc1"
    title: string;                                  // ≤ 120
    question: string;                               // ≤ 240
  };

  methods: {
    baseline: { code: string; displayName: string };   // ≤ 40, ≤ 60
    candidate: { code: string; displayName: string };
  };

  decision: {
    outcome: "reject" | "revise_once" | "benchmarked";
    retainedFallback: string | null;                // must equal methods.baseline.code when outcome is "reject"
    summary: string;                                // ≤ 240
  };

  metrics: Array<{                                  // 1..6, keys unique
    key: string;                                    // ≤ 40
    label: string;                                  // ≤ 40
    unit: "rate" | "count_per_year" | "hours" | "count" | "ratio";
    betterWhen: "lower" | "higher";
    baseline: { status: "measured"; value: number } | { status: "unavailable" };
    candidate: { status: "measured"; value: number } | { status: "unavailable" };
  }>;

  gates?: Array<{ code: string; label: string; passed: boolean | null }>; // ≤ 8, ordered; null = not evaluated

  limitations: Array<{ code: LimitationCode; display_text: string }>;          // 1..8, closed registry
  unsupportedClaims: Array<{ code: UnsupportedClaimCode; display_text: string }>; // 1..8, closed registry

  provenance: {
    producer: "developer-lens-lab";
    labCommit: string;                              // 40 hex
    productContractCommit: string;                  // 40 hex
    bundleHash: string;                             // "sha256:" + 64 hex
    publicReportUrl?: string;                       // allowlisted literal host only (the Developer Lens Pages origin)
  };
}
```

The limitation and unsupported-claim registries start from the four-plus-four codes the current
summary already carries and grow only by schema change. Consumer semantic checks: an `outcome` of
`reject` requires at least one metric where the candidate is measurably worse under `betterWhen`
or at least one gate with `passed: false`; `retainedFallback` equals the baseline code on
`reject`; `benchmarked` never renders the word "promoted"; an `unavailable` metric renders as
`NOT MEASURED`, never as zero.

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
| Consumer | rejection: unknown field, unknown code, out-of-range value, stale `generatedAt`, over-size file, untracked or escaping path | invented |
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

A consumer PR that lands before its producer's schema is published must vendor a fixture marked
`"classification": "C0"` and `"scope": "public-demo"` that the producer's later schema is tested
against; if the two disagree, the producer's schema wins and the consumer re-vendors.

## Compatibility risks

- Developer Lens may choose different field names when it publishes; this document follows its
  existing payload names to minimize that, and the consumer is written against the published
  schema, not this file.
- The Lab's WB-C1 gates and metrics are currently literal in the CommitAtlas validator; loosening
  them to bounded enums must not drop the semantic cross-checks that make a `reject` verifiable.
- The owner's C1 projection is a public artifact once committed to the profile repository. Aliases
  reduce identification but are not anonymity; the `privacyNote` is rendered, not hidden.
