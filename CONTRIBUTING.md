# Contributing to CommitAtlas

Thanks for helping make GitHub portfolio signals more useful and more honest.

## Before opening a change

- Search existing issues and pull requests.
- Keep the change focused on one behavior or documentation outcome.
- Do not add inferred health scores, language-proficiency claims, or green fallbacks for unknown CI state.
- Do not include GitHub tokens, private repository data, generated secrets, or personal analytics.

For substantial API or visual-contract changes, open a feature request first so the versioning and accessibility impact can be discussed.

## Local development

CommitAtlas requires Node.js 22.13 or newer and uses the checked-in npm lockfile.

```bash
npm ci
npm run dev
```

The local site is served at `http://localhost:3000`. Before opening a pull request, run:

```bash
npm run check
npm audit --omit=dev --audit-level=high
```

Add focused tests for changed calculations, validation, rendering, or endpoint behavior. SVG changes must remain deterministic, XML-safe, readable without color, and accessible through an explicit image name and description.

## Pull requests

- Use a present-tense Conventional Commit title, such as `feat(cards): add project release signals`.
- Explain the user-visible outcome and the checks you ran.
- Include before/after images for material visual changes.
- Note caching, rate-limit, privacy, and compatibility effects where relevant.
- Keep generated build output out of commits.

By contributing, you agree that your work is licensed under the repository's [GPL-3.0-only license](LICENSE).
