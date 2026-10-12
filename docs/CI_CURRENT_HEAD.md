# Configured CI is bound to an observed default-branch tip

Issue #348. The project collector must not attribute a previous revision's successful, failed or pending run to newer code that has not been tested.

For each public project with an explicitly configured workflow, collection first obtains the declared default branch's tip through the bounded GitHub `/repos/{owner}/{repo}/branches/{branch}` endpoint. Both branch and workflow identities remain encoded path segments. A usable tip requires the requested branch name and a full 40-hex commit SHA. No absent default branch is guessed as `main`.

The existing latest-run request remains scoped to that workflow and branch with `per_page=1` and `exclude_pull_requests=true`. Only a run whose full `head_sha` matches the captured tip may contribute passing, failing, pending or stale status. Existing conclusion and age rules remain unchanged. Mismatched or malformed revision evidence yields configured `unavailable`, with no borrowed run URL, timestamp or SHA; the board is partial. A missing run is not a failed build.

## Cost and failure boundaries

This adds one request per configured project workflow, at most six additional requests per board under the existing project cap. Unconfigured CI makes neither a branch nor a workflow request. Public repository validation precedes every auxiliary lookup. Refused or missing optional branch evidence stays unavailable; existing rate-limit and upstream-availability errors retain their established error contract. No timeout, retry, token scope, status enum or dependency is changed.

The tip is a **single as-of observation**, not a transaction with GitHub or a guarantee that the branch cannot move after it was read. The collector neither invents a current result from the most recent run nor promises that sequential API reads are atomic. No branch history, names from private repositories, jobs, logs or commit contents are retained.

## Proof obligations

`packages/github/tests/ci-current-head.test.mjs` covers old-head success/failure/cancellation, matching status and stale controls, invalid tips/run SHAs, missing branch metadata, encoded names, optional lookup failures, bounded calls, unconfigured CI and private-repository refusal. It is registered in the ordinary GitHub gate after building its package. Existing client/terminal fixtures now explicitly provide a branch tip and full run SHA instead of permitting a hidden fallback. Unconfigured fixtures still reject unexpected branch calls.

The built Worker regression in `tests/rendered-html.test.mjs` checks the actual projects API for both matched and mismatched revisions, including state, head, timestamp and board freshness. The generated Action must be rebuilt from the same source. All normal quality checks remain required.

Local behavioral probing used the committed Action's actual collector with the candidate method substituted, not a locked source build: 34 new counterexamples fail on the old implementation, then all 40 new tests and 78 existing client tests pass with the repair. A pinned temporary qualification transport must independently reproduce red, apply the exact reviewed source/test blobs, pass the full locked gate, and retain proof. It never moves a branch. The transport and workflow must be removed when the verified source and bundle are published; successful normal CI on the final clean head is the merge gate. Actual run outcomes belong in the PR receipt.
