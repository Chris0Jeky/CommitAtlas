# Architecture

CommitAtlas combines a small, versioned rendering library with two delivery surfaces:

```text
README <img> ─┐
Static action ─┼─> validated data model ─> accessible SVG renderers
Studio / HTML ┘            ↑
                    GitHub REST + GraphQL
```

## V1 surfaces

| Surface | Purpose | Delivery |
| --- | --- | --- |
| Profile | Public repositories, stars, followers, contribution totals | SVG + JSON |
| Streak | Current/longest UTC contribution streak | SVG + JSON |
| Activity | Bounded contribution trend | SVG + JSON |
| Languages | Repository-language distribution, not proficiency | SVG + JSON |
| Projects | Explicit lifecycle, CI, release, docs/install/download availability | SVG summary + HTML actions |
| Studio | Configure, preview, copy Markdown, and inspect source/freshness | HTML |

An external SVG embedded in a README is one image link. Its internal pseudo-buttons are not a
reliable interaction surface, so the project card links as a whole to the HTML dashboard where each
project action is keyboard-accessible.

## Boundaries

- Query parameters are allowlisted, length-bounded, canonicalized, and versioned under `/api/v1`.
- Outbound requests target GitHub API hosts only. Manifest links are displayed after HTTPS
  validation but are never fetched by the service.
- GitHub tokens are server/action secrets only. The optional `GITHUB_TOKEN` Worker binding is set
  with `wrangler secret put GITHUB_TOKEN`; it is never accepted in URLs or browser state.
- The shared hosted API rejects private repository responses. Before its viewer-scoped contribution
  query, it requires an authenticated GitHub REST scope proof containing only empty or `public_repo`
  classic scopes and rejects any restricted contribution collection. It also rejects any emitted URL
  with credentials. Private portfolio output belongs to static generation owned by the repository author.
- Renderers accept normalized data, escape every text node, and emit no scripts, remote images,
  `foreignObject`, event attributes, or arbitrary CSS.
- Cache age and source availability are visible product data. Partial responses remain partial.

## Delivery and caching

The hosted service is best-effort and cache-first. Static generation through GitHub Actions is the
reliability path because it uses repository-owned credentials and serves committed SVG assets. The
edge adapter uses canonical cache keys and conditional GitHub requests; no database is required for
V1.

## Project manifest

```yaml
version: 1
projects:
  - repo: Chris0Jeky/CommitAtlas
    label: CommitAtlas
    lifecycle: active
    workflow: ci.yml
    links:
      docs: https://github.com/Chris0Jeky/CommitAtlas/tree/main/docs
      install: https://github.com/Chris0Jeky/CommitAtlas#quick-start
      download: https://github.com/Chris0Jeky/CommitAtlas/releases/latest
```

The manifest is fetched only from a validated GitHub `owner/repo/path` source. V1 limits a project
board to six entries to cap API work and keep the README card legible.
