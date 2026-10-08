# Recovered codec repair, reviewed 8 October 2026

This recovers the interrupted #325 candidate at `76ff68c15db2fb9de90526122fed95d8ba4db4bb`.
Its merge with current main `826c5f0912e2cfff77dae12a7a9365040c59982c` was rehearsed
locally without conflicts. Current-main PR CI is required before merge; the older
qualification does not prove current-main integration.

## Narrow overrides and behavioral proof

Pin `fflate` to 0.7.5 and `sharp` to 0.35.5. Satori and Miniflare currently pin the
older leaf versions, so root overrides make the reviewed exceptions explicit without
downgrading their parent tools. The lockfile changes only fflate, sharp, and sharp's
coordinated @img native packages. Remove these overrides when upstream consumers
resolve patched releases; reassess them before adopting a different fflate major/minor.

Four dependency tests enter the normal check command: every locked fflate copy is
patched, the installed sharp/librsvg versions match the patch floor, normal ZIP/SVG
operations remain usable, and a synthetic malformed ZIP64 archive is rejected within
a three-second child-process deadline. No archive is extracted to disk. Against the
old graph there were three failures and one passing control, including an observed
ZIP64 timeout. Against the patched graph all four passed. The native receipt records
sharp 0.35.5 and librsvg 2.63.2. This is not a proof of exploitability or exploit prevention
for every possible native payload.

The [sharp maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)
was independently read on 8 October 2026. It identifies sharp before 0.35.5 as affected,
and 0.35.5's bundled librsvg 2.63.2 as patched. Runtime-specific conditions apply.
The fflate advisory identifier GHSA-px8p-9vwx-vf98 comes from the retained npm report;
its presumed maintainer-advisory URL did not resolve during this review. The regression
and resolved package receipts, not that missing page, are the evidence for this repair.

## Retained qualification

[Run 37693240087](https://github.com/Chris0Jeky/CommitAtlas/actions/runs/37693240087)
ran the full gate on the clean candidate with Node 22.13.0 and locked dependencies.
Artifact 11514013634 includes red/green logs, full-check log, source bundle and reports.
Its downloaded ZIP matches native SHA-256
`2eea7b3a8cfb977f1c6866a4a78d3bba897660ef70488d9475e3efc576bb173c`.
The Action rebuild had no net change from this dependency update.

At the retained 7 October audit time the full report fell from 14 propagated package
findings to 7; production-only stayed at zero. The remaining seven entries trace to
braces through micromatch, not seven independent root defects. The current reviewed
[braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) still lists no patched
release as of this review. Do not apply suggested parent downgrades or audit fix --force.

`dev: true` and a clean production-only audit do not prove absence from generated code.
CommitAtlas has no application ZIP-upload API; its image optimizer is intentionally
unbound/passthrough. Sharp is also used by the local Worker toolchain. These observations
bound the known entry points but are not a complete bundled-code reachability proof.
#325 stays open for the remaining braces disposition, upstream resolution and review of
future changes to those entry points. No audit threshold is lowered.
