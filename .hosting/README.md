# CommitAtlas hosting compatibility

Reference-only preparation, 2026-09-10. `manifest.json` is inert agent metadata. No Worker, KV, hostname, secret, runtime behavior or deployment trigger is changed. The existing pipeline publishes main pushes after CI; a future documentation-only merge can therefore deploy too. Review that path before merging.

Retain the existing Worker and LAST_GOOD namespace. Static assets do not make the server-rendered and SVG/API routes a static-only application. Do not rewrite those routes or combine this service with unrelated applications merely to share an account or umbrella domain.

## Next slices

CA1 prepares a final owned origin without conflating `SITE_ORIGIN` (canonical, sitemap, structured metadata) and `DEPLOY_BASE_URL` (deployment verification). Test alias/fork behavior and retain old embed URLs deliberately. No candidate hostname is installed by this PR.

CA2 preserves `npm run deploy`, the build-generated configuration and its deterministic deployed-origin probes. A bare Wrangler deploy from an unbuilt checkout can replace a working deployment without its client assets. Never use that shortcut as an automation adapter.

CA3 verifies namespace preservation, public last-good fallback, no private/token-backed fallback borrowing, and stable card routes. Keep the optional token outside source and output. Invalid, cold, expired or stale evidence must not become a fabricated success during domain migration.

## Checks and rollback

Follow `AGENTS.md`, the current project state, expansion plan and existing workflow. This is a reference, not a new prompt system. Syntax: `python -m json.tool .hosting/manifest.json`. Future implementation uses `npm run typecheck`, `npm run lint`, `npm test` and the full `npm run check` as applicable. Actual hosting acceptance requires the existing live probes; JSON validation does not establish it.

Record the previous Worker version and KV binding before promotion. Do not delete namespace data or old embed routes during a marketing rename. Keep public names, internal service IDs, package/action coordinates and generated asset paths separately versioned. Private operational receipts and unregistered candidate names remain outside this public repository.
