edit('docs/STUDIO_SCENE_PREVIEWS.md', None, [
    (0, 0, r'''# Studio scene previews and evidence

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
'''),
])
edit('lib/hosted-scene-catalog.ts', None, [
    (0, 0, r'''/** Browser-safe, explicit public scene surface. Registry/capability parity is tested in CI. */
export const HOSTED_SCENE_IDS = Object.freeze(["activity-terrain", "evidence-coverage", "lifecycle-map"] as const);
export type HostedSceneId = typeof HOSTED_SCENE_IDS[number];
export const HOSTED_SCENE_LABELS: Readonly<Record<HostedSceneId, string>> = Object.freeze({
  "activity-terrain": "Activity terrain", "evidence-coverage": "Evidence coverage", "lifecycle-map": "Lifecycle map",
});
export const HOSTED_SCENE_PACKS = Object.freeze({
  "activity-terrain": Object.freeze(["survey"] as const),
  "evidence-coverage": Object.freeze(["survey"] as const),
  "lifecycle-map": Object.freeze(["survey"] as const),
});
export function isHostedSceneId(value: string): value is HostedSceneId {
  return (HOSTED_SCENE_IDS as readonly string[]).includes(value);
}
'''),
])
edit('lib/last-good.test.ts', 'bdd52ac3aad7a0876e9ef2cac4ece060f337fa41', [
    (428, 428, r'''
test("a changed last-good scene body cannot inherit a fresh compiler receipt", async () => {
  const store = memoryStore();
  const pending: Promise<unknown>[] = [];
  const request = new Request("https://example.test/api/v1/scenes/evidence-coverage.svg?user=octocat&demo=false");
  const body = svgBody();
  const fresh = svgResponse(body);
  fresh.headers.set("x-commitatlas-scene-metadata", JSON.stringify({ version: 1, scene: "evidence-coverage",
    bytes: new TextEncoder().encode(body).length, animatedElements: 0, loopingGroups: 0, unavailable: false }));
  const live = await withPublicLastGood(request, async () => fresh, runtime(store, pending, LIVE_AT));
  assert.ok(live.headers.has("x-commitatlas-scene-metadata"));
  await Promise.all(pending);
  const stale = await withPublicLastGood(request, async () => githubError(502, "github_unavailable"),
    runtime(store, [], new Date("2026-08-27T21:00:00Z")));
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get("x-commitatlas-data-state"), "stale");
  assert.equal(stale.headers.has("x-commitatlas-scene-metadata"), false);
  assert.notEqual(await stale.text(), body);
});
'''),
])
edit('lib/scene-metadata.ts', None, [
    (0, 0, r'''import type { SceneRenderResult } from "@/packages/svg/src/index";
import { isHostedSceneId, type HostedSceneId } from "./hosted-scene-catalog";

export const SCENE_METADATA_HEADER = "X-CommitAtlas-Scene-Metadata";
export const MAX_SCENE_PREVIEW_BYTES = 128 * 1024;
export interface SceneResponseMetadata {
  readonly version: 1;
  readonly scene: HostedSceneId;
  readonly bytes: number;
  readonly animatedElements: number;
  readonly loopingGroups: number;
  readonly unavailable: boolean;
}

/** These are compiler/renderer counters, not a claim that a browser played the animation. */
export function sceneResponseMetadata(scene: HostedSceneId, result: SceneRenderResult): SceneResponseMetadata {
  return Object.freeze({ version: 1, scene, ...result.counters, unavailable: result.unavailable });
}

/** A closed, versioned receipt for the decoded response bytes. Never estimate from SVG syntax. */
export function parseSceneResponseMetadata(header: string, scene: string, bytes: number): SceneResponseMetadata {
  const invalid = () => new Error("Scene response metadata does not match this preview");
  if (header.length > 512 || !isHostedSceneId(scene)) throw invalid();
  let value: Record<string, unknown>;
  try { value = JSON.parse(header) as Record<string, unknown>; } catch { throw invalid(); }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== 6 || Object.keys(value).some(key => !["version", "scene", "bytes", "animatedElements", "loopingGroups", "unavailable"].includes(key))) throw invalid();
  const integer = (number: unknown, max: number) => typeof number === "number" && Number.isSafeInteger(number) && number >= 0 && number <= max;
  if (value.version !== 1 || value.scene !== scene || value.bytes !== bytes || bytes < 1 || bytes > MAX_SCENE_PREVIEW_BYTES ||
    !integer(value.animatedElements, 96) || !integer(value.loopingGroups, 6) || typeof value.unavailable !== "boolean" ||
    (value.loopingGroups as number) > (value.animatedElements as number) ||
    (value.unavailable && (value.animatedElements !== 0 || value.loopingGroups !== 0))) throw invalid();
  return Object.freeze({ version: 1, scene, bytes, animatedElements: value.animatedElements as number,
    loopingGroups: value.loopingGroups as number, unavailable: value.unavailable });
}
'''),
])
edit('package.json', 'a1d23732b7aaad931b3dd05079371e504db1701d', [
    (46, 47, r'''    "test:github": "node --test tests/github-test-discovery.test.mjs && tsx --test tests/projects-route.test.ts tests/profile-route.test.ts tests/scene-route.test.ts tests/terrain-route.test.ts tests/lifecycle-route.test.ts tests/scene-metadata-route.test.ts app/api/v1/health/route.test.ts app/api/v1/contributions/route.test.ts tests/motion-probe-route.test.ts tests/hosted-motion-routes.test.ts lib/pulse-capsule.test.ts lib/pulse-lifecycle.test.ts packages/github/src/delivery.test.ts packages/github/src/delivery-client.test.ts lib/http.test.ts lib/last-good.test.ts lib/github/client.test.ts lib/github/terminal-conclusions.test.ts lib/github/demo.test.ts lib/github/validation.test.ts lib/github/adapters.test.ts lib/portfolio.test.ts lib/svg-adapters.test.ts lib/svg-routes.test.ts app/structured-data.test.ts lib/site.test.ts",
'''),
    (48, 49, r'''    "test:studio": "tsx --test app/studio/studio-test-discovery.test.ts app/studio/studio-fetch.test.ts app/studio/studio-card-availability.test.ts app/studio/studio-case-canonicalization.test.ts app/studio/studio-markdown.test.ts app/studio/studio-messages.test.ts app/studio/studio-presentation.test.ts app/studio/studio-refresh-lifecycle.test.ts app/studio/studio-urls.test.ts app/studio/studio-scene-preview.test.ts tests/studio-board-isolation.test.mjs",
'''),
])
edit('scripts/deployment-verification.mjs', '41bc9634f1876bfd37534e46b2827ebcce0d50a1', [
    (248, 248, r'''    ...["activity-terrain", "lifecycle-map"].map((id) => ({
      name: `synthetic /api/v1/scenes/${id}.svg carries its current renderer receipt`,
      async run(get) {
        const response = await get(`/api/v1/scenes/${id}.svg?user=octocat&repos=atlas&states=atlas%3Aactive&demo=true&theme=ember`, { retryNotFound: true });
        assert(response.status === 200, `expected 200, got ${response.status}`);
        assert(response.headers.get("content-type") === "image/svg+xml; charset=utf-8", "expected scene SVG content type");
        const body = await response.text();
        assertSafeSvgMarkup(body);
        const metadata = JSON.parse(response.headers.get("x-commitatlas-scene-metadata") ?? "null");
        assert(metadata?.version === 1 && metadata.scene === id, "expected the matching scene receipt");
        assert(metadata.bytes === new TextEncoder().encode(body).length, "scene byte receipt does not match its body");
        assert(metadata.unavailable === false, "synthetic scene unexpectedly unavailable");
        assert(metadata.animatedElements === 0 && metadata.loopingGroups === 0, "default scene must remain still");
      },
    })),
'''),
])
edit('tests/deployment-verification.test.mjs', '40353b8aefc2060b441b4fd4c00199c8f960cff6', [
    (55, 57, r'''test("the ordered verifier surface has twenty-one checks", () => {
  assert.equal(createDeploymentChecks().length, 21);
'''),
])
edit('tests/rendered-html.test.mjs', '796c42b0b78068b5d9c69693717cbe11ef9ee908', [
    (302, 302, r'''  assert.match(html, /<legend>Scene pack<\/legend>/);
  assert.match(html, /<button type="button"[^>]*>Profile view<\/button>/);
  for (const scene of ["Activity terrain", "Evidence coverage", "Lifecycle map"]) assert.ok(html.includes(scene));
  for (const pack of ["Survey", "Orbital", "Spectral", "Terminal"]) assert.match(html, new RegExp(`<strong>${pack}</strong>`));
  assert.match(html, /Scenes to show &amp; copy/);
  assert.match(html, /<span>Evidence coverage<\/span>/);
  assert.match(html, /<legend>Preview tools<\/legend>/);
  assert.match(html, /<button type="button"[^>]*>Replay<\/button>/);
  assert.match(html, /<button type="button"[^>]*>Reduced-motion view<\/button>/);
  assert.match(html, /<button type="button"[^>]*>Frame zero<\/button>/);
'''),
])
edit('tests/scene-metadata-route.test.ts', None, [
    (0, 0, r'''import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/v1/scenes/[id]/route";
import { withWorkerEnv } from "@/lib/runtime-env";

const header = "x-commitatlas-scene-metadata";
function call(id: string, tail = "", headers?: HeadersInit) {
  return GET(new Request(`https://example.test/api/v1/scenes/${id}.svg?user=octocat&repos=atlas&states=atlas%3Aactive&demo=true${tail}`, { headers }),
    { params: Promise.resolve({ id: `${id}.svg` }) });
}
for (const id of ["evidence-coverage", "activity-terrain", "lifecycle-map"]) {
  for (const motion of ["none", "ambient"]) test(`${id}/${motion} carries renderer-owned counters bound to its exact SVG`, async () => {
    await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
      const tail = motion === "none" ? "" : `&motion=${motion}`;
      const response = await call(id, tail);
      assert.equal(response.status, 200);
      const metadata = JSON.parse(response.headers.get(header) ?? "null");
      assert.ok(metadata, "renderer metadata is absent");
      assert.equal(metadata.version, 1); assert.equal(metadata.scene, id);
      assert.equal(metadata.bytes, new TextEncoder().encode(await response.text()).length);
      assert.equal(typeof metadata.unavailable, "boolean");
      assert.ok(Number.isSafeInteger(metadata.animatedElements));
      assert.ok(Number.isSafeInteger(metadata.loopingGroups));
      if (motion === "none") {
        assert.equal(metadata.animatedElements, 0); assert.equal(metadata.loopingGroups, 0);
      }
      assert.match(response.headers.get("access-control-expose-headers") ?? "", /X-CommitAtlas-Scene-Metadata/i);
      const conditional = await call(id, tail, { "if-none-match": response.headers.get("etag")! });
      assert.equal(conditional.status, 304);
      assert.deepEqual(JSON.parse(conditional.headers.get(header)!), metadata);
    });
  });
}
test("unavailable scene plates are not labelled as successfully rendered evidence", async () => {
  await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
    const response = await GET(new Request("https://example.test/api/v1/scenes/lifecycle-map.svg?user=octocat&demo=true&motion=ambient"),
      { params: Promise.resolve({ id: "lifecycle-map.svg" }) });
    assert.equal(response.status, 200);
    const metadata = JSON.parse(response.headers.get(header) ?? "null");
    assert.equal(metadata?.unavailable, true); assert.equal(metadata?.animatedElements, 0);
  });
});
test("errors and canonical redirects cannot supply a scene receipt", async () => {
  await withWorkerEnv({ GITHUB_TOKEN: "" }, async () => {
    for (const [id, tail, status] of [["unknown", "", 404], ["evidence-coverage", "&motion=cinematic", 400],
      ["evidence-coverage", "&theme=aurora", 308]] as const) {
      const response = await call(id, tail);
      assert.equal(response.status, status); assert.equal(response.headers.has(header), false);
    }
  });
});
'''),
])
