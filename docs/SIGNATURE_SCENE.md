# Developer Signature

`signature` is a static-first, synthetic Developer Lens composition. It is a `signature` family
scene using the shared map/signature budget (80 KiB, 64 animated targets, six loop groups). It
supports the `survey` pack, the four themes, wide and compact layouts, and `none` or `ambient`.
It is registered for static/Action generation and the Gallery. It is not in the hosted catalogue
and has no hosted SVG endpoint or selectable Studio scene.

[Wide and compact browser captures](./evidence/appearance-2026-10-26/README.md) show the composition
with its actual fonts, exact readings and complete disclosure.
The [final CI receipt](./SIGNATURE_EVIDENCE.md) records the merged #449 source, 312 measured layouts,
14 playback/control rows, actual font and timing observations, artifact hashes and delivery checks.

## Data and interpretation

The scene requires the complete, validated C0 `PublicLensProjection.v1` context introduced by
#145. The former common coverage/privacy context is insufficient and produces `UNAVAILABLE`.
The producer fixture remains pinned with its original `2026-09-01T12:00:00Z` timestamp. All age
calculations use the snapshot clock and the existing 45-day default; rendering never rewrites
the artifact to make it look fresh. C1 publication stays disabled under Q-9 No / #170.

The radar uses the canonical clockwise order from the top: focus, shipping, collaboration,
consistency, breadth, stewardship. Radial distance and six stationary bars represent the supplied
0..1 values. Each axis is numbered, named and printed with its exact JavaScript numeric value;
no percent conversion or display rounding changes those readings. The polygon fill is decorative,
not an overall score. The two greatest supplied dimensions are named separately; equal values
retain canonical axis order. The archetype name and description are the producer's bounded text.

The published contract requires a fixed DNA tuple. A full artifact with shuffled entries remains
invalid, even after recomputing its hash. The scene's model also uses keys rather than relying on
incidental input positions; a model-level order test does not relax the transport validator.

The coverage track uses the producer's `coverage.scorePercent` directly, with neutral ink. It does
not manufacture observed counts or reinterpret the derived score as a health verdict. The complete
coverage counts, supplied warnings, privacy note and projection age are painted in a wrapped block
and repeated in the accessible description. Available output clearly prints `DERIVED SIGNATURE`,
`SYNTHETIC SHOWCASE` and `not a productivity score`.

## Freshness and motion

Fresh `ambient` output has two decorative targets: a nine-second plotting overdraw and a
twenty-second calibration ring. The stationary base outline, nodes, labels and readings remain
visible throughout. Neither motion target contains text. Both CSS and SMIL come from the existing
compiler and retain the 45-second GitHub README interval. Removing the compiler's animation nodes
from ambient produces the exact `none` output. SMIL reduced motion requires the `none` twin.

Stale projections retain their historical shape and exact readings, receive the engine-owned
`STALE PROJECTION` header, label the score `LAST DERIVED COVERAGE`, and emit no motion. Expired
projections take the engine's unavailable branch before model construction; no axes or archetype
are inferred. The unavailable composition retains the theme, width, explicit reason and age.
Gallery evidence labels remain derived for both fresh and historical signatures; expired or
missing inputs are unavailable. Freshness is a separate state: `ready`, `stale` or `unavailable`.
A still-readable historical signature is explicitly labelled Stale rather than Ready.

## Layout and text

Wide output is 860 pixels across, with a large radar beside the archetype and axis ledger. Compact
output is 480 pixels across, placing the archetype above a radar/ledger pair. A distinct neutral
coverage area follows the signature. The footer grows with the complete disclosure text. Full
maximum-length CJK text and all eight warnings fit within the shared 1000-pixel frame body limit.
The engine adds its 28-pixel stale strip outside that body, so historical output can reach 1028
pixels overall. If combined text, count and numeric extremes exceed the normal layout, a dense
composition uses a smaller display title and compact radar, closer spacing, and character-boundary
wrapping. The 10/11/12-pixel disclosure and reading sizes remain unchanged; every supplied character
is still visible. Maximum BMP pictographs, CJK soft breaks, long exact decimals and counts are tested
together, including the longest admitted projection-age display.

Text wrapping preserves every character so the engine can compare the complete common disclosure.
Explicit text lengths reserve wider space for CJK and emoji and bound font substitution. Every
string is XML-escaped. The shared harness rejects malicious full-projection text through canonical
Unicode or strict schema/privacy validation after rehashing the changed body; permitted punctuation
has a separate escaping/render test.

## Configuration and verification

Select `"scenes": ["signature"]` with `"scenePack": "survey"`, `"motion": "none"` or `"ambient"`,
and a valid tracked C0 `lens.path`. The existing generator writes `scene-signature.svg` in each
selected theme directory and includes its real bytes and SHA-256 in the manifest. Missing Lens
input yields an unavailable artifact; invalid configured files fail before writes as before.

Focused checks:

```sh
npm run typecheck
npm run lint
npm run test:svg
npm run test:static
npm run test:chassis
```

`packages/svg/tests/signature.test.mjs` covers exact readings, canonical order/ties, strict tuple
rejection, the shared scene harness, zero and precise values, maximum text, permitted punctuation,
both backends, both widths and all themes. Static tests cover paired artifacts, actual manifest
integrity, missing input and stale/expired output. Gallery tests retain Derived evidence through
fresh and historical states, with an unavailable expiry, without enabling a hosted route.

After building the packages, create reproducible capture inputs with:

```sh
node tests/signature-fixtures.mjs --out /tmp/commitatlas-signature-fixtures
```

The helper exports `renderSignatureFixture` and `signatureFixtureInputs` for independent comparisons
against the exact validated inputs. Its 384 fixtures cover fresh, stale, expired, maximum text and
maximum historical text, combined dense BMP/CJK/word-break extremes, zero, precise-value and
escaped-text cases for both widths, all themes, CSS/SMIL and none/ambient, with byte/hash/counter
receipts. These generated files alone do not prove browser playback. Browser
capture and integration-gate receipts are recorded separately; this scene does not complete the
existing GitHub raw/Camo transport matrix or authorize real profile adoption.

The optional `tests/signature-browser.mjs` harness builds the SVG package before importing it,
then records source and compiled-module hashes, actual browser/font identities, measured glyph
bounds and load-relative frame times. It measures 312 theme/layout/font/input combinations and
14 direct-image playback/control rows at first observation, 1s, 5s and 46s. Fresh CSS and SMIL must
move and return pixel-exactly to the still twin; none, stale, expired and explicitly selected
reduced-motion twins must stay unchanged. Its GitHub Actions workflow uses Playwright 1.57.0 and
explicitly selected Chromium 143.0.7499.4, with real CJK and emoji fonts installed.

The tracked Action bundle is rebuilt with this renderer. `action/signature-output.test.mjs`
executes that bundle using a synthetic network boundary and the byte-identical tracked C0 fixture.
It checks paired fresh ambient, stale, expired and dry-run outputs, actual artifact bytes and
SHA-256 manifests, and verifies that stale/expired output emits no motion.
