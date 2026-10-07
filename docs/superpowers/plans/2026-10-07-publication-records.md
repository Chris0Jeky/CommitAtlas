# Publication record data-field validation

Goal: advance #256 by making journal, target, operation, file-version and status inputs use the same own-data-field boundary as recovery observations. This is a pure validator repair, not a durable writer or a claim of filesystem atomicity.

1. Reproduce getter execution and inherited required-field acceptance at every record layer; test hidden/symbol unknown keys and detached/null-prototype inputs.
2. Snapshot own property descriptors into fresh null-prototype records before any value reads. Reject accessors and all unknown own keys without executing getters. Reuse the boundary for observations.
3. Preserve canonical encoded bytes, phase identity, action validation, budgets, recovery ordering, and existing dense-array handling.
4. Run focused pure-protocol regressions before and after the fix. Publish on a branch from current main and validate the full repository/Action distribution in CI before merge.

Source verified against main f1a0676c4613b4be1d166b3173314b6855dbf3d3: publication-protocol.ts blob 08b84ee0196594157a6775f7d1c1226b1226a0f6. The uploaded archive is 7a4695c; unrelated dependency changes remain GitHub-authoritative.
