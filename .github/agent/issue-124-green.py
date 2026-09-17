from __future__ import annotations

import re
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")


def replace_count(path: str, old: str, new: str, expected: int) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} replacements, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")


def regex_once(path: str, pattern: str, replacement: str, *, flags: int = 0) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex replacement, found {count}: {pattern!r}")
    target.write_text(updated, encoding="utf-8")


# Renderer-owned motion vocabulary and style metadata.
replace_once(
    "packages/svg/src/index.ts",
    'export type ThemeName = "aurora" | "midnight" | "paper" | "ember";\n',
    '''export type ThemeName = "aurora" | "midnight" | "paper" | "ember";
export type MotionProfile = "none" | "subtle" | "ambient" | "cinematic";
export type HostedMotionProfile = Exclude<MotionProfile, "cinematic">;

export interface MotionRenderMetadata {
  readonly inlineStyles: boolean;
}

export function motionRenderMetadata(motion: MotionProfile | undefined): MotionRenderMetadata {
  return { inlineStyles: motion !== undefined && motion !== "none" };
}
''',
)
replace_once(
    "packages/svg/src/index.ts",
    '  readonly motion?: "none" | "subtle";',
    "  readonly motion?: MotionProfile;",
)
replace_count(
    "packages/svg/src/index.ts",
    '  if (motion !== "subtle") return "";',
    '  if (!motionRenderMetadata(motion).inlineStyles) return "";',
    2,
)

# Hosted query boundary: ambient is public; cinematic remains static/package-only.
replace_once(
    "lib/svg-routes.ts",
    'import type { ThemeName } from "@/packages/svg/src/index";',
    'import type { HostedMotionProfile, ThemeName } from "@/packages/svg/src/index";',
)
replace_count(
    "lib/svg-routes.ts",
    'readonly motion: "none" | "subtle";',
    "readonly motion: HostedMotionProfile;",
    3,
)
replace_once(
    "lib/svg-routes.ts",
    '''export function parseMotion(value: string | null): "none" | "subtle" {
  if (value === null || value === "subtle") return "subtle";
  if (value === "none") return "none";
  throw new InputError("motion must be subtle or none");
}

export function parseStandaloneMotion(value: string | null): "none" | "subtle" {
  if (value === null || value === "none") return "none";
  if (value === "subtle") return "subtle";
  throw new InputError("motion must be subtle or none");
}''',
    '''export function parseMotion(value: string | null): HostedMotionProfile {
  if (value === null || value === "subtle") return "subtle";
  if (value === "none" || value === "ambient") return value;
  throw new InputError("motion must be none, subtle, or ambient");
}

export function parseStandaloneMotion(value: string | null): HostedMotionProfile {
  if (value === null || value === "none") return "none";
  if (value === "subtle" || value === "ambient") return value;
  throw new InputError("motion must be none, subtle, or ambient");
}''',
)

route_paths = [
    "app/api/v1/cards/atlas.svg/route.ts",
    "app/api/v1/cards/profile.svg/route.ts",
    "app/api/v1/cards/streak.svg/route.ts",
    "app/api/v1/cards/breakdown.svg/route.ts",
    "app/api/v1/cards/rhythm.svg/route.ts",
    "app/api/v1/cards/activity.svg/route.ts",
    "app/api/v1/cards/languages.svg/route.ts",
    "app/api/v1/projects.svg/route.ts",
]
for route_path in route_paths:
    target = Path(route_path)
    text = target.read_text(encoding="utf-8")
    if text.count('inlineStyles: query.motion === "subtle"') != 1:
        raise RuntimeError(f"{route_path}: expected one route-owned style inference")
    pattern = r'import \{([^{}]+)\} from "@/packages/svg/src/index";'
    match = re.search(pattern, text, flags=re.DOTALL)
    if match is None:
        raise RuntimeError(f"{route_path}: SVG source import not found")
    imported = match.group(1)
    if "motionRenderMetadata" in imported:
        raise RuntimeError(f"{route_path}: metadata import already present")
    normalized = imported.strip()
    replacement = f'import {{ motionRenderMetadata, {normalized} }} from "@/packages/svg/src/index";'
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"{route_path}: failed to add metadata import")
    text = text.replace(
        'inlineStyles: query.motion === "subtle"',
        "inlineStyles: motionRenderMetadata(query.motion).inlineStyles",
    )
    target.write_text(text, encoding="utf-8")

