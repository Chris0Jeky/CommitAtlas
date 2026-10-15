# `@commit-atlas/github`

Hardened GitHub REST and GraphQL transport for CommitAtlas. It normalizes public profile, contribution, release, and explicitly configured workflow evidence while enforcing bounded responses, deadlines, GitHub-only destinations, and fail-closed public credential checks.

```ts
import { GitHubClient } from "@commit-atlas/github";

const client = new GitHubClient();
const contributions = await client.fetchPublicProfileContributions("octocat", 365);
```

The logged-out public-profile path sends no credential, requires a complete daily window, and labels
GitHub's public activity mix as percentages. Token-backed request-time routes are a separate API and
require positive public-only classic OAuth scope evidence before resource lookup.

`GitHubApiError.code` distinguishes `github_timeout` (the shared deadline expired),
`github_auth_required` (HTTP 401 or GraphQL authentication refusal), `github_forbidden`
(permission refusal), `github_rate_limited` (primary/secondary quota), `github_unavailable`
(network/read failure, 5xx or unclassified GraphQL failure), and `github_not_found`.
Messages never expose upstream bodies. Hosted routes preserve the v1 error envelope and use
502 for upstream failures, 429 with retry guidance for quotas, and 404 for not found; see
[the API contract](../../docs/ARCHITECTURE.md#hosted-delivery-and-caching).

The static generator and Action currently use logged-out public data only. Private generation is not
implemented or implied.

Project snapshots keep release evidence explicit: `releaseState: "none"` means GitHub proved that no
latest release exists, while `"unavailable"` means the optional lookup could not be observed. Consumers
must not count the latter as an unreleased project.

Licensed under GPL-3.0-only.
