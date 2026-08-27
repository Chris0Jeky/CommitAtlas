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
