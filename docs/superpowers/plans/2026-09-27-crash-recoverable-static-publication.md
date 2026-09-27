# Crash-Recoverable Static Publication Plan

> **Execution requirement:** implement this plan test-first in focused pull requests. Do not describe the result as cross-directory atomicity.

**Issue:** #256  
**Goal:** Make interrupted multi-theme publication recoverable, idempotent, and truthfully observable without changing existing artifact paths or deleting caller-owned files.

## Decision

CommitAtlas cannot truthfully provide one atomic filesystem transition across unrelated output directories or mounts. Standard file replacement is atomic only for one destination on one filesystem. Directory swaps are not portable across Windows and POSIX, and replacing an output directory would also endanger unrelated sibling files that CommitAtlas does not own.

The chosen contract is therefore **durable rollback recovery**, not cross-directory atomicity:

1. Render and validate every target from one snapshot.
2. Stage every new payload beside its final destination.
3. Preserve every currently owned file that may be replaced or removed.
4. Persist one repository-contained transaction journal before the first visible mutation.
5. Apply bounded file transitions while manifests remain last in each output directory.
6. Remove backups and the journal only after every target is committed.
7. On the next invocation, detect an unfinished journal and roll back idempotently before rendering a new snapshot.

A process may still terminate during the visible commit window. During that window, the transaction is explicitly uncommitted. The Action consumer already publishes only after generation and validation succeed, so a failed run must never commit that working tree. Direct CLI users receive the same rollback on the next invocation.

## Rejected alternatives

### Whole-directory rename

Rejected because output directories may contain caller-owned siblings, replacing non-empty directories is not portable, and configured theme directories may reside on distinct mounts.

### Symlink or pointer switch

Rejected for v1 because it changes public artifact paths, introduces Windows privilege and junction differences, and does not map cleanly to repositories that commit generated files.

### Forward completion after interruption

Rejected as the default because staged new files may be missing or externally modified after a crash. Previously published files and their hashes are the stronger recovery authority. Recovery rolls back unless a later versioned protocol proves forward completion safe.

### Journal without backups

Rejected because it can report a partial commit but cannot restore the previous valid generation.

## Ownership and containment

- The existing valid CommitAtlas manifest remains the sole authority for files CommitAtlas may replace or remove.
- The journal cannot grant ownership over a path that the prior manifest did not claim or that the new validated payload set does not name.
- Every recorded path is repository-relative, normalized, bounded, and revalidated without symlink components before each destructive transition.
- Backups live beside their original files so restore renames stay on the same filesystem.
- Temporary names are random, hidden, and accepted only when the journal records the exact name and expected digest.
- Directories, symlinks, devices, and other special entries fail closed.

## Transaction layout

One active journal is stored at:

```text
<repository>/.commitatlas/transactions/active.json
```

The parent path is runtime state, not a generated portfolio artifact. Its containment and component types are validated before use. A repository may have at most one active static publication transaction.

Each destination uses same-directory temporary names:

```text
.<artifact>.<transaction-id>.new
.<artifact>.<transaction-id>.backup
```

Temporary names never appear in a manifest and are excluded from ordinary artifact discovery.

## Journal v1

```ts
interface PublicationJournalV1 {
  readonly version: 1;
  readonly generator: "CommitAtlas";
  readonly transactionId: string;
  readonly state: "prepared" | "committing" | "rolling-back";
  readonly createdAt: string;
  readonly targets: readonly PublicationTargetJournalV1[];
}

interface PublicationTargetJournalV1 {
  readonly outputDir: string; // repository-relative
  readonly operations: readonly PublicationOperationV1[];
}

interface PublicationOperationV1 {
  readonly destination: string; // basename only
  readonly kind: "replace" | "create" | "remove";
  readonly newTemporary: string | null;
  readonly newSha256: string | null;
  readonly backupTemporary: string | null;
  readonly previousSha256: string | null;
  readonly manifest: boolean;
}
```

Unknown fields, unknown versions, invalid state, duplicate destinations, absolute/traversing paths, unbounded strings, inconsistent nullability, and non-hex digests fail closed. A malformed journal is never deleted automatically because it may be the only recovery evidence.

## State machine

### No journal

Normal generation may begin.

### `prepared`

All new files are staged and all required backups are durable. No visible destination has changed. Recovery removes staged and backup files after verifying their recorded hashes, then removes the journal.

### `committing`

At least one visible transition may have occurred. Recovery changes the journal to `rolling-back`, then restores every operation in reverse target and reverse operation order.

### `rolling-back`

