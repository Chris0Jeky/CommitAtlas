# Observatory integration

Shared collector/dashboard: [Pulseboard #15](https://github.com/Chris0Jeky/Pulseboard/pull/15), source commit `8d92fff11f581d600c357e402cd521426665f318`.

## Current state: staged and inactive

The root layout loads a local, versioned observer script whose endpoint is empty. No reporting, consent storage, timers, or network activity is enabled. Profile SVGs, cached image requests, and GitHub data are not instrumented as individual human views.

`ObservatoryRouteBridge` is also mounted in the root layout. It is a content-free navigation signal, not an active tracker: it reads the current App Router pathname, converts it to one of the closed route buckets below, and dispatches `commitatlas:observatory-route` only when that bucket changes.

| Pathname | Route bucket |
| --- | --- |
| `/` | `home` |
| `/studio` and descendants | `studio` |
| every other pathname | `other` |

The event detail contains only `{ route }`. Raw pathnames, query strings, fragments, document content, filenames, and user-entered values are never placed on this interface.

## Activation contract

Before an active observer is generated, its route adapter must:

1. derive the initial bucket from `window.location.pathname`;
2. listen for `commitatlas:observatory-route` so client navigation updates attribution without re-running the shared layout script;
3. validate the detail against `home | studio | other` before accepting it;
4. announce at most one consented `page.view` per mounted client session;
5. treat navigation as an attribution update, not another page view;
6. attach later approved events to the latest route bucket.

`lib/observatory-route.ts` is the executable host-side contract for those transitions. Fixture-backed tests cover direct `/studio`, `/` to `/studio`, `/studio` to `/`, repeated same-bucket navigation, repeated consent, and unknown paths. The generated observer remains unchanged and inactive until a separate reviewed activation regenerates `public/observatory.js` and its lock.

## Verification

Run `npm run test:observatory`. It verifies the generated artifact hash and inactive runtime, then runs the route-attribution scenarios. The full host gate remains `npm run check`.

## Pilot activation

Deploy the isolated collector, review the notice and CSP, regenerate the script using the checked installer and exact project endpoint, implement the route-event listener above, then verify consent, withdrawal, failure handling, navigation attribution, and offline behavior. No dashboard secret belongs in a browser build.

The first active baseline is opted-in page views and content-free error occurrence counts. `studio.opened` and `card.exported` are approved names awaiting explicit application hooks, not yet a measured generation funnel. Treat copy/download requests separately from successful generation. Reuse server-side operational instrumentation later for cache hits, render latency, and upstream failures; browser event counts cannot substitute for those measurements.
