# @commit-atlas/svg

Small, dependency-free SVG renderers for GitHub portfolio cards. Renderers return a
complete SVG string and are safe to put in a README or a static site: user text is XML
escaped, links are restricted to `http`/`https`, and no scripts, images, stylesheets, or
remote assets are emitted.

The package includes a rich developer Atlas plus profile, streak, activity, language, and
six-project signal-board cards. Choose one of the four built-in themes (`aurora`, `midnight`,
`paper`, or `ember`) and provide plain presentation data from your own GitHub adapter. Renderers
support optional subtle fixed CSS load motion and emit a reduced-motion override.

```ts
import { renderProfileCard } from "@commit-atlas/svg";

const svg = renderProfileCard({
  name: "Ada Lovelace",
  login: "ada",
  repositories: 12,
  followers: 420,
  following: 18,
}, { theme: "aurora" });
```

Published packages contain compiled JavaScript and TypeScript declarations in `dist`.

Renderer inputs are bounded for portable README use: dimensions clamp to renderer-safe ranges,
accessible title and description labels are length-limited, and activity cards accept up to a
full 366-day window while remaining below the 30KB SVG output budget. Language cards use one
source basis per item: standalone inputs may use `name` plus bytes or percentages, while the
canonical `@commit-atlas/core` `aggregateLanguages()` result uses `language`, `bytes`, and the
derived `percentage` together and can be passed directly to `renderLanguagesCard`. Profile cards
render an optional source-backed aggregate `stars` value when supplied and leave it absent
otherwise. Partial bytes/percentage mixtures are rejected because their basis is ambiguous.
