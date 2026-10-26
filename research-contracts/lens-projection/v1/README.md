# Pinned PublicLensProjection.v1 consumer receipt

These are the unchanged producer `schema.json` and invented C0 `showcase.fixture.json` from
Developer Lens commit **`bae3bddf7295b767d57196887bd648ba1cfe2ab3`**. This pin names the revision
whose schema/runtime the consumer reviewed, independently of the artifact's own provenance.

| Source | Pinned location |
| --- | --- |
| Canonical schema, fixture and full semantics/registries | [Producer v1 README](https://github.com/Chris0Jeky/developer-lens/blob/bae3bddf7295b767d57196887bd648ba1cfe2ab3/research-contracts/lens-projection/v1/README.md) |
| Strict runtime validator | [shared/lensProjection.ts](https://github.com/Chris0Jeky/developer-lens/blob/bae3bddf7295b767d57196887bd648ba1cfe2ab3/shared/lensProjection.ts) |
| RFC 8785 canonicalizer and privacy tokens | [shared/researchFinding.ts](https://github.com/Chris0Jeky/developer-lens/blob/bae3bddf7295b767d57196887bd648ba1cfe2ab3/shared/researchFinding.ts) |
| Producer denial/semantic/hash controls | [shared/lensProjection.test.ts](https://github.com/Chris0Jeky/developer-lens/blob/bae3bddf7295b767d57196887bd648ba1cfe2ab3/shared/lensProjection.test.ts) |

## Independent integrity vectors

File hashes are SHA-256 over UTF-8 bytes with LF line endings and one trailing newline. Consumer
canaries normalize CRLF to LF before hashing. Canonical `projectionHash` removes only
`provenance.projectionHash`, sorts object keys by UTF-16, uses ECMAScript shortest JSON numbers
and no insignificant whitespace, and rejects lone surrogates, non-finite numbers, sparse arrays
and unsupported JSON values.

| Value | Pin |
| --- | --- |
| Schema file SHA-256 | `sha256:89c4e36d7fea2e17f20f0ffc27c422ff2fa72c4bee59d5d45cad41256a54d67e` |
| Fixture file SHA-256 | `sha256:dfea3cd8f62e4eef17af433690cf586335fff6346bc37ac2638a0580b9cc3b78` |
| Fixture canonical projectionHash | `sha256:a97f47a7c76ee3bf0c4c44ec6730a88c6a0e47b2de95155c3f358ec920e5a9b3` |
| Fixture redacted-input hash | `sha256:ce1151426b16a1b99a2143662c4b383edf777b641fad9a12f36d4db397a228b2` |
| Showcase input-generator anchor (`provenance.producerCommit`) | `d05533bbe17b3db524f9d404ef6c4a95a482e4bd` |
| Fixed fixture generatedAt | `2026-09-01T12:00:00Z` |

The input hash is producer provenance; CommitAtlas has no original payload and cannot recompute
it. The projection hash proves body integrity, not authenticity, data-class truth, anonymity or
publication authorization. The fixture's input anchor does not claim to be its publishing commit.

## Consumer boundary

`packages/core/src/lens-projection.ts` ports the producer runtime's strict structural and semantic
checks without compatibility shims. Published v1 uses `coverage.scorePercent` (integer 0..100,
restricted to producer count-consistent candidates) and warning `displayText` from the exact closed
registry. DNA is a fixed six-key tuple. `delivery`, when present, has a finite non-null median,
merged samples equal to the summary and censoring exactly matching nonzero open work. All share,
ordering, uniqueness, redaction, alias and narrative/privacy denials remain enforced.

The server-compatible `@commit-atlas/core/lens` consumer entry point exposes
`parseLensProjection(input, { generatedAt, repositoryNames })`;
its errors contain bounded `LENS_*` codes, never Zod diagnostics or projection text. It adds future
timestamp and snapshot repository-name alias-collision checks. Both C0 and C1 transport semantics
are validated, but **static and hosted publication adapters permit C0 only** under the operative Q-9 No policy recorded in #170.
The owner's real projection is never a fixture. Hosted input is this vendored fixture under explicit
`demo=true`, never a URL or body. A historical snapshot earlier than the fixed fixture has no
Lens context. Freshness always uses the snapshot timestamp; no fixture timestamp is rewritten.

Core golden/canary/denial/freshness tests, static tracked-file tests and hosted/SVG adapter tests
pin these boundaries. No signature scene is introduced here; owner C1 publication remains disabled under Q-9 No.

Tracked-file proof ignores inherited Git repository/index/config overrides and uses literal
pathspecs. The reader compares root-to-file ancestor identities and resolved paths before opening,
after opening and after the bounded read, and compares the opened file's identity/size/timestamps.
Detected substitutions fail closed. These are portable detection checks, not an atomic `openat`
confinement guarantee against a hostile process repeatedly swapping and restoring directories
between individual filesystem operations; run generation in a trusted checkout.
