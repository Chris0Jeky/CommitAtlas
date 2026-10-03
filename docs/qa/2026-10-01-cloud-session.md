# Cloud QA session, 1 October 2026

## Scope and source

Source baseline: `82027d61d70b79be2b72130e5c20eb9846685fe7` (includes #276).
Linux cloud execution, Node 24.19.0. No user PC, credentials, private GitHub data,
production writes, merge or deployment used.

## Verified finding and fix

Issue #278: `test:studio` omitted the five existing `studio-fetch.test.ts` cases.
Added that suite and an adjacent-test discovery guard to the explicit script list.
The guard failed on the baseline list, naming the omitted fetch suite and itself;
after correction all 66 adjacent Studio tests passed. Independent read-only review
found no blocking issue in the two-file change. No application runtime change.

## Local results

- Locked dependency installation: passed after selecting a writable npm cache.
  The first install failed because the environment's default home/cache did not exist.
- `npm run typecheck:worker`: passed in the baseline aggregate attempt.
- `npm run typecheck` and `npm run lint`: passed after the correction.
- `node --import tsx --test app/studio/*.test.ts`: 66 passed, zero failures.
- `npm audit --omit=dev --audit-level=high`: zero production vulnerabilities reported.
- `npm test`: production build and all 55 rendered HTML/SVG/discoverability tests passed.
- `npm run check`: **blocked**, at the tsx CLI's local IPC socket (`EPERM`) in
  `test:observatory`. It did not complete the full aggregate gate.
- Existing isolated Chromium harness: **not run successfully**. Browser startup
  failed at a restricted process singleton socket; the supported escalation attempt
  did not resolve it. This is environment evidence, not a product defect.

The direct Node/tsx import invocation avoids the CLI's auxiliary IPC server without
changing project code or security settings. It is focused evidence, not a claim that
`npm run check` passed. CI uses Node 22.13.0; this local run used Node 24.19.0.

## Published-app browser observations

Separately exercised `https://commit-atlas.commit-atlas.workers.dev/studio` in the
supported cloud browser, approximately 00:49–00:54 UTC. The deployment commit was not
independently established, so these results must not qualify the current source commit.
Telemetry was turned off through the page's own choice controls. All test inputs were
synthetic (`octocat`, default example projects); no live-public mode was selected.

Passed observations:

1. Synthetic Preview loads explicit synthetic provenance and project signals.
2. Copy Markdown enables after a valid preview; changing Ember to Paper disables it
   and replaces output with the instruction to re-preview. A new preview enables it.
3. Deselecting all cards shows an explicit empty gallery and disables Copy Markdown.
4. Invalid handle `not a valid handle!` preserves the old preview with a retained
   label, presents a validation message, and withholds copying.
5. All eight selected card images loaded with nonzero intrinsic dimensions.
6. At the observed 1180×757 viewport the document width was 1165 px, with no horizontal overflow.

Screenshots were inspected during the session. The visible cards remained legible.
The recent browser error log was dominated by extension metadata errors; this is not
attributed to the application and is not a comprehensive console-clean certificate.

## Not verified / next sessions

No physical phone, WebKit, screen reader, clipboard write, real GitHub freshness failure,
production deployment identity, or full aggregate gate was established. Open #277/#263
own the vinext upgrade; #186 owns a separate WebKit motion diagnostic. Existing fixes
#258 and #274 were not reopened from stale checklist text in #235.