# Static config accepts every renderer profile while preserving the still default.
replace_once(
    "packages/static/src/config.ts",
    'import { z } from "zod";',
    'import type { MotionProfile } from "@commit-atlas/svg";\nimport { z } from "zod";',
)
replace_once(
    "packages/static/src/config.ts",
    '  motion: z.enum(["none", "subtle"]).default("none"),',
    '  motion: z.enum(["none", "subtle", "ambient", "cinematic"]).default("none"),',
)
replace_once(
    "packages/static/src/config.ts",
    '  readonly motion: "none" | "subtle";',
    "  readonly motion: MotionProfile;",
)

# Studio shares the hosted profile type and exposes ambient without overclaiming new visuals.
replace_once(
    "app/studio/studio-urls.ts",
    "export interface StudioProjectInput {",
    'import type { HostedMotionProfile } from "@/packages/svg/src/index";\n\nexport interface StudioProjectInput {',
)
replace_once(
    "app/studio/studio-urls.ts",
    '  motion?: "none" | "subtle";',
    "  motion?: HostedMotionProfile;",
)
replace_once(
    "app/studio/studio-markdown.ts",
    'import { buildStudioRouteUrl, type StudioCardKind, type StudioProjectInput } from "./studio-urls";',
    '''import type { HostedMotionProfile } from "@/packages/svg/src/index";
import { buildStudioRouteUrl, type StudioCardKind, type StudioProjectInput } from "./studio-urls";''',
)
replace_once(
    "app/studio/studio-markdown.ts",
    '  motion?: "none" | "subtle";',
    "  motion?: HostedMotionProfile;",
)
replace_once(
    "app/studio/studio-client.tsx",
    'import { useMemo, useState, type FormEvent } from "react";',
    '''import type { HostedMotionProfile } from "@/packages/svg/src/index";
import { useMemo, useState, type FormEvent } from "react";''',
)
replace_once(
    "app/studio/studio-client.tsx",
    '  motion: "none" | "subtle";',
    "  motion: HostedMotionProfile;",
)
replace_once(
    "app/studio/studio-client.tsx",
    '  const [motion, setMotion] = useState<"none" | "subtle">("subtle");',
    '  const [motion, setMotion] = useState<HostedMotionProfile>("subtle");',
)
replace_once(
    "app/studio/studio-client.tsx",
    '''              <label><input type="radio" name="motion" checked={motion === "subtle"} onChange={() => setMotion("subtle")} /><span><strong>Subtle</strong><small>Reduced-motion safe</small></span></label>
              <label><input type="radio" name="motion" checked={motion === "none"} onChange={() => setMotion("none")} /><span><strong>Still</strong><small>Static export</small></span></label>''',
    '''              <label><input type="radio" name="motion" checked={motion === "subtle"} onChange={() => setMotion("subtle")} /><span><strong>Subtle</strong><small>Reduced-motion safe</small></span></label>
              <label><input type="radio" name="motion" checked={motion === "ambient"} onChange={() => setMotion("ambient")} /><span><strong>Ambient</strong><small>Subtle-compatible</small></span></label>
              <label><input type="radio" name="motion" checked={motion === "none"} onChange={() => setMotion("none")} /><span><strong>Still</strong><small>Static export</small></span></label>''',
)

