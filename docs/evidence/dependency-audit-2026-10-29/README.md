# Full-toolchain dependency audit — 2026-10-29

This receipt addresses [#447](https://github.com/Chris0Jeky/CommitAtlas/issues/447).
The complete reports are retained beside this file; `SHA256SUMS` binds their exact
bytes. The advisory identities below were checked against the package maintainer's
published security advisories on 2026-10-29.

## Baseline and observation

- Upstream source baseline: `7dd3b2bfb3ef11bbb9c910d011667ba541e5ac36`.
- Baseline lockfile Git blob: `89d9811f5efc7e2346c7213c6126f09187570dba`.
- Baseline lockfile SHA-256: `e32f5aa76f65aa8426b9d2920f43ebfe2466312b0c0a42aff78ebf0f396aeeeb`.
- Reports collected at `2026-10-29T02:13:05Z`, using Node `24.22.1` and npm `11.9.0`.
- The collection checkout had parallel source work, but both package manifests
  were unchanged from that baseline. Dependency-only validation uses a separate
  complete archive of the baseline, with its own local Git metadata.

`baseline-full.json` reports four affected **packages**: three moderate and one
high. The graph contains eight distinct Undici advisories, represented by thirteen
affected-version entries. These counts are different quantities. The
production-only report has zero findings. `baseline-dependency-paths.json`
retains the actual installed paths instead of inferring them from the aggregate.

## Compatible remediation

| Component | Baseline | Candidate | Reason |
| --- | --- | --- | --- |
| Direct `@cloudflare/vite-plugin` | 1.64.0 | 1.66.0 | Supported minor release selecting patched Miniflare |
| Direct `wrangler` | 4.152.0 | 4.154.0 | Matches the plugin's exact Wrangler dependency and removes a duplicate copy |
| Miniflare | 5.20261012.0-beta / 5.20261019.2-beta | 5.20261023.1-beta | Parent-selected release pins Undici 7.30.1 |
| Undici under Miniflare | 7.29.1 | 7.30.1 | Patched release for all eight reported advisories |
| Undici under `@actions/http-client` | 6.29.0 | 6.29.1 | Compatible patch within the existing `^6.23.0` constraint |

`@actions/core` remains at 3.0.1 and `@actions/http-client` remains at 4.0.1.
There is no forced audit repair, dependency downgrade, new override, or audit
threshold change. The existing `fflate@0.7.5` and `sharp@0.35.5` overrides remain.
Workerd moves to the version selected by the patched Cloudflare parents. The
plugin selects `ws@8.22.0`; Miniflare retains its own `ws@8.21.0` requirement.
The lockfile also records npm 11's libc metadata for unchanged platform packages.

The isolated candidate was produced with:

```sh
npm install --package-lock-only --ignore-scripts --save-exact --save-dev @cloudflare/vite-plugin@1.66.0 wrangler@4.154.0
npm update undici --package-lock-only --ignore-scripts
npm ci
```

Both candidate audit commands return zero findings. This resolves each current
report entry: `undici` is patched in both installed paths, and the inherited
`miniflare`, `wrangler`, and `@cloudflare/vite-plugin` findings disappear with
their supported parent updates.

## Primary advisory identities and disposition

| Maintainer advisory | Relevant behavior | Affected installed major | Disposition |
| --- | --- | --- | --- |
| [GHSA-4qv8-2p9j-2685](https://github.com/nodejs/undici/security/advisories/GHSA-4qv8-2p9j-2685) | Unbounded retained state in EventSource parsing | 6, 7 | Patched by 6.29.1 and 7.30.1 |
| [GHSA-f72v-6w45-q472](https://github.com/nodejs/undici/security/advisories/GHSA-f72v-6w45-q472) | Integrity checks skip valid non-lowercase algorithm names | 7 | Patched by 7.30.1 |
| [GHSA-xjj6-f33q-929c](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c) | Excessive content encodings can leave an unhandled stream error | 6, 7 | Patched by 6.29.1 and 7.30.1 |
| [GHSA-4w7w-5xrc-9h26](https://github.com/nodejs/undici/security/advisories/GHSA-4w7w-5xrc-9h26) | Specific redirect/shared-cache composition stores a response under the wrong origin | 7 | Patched by 7.30.1 |
| [GHSA-2m5v-pch6-74hx](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx) | Agent cloning drops function-valued custom TLS verification options | 6, 7 | Patched by 6.29.1 and 7.30.1 |
| [GHSA-qrxm-fqhp-jwvm](https://github.com/nodejs/undici/security/advisories/GHSA-qrxm-fqhp-jwvm) | Certificate-changing TLS 1.2 renegotiation can terminate the client | 6, 7 | Patched by 6.29.1 and 7.30.1 |
| [GHSA-9fm3-97px-rjf6](https://github.com/nodejs/undici/security/advisories/GHSA-9fm3-97px-rjf6) | Automatic WebSocket PONG writes can accumulate without backpressure | 6, 7 | Patched by 6.29.1 and 7.30.1 |
| [GHSA-55wc-3pg8-jfw6](https://github.com/nodejs/undici/security/advisories/GHSA-55wc-3pg8-jfw6) | A throwing decompression interceptor handler can escape asynchronously | 7 | Patched by 7.30.1 |

## Entry points and generated output

The Cloudflare chain is used by Vite development/build tooling and Wrangler.
CommitAtlas's GitHub client uses the runtime `fetch`; its source does not import
the installed Undici package or configure the vulnerable interceptor compositions.
The Worker source does not import Miniflare or Wrangler. This source inspection
does not turn npm's `dev` flag into a general claim that tooling cannot affect
shipped code.

The separate Actions chain does enter the generated Action. `@actions/core`
imports its OIDC helper, which imports `@actions/http-client`; that module imports
Undici's `ProxyAgent`. The checked Action bundle contains Undici and EventSource
code. CommitAtlas's Action entry point invokes input/output, logging, and summary
helpers and does not call `getIDToken`. Presence is established; an exploitable
invocation through this application is not claimed. The affected installed copy
is patched and the Action is rebuilt regardless.

Node's built-in fetch implementation is separate from npm's installed Undici.
The observed local Node 24.22.1 runtime reports built-in Undici 7.30.1. Hosted
Action/runtime updates remain the runtime provider's responsibility; an npm
lockfile update does not replace Node's built-in implementation.

## Validation

The candidate full and production-only audits are both clean, and the clean
locked installation succeeds. The generated Action rebuild and full local gate
are recorded in `validation.json` when complete. Hosted CI must qualify the exact
published candidate before merge; this local receipt does not claim deployment.
