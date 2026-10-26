# @commit-atlas/core

Validated GitHub portfolio metrics and project-state contracts for CommitAtlas.

## Install

`@commit-atlas/core` is not published to npm. Build and use it from this repository or from a pinned
source checkout:

```powershell
npm.cmd ci
npm.cmd --prefix packages/core run build
```

The built workspace package exports ES2020 JavaScript and TypeScript declarations from `dist/`.

## Example

```js
import { parseOptions } from "@commit-atlas/core";

const options = parseOptions({ theme: "dark" });
```

CommitAtlas is licensed under [GPL-3.0-only](LICENSE).

## Optional Lens contract entry point

`@commit-atlas/core/lens` provides the pinned `PublicLensProjectionSchema`, bounded-error
`parseLensProjection`, canonical projection hashing and snapshot-clock freshness policy. It is a
separate server/Node-compatible entry point because exact synchronous producer hashing uses
`node:crypto`; ordinary metrics imports do not load it into browser bundles. The schema accepts
C0/C1 contract semantics; CommitAtlas publication adapters currently permit C0 only under the operative Q-9 No policy.
See the [consumer receipt](../../research-contracts/lens-projection/v1/README.md) for the source pin,
fixture canaries, semantic/privacy rules and explicit publication limits.
