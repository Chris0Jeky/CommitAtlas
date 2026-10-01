# Crash-recoverable multi-theme static publication

Status: proposed design for issue #256

## Decision summary

CommitAtlas should not claim true atomic publication across unrelated output directories. Ordinary filesystem rename primitives can make one file replacement atomic inside one filesystem namespace, but they cannot make a set of changes across arbitrary directories or mounts become visible at one instant.

The proposed v2 protocol provides a narrower and testable guarantee:

> Every publication is either fully committed, or is durably marked incomplete and recovered before another publication begins. Recovery is idempotent, never promotes an uncommitted generation, never follows symlinks, and never removes or replaces a file that CommitAtlas has not proved it owns.

This is a crash-recovery protocol, not a cross-directory transaction. Readers that open files directly can observe a bounded mixture while commit or recovery is in progress. The protocol makes that state detectable, preserves enough information to converge to one complete generation, and refuses to continue when safe recovery cannot be proved.

## Why the current v1 protocol is insufficient

The current writer already provides strong predictable-failure protection:

1. every theme is rendered and validated before the first write;
2. every payload and manifest is staged before the first visible replacement;
3. current destinations and stale managed paths are preflighted across all themes;
4. stale cleanup finishes before new payloads are exposed;
5. each directory publishes its manifest last;
6. temporary files are removed on ordinary failure.

Those rules prevent known preparation, containment, destination, and cleanup errors from advancing one theme while another fails. They do not cover termination or storage failure between visible rename operations. A process can stop after replacing some payloads, after publishing one directory's manifest, or while cleaning stale files. The next run has no durable transaction record that distinguishes a complete generation from an interrupted one.

## Scope

The v2 protocol covers one invocation of `generateStaticFromSnapshot` that may publish a primary output and up to three theme variants.

It covers:

- process termination between any two durable transitions;
- ordinary I/O failure during staging, backup, install, manifest publication, or cleanup;
- a later invocation discovering and recovering an interrupted publication;
- output directories on the same filesystem or on different filesystems;
- Windows and POSIX hosts without requiring symbolic-link privileges;
- existing direct-file consumers such as GitHub README image URLs;
- single-theme generation and dry-run compatibility.

It does not promise:

- one instant at which every directory changes together;
- recovery after loss or corruption of both the destination and its recorded backup;
- coordination with another process that ignores the CommitAtlas lock and changes managed paths concurrently;
- protection from storage hardware that acknowledges writes but does not preserve them;
- atomic visibility to readers that open several files without consulting publication status.

## Rejected approaches

### Rename an entire output directory

Replacing a populated directory is not portable. POSIX and Windows differ in replacement behavior, open-handle behavior, and whether a non-empty destination can be exchanged. Output directories can also contain caller-owned siblings that CommitAtlas must preserve.

### Generation directories plus a symlink or junction pointer

A single pointer switch is attractive, but it changes public paths, complicates checked-in artifacts, and depends on symlink or junction capabilities that are not uniformly available on Windows. It also does not solve one pointer per unrelated theme directory.

### Treat preflight as a transaction

Preflight reduces predictable failure but cannot stop power loss or process termination after the first visible rename. Calling it atomic would overstate the contract.

### One journal per output directory

Independent journals cannot establish whether all themes belong to the same publication or which recovery direction is authoritative. A publication needs one repository-scoped transaction identity and one ordered record of every target.

## On-disk layout

The protocol reserves a repository-contained control directory:

```text
.commitatlas/
  publication.lock
  transactions/
    <transaction-id>/
      journal.json
      status.json
      targets/
        000/
          staged/
          backup/
        001/
          staged/
          backup/
```

The control directory is outside every configured output directory. All paths recorded in the journal are repository-relative normalized paths. Absolute paths, parent traversal, empty segments, alternate data-stream syntax, and paths that resolve through symlinks are rejected.

The transaction directory is created with an unpredictable identifier and exclusive-create semantics. Staged and backup files use fixed journal-derived names inside that directory rather than caller-derived temporary paths in output directories.

`journal.json` is immutable after preparation. `status.json` is the only phase record that advances. Both documents use bounded v1 schemas, include the transaction identifier, and reject unknown or malformed structural values rather than guessing.

## Journal schema

The exact JSON schema belongs in code, but the durable record needs these facts:

```json
{
  "version": 1,
  "generator": "CommitAtlas",
  "transactionId": "uuid",
  "createdAt": "ISO-8601 timestamp",
  "repositoryRoot": ".",
  "targets": [
    {
      "outputDir": "assets/commitatlas",
      "previousManifest": {
        "present": true,
        "sha256": "..."
      },
      "nextManifest": {
        "sha256": "..."
      },
      "operations": [
        {
          "name": "atlas.svg",
          "action": "replace",
          "previous": {
            "owned": true,
            "sha256": "..."
          },
          "next": {
            "sha256": "...",
            "bytes": 19987
          }
        }
      ]
    }
  ]
}
```

An operation action is `create`, `replace`, or `remove`.

