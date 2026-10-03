# Publication recovery model verification

Scope: follow-up to #282 under #256. This is a pure, synthetic state-model
exercise, not filesystem crash-recovery or power-loss evidence.

## Reproduced defects

The planner classified a replacement whose previous and next digest/length were
identical as previous. Roll-forward consequently returned `install-next` even
after those bytes were installed, so repeated recovery never reached an empty
plan. The fix treats a validated observation matching both generations as a
no-op. Missing, special or drifted destinations still fail before any steps are
returned; equal journal versions do not bypass destination validation.

The directly exported phase helpers also trusted their TypeScript annotations at
runtime. An unknown phase returned rollback, while two unknown phases passed the
retry comparison because both map lookups were undefined. Both helpers now use
the same runtime phase validator as the recovery entry point. The legal phase
machine and commit boundary are unchanged.

## Deterministic interruption model

`packages/static/tests/publication-recovery-boundaries.test.mjs` models two theme
directories, each containing create, replace, byte-identical replace, remove and
manifest-replace operations. It enumerates every previous/next combination of
the eight changing destinations under all nine durable phases:

- 2,304 starting states (256 combinations times nine phases).
- 11,520 interruption points, including before the first recovery operation and
  after the final operation.
- At each point, resume from the newly observed state, require the selected
  generation across both themes, and require a subsequent empty recovery plan.
- Both initial and resumed plans must keep every payload before any manifest.
- A separate matrix injects drift into each of ten destinations in every phase
  and requires refusal of the whole plan.

The focused gate includes all 17 pre-existing protocol/status/manifest-order
cases plus four new tests. It passed after strict standalone TypeScript
compilation on Node 22.16.0. Full repository typecheck, lint, packaging and build
remain the published head's GitHub Actions gate, not a local installation claim.

## Correction and remaining work

The earlier #282 description incorrectly called trailing line terminators a new
transaction-ID acceptance gap. The original JavaScript regex, without multiline
mode, already rejected them. This follow-up restores that simpler expression
while retaining all boundary tests and the new status/journal identity binding.

This model assumes durable, accurately observed files and sequential operations.
It does not test fsync, atomic rename, reparse points, multi-filesystem behavior,
process termination inside an OS operation, corrupt backups, stale locks or
reader-visible status. The ownership migration decision, bounded control store,
platform adapter and real fault-injection harness from
`docs/STATIC_PUBLICATION_RECOVERY.md` remain unimplemented. The production writer
and its existing overwrite policy are not changed; #256 must remain open.
