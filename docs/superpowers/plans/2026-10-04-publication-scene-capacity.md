# Publication scene-capacity reconciliation

Scope: bounded #256 follow-up after #297/#298, not production writer activation.

- [x] Reproduce the 81-operation old/new inventory rejection and the 120 KiB
      scene payload rejection before changing the protocol.
- [x] Bound artifact names to 64 characters, increase operation capacity to 96,
      and permit the scene byte ceiling only for canonical static scene names.
- [x] Increase the bounded canonical journal envelope to 128 KiB; retain 512-byte
      status records and intrinsic pre-decode checks.
- [x] Exercise all phases and global manifest order for four full inventories;
      pin naming/size agreement with static delivery and retain small wire records.
- [ ] Publish as a separate PR; inspect exact-head full CI and independent review.

Evidence: four of six initial tests failed on baseline; the passing controls
confirmed unchanged fixed-artifact limits and canonical small-record bytes.
The new suite contains seven tests, including static-name parity. All 107 local
static tests pass after the repair. Full lint/packaging/Action reproducibility
remains the published head's ordinary CI gate.

Ruling: internal record capacity must cover the union of previous and next
scene names, not just the current selection. The 81-entry maximum derives from
16 fixed names, 32 retired scenes, 32 new scenes, and one manifest. Capacity 96
leaves finite headroom; four targets still fit a 128 KiB canonical envelope with
bounded names. No production artifact allowlist, overwrite policy, lock rule,
reader status, filesystem operation or motion budget is changed.
