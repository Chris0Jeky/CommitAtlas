# Contribution-range review, 2026-10-07

Reviewed implementation head: `fe7a4705231ec3829460fe6f73919a65dfd58fd6` (PR #316).
Current main at review: `f1a0676c4613b4be1d166b3173314b6855dbf3d3`.

The retained [range receipt](./contribution-range-2026-10-06.json) records a live HTTP-200 GraphQL range error for a single 730-day collection, followed by two complete 365-day date collections. Its repository GITHUB_TOKEN verifies the API range constraint, not the application's classic public-only token preflight. No activity counts or credentials are retained in that receipt.

The implementation uses consecutive UTC slices of at most 365 calendar dates, ending each nonfinal slice one millisecond before the next starts. The explicit 730-day maximum uses two queries; the existing 731-day automatic ceiling can use three. Calls share one client deadline and credential proof. Every slice checks restricted-data flags, date validity and category counts; combination checks safe-integer category totals and complete contiguous coverage before automatic leading-zero trimming. No partial snapshot is returned after a failed slice.

The added tests cover 365/366/730/clamped/automatic ranges, leap-day coverage, one preflight, exact adjacent boundaries, final timestamp, restricted/missing/duplicate/future/error data, category overflow, the absolute deadline, short automatic history, stale endings, empty history and gaps hidden in inactive prefixes. `lib/github/client.ts` remains the package re-export; the implementation lives in `packages/github/src/client.ts`.

CI run [37548770096](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37548770096) completed the repository gate and production audit for the reviewed implementation head, including the checked-in Action rebuild check. This review commit requests fresh CI against current main before merge. The temporary range-diagnostic workflow is absent from the final diff.

Issue #307 remains the place to record an end-to-end live 730-day fetch through the application's accepted classic public-only credential path. That narrower credential qualification is not established by the repository-token diagnostic or synthetic tests. The range repair can ship independently without weakening that boundary.