# Exercise both sides of the hosted CSP boundary on every SVG route.
replace_once(
    "tests/hosted-motion-routes.test.ts",
    'type Motion = "ambient" | "cinematic";',
    'type Motion = "none" | "ambient" | "cinematic";',
)
replace_once(
    "tests/hosted-motion-routes.test.ts",
    '''    for (const route of routes) {
      const ambient = await route.get(new Request(`https://example.test/api/v1/${route.name}?${route.query("ambient")}`));''',
    '''    for (const route of routes) {
      const none = await route.get(new Request(`https://example.test/api/v1/${route.name}?${route.query("none")}`));
      assert.equal(none.status, 200, `${route.name} none status`);
      assert.match(
        none.headers.get("content-security-policy") ?? "",
        /style-src 'none'/,
        `${route.name} none CSP`,
      );

      const ambient = await route.get(new Request(`https://example.test/api/v1/${route.name}?${route.query("ambient")}`));''',
)

# Make the source-level selector assertion literal rather than regex-escape-sensitive.
regex_once(
    "app/studio/studio-presentation.test.ts",
    r'''test\("Studio exposes exactly the three hosted motion profiles", \(\) => \{\n  const source = readFileSync\(new URL\("\./studio-client\.tsx", import\.meta\.url\), "utf8"\);\n  for \(const profile of \["none", "subtle", "ambient"\]\) \{\n    assert\.match\(source, new RegExp\(`setMotion.*?\n  \}\n  assert\.doesNotMatch\(source, /setMotion.*?\n\}\);''',
    '''test("Studio exposes exactly the three hosted motion profiles", () => {
  const source = readFileSync(new URL("./studio-client.tsx", import.meta.url), "utf8");
  for (const profile of ["none", "subtle", "ambient"]) {
    assert.ok(source.includes(`setMotion("${profile}")`), `missing ${profile} selector`);
  }
  assert.ok(!source.includes('setMotion("cinematic")'));
});''',
    flags=re.DOTALL,
)

