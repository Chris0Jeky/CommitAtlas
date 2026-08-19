# @commit-atlas/svg

Small, dependency-free SVG renderers for GitHub portfolio cards. Renderers return a
complete SVG string and are safe to put in a README or a static site: user text is XML
escaped, links are restricted to `http`/`https`, and no scripts, images, stylesheets, or
remote assets are emitted.

The package includes profile, streak, activity, language, and six-project signal-board
cards. Choose one of the four built-in themes (`aurora`, `midnight`, `paper`, or `ember`)
and provide plain presentation data from your own GitHub adapter.

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
