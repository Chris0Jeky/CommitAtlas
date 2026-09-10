# Observatory integration

Shared collector/dashboard: [Pulseboard #15](https://github.com/Chris0Jeky/Pulseboard/pull/15), source commit `8d92fff11f581d600c357e402cd521426665f318`.

The layout loads a local, versioned script with an empty endpoint. No reporting or consent storage is enabled. Profile SVGs, cached image requests and GitHub data are not instrumented as individual human views.

Run `node observatory/check.mjs`; also run existing lint, build and browser tests. Shared kit: 58 local tests passed. Full CommitAtlas build and hosted checks were not run here.

Pilot activation: deploy the isolated collector, review the notice and CSP, regenerate the script using the checked installer and exact project endpoint, then verify consent, withdrawal, failure handling and offline behavior. No dashboard secret belongs in a browser build.

The first active baseline is opted-in page views and content-free error occurrence counts. `studio.opened` and `card.exported` are approved names awaiting explicit application hooks, not yet a measured generation funnel. Treat copy/download requests separately from successful generation. Reuse server-side operational instrumentation later for cache hits, render latency and upstream failures; browser event counts cannot substitute for those measurements.