For every existing path, the journal records the observed entry kind and digest before commit. Only a regular file whose ownership can be proved may be replaced or removed. Missing paths can be created. Directories, symlinks, junctions, reparse points, devices, sockets, and other special entries fail closed.

The journal never records arbitrary deletion paths. Artifact names still come from the bounded managed-name set, and every destination is recomputed from the verified output directory plus the bounded name during recovery.

## Ownership contract and migration

Issue #256 requires that no caller-owned file be removed or replaced. That is stronger than the current README contract, which permits a selected reserved name to overwrite a pre-existing file even when no valid prior CommitAtlas manifest claims it.

The v2 protocol therefore needs an explicit compatibility decision. The recommended migration is:

1. keep reading the existing v1 manifest as proof of ownership for files it lists with matching path, byte length, and digest;
2. treat an existing destination that lacks matching manifest ownership as caller-owned and fail before commit;
3. allow `create` only when the destination is absent;
4. allow `replace` or `remove` only when the current bytes match the previous valid manifest or a prior v2 transaction record;
5. add an explicit one-time adoption command later if users need to transfer a pre-existing reserved file into CommitAtlas ownership;
6. update the README and release notes because this intentionally tightens overwrite behavior.

A filename being reserved is not ownership proof. A manifest entry whose digest does not match the current file is also not ownership proof. Drift means a caller or another process changed the path, so publication stops without altering it.

Until that migration is approved, implementation should remain behind a draft PR and must not silently change overwrite behavior.

## Phase machine

The durable status progresses monotonically through these phases:

```text
preparing
prepared
backed-up
installing
installed
committing
committed
cleaning
complete
```

A status update is written to a new file, flushed, and atomically renamed over `status.json`. The containing transaction directory is flushed where the platform permits it. A status is never advanced before the data needed to recover that phase is durable.

### `preparing`

The transaction directory exists, but the immutable journal is not yet complete. A later run may delete an old `preparing` transaction only after proving that no destination change was possible and that all files remain under the transaction directory.

### `prepared`

Every next-generation payload and manifest is staged and verified by byte length and digest. All output paths have been re-resolved without symlinks. No destination has changed.

### `backed-up`

Every existing owned destination that may be replaced or removed has a verified backup in the transaction directory. The backup digest matches the journal. Caller-owned and drifted files were rejected before this phase.

### `installing`

Payload operations are applied in deterministic target and filename order. Before each operation, the destination is rechecked against the journal's previous state or the already-installed next state. This makes retry idempotent and detects external mutation.

### `installed`

All payloads except output manifests contain next-generation bytes. Previous output manifests remain visible, so direct readers may see new payloads under old manifests during this bounded interval. The repository-scoped status marker identifies the publication as incomplete.

### `committing`

Output manifests are installed last, in deterministic target order. The global transaction remains incomplete until every target manifest is present and verified.

### `committed`

Every target payload and manifest matches the next generation. Recovery must roll forward from this point, never roll back, because readers may already have consumed committed manifests.

### `cleaning`

Backups and staged files are removed only after the committed generation has been verified again. Cleanup failure does not make the published generation invalid.

### `complete`

The transaction has no remaining staged or backup files. A compact completion receipt may be retained for a bounded period, then removed.

## Recovery direction

Recovery chooses one direction from durable evidence. It never chooses per file.

- Before `committed`, default to rollback to the previous complete generation.
- At or after `committed`, roll forward and finish cleanup.
- If status is missing or corrupt, inspect the immutable journal and destination digests. Recover only when every observed path can be classified unambiguously as previous, next, or absent according to its action.
- If any path matches neither recorded state, stop with a bounded error that names the transaction and path. Do not delete, overwrite, or guess.

Rollback restores owned backups in reverse operation order, restores previous manifests last, and removes only newly created paths whose current digest matches the recorded next digest. A newly created file that was changed after the crash is no longer safe to remove and causes recovery to stop.

Roll-forward installs any missing next bytes, verifies every target manifest, and then cleans transaction storage. It never uses an uncommitted staged generation as current unless the journal and status require a committed roll-forward.

Recovery runs before rendering or fetching new data. A new publication cannot begin while any earlier transaction is incomplete.

## Reader-visible contract

Direct file paths remain stable. This preserves README images and checked-in artifact workflows.

Because paths remain stable, a reader can observe mixed bytes during commit or rollback. The contract is therefore:

- each individual file replacement is atomic;
- each output manifest is published after its payloads;
- a repository-scoped status marker reports an incomplete publication;
- a consumer that needs a coherent multi-theme snapshot must refuse to consume while a transaction is incomplete, then verify manifest hashes after completion;
- casual direct-file consumers may briefly observe a mixture, but the next generator invocation deterministically converges or fails closed.

The CLI should print the transaction identifier and recovery result when it encounters unfinished work. The Action should expose a concise step summary. It should never print a success message while status is not `complete`.

## Locking and concurrent writers

The first implementation should use an exclusive repository-scoped lock file containing a bounded owner record with process id, start time, hostname, and transaction id.

