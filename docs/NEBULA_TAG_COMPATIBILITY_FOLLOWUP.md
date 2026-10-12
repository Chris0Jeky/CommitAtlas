# Nebula release-tag compatibility

Follow-up to #350, implemented in #352. Merge remains gated on complete locked verification, a freshly rebuilt Action bundle, removal of the temporary qualification workflow, and successful normal CI on the final clean head.

## Contract

The GitHub collector bounds `tag_name` to 200 Unicode **code points**, not UTF-16 code units (`packages/github/src/client.ts`, `GITHUB_TEXT_LIMITS.releaseTag` and `textField`). Nebula now uses the same 200-point ceiling. Slash-containing, non-Latin and astral characters are retained exactly, including all 200 astral points. No trimming, Unicode normalization, truncation or identity substitution occurs.

Empty strings, whitespace, Unicode control characters, lone surrogates, non-string values and overlong tags cannot authorize release marks. A 400-UTF-16-unit precheck rejects large input before scanning; the bounded loop counts code points without allocating an array. This is a bounded seed-metadata validator, not a complete Git ref-name parser.

Tags never become SVG text, attributes, URLs, paths or commands. Consequently printable markup-looking identities such as `<script>` are safe to retain **only as seed metadata**. The old markup-only rejection fixture is replaced by a control-bearing invalid tag, with explicit well-formedness/no-interpolation tests for markup-looking identities. The old 65-unit rejection is replaced by a 201-point rejection and 64/65/200-point acceptance controls. This is an intentional compatibility-contract correction, not removal of the unsafe-output guard.

## Regression coverage

`packages/svg/tests/nebula-tag-compatibility.test.mjs`, already registered in the normal SVG test list, covers both source classes, both layouts, all themes, CSS/SMIL and still/ambient rendering. It verifies exact model identity, retained contribution/release stars, immutable caller input, unchanged frame-zero geometry and well-formed SVG. Additional checks cover the last accepted code point's effect on the seed, composed versus decomposed identity, malformed input, unusable boards, and the real collector-to-renderer path behind a synthetic HTTP fixture. The producer's 201-point refusal is tested independently.

All existing root/contribution/project clocks, publication-time, repository-identity, duplicate-board, unavailable-state, determinism and motion/byte-budget checks remain in place. No fetch or new dependency is added to production.

## Evidence and release gate

The original normal CI run 38248550605 at head `f15236a5a0a540e8dca939cca59d7d4e38222120` reproduced three failures: slash, CJK and Cyrillic tags. Before this implementation, a local extraction of the exact renderer function (blob `7a046d5a419ec6e47a10823fa98743bd9adfdfd6`) reproduced six failing compatibility cases and five passing controls; the updated function passes all eleven. That function-only probe is not a renderer, typecheck or full-build result.

The temporary qualification job is required to reproduce the expanded tests against the previous renderer, restore and verify the candidate source, then rebuild the Action and run complete `npm run check` plus the production audit. It may preserve verified generated blobs but must never move a branch. Source identities, red/green/full-gate logs and generated-blob identity must be retained. The connector publishes the clean bundle and removes the runner; only then can normal exact-head CI authorize a merge. The PR discussion records actual run outcomes rather than this document assuming success.

No browser playback, hosted allowlist, broader motion completion, development-toolchain audit resolution or owner-decision override is implied.
