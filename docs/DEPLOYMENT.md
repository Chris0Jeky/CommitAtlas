# Deploying CommitAtlas

CommitAtlas is a Cloudflare Worker with static assets. It renders public GitHub data and needs
**no credentials** to serve every documented surface, so a deployment has no required secrets.
Hosted last-good resilience uses one non-secret Workers KV binding.

## What is deployed

| Piece | Source | Deployed as |
| --- | --- | --- |
| App Router server, `/api/v1/*` routes, all eight SVG cards | `app/`, `lib/`, `worker/index.ts` | The Worker script (`dist/server/index.js`) |
| Landing page and Studio client bundles, `og.png` | `app/`, `public/` | Worker static assets (`dist/client/`) |

`vite build` writes both, plus a deploy-ready `dist/server/wrangler.json` derived from the root
[`wrangler.jsonc`](../wrangler.jsonc). Do not hand-edit the generated file — change `wrangler.jsonc`.

## One-time Cloudflare setup

```bash
npm ci
npx wrangler login          # opens a browser; grants Workers deploy scope
npx wrangler kv namespace create commit-atlas-last-good
# Copy the returned namespace id into the LAST_GOOD binding in wrangler.jsonc.
npm run deploy              # builds, deploys, and smoke-checks the result
```

Workers KV namespace IDs belong to one Cloudflare account. The checked-in `LAST_GOOD` ID is for the
maintainer's deployment; a fork must create its own namespace and replace that ID before deploying.
The generated `worker-configuration.d.ts` is kept in step with the binding by
`npm run typecheck:worker`.

The binding stores only validated, credential-free public API representations. Entries expire after
seven days. Synthetic and token-backed requests bypass it; a cold or expired lookup preserves the
normal `429`/`502` response. See [ARCHITECTURE.md](./ARCHITECTURE.md#hosted-delivery-and-caching) for
the cache key, stale response, and eventual-consistency contract.

`npm run deploy` builds, deploys, reads the origin **out of Wrangler's own output**, and verifies
that origin. A `workers.dev` hostname is `<worker-name>.<account-subdomain>.workers.dev`, so it
differs per Cloudflare account — the maintainer's is
`https://commit-atlas.commit-atlas.workers.dev`, and yours will not be. Nothing is hard-coded; if
the origin cannot be read the script says so and exits non-zero rather than verifying someone
else's site.

The bundle is well under the 3 MiB gzipped script limit. Confirm current Workers and KV quotas for
your account before deploying sustained traffic; CommitAtlas does not assume a paid plan.

> **Do not run a bare `wrangler deploy` on an unbuilt checkout.** After a build, Wrangler follows
> `.wrangler/deploy/config.json` to the generated `dist/server/wrangler.json`. Without one it uses
> the root `wrangler.jsonc` directly — same Worker name, no static assets — which would replace a
> working deployment with one that serves no client bundle. `npm run deploy` always builds first.

## Continuous deployment from GitHub

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) deploys the exact commit that
already passed the `CI` quality gate.

A `workflow_run` job is privileged: it runs in the base repository with secrets available. `CI` also
runs on `pull_request`, and a fork PR can name its head branch `main`, so the trigger's own
`branches:` filter is **not** a trust boundary. The job condition therefore requires all four of:
the triggering run was a `push`, from **this** repository, on `main`, and it **succeeded**. Only
then is `workflow_run.head_sha` a commit this repository has proven, and only then is it safe to
check it out and execute its dependencies alongside a deploy token.

Manual `workflow_dispatch` carries no such evidence, so it earns its own: it is refused from any ref
other than `main`, and it runs the full `npm run check` gate before deploying.

It stays green and simply logs a notice until both secrets exist, so adding them is safe to defer.

### The two repository secrets

Add these under **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** template. Scope it to the single account below and no zones. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account details, or `npx wrangler whoami`. |

Optionally add a repository **variable** `DEPLOY_BASE_URL` to verify a specific origin — needed if
the Worker answers on a custom domain. Otherwise the post-deploy check uses whatever origin Wrangler
reports for that deployment, which is correct for any account.

Never commit either value. `wrangler.jsonc` deliberately carries an empty `vars` block.

## Deploying a fork: set your canonical origin

