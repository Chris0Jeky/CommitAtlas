# Studio scene previews and evidence

The hosted scene allowlist is a small browser-safe catalogue shared by the route and
Studio. It currently contains evidence coverage, activity terrain, and lifecycle map.
Only registered instrument/map definitions with an explicit catalogue entry are hosted;
registry and pack-capability parity is tested. Adding a map no longer implicitly widens
the public endpoint. Other packs stay visibly unsupported until their implementations
are accepted. The renderer package is not bundled into the browser just to read labels.

## What authorizes scene Markdown

A Preview run validates the configuration. Each selected scene fetch then independently
validates a bounded SVG response, retains its exact bytes in a Blob, and waits for the
actual image's load event with positive bounded intrinsic dimensions. The Blob is never
inserted as inline SVG. A second live request cannot supply a different image behind the
same counter strip. Generated Markdown contains the canonical HTTPS route, never a Blob
URL or replay nonce, and retains the existing dark/light pair.

Configuration, global view, explicit Preview and Replay attempts have distinct keys.
Each scene also has independent Profile, Replay, Reduced-motion and Frame-zero buttons.
Changing one image invalidates its receipt before a new fetch; another image's receipt
is untouched. A late/aborted response, HTML-200, invalid SVG decode, unavailable plate,
wrong-size metadata, stale fallback, or unsupported pack cannot authorize scene copying.
Read-only stale or legacy SVGs can remain visible without a current copy receipt.
Failed or stalled loads have a bounded timeout. Object URLs are revoked on disposal.

Only the selected profile image can authorize its scene's Markdown. A still twin does
not authorize an unseen animated profile. The explicit Profile button and Replay return
from both still views. The global controls apply to all scenes; per-image controls allow
independent inspection. Local HTTP origins remain preview-only: the existing HTTPS copy
boundary is not weakened for QA. The opposite colour-scheme URL is generated from the
same supported rendering contract; it is not falsely described as separately decoded.

## Counters are not browser telemetry

`X-CommitAtlas-Scene-Metadata` is a closed version-1 response header emitted directly from
`SceneRenderResult`. It contains scene ID, exact UTF-8 body bytes, compiler unique animated
elements and looping groups, and the explicit unavailable flag. The SVG MIME/CSP/ETag and
canonical redirect contracts remain unchanged. Conditional 304 responses carry the same
receipt; redirects/errors do not. It is accessible to CORS callers through an exposed
header. A same-origin server receipt is not a cryptographic signature.

The client checks scene identity, byte span, types and bounds. It does not count animation
tags or CSS declarations, which do not have the same semantics as unique targets/groups.
The last-good header allowlist deliberately does not persist scene metadata; a modified
stale body therefore cannot inherit a fresh renderer receipt. This boundary has a
regression test. Compiler counts do not prove motion playback or runtime cost.

Reduced-motion and frame-zero controls use the `motion=none` twin. They do not pause,
scrub, emulate a browser preference, or capture an actual animation frame. No unqualified
`prefers-reduced-motion` source is emitted into README Markdown while #113 remains open.

## Verification

`test:studio` covers configuration/URL/Markdown emission, the closed receipt parser,
bounded streaming, aborts and loaded-image receipt matching. The route suite binds
metadata to all three scenes, still/ambient bodies, 304s and unavailable/error/redirect
responses. The deployment verifier now has 21 HTTP probes including the two new map
routes and their body-matching metadata.

`tests/studio-scene-browser.mjs` is optional synthetic browser QA, outside `npm run check`.
It consumes an exact-version Playwright driver from `PLAYWRIGHT_PREFIX` and an already
installed Chrome at `CHROME_BIN`; it does not add a dependency or install browsers into
the repository gate. It can run against the local development server or the fixed
production origin, always with `demo=true`. The local mode proxies a synthetic HTTPS
origin so the real copy restriction is exercised, rather than disabled. Fault injection
is confined to that browser's responses. The retained receipt names source commit,
driver, observed browser version, image/view/error cases and actual keyboard traversal.
Screenshots and receipts are UI evidence, not #113's three-engine raw/Camo motion oracle.

The initial local browser rejected navigation with ERR_BLOCKED_BY_ADMINISTRATOR. No
browser policy was disabled or bypassed. Interactive verification is performed in the
separate authorized Actions environment; its exact results belong in the PR receipt.
