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

The static generator and Action currently use logged-out public data only. Private generation is not
implemented or implied.

Licensed under GPL-3.0-only.
