# Public delivery evidence

Status: accepted implementation contract for issue #226  
Version: 1  
Owner: CommitAtlas static portfolio pipeline

## Purpose

CommitAtlas may show how pull requests move through a deliberately configured public portfolio. The feature exists to make unusually high delivery activity inspectable and reproducible without turning pull-request volume into a claim about productivity, code quality, business impact, effort, employability, or a person's global rank.

The public output is two artifacts generated from one snapshot:

- `delivery.svg` — a bounded, accessible portfolio reading;
- `delivery.json` — the complete versioned evidence, formulas, source scope, benchmark provenance, and limitations.

## Scope and privacy boundary

The configured handle and the repositories already listed in `.commitatlas.json` define the complete query scope. Every repository must:

1. be an `owner/name` GitHub identifier;
2. be owned by the configured handle, case-insensitively;
3. occur exactly once;
4. have passed the existing public project fetch, which rejects private repositories.

The collector uses a short-lived GitHub Actions repository token only to call GraphQL. Token visibility never expands the query: every search includes `is:public`, the configured author, and the exact configured repository scope. Search selections request `issueCount` only. They never request pull-request titles, bodies, comments, branches, commits, diffs, reviewers, labels, or identities other than the configured author.

The exported collector independently proves each configured repository public in that same request:
`scopeRepository<index>: repository(owner: ..., name: ..., followRenames: false) { isPrivate }`.
Only literal `isPrivate: false` is accepted; GitHub defines that field as private **or internal**.
Null, missing, malformed, private/internal, renamed or errored scope fails the whole collection,
even when every search count is zero. A public-only search filter is not itself a visibility proof.
These at-most-six visibility bits are transient validation data, not retained repository metadata.
The GraphQL repository query/field definitions are documented in
[GitHub's primary schema reference](https://docs.github.com/en/graphql/reference/repos).

No raw GraphQL response or visibility bit is written to an artifact. Only validated aggregate
integers enter the snapshot; `source.queryCount` counts aggregate search aliases, not the
additional visibility selections or network requests. Collection still performs one request.

## Time basis

The snapshot is anchored to one UTC `asOf` date. Windows are inclusive UTC calendar-day intervals:

| Window | From | To | Formula |
| --- | --- | --- | --- |
| 7 days | `asOf - 6 days` | `asOf` | inclusive |
| 30 days | `asOf - 29 days` | `asOf` | inclusive |
| 90 days | `asOf - 89 days` | `asOf` | inclusive |
| 365 days | `asOf - 364 days` | `asOf` | inclusive |

A live scheduled run may include the still-open current UTC day. The exact bounds are printed and exported so a reader can interpret the count.

## Observed aliases

One GraphQL request contains these aggregate search aliases:

- `lifetimeAuthored`
- `lifetimeMerged`
- `lifetimeClosed`
- `lifetimeOpen`
- `lifetimeDrafts`
- `opened7`, `merged7`
- `opened30`, `merged30`
- `opened90`, `merged90`
- `opened365`, `merged365`
- one `repoOpened30_<index>` alias per sorted configured repository

All values must be finite safe non-negative integers.

The following identities must hold inside the one response:

- `lifetimeAuthored = lifetimeClosed + lifetimeOpen`;
- `lifetimeMerged <= lifetimeClosed`;
- `lifetimeDrafts <= lifetimeOpen`;
- sum of all `repoOpened30_<index>` values equals `opened30`.

A violated identity is contradictory evidence and fails generation. Window merges may exceed window openings because a pull request can open before the window and merge inside it.

## Versioned snapshot

```ts
interface DeliverySnapshot {
  version: 1;
  login: string;
  scope: {
    kind: "configured-public-repositories";
    repositories: readonly string[];
  };
  asOf: string;
  generatedAt: string;
  source: {
    provider: "github-graphql";
    metric: "pull-request-search-counts";
    queryCount: number;
  };
  lifetime: {
    authored: number;
    merged: number;
    closed: number;
    closedWithoutMerge: number;
    open: number;
    drafts: number;
  };
  windows: readonly DeliveryWindow[];
  repositories: readonly DeliveryRepositoryWindow[];
  derived: DeliveryDerivedSignals;
  benchmark: DeliveryBenchmark | null;
  formulas: Readonly<Record<string, string>>;
  limitations: readonly string[];
}
```

Repository rows are sorted case-insensitively by canonical `owner/name`. JSON object construction and arrays are deterministic; the serializer appends exactly one newline.

## Derived signals

All ratios use validated counts and are rounded to four decimal places in the evidence. A zero denominator produces `null` and the SVG word `unavailable`; it never produces zero, infinity, or `NaN`.

| Signal | Formula |
| --- | --- |
| Resolved merge conversion | `lifetime.merged / lifetime.closed` |
| Window merged PRs/week | `window.merged / window.days * 7` |
| 30-day integration balance | `merged30 / opened30` |
| Current WIP merge-weeks | `lifetime.open / merged7` |
| Top-two 30-day concentration | `sum(two largest repository opened30) / opened30` |
| Top-six 30-day concentration | `sum(six largest repository opened30) / opened30` |
| 7-day benchmark multiple | `mergedPerWeek7 / benchmark.value` |

Integration balance may exceed `1.0`; merges in a period are not necessarily drawn from openings in the same period. It must never be silently capped.

## Benchmark availability

No built-in numeric benchmark is enabled. Ordinary static and Action generation emits
`benchmark: null` and `derived.benchmarkMultiple7: null`; the SVG and its accessible description
state `BENCHMARK UNAVAILABLE`. Observed counts and other derived flow metrics are preserved.
The benchmark formula applies only when an explicit reference exists; otherwise the result is
null, not zero. A retained numeric multiple without a reference cannot render a comparison.

Programmatic collectors may supply a structurally valid `DeliveryBenchmark` with a version,
identity, unit/value, primary source, date, population, cohort, and caveats. The caller is
responsible for verifying that source; structural validation does not authenticate a claim.
No external URL is fetched by this feature. Test comparisons use an explicitly synthetic
reference on `example.invalid`, never an attribution to a real publisher.

Issue #245 tracks the primary-evidence requirement before enabling any built-in reference.
The original draft's unverified numeric default is removed rather than being shown as verified.

## SVG content

The wide/compact static card uses the active CommitAtlas theme and existing escaping/font/chassis rules. It prints:

- focal: latest seven-day merged PRs/week;
- comparison: multiple of the dated benchmark;
- resolved merge conversion;
- 30-day integration balance;
- current open WIP and merge-weeks when available;
- top-two 30-day repository concentration;
- configured public repository count;
- exact seven-day date range;
- freshness/source;
- literal non-claim: `activity flow · not quality or impact`.

`<title>` and `<desc>` contain the same readings, scope, source date, benchmark basis, and non-claim. Decorative motion may not alter text legibility. `motion: none` is the frame-zero reference.

## Failure behavior

Generation fails closed when:

- delivery is selected without a token;
- the configured handle or repository is unsafe, duplicated, cross-owner, or over the bounded repository count;
- GraphQL is unavailable, rate limited, incomplete, or malformed;
- an alias is missing or not a safe non-negative integer;
- lifetime or repository aggregate identities conflict;
- the benchmark fails its versioned validation;
- JSON or SVG exceeds its artifact budget.

Existing cards do not fetch delivery evidence and do not require a token when `delivery` is absent.

## Public profile integration

The profile workflow supplies `${{ github.token }}` only to the CommitAtlas Action, validates `delivery.svg` and `delivery.json` in both theme manifests, verifies both themes describe the same generated snapshot, and commits the last known-good generated artifacts. A failed refresh leaves the previous committed evidence visible.