Recovery resumes rollback. Every step is idempotent and classifies the filesystem from the destination, backup, staged file, and recorded digests rather than trusting an in-memory counter.

### No journal after successful commit

Every payload and manifest transition completed, backups were removed, and the journal was removed last.

## Operation recovery

For each operation, recovery accepts only states explainable by the journal:

- `replace`: previous bytes may be at the destination or backup; new bytes may be at the destination or staged path. Restore the previous digest to the destination, then remove the verified staged/backup residue.
- `create`: the previous state is absence. Remove the destination only when it matches the recorded new digest; remove the verified staged file.
- `remove`: restore the verified backup to the destination when absent. If the destination already matches the previous digest, remove only the verified backup.

Any destination with an unrecorded digest, unexpected special entry, missing required previous bytes, or path containment drift stops recovery without deleting evidence.

## Commit ordering

1. Revalidate all target directories and current destinations.
2. Stage all new payloads and manifests.
3. Create and sync all required backups.
4. Write and atomically replace the `prepared` journal.
5. Replace the journal with state `committing`.
6. Apply non-manifest payload operations target by target.
7. Apply each target manifest last.
8. Verify final destination hashes against the new manifests.
9. Remove verified backups and unused staged files.
10. Remove the active journal last.

Journal replacement uses a same-directory temporary file and rename. File handles are synced before rename where Node exposes that operation. Directory syncing is attempted on platforms that support it; unsupported directory sync is documented rather than silently claimed.

## Failure-injection matrix

The test driver must inject termination before and after every transition for two themes, with at least one replace, create, and remove operation per target:

- after new staging;
- after each backup is durable;
- before and after writing `prepared`;
- before and after writing `committing`;
- before and after every payload replacement;
- before and after every stale-file removal;
- before and after every manifest replacement;
- during backup cleanup;
- immediately before journal removal.

For every injected point:

1. Start from a complete previous two-theme generation.
2. Attempt a changed generation and inject the failure.
3. Start a fresh generator invocation.
4. Require recovery to restore the complete previous generation byte-for-byte.
5. Run recovery again and require no change.
6. Require no caller-owned sibling change.
7. Require no path outside the repository to change.
8. Require temporary files to be bounded to the recorded transaction set.

Separate hostile-state tests cover changed destination bytes, removed backups, symlink replacement, malformed journals, unsupported versions, duplicate operations, and interrupted rollback.

## API shape

Filesystem injection remains internal. `generateStaticFromSnapshot` keeps its public options unchanged. Publication moves into an internal module with a narrow driver:

```ts
interface PublicationIo {
  lstat(path: string): Promise<Stats>;
  readFile(path: string): Promise<Buffer>;
  writeExclusive(path: string, body: Buffer): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  syncFile(path: string): Promise<void>;
  syncDirectory(path: string): Promise<"synced" | "unsupported">;
}
```

Production uses Node filesystem operations. Tests use a deterministic failpoint wrapper around the real temporary filesystem, not a fake in-memory filesystem.

## Delivery slices

### Slice 1: Pure journal validation and filesystem classification

- [ ] Add strict journal schemas and semantic checks.
- [ ] Add operation-state classification from recorded hashes.
- [ ] Add malformed, hostile, and cross-platform path tests.
- [ ] Keep this slice free of visible publication changes.

### Slice 2: Backup preparation and idempotent rollback

- [ ] Add same-directory backup creation with exclusive names and digests.
- [ ] Persist `prepared`, `committing`, and `rolling-back` states atomically.
- [ ] Implement reverse-order rollback.
- [ ] Add interruption tests for preparation and rollback itself.

### Slice 3: Integrate commit and recovery

- [ ] Run recovery before every non-dry-run publication.
- [ ] Route current payload, manifest, and stale cleanup transitions through the transaction engine.
- [ ] Preserve manifest-last semantics.
- [ ] Add the full two-theme failure matrix.

### Slice 4: Distribution and contract documentation

- [ ] Rebuild `action/dist`.
- [ ] Update the static generator contract to distinguish per-file atomic replacement, predictable-failure preflight, and crash recovery.
- [ ] Document unsupported directory syncing honestly.
- [ ] Pass exact-head `npm run check` and production dependency audit.

## Merge gates

- Every slice is independently reviewable and has no temporary workflow residue.
- A rollback test must demonstrate RED against the preceding implementation before the recovery behavior lands.
- Exact-head CI must pass after the tracked Action bundle is regenerated when static source changes.
- The PR description must never use “atomic” without the qualifier “single-file” or “not cross-directory”.
- #256 remains open until all four slices and the full failure matrix are merged.
