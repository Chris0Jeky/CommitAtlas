# Pulseboard usage integration

Shared collector and Desk: [Chris0Jeky/Pulseboard](https://github.com/Chris0Jeky/Pulseboard), host wave
[Pulseboard#105](https://github.com/Chris0Jeky/Pulseboard/issues/105). The SDK contract is Pulseboard
`observatory/docs/SDK.md`; the plan it implements is `observatory/docs/USAGE_PLAN.md`.

## What is installed

`public/pulseboard.js` is the Pulseboard SDK 3.1.0, generated for project `commitatlas` by Pulseboard's
`observatory/adapters/build-sdk.mjs` and pinned by `observatory.lock.json` (SHA-256, release `unattributed`,
the only release registered for CommitAtlas). It replaces the inert `public/observatory.js`. Never edit it by
hand; regenerate it from a Pulseboard checkout:

```sh
cd <Pulseboard>/observatory
node adapters/build-sdk.mjs commitatlas <CommitAtlas checkout> public/pulseboard.js
```

then copy the printed `sha256` into `observatory.lock.json`.

## Where it loads

Only the root App Router layout (`app/layout.tsx`) loads it, as `<script defer src="/pulseboard.js">`, with an
empty `<div data-pulseboard-bar>` with `min-height: 2.5rem` as the first child of `<body>` so the Beta bar causes
no layout shift; the placeholder grows when the bar wraps on a narrow screen, pushing the page down rather than
covering it. That layout renders the two interactive HTML pages, `/` and `/studio`, and also the framework's 404 page, which
loads the SDK too and records its view as `other`. SVG cards, probes and JSON
routes are route handlers that never render the layout: a README image fetched through GitHub's camo proxy
carries no script (`tests/rendered-svg.test.mjs` and `tests/rendered-html.test.mjs` assert both sides).

The HTML pages send no Content-Security-Policy today. If one is added, it needs
`connect-src https://pulseboard-observatory.commit-atlas.workers.dev`, and its `script-src` must admit the
inline scripts in `<head>` (the landing-route bootstrap, the chassis theme bootstrap) and the framework's own
inline scripts, by a per-response nonce or their sha256 hashes. A bare `script-src 'self'` would block them
silently: the SDK would still load but record every landing as `home`. `tests/rendered-html.test.mjs` fails on
such a policy for the route bootstrap. The SDK styles through the CSSOM, so it needs no
`style-src 'unsafe-inline'`.

## What it records

| Call | Where | Props |
| --- | --- | --- |
| `Pulseboard.route(bucket)` | `ObservatoryRouteBridge` on each App Router bucket change (`home`, `studio`, `other`) | none; the pathname never leaves the page |
| `studio.opened` (count and journey) | Studio mount | `{}` |
| `profile.loaded` (journey) | a successful Studio Preview | `repoCountBucket` (`0`, `1-9`, `10-49`, `50-99`, `100+`, `unknown`), `source` (`synthetic`, `live`), `projects` (0-32), `contributions` (boolean) |
| `card.exported` (count and journey) | a successful README Markdown copy | `format` (`markdown`), `theme` (`ember`, `aurora`, `midnight`, `paper`, `other`), `cards` (0-32) |

`studio.opened` and `card.exported` are the aggregate count names registered for `commitatlas` in Pulseboard
`observatory/src/projects.mjs`; every call also goes to Journeys with its props. The GitHub handle,
repository names, workflow names and URLs typed into the Studio are identity or free text and are never
passed. All calls go through `lib/pulseboard.ts`, which returns `false` instead of throwing when
`window.Pulseboard` is absent, blocked or broken (`lib/pulseboard.test.ts`).

The landing route is named on `<html data-pulseboard-route>` (`home`, `studio` or `other`), which the SDK
reads once at mount, so a direct visit to `/studio` records one `studio` view, never `home` first. The shared
root layout is not given the pathname, so `PULSEBOARD_ROUTE_BOOTSTRAP` (`lib/observatory-route.ts`) sets the
attribute in `<head>` before the deferred SDK runs, by the same rule as `observatoryRouteFromPathname`; only
the bucket is written. The bridge forwards later navigations only, in a layout effect, so the Studio's
`studio.opened` (a passive effect) is attributed to `studio`, and keeps the attribute current for a bfcache
remount.

While the region hint is pending, the SDK holds `track` events in memory and sends them once Journeys is
allowed (outside the EEA, or after OK); in the EEA without OK, or if the hint fails, they are dropped.

## Notice and choices

The SDK shows a one-line **Beta** bar: CommitAtlas collects usage and diagnostics to improve it; no names,
emails or IPs. **Choose** opens three switches:

- **Usage counts**: daily aggregate counts (event, route bucket, release, plus coarse device, new or
  returning, referral category and host, campaign tag and colour scheme). On by default everywhere.
- **Diagnostics**: web-vital timings, JavaScript error summaries, visible time and scroll depth. On by
  default outside the EEA; in the EEA (or when the region is unknown) off until the visitor clicks OK.
- **Journeys and product data**: a random id for one browser tab session and the product events above. Same
  default as Diagnostics.

Global Privacy Control or Do Not Track turns every category off silently. After a choice the bar becomes a
small **Beta** button that reopens the switches. Pulseboard keeps detailed data (journeys, diagnostics) for
90 days and aggregate counts for currently 14 days. No IP address, user agent, page URL or cross-site
identifier is stored.

## Collection state

The SDK is live in the page once deployed, but the collector stores nothing for CommitAtlas until the owner
adds `commitatlas` to Pulseboard's `COLLECT_STAT_PROJECTS` and `COLLECT_PRODUCT_PROJECTS` (one Pulseboard PR
after the host wave). Until then the collector refuses its requests and the SDK stops after three failures per
endpoint. Server-side operational measurements (cache hits, render latency, upstream failures) remain separate
from these browser events.

## Verification

`npm run test:observatory` runs `observatory/check.mjs` (lock hash, pristine SDK header and body hash, collector
origin, no server-only constants, and in a fake browser: `window.Pulseboard` defined without throwing, no
request before the bar is on screen, silence off-origin and under automation), then the route contract and
`lib/pulseboard.test.ts`. The full host gate remains `npm run check`.
