# Dependency audit checkpoint, 7 October 2026

This is a bounded repair and evidence inventory for #325, not a claim that the full dependency graph is clean or that every reported issue is exploitable in production.

## Sources and identity

Baseline: `cea038bd45c0c1204874ca177e184aae22f1c0b4`, Node 22.13.0, npm 10.9.2. The baseline collection ran with lifecycle scripts disabled and retained both audit scopes and `npm explain --json` for every reported package.

- [Baseline collection run](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37561632092), artifact `dependency-audit-325`, ID `11457376313`.
- Downloaded ZIP SHA-256: `7fb67824d4b0f74cad8816ad9309117920aff789e1137d0190a2013290e5f962`.
- Baseline lockfile SHA-256: `d771736df10cb8893f7752632e8e6be3ad973100a7e01d77ff889e0715d4c86c`.
- Its Git blob is `93e2515b7cd87af80895dace28856a882a861977`, independently matched to the baseline main file through GitHub.
- Baseline full audit SHA-256: `8bf53db91708e8890f00a03c29bd242c2ba34cadfa29cdb26d7e3b436f924d05`.
- Baseline production audit SHA-256: `111cee326baead8e46cb059f092225c54df057609624dd1cd5f68f34b3e0c2f7`.
- The committed `receipt.json`, `full.json` and `production.json` describe the patched lockfile. The receipt records the repair source head, observation time, runtime versions and hashes. Audit database results are time-dependent.

## Compatible patches

| Resolved package | Before | After | Declared consumers retained |
| --- | --- | --- | --- |
| fast-uri | 3.1.7 | 3.1.8 | AJV's existing `^3.0.1` ranges under ajv-formats and schema-utils |
| source-map-js | 1.2.1 | 1.2.2 | PostCSS and @tailwindcss/node's existing `^1.2.1` ranges |

Only each leaf's version, registry tarball URL and integrity entry change in the lockfile. The registry-resolved candidates were checked for unchanged dependency contracts. npm's unrelated optional-platform metadata rewrites were discarded by copying the two approved entry triplets into the original lockfile. A subsequent normal `npm ci`, Action rebuild and Action tests validated that exact graph. No parent version, direct dependency range, audit threshold, or build script changes.

The baseline audit reported 16 package findings (4 moderate, 12 high); the post-repair receipt reports 14 (3 moderate, 11 high). Production-only reported zero in both. The fast-uri and source-map-js advisories were respectively moderate and high in the retained baseline report. These are package/advisory-graph counts, not a count of independent deployed vulnerabilities. The regenerated Action bundle had no net change.

## Remaining paths and dispositions

The following advisory labels are transcribed from the retained npm audit, not independently confirmed vulnerability research. Public advisory-page verification was unsuccessful during this pass; the raw report is the inspectable source for the claims below.

| Underlying report entry | Resolved path / declared constraint | Disposition |
| --- | --- | --- |
| braces 3.0.3, GHSA-vfj7-8cjw-p6xm, high | micromatch requires `^3.0.3`; propagated findings affect build/lint tooling | Unresolved. Find a compatible upstream resolution and test hostile bounded patterns before changing the graph. Do not classify all propagated parents as separate root vulnerabilities. |
| fflate 0.7.3, GHSA-px8p-9vwx-vf98, moderate | satori pins `0.7.3`; @shuding/opentype.js also requests `^0.7.3` | Unresolved. The retained report concerns malformed ZIP64 handling. Prefer an upstream Satori update or explicitly reviewed compatible override; validate font/image build paths. Its presence does not establish that CommitAtlas accepts caller-supplied ZIP archives. |
| sharp 0.35.4, GHSA-wq5f-xc86-pv6w, high | miniflare pins `0.35.4`; @vercel/og requests optional `^0.35.3` | Unresolved. A fix needs coordinated native-package/libvips compatibility and a supported Miniflare/Wrangler graph. A native dependency in local tooling is not proof that the deployed Worker executes it. |

`dev: true` and a passing `--omit=dev` audit are not adequate runtime-exposure proofs: build dependencies can contribute to the Worker or checked-in Action bundle. Inspect actual imports and produced bundles for each affected path before declaring a finding non-applicable. This pass establishes resolved paths and leaves that deeper disposition open.

Do not apply the audit's suggested parent downgrades or `npm audit fix --force` as a substitute for compatibility analysis. They can undo the project's reviewed hosting/tooling setup.

## Remaining acceptance for #325

Obtain supported resolutions or evidence-based non-applicability decisions for the remaining three underlying report entries, retain an updated exact-lock audit and dependency paths, exercise affected runtime/build surfaces, rebuild generated output and run full exact-head CI. This PR deliberately leaves #325 open for those steps.

The temporary collection/repair workflows are absent from the final diff. Their runs remain linked evidence; no write-enabled audit workflow is installed by this change.