The lock is advisory, not a security boundary. A second cooperative writer stops. A stale lock may be reclaimed only after the associated transaction has been recovered and the implementation can prove that the recorded local process is not active where that check is supported. On hosts where liveness cannot be proved, require an explicit recovery command or a bounded stale-age policy documented as best effort.

All destination checks still run immediately before mutation because another process can ignore the lock.

## Durability and platform rules

The implementation should isolate platform-specific durability operations behind a small adapter and test the state machine independently.

Required rules:

- use regular files only for journal, status, staged payloads, backups, and destinations;
- open new control files with exclusive creation;
- flush file contents before a phase can depend on them;
- flush the containing directory after critical create or rename operations where supported;
- treat unsupported directory flush as a reported weaker durability capability, not as proven equivalent behavior;
- never depend on replacing a non-empty directory;
- never depend on symlink or junction creation;
- close file handles before replacement on Windows;
- classify sharing violations and antivirus locks as retryable only before a bounded deadline, then fail without advancing status;
- recompute containment and reject reparse points or symlinks before every visible mutation.

The initial implementation should test Windows and Linux in CI. macOS should be added when the failure-injection harness is deterministic there.

## Failure-injection matrix

Tests need a storage adapter whose operations can fail or terminate after named checkpoints. At minimum, exercise two themes and inject interruption:

1. before journal publication;
2. after journal publication;
3. after each staged payload;
4. after each backup;
5. before the first destination mutation;
6. after every payload create, replace, and remove;
7. after the last payload but before any manifest;
8. after each target manifest;
9. immediately before and after `committed` status;
10. during staged-file cleanup;
11. during backup cleanup;
12. during rollback after each restored file;
13. during roll-forward after each installed file.

For every checkpoint, restart recovery repeatedly and assert:

- recovery is idempotent;
- all themes converge to one previous or next generation according to phase;
- no uncommitted generation is reported complete;
- no caller-owned or drifted file changes;
- no symlink or reparse-point escape occurs;
- manifests match the bytes they claim;
- temporary storage is eventually bounded;
- a second generation cannot start first;
- single-theme behavior follows the same protocol;
- dry-run creates no lock, journal, backup, status, or output.

The harness should also mutate one destination between checkpoints. Recovery must fail closed whenever bytes match neither recorded generation.

## Bounded cleanup

Only `complete` transactions and `preparing` transactions proven never to have reached a destination may be garbage-collected automatically.

Recommended defaults:

- remove staged and backup files immediately after successful verification;
- retain a small completion receipt for seven days or the latest 20 publications, whichever is smaller;
- never age-delete an incomplete transaction;
- provide a read-only diagnostic command that explains why an incomplete transaction is recoverable, blocked, or corrupt;
- require an explicit operator action to abandon an irrecoverable transaction, and never let abandonment delete destinations.

## Implementation slices

### Slice 1: pure protocol and failure harness

Add schema validation, phase transitions, recovery classification, and an in-memory storage adapter. Prove the matrix without touching production publication.

### Slice 2: repository control store

Implement contained transaction directories, exclusive writes, digest verification, lock handling, and platform durability capabilities. Keep v1 publication as the default.

### Slice 3: shadow planning

Run the v2 planner in CI tests beside v1 and compare intended operations. Record no production journal and make no behavior change.

### Slice 4: v2 single-theme opt-in

Enable the protocol for one output directory behind an explicit config or CLI opt-in. Add migration documentation for ownership tightening.

### Slice 5: multi-theme opt-in

Enable one repository-scoped transaction across all configured themes. Require Windows and Linux failure-injection CI and rebuild `action/dist`.

### Slice 6: default and cleanup

After compatibility evidence, make v2 the default, keep a bounded escape hatch for one release, update public documentation, and remove the old writer only after equivalent single-theme and dry-run coverage.

## Acceptance mapping

| Issue #256 acceptance | Design response |
| --- | --- |
| interruption around every payload and manifest transition | named failure-injection checkpoints and restart matrix |
| recovery is idempotent | one journal, monotonic status, whole-transaction recovery direction |
| uncommitted generation never current | manifests last, `committed` boundary, rollback before that boundary |
| no caller-owned file removed or replaced | digest-backed ownership proof and fail-closed migration |
| symlink/path replacement fails closed | containment and entry-kind checks before every visible mutation |
| bounded temporary generations and journals | immediate data cleanup plus bounded completion receipts; incomplete work never age-deleted |
| single-theme and dry-run compatibility | same protocol for one target; dry-run writes nothing |
| rebuilt Action and exact-head CI | required in implementation slices that change production code |

## Open decisions before implementation can merge

1. Approve the recommended ownership tightening, or define a different explicit migration for pre-existing reserved files.
2. Decide whether incomplete-publication status is exposed only under `.commitatlas/` or also copied into each output directory for consumers that cannot inspect the repository root.
3. Choose the stale-lock policy for hosts where process liveness cannot be proved.
4. Decide whether directory flush capability is required for enabling v2 by default or reported as a documented durability downgrade.

These decisions do not block the pure state-machine and failure-injection harness. They do block switching production publication to v2.
