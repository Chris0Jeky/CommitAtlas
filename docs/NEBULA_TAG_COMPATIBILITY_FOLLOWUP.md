# Nebula release-tag compatibility follow-up

Status: test-first draft, not merge-ready. Follow-up to the safely merged evidence repair #350.

The current `boundedToken` in `packages/svg/src/scenes/nebula.ts` accepts only ASCII letters, digits and `._+-`, at most 64 UTF-16 code units. This can suppress real observed release marks for tags such as `release/v1.0.0`, `版本-1.0` and `релиз-1.0`. The collector's `GITHUB_TEXT_LIMITS.releaseTag` is 200. That contract mismatch is a false-negative compatibility limitation, not permission to weaken source, publication-time or clock qualification.

## Reproduced baseline

At merged main `290f4d801ccb7a2040d453791c3cff6f597b125a`, the new focused test returns three failures and four passing controls. The plain ASCII tag passes; slash-containing and Unicode tags are not retained in the model. Stale, partial and unavailable project boards still suppress release marks. The test is registered in normal SVG CI; its red status is intentional evidence of unfinished implementation, never a merge waiver.

Run after a normal locked build:

```sh
npm ci
npm --prefix packages/svg run build
node --test --test-concurrency=2 packages/svg/tests/nebula-tag-compatibility.test.mjs
```

Local reproduction used offline TypeScript syntax emission and the committed bundled Zod implementation, not a successful locked build. Normal CI must independently reproduce the failure and later prove the fix.

## Remaining implementation and validation

- Replace the ad hoc ASCII token restriction with a bounded tag contract aligned with the producer. Explicitly reconcile the existing 64-unit renderer bound with the collector's 200-unit bound; do not silently truncate, normalize or replace the original observed identity.
- Add length-boundary, slash, Unicode, malformed type, blank/control text and hostile-markup fixtures. Preserve the existing unsafe-record and unpublished/future-release checks. If a former rejection fixture becomes valid under the reviewed compatibility contract, add its replacement out-of-bound case and explain the changed contract rather than deleting protection.
- Keep all root/contribution/project clock, source-class, duplicate-repository, unavailable-board, budget, determinism and frame-zero regressions from #350.
- Verify a changed tag affects the stable model/seed without introducing raw unsafe SVG text. Test both layouts and themes, and prove malformed tags never authorize a release.
- Rebuild the Action from the exact new source and inspect the complete locked `npm run check` plus production audit. Publish only the verified bundle, with no temporary qualification workflow remaining in the clean merge candidate.
- Require successful normal CI on the final exact clean head and review before merging this draft. This PR currently contains tests and this handoff only, not a compatibility fix.

No new fetch, release-history feature, hosted allowlist entry, motion policy, measured playback claim or owner-decision override is required.
