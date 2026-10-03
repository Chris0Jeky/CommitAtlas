# Proposed recovery-store record codec

This is an internal, pure foundation for #256. It does not read or write files,
activate a writer, acquire a lock, or establish filesystem durability or authenticity.
The existing production generator and manifest format are unchanged.

`packages/static/src/publication-codec.ts` provides four operations:
`encodePublicationJournal`, `decodePublicationJournal`, `encodePublicationStatus`,
and `decodePublicationStatus`. Encoders accept values validated by the existing
protocol schemas and return fresh UTF-8 `Uint8Array` bytes. Decoders accept byte
views (including Node Buffers), enforce a nonempty byte limit through the intrinsic typed-array length getter before decoding,
use fatal UTF-8 decoding, parse JSON, and validate the resulting record.

A journal may occupy at most 131,072 bytes; a status at most 512 bytes. These
are control-record limits, not payload limits. The pure protocol accepts up to
four targets and 96 operations per target. Canonical `scene-<id>.svg` names
(with the static contract's 48-character scene IDs) accept up to 120 KiB per
recorded generation. Other artifact names keep their existing 96 KiB ceiling;
this does not widen the production generator's stricter per-type limits.

Artifact names are now capped at 64 ASCII characters before serialization.
This bounds record size as well as operation count. The encoder's final byte
check and decoder's intrinsic pre-decode byte check remain independent guards.
The canonical representation of existing short records is unchanged. This is
an internal proposed-store schema change, not a migration of production files;
previously schema-valid names over 64 characters are intentionally rejected.

### Inventory capacity

One transition may contain the union of the old and new selections. The current
maximum is 16 fixed generated filenames, up to 32 retired scenes, up to 32 new
scenes, plus the manifest: **81 operations per target**. A 96-operation cap
provides bounded headroom without dropping stale cleanup operations to fit a
32-operation journal. The 128 KiB record limit accommodates four full targets
with maximum-length names and hashes; tests also exercise JSON escaping growth.

The scene-capacity suite cross-checks the static card/scene inventory and scene
naming contract, preserves global manifest-last recovery in every phase, and
compares the large-payload boundary with `SCENE_MOTION_BUDGET.bytes`. Revisit
these bounds explicitly when the static inventory or provisional scene budget
changes. Raising a record limit does not approve a destination or prove file
ownership; those remain the storage adapter's separate responsibilities.

## One wire representation

The validator's field order, compact JSON, and one final LF define the wire
representation. Encoding normalizes input key insertion order. Decoding requires
that exact representation. Duplicate keys (even identical values), reordered
fields, extra whitespace, alternative numeric spellings, missing LF, a BOM and
trailing content are rejected. This deliberately strict format is for a future
store using these encoders, not a permissive parser for manually authored JSON.
It does not migrate or rewrite any existing publication files.

The journal validator now rejects sparse or accessor-backed target/operation
arrays. Previously `Array.map` and `flatMap` could skip holes, allowing an invalid
programmatic journal to produce an empty recovery plan. Descriptor values are copied into fresh plain arrays before
mapping, without invoking array-entry getters, supplied map/iterator methods,
or Array subclass species. This also prevents overridden map methods from
silently omitting validated destinations.

Encoders also validate the serialized round trip. This prevents a sparse
in-memory array from becoming JSON null entries in an unreadable durable record.
Decoded records and returned byte arrays are detached from their inputs; the
records are not advertised as immutable or as authenticated evidence.

## Integration boundary

Decoding a valid status does not prove that it belongs to a journal. A future
storage adapter must still call `planPublicationRecoveryFromStatus` to verify
transaction identity before planning, verify destination and backup digests,
and implement the containment, ownership and platform rules in
[STATIC_PUBLICATION_RECOVERY.md](STATIC_PUBLICATION_RECOVERY.md).

The codec is internal and is not added to the static package's public root API.
No Action runtime path imports it, so the checked-in bundle has no codec change.
The ordinary packaging and Action reproducibility gates still run in CI.

## Verification

The original thirteen codec/protocol tests cover detached deterministic encoding, all nine phases and
status/journal mismatch, byte bounds and sliced views, malformed UTF-8, BOMs,
duplicate keys, noncanonical and truncated JSON, schema errors, all 384 bounded
operations, sparse input rejection and spoofed typed-array lengths. Own length
properties/getters cannot bypass the pre-decode limit; incompatible proxies are
rejected before decoding. They run in the explicit static test
script. Focused local validation uses strict standalone TypeScript compilation;
full repository integration is the exact-head Actions gate. Seven additional scene-capacity
tests cover full old/new inventories, scene/name limits, fixed-output limits,
maximum records, canonical compatibility, and the static naming contract.

The remaining #256 decisions and work include ownership migration, a bounded
control store, incomplete-reader status, stale-lock policy, platform flushing
and rename semantics, and actual process/OS interruption tests. None is implied
by passing a byte-codec test.
