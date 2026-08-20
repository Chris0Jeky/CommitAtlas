# `@commit-atlas/github`

Hardened GitHub REST and GraphQL transport for CommitAtlas. It normalizes public profile, contribution, release, and explicitly configured workflow evidence while enforcing bounded responses, deadlines, GitHub-only destinations, and fail-closed public credential checks.

```ts
import { GitHubClient } from "@commit-atlas/github/client";

const client = new GitHubClient({ token: process.env.GITHUB_TOKEN });
const contributions = await client.fetchContributions("octocat", 365);
```

Tokens used by public request-time routes must carry positive public-only classic OAuth scope evidence. Scheduled private generation belongs in the static generator, where output policy and repository permissions are explicit.

Licensed under GPL-3.0-only.
