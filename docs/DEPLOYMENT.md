# Deploying CommitAtlas

CommitAtlas is a Cloudflare Worker with static assets. It renders public GitHub data and needs
**no credentials** to serve every documented surface, so a deployment has no required secrets.

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
npm run deploy              # builds, deploys, and smoke-checks the result
```

That publishes to `https://commit-atlas.commit-atlas.workers.dev`. The free Workers plan is
sufficient: the bundle is well under the 3 MiB gzipped script limit and every response is either
cached at the edge or a bounded error.

## Continuous deployment from GitHub

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) deploys the exact commit that
already passed the `CI` quality gate — it triggers on CI's `workflow_run` completion and checks out
`workflow_run.head_sha`, so an unproven commit is never published.

It stays green and simply logs a notice until both secrets exist, so adding them is safe to defer.

### The two repository secrets

Add these under **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** template. Scope it to the single account below and no zones. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account details, or `npx wrangler whoami`. |

Optionally add a repository **variable** `DEPLOY_BASE_URL` if the deployment answers on a custom
domain; the post-deploy check falls back to the `workers.dev` URL.

Never commit either value. `wrangler.jsonc` deliberately carries an empty `vars` block.

## The optional GitHub token

Anonymous GitHub requests are rate-limited, and CommitAtlas reports that honestly rather than
inventing data. If you want higher live limits:

```bash
npx wrangler secret put GITHUB_TOKEN
```

Use a **public-scope-only** token. `lib/github/client.ts` refuses any credential that could reach
private data, and `lib/runtime-env.ts` is the single contract for reading it. The synthetic demo
mode and the scheduled static snapshot never need it.

## Verifying a deployment

```bash
node scripts/verify-deployment.mjs https://commit-atlas.commit-atlas.workers.dev
```

Twelve deterministic probes: health, the landing page, the Studio, all eight synthetic SVG cards
(each asserted to be SVG with no `<script>`, `<foreignObject>`, `<iframe>`, or plaintext-HTTP
reference), and one invalid query proving it is rejected as a bounded `400` with `no-store`. Every
probe uses synthetic mode, so a failure means the deployment is wrong — not that GitHub was
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
