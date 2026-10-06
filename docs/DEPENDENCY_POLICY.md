# Runtime and dependency update policy

## Node declarations follow the supported runtime floor

The root package declares Node 22.13.0 and newer, the bundled GitHub Action uses `node22`, and the quality gate builds and tests the workspace packages on Node 22.13.0. Keep `@types/node` on major 22 until the minimum runtime is deliberately migrated.

Newer Node declaration majors can typecheck APIs unavailable on the minimum supported runtime. A green test run of existing code does not establish that future code compiled against those declarations will run on Node 22.

Dependabot therefore ignores only major version updates for `@types/node`. Its minor and patch updates remain eligible for the existing development-dependencies group. Other dependencies, GitHub Actions, schedules, and pull-request limits are unchanged. This is not a general freeze on dependency or security maintenance.

## Coordinated runtime migration

Before changing the declaration major, coordinate the root engine floor, CI runtime, and Action execution runtime. Check the published packages for runtime-specific APIs and declare package-specific engine requirements where needed. Confirm that the target runtime is supported by the Actions runner and that the built packages and Action work on the new minimum version. Update this policy and the Dependabot rule as part of that migration rather than accepting a standalone declaration-major bump.

## Merge evidence

Review both package and lockfile changes, run the full `npm run check` gate and production audit, and qualify the current PR head against the current main branch. Older green checks are not proof for a subsequently changed branch. Rebuild tracked Action output whenever bundled code or dependencies change.

References: GitHub's [Dependabot ignore configuration](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/controlling-dependencies-updated) and repository PR #310.
