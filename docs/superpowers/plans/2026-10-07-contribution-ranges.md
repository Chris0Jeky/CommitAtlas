# Bounded contribution ranges (#307)

Base: main 7a4695cec39fd5d9715d4e30896bdac0feeecc98, uploaded archive tree verified identical.

1. Reproduce the oversized token query with a UTC-range-aware mock and a read-only live API receipt. No activity counts or credentials in the receipt.
2. Split the existing client request into non-overlapping, at-most-365-day UTC slices (maximum three for auto=731). Reuse its credential proof and absolute deadline; reject any failed/private/malformed slice without partial output.
3. Validate and combine observed calendar days and exact category counts; reject unsafe aggregate integers, missing interior days, and stale endings. Preserve leading short history in auto mode and strict explicit coverage.
4. Test leap days, midnight boundaries, numeric clamping, auto history, privacy, incomplete/duplicate/future data, upstream failures, and shared-deadline exhaustion.
5. Rebuild tracked Action output. Remove the temporary diagnostic workflow. Run focused and full gates on the final head, review, then merge only if qualified.

No motion-oracle relaxation, owner-decision closure, benchmark fabrication, or private export expansion.
