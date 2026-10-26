# Publication shadow planning implementation plan

**Goal:** Implement slice 3 of `STATIC_PUBLICATION_RECOVERY.md` without changing the v1 writer.

**Architecture:** A pure internal planner consumes explicit prior ownership versions, next rendered versions, and a complete current observation set. It returns a whole journal or explicit conflicts. Real-filesystem tests compare its intent with v1; no production caller imports the helper.

**Constraints:** Keep v2 test-only, all four control-policy decisions explicit, and v1 selected-name overwrite behavior unchanged. Use the existing protocol/codec budgets and own-data input boundary. A plan is a snapshot, not mutation authority, ownership authentication or durable evidence.

## Contract and decisions

- `planPublicationShadow(declaration, observations)` accepts transaction identity/time and one to four targets. Each target supplies `outputDir`, dense named `previous` ownership versions, and dense named `next` rendered versions including `manifest.json`.
- Dense observations cover the exact union once. Extra, duplicate, missing, sparse or accessor-backed declarations/observations are invalid input.
- Missing selected files become `create`; matching owned selected files become `replace`, including byte-identical versions. Matching owned retired files become `remove`; absent retired files are omitted. No new no-op policy is introduced.
- Current files without a separate previous claim block, even when their bytes match next. Drift and unsafe entry kinds block every target and return no partial journal.
- Preserve target/config order. Sort payload names and place each manifest last. Reject case-colliding output roots, unsafe platform paths and control-root overlap. Existing codec bounds apply before returning a journal.
- Ownership declarations are evidence supplied by a future validated adapter. This pure helper neither authenticates them nor permits later destination mutation without fresh checks.

## Work

- [x] Add literal tests for creates/replacements/removals, missing retired files, all-theme blocking and ownership-versus-matching-bytes.
- [x] Run the new tests against the unchanged protocol and retain the missing-feature baseline.
- [x] Implement the helper with detached own-data records and existing schema/codec limits.
- [x] Add malformed-input, ordering/permutation, capacity, changed-after-planning and real v1 multi-theme/dry-run comparison tests.
- [x] Demonstrate meaningful safety mutations fail, then restore and run the static suite, typecheck, lint and discovery gate.
- [x] Update the design with implementation evidence and remaining production acceptance; hand the exact patch to root for independent review and GitHub integration.

## Approaches considered

Shadow planning is the existing next slice and adds executable comparison evidence without deciding migration. A live recovery diagnostic would need additional readiness/status semantics. Destination mutation would cross unresolved ownership and platform gates, so remains outside this work.

## Local evidence

- Initial unchanged-source feature baseline: 12 failing cases, missing shadow entry point.
- The all-unowned-manifest case exposed premature filtered-journal validation: 12 passed/1 failed before repair, 13 passed after it.
- Final focused suite: 16 passed, no skips. Four safety mutations separately fail 4/2/2/3 cases; all mutations were restored.
- Full static package suite: 329 passed, no skips. Typecheck and lint pass; the combined focused/discovery run passes 39 tests. The first typecheck attempt overlapped package rebuild and observed transient missing dist declarations; the sequential rerun passes.
- No production imports, activation, Action bundle regeneration, native Windows or crash-durability claim is included.
