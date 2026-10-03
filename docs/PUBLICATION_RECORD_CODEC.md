# Proposed recovery-store record codec

This is an internal, pure foundation for #256. It does not read or write files,
activate a writer, acquire a lock, or establish filesystem durability or authenticity.
The existing production generator and manifest format are unchanged.

`packages/static/src/publication-codec.ts` provides four operations:
`encodePublicationJournal`, `decodePublicationJournal`, `encodePublicationStatus`,
and `decodePublicationStatus`. Encoders accept values validated by the existing
protocol schemas and return fresh UTF-8 `Uint8Array` bytes. Decoders accept byte
views (including Node Buffers), enforce a nonempty byte limit before decoding,
use fatal UTF-8 decoding, parse JSON, and validate the resulting record.

A journal may occupy at most 65,536 bytes; a status at most 512 bytes. These are
control-record limits, not payload limits. Existing protocol bounds of four
targets, 32 operations per target, and 96 KiB per payload remain unchanged. The
codec rejects a schema-valid record that exceeds its serialized byte limit.
Future scene inventories and any increase to operation counts must be reconciled
with these limits before a v2 writer is enabled. In particular, the new static
scene delivery limit is 120 KiB while the proposed journal still permits only
96 KiB per payload; this codec does not silently widen that separate contract.

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

The twelve codec/protocol tests cover detached deterministic encoding, all nine phases and
status/journal mismatch, byte bounds and sliced views, malformed UTF-8, BOMs,
duplicate keys, noncanonical and truncated JSON, schema errors, all 128 bounded
operations and sparse input rejection. They run in the explicit static test
script. Focused local validation uses strict standalone TypeScript compilation;
full repository integration is the exact-head Actions gate.

The remaining #256 decisions and work include ownership migration, a bounded
control store, incomplete-reader status, stale-lock policy, platform flushing
and rename semantics, and actual process/OS interruption tests. None is implied
by passing a byte-codec test.