If you deploy your own copy, set `SITE_ORIGIN` in `wrangler.jsonc` to the origin your Worker
actually answers on:

```jsonc
"vars": { "SITE_ORIGIN": "https://commit-atlas.<your-subdomain>.workers.dev" }
```

This is the canonical URL your deployment advertises — in `rel=canonical`, `/sitemap.xml`, the
`Sitemap:` line of `/robots.txt`, and the landing page's JSON-LD. **Leave it unset and your
deployment tells crawlers that the canonical copy of its pages lives on this project's origin**,
which deindexes your own site in favour of someone else's.

It is deliberately deployment configuration rather than something read from the request `Host`
header. A canonical URL has to be stable, and a per-request one would name whatever alias a
visitor arrived on — including a preview hostname, which is the duplicate-content problem
`rel=canonical` exists to solve. Anything unparseable, non-`https`, or carrying a path, query, or
fragment falls back to the default rather than emitting a broken canonical URL on every page at
once.

This is separate from `DEPLOY_BASE_URL` above: `SITE_ORIGIN` is what the site *says about itself*,
`DEPLOY_BASE_URL` is what the post-deploy check *probes*. The verifier does not require them to
match the origin it was pointed at — it checks that `robots.txt` and `sitemap.xml` agree with each
other, which holds on any host.

## The optional GitHub token

Anonymous GitHub requests are rate-limited, and CommitAtlas reports that honestly rather than
inventing data. If you want higher live limits:

```bash
npx wrangler secret put GITHUB_TOKEN
```

Use a **public-scope-only** token. `packages/github/src/client.ts` refuses any credential that
could reach private data (`lib/github/client.ts` re-exports it), and `lib/runtime-env.ts` is the
single contract for reading it. The synthetic demo
mode and the scheduled static snapshot never need it.

## Verifying a deployment

```bash
node scripts/verify-deployment.mjs https://commit-atlas.commit-atlas.workers.dev
```

Eighteen deterministic probes:

- health, the landing page, and the Studio (matched on the title only `/studio` sets, so serving the
  landing page for that route fails rather than passes);
- all eight synthetic SVG cards, each asserted to be an SVG containing no `<script>`,
  `<foreignObject>`, `<iframe>`, inline event handler, or plaintext-`http://` reference;
- `motion=none`, which takes the other CSP branch, asserted to emit no `@keyframes` and to carry a
  script-blocking `Content-Security-Policy`;
- an out-of-range parameter value **and** an unknown parameter, both proving a bounded `400` with
  `no-store` and a JSON error envelope;
- the fixed synthetic `/api/v1/probes/motion/css-enter.svg` route, whose SVG identity, headers, and
  safety are asserted. This one newly deployed route may retry a received `404` for four bounded
  delays (5, 10, 15, and 20 seconds); transport errors use the same five-attempt budget. Every
  other received status is validated immediately, and a fifth `404` fails explicitly;
- `robots.txt`, `sitemap.xml`, and the landing page's structured data.

Every probe uses synthetic mode, so a failure means the deployment is wrong — not that GitHub was
rate-limited.

## Rolling back

```bash
npx wrangler deployments list
npx wrangler rollback [deployment-id]
```

## Why not GitHub Pages

Pages is static-only. The eight SVG cards, the `/api/v1/*` endpoints, the ETag and cache-separation
behavior, and the Studio's live-public mode are all server-rendered per request. A Pages build could
host only the pre-generated snapshot that
[`@commit-atlas/static`](../packages/static) already produces for READMEs — which is exactly what
the [GitHub Action](../action.yml) is for, and it needs no hosting at all.

## Note on the earlier OpenAI Sites mirror

Before this configuration existed, the public demonstration was hosted on OpenAI Sites at
`commitatlas.jeky-tck.chatgpt.site` (project `appgprj_6a872d3f98c481919ed37186cb4d0c30`, recorded in
`.openai/hosting.json`). That deployment still answers, but it is not reproducible from this
repository and is no longer the canonical host. The dated QA records in
`docs/RELEASE_CANDIDATE_QA_2026-08-20.md` and `docs/STUDIO_QA_2026-08-20.md` deliberately still name
it, because that is the origin those observations were actually made against.