# Public-facing documentation reflects the compatibility slice without claiming differentiated motion.
replace_once(
    "packages/svg/README.md",
    '''All renderers accept `motion: "none" | "subtle"`. `none` emits no animation keyframes; `subtle`
adds a short load transition plus a `prefers-reduced-motion: reduce` override that disables it.
''',
    '''All renderers accept the shared `MotionProfile` vocabulary: `none`, `subtle`, `ambient`, and
`cinematic`. `none` emits no animation keyframes. In this compatibility slice, `subtle`, `ambient`,
and `cinematic` intentionally emit byte-identical bounded load motion with a
`prefers-reduced-motion: reduce` override. Hosted routes expose `none | subtle | ambient`; cinematic
remains available only to package and static-generator callers until a dedicated backend lands.
`motionRenderMetadata()` reports whether the current renderer output requires inline presentation
styles, so HTTP routes do not duplicate profile-to-CSP rules.
''',
)
replace_once(
    "docs/STATIC_GENERATOR_PLAN.md",
    '''within-window personal consistency summary, not a GitHub rank. `motion: "none"` produces no
animation keyframes; `motion: "subtle"` produces short load motion with a reduced-motion override.
A malformed, incomplete, gapped, oversized, or unavailable response fails generation.
''',
    '''within-window personal consistency summary, not a GitHub rank. Static configuration accepts
`motion: "none" | "subtle" | "ambient" | "cinematic"` and defaults to `none`. `none` produces no
animation keyframes. The other three profiles currently produce the same bounded load motion with a
reduced-motion override; differentiated ambient and cinematic compilation remains a later slice.
A malformed, incomplete, gapped, oversized, or unavailable response fails generation.
''',
)
replace_once(
    "docs/DESIGN_CHASSIS.md",
    '''The card SVGs keep `motion=none|subtle` and stay transform-only. Nothing here changes them.

The [expansion programme](./EXPANSION_PLAN.md) plans to move that boundary — `ambient` and
`cinematic` profiles, the M-series ported into the cards through a CSS/SMIL motion compiler — only
after Phase 0 has measured how github.com actually renders animated SVG through `<img>`. Until a
slice ships, the sentence above stays true, and any new motion ref a scene introduces is recorded
in the table here as M10 onward.
''',
    '''The card renderer now shares the four-profile vocabulary `none | subtle | ambient | cinematic`.
Hosted URLs and the Studio expose `none | subtle | ambient`; static/package callers may also select
`cinematic`. This slice changes the contract rather than the visuals: `subtle`, `ambient`, and
`cinematic` remain byte-identical, transform-only load motion, while `none` remains still.

The [expansion programme](./EXPANSION_PLAN.md) will differentiate the compatibility profiles through
a measured CSS/SMIL motion compiler only after github.com `<img>` evidence supports that backend.
Any new motion ref a scene introduces is recorded in the table here as M10 onward.
''',
)
replace_once(
    "app/chassis/specimen-tray.tsx",
    '              MOTION <b>none | subtle (transform-only)</b>',
    '              MOTION <b>hosted: none | subtle | ambient</b>',
)
replace_once(
    "README.md",
    '''- Eight hosted SVG routes and the live Studio run on the public Cloudflare Worker.
- The source CLI and bundled Node 24 Action generate ten card types from one public snapshot: the hosted eight plus static Cadence and Releases cards.''',
    '''- Eight hosted SVG routes and the live Studio run on the public Cloudflare Worker.
- Hosted URLs and the Studio accept `none | subtle | ambient`; the package and static generator also accept `cinematic`. In this compatibility slice, every non-`none` profile remains byte-identical to the existing subtle load motion.
- The source CLI and bundled Node 24 Action generate ten card types from one public snapshot: the hosted eight plus static Cadence and Releases cards.''',
)
replace_once(
    "README.md",
    "**Planned, not shipped:** ambient/cinematic motion, a scene engine, owner-reviewed Developer Lens projections, additional research finding projections, and broader visual families.",
    "**Planned, not shipped:** differentiated ambient/cinematic motion, a motion compiler, a scene engine, owner-reviewed Developer Lens projections, additional research finding projections, and broader visual families.",
)
replace_once(
    "README.md",
    "1. prove which SVG motion backend actually works through GitHub README `<img>` rendering before expanding the motion vocabulary;",
    "1. finish proving which SVG motion backend works through GitHub README `<img>` rendering before differentiating the compatibility motion profiles;",
)
replace_once(
    "docs/ARCHITECTURE.md",
    '''The accepted programme in [EXPANSION_PLAN.md](./EXPANSION_PLAN.md) extends this architecture in
three additive steps: a `none | subtle | ambient | cinematic` motion model compiled to CSS or SMIL
by a backend chosen from measured github.com behaviour; a scene engine in `@commit-atlas/svg`
(primitives, seeded determinism, budgets, a per-scene contract test harness) feeding new
`/api/v1/scenes/<id>.svg` routes and `scene-<id>.svg` static artifacts; and two validated,
fail-closed projections — `PublicLensProjection.v1` from Developer Lens and
`ResearchFindingProjection.v1` exported by Developer Lens Lab into a Developer Lens-owned schema — specified in
[PROJECTION_CONTRACTS.md](./PROJECTION_CONTRACTS.md). Until a slice ships, everything above this
heading remains the complete description of the product.
''',
    '''The first motion-contract slice from [EXPANSION_PLAN.md](./EXPANSION_PLAN.md) is shipped in
source: `@commit-atlas/svg` and static configuration accept
`none | subtle | ambient | cinematic`, while hosted routes and the Studio accept
`none | subtle | ambient`. Renderer metadata, rather than route string comparisons, now decides
whether SVG CSP permits inline presentation styles. The three non-still profiles intentionally
render byte-identically until a measured CSS/SMIL compiler differentiates them.

The remaining accepted programme is additive: that compiler; a scene engine in
`@commit-atlas/svg` (primitives, seeded determinism, budgets, a per-scene contract test harness)
feeding new `/api/v1/scenes/<id>.svg` routes and `scene-<id>.svg` static artifacts; and two
validated, fail-closed projections — `PublicLensProjection.v1` from Developer Lens and
`ResearchFindingProjection.v1` exported by Developer Lens Lab into a Developer Lens-owned schema —
specified in [PROJECTION_CONTRACTS.md](./PROJECTION_CONTRACTS.md). Until another slice ships,
everything above this heading remains the complete description of the product.
''',
)
