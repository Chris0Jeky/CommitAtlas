edit('.gitignore', '0c67aa71a7c5323c50655d5846d78c4af4f4cec5', [
    (54, 54, r'''
# Optional synthetic Studio browser QA artifacts.
.studio-qa/
'''),
])
edit('app/api/v1/scenes/[id]/route.ts', '376873035fddcf9ef03a12444ce992800d4ce3ee', [
    (0, 0, r'''import { isHostedSceneId } from "@/lib/hosted-scene-catalog";
import { SCENE_METADATA_HEADER, sceneResponseMetadata } from "@/lib/scene-metadata";
'''),
    (28, 29, r'''    if (!scene || !isHostedSceneId(id)) throw new GitHubApiError("github_not_found", NOT_FOUND, 404);
'''),
    (51, 52, r'''    const response = await svgResponse(request, rendered.svg, {
'''),
    (56, 56, r'''    response.headers.set(SCENE_METADATA_HEADER, JSON.stringify(sceneResponseMetadata(id, rendered)));
    response.headers.set("Access-Control-Expose-Headers", `ETag, ${SCENE_METADATA_HEADER}`);
    return response;
'''),
])
edit('app/globals.css', '307cc9dc43c1249e544f55e06758cc982ffdd7b5', [
    (1158, 1158, r'''.preview-tools { display: flex; flex-wrap: wrap; gap: 7px; margin: 0; padding: 0; border: 0; }
.preview-tools legend { width: 100%; }
.preview-tools button { min-height: 34px; padding: 0 11px; border: 1px solid var(--line); background: transparent; color: var(--ink); font: 500 11px/1 var(--font-geist-mono), monospace; cursor: pointer; }
.preview-tools button:focus-visible { outline: 2px solid var(--cool-ink); outline-offset: 2px; }
.preview-tools button:disabled { cursor: not-allowed; opacity: 0.45; }
.scene-motion-counters { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0 0; }
.scene-motion-counters div { display: flex; gap: 6px; }
.scene-motion-counters dt { color: var(--muted); }
'''),
    (1397, 1397, r'''
.scene-image-tools { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.scene-image-tools button { font: inherit; font-size: 12px; padding: 6px 10px; border: 1px solid var(--border); background: transparent; color: inherit; border-radius: 4px; cursor: pointer; }
.scene-image-tools button[aria-pressed="true"] { outline: 2px solid currentColor; outline-offset: 1px; }
.scene-preview-status { padding: 0 16px; font-size: 12px; line-height: 1.5; }
'''),
])
edit('app/page.tsx', 'd8010d6adc609b9a80ff33ae6fed7eb03a815b71', [
    (59, 60, r'''                public GitHub evidence. CommitAtlas ships hosted SVG cards and scenes, ten static card
'''),
])
edit('app/studio/studio-client.tsx', 'a00da756a5df468fc86c772116835da9714d3675', [
    (2, 4, r'''import type { HostedMotionProfile, ScenePack } from "@/packages/svg/src/index";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
'''),
    (30, 30, r'''  buildStudioSceneUrl,
'''),
    (31, 31, r'''  STUDIO_SCENE_IDS,
  STUDIO_SCENE_LABELS,
  STUDIO_SCENE_PACKS,
'''),
    (44, 44, r'''import { StudioScenePreview } from "./studio-scene-preview-image";
import { scenePreviewToken, sceneReceiptMatches, type SceneImageReceipt, type ScenePreviewView } from "./studio-scene-preview";
'''),
    (114, 114, r'''  pack: ScenePack;
  scenes: readonly string[];
'''),
    (160, 160, r'''  const [pack, setPack] = useState<ScenePack>("survey");
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(() => new Set());
  const [sceneView, setSceneView] = useState<ScenePreviewView>("profile");
  const [sceneReplay, setSceneReplay] = useState(0);
  const [renderedScenes, setRenderedScenes] = useState<ReadonlyMap<string, SceneImageReceipt>>(() => new Map());
'''),
    (183, 183, r'''    pack: "survey",
    scenes: [],
'''),
    (199, 200, r'''    pack,
    scenes: [...selectedScenes].sort(),
  }), [activeProjects, demo, handle, layout, motion, pack, selectedScenes, theme]);
'''),
    (208, 208, r'''    pack: previewConfiguration.pack,
    scenes: previewConfiguration.scenes,
'''),
    (266, 266, r'''      pack: previewConfiguration.pack,
      selectedScenes,
      renderedSceneIds: new Set(STUDIO_SCENE_IDS.filter((id) => sceneReceiptMatches(
        renderedScenes.get(id), scenePreviewToken(previewConfigurationKey, id, sceneView, sceneReplay),
        buildStudioSceneUrl(id, { owner: previewConfiguration.owner, projects: previewConfiguration.projects,
          theme: previewConfiguration.theme, demo: previewConfiguration.demo, days: STUDIO_PREVIEW_DAYS,
          motion: previewConfiguration.motion, layout: previewConfiguration.layout, pack: previewConfiguration.pack }), renderedScenes.get(id)?.view ?? sceneView))),
'''),
    (267, 268, r'''  }, [baseUrl, hasCurrentContributions, hasCurrentLanguages, previewConfiguration, previewConfigurationKey, renderedScenes, sceneView, sceneReplay, selectedCards, selectedScenes]);
  const markSceneRendered = useCallback((id: string, token: string, receipt: SceneImageReceipt | null) => {
    setRenderedScenes((current) => {
      if (receipt === null && current.get(id)?.token !== token) return current;
      const next = new Map(current);
      if (receipt) next.set(id, receipt); else next.delete(id);
      return next;
    });
  }, []);
  function changeSceneView(view: ScenePreviewView) {
    setSceneView(view);
    setSceneReplay(current => current + 1);
  }
  const sceneRouteOptions = {
    owner: previewConfiguration.owner,
    projects: previewConfiguration.projects,
    theme: previewConfiguration.theme,
    demo: previewConfiguration.demo,
    days: STUDIO_PREVIEW_DAYS,
    layout: previewConfiguration.layout,
    pack: previewConfiguration.pack,
  };
'''),
    (300, 300, r'''      pack,
      scenes: [...selectedScenes].sort(),
'''),
    (329, 329, r'''      setSceneReplay(current => current + 1);
'''),
    (336, 336, r'''        pack,
        scenes: [...selectedScenes].sort(),
'''),
    (451, 451, r'''          <fieldset className="segmented-field">
            <legend>Scene pack</legend>
            {STUDIO_SCENE_PACKS.map((value) => (
              <label key={value}>
                <input type="radio" name="pack" checked={pack === value} onChange={() => setPack(value)} />
                <span><strong>{value[0].toUpperCase() + value.slice(1)}</strong><small>{value === "survey" ? "Default geometry" : "Alternate geometry"}</small></span>
              </label>
            ))}
          </fieldset>

          <fieldset className="card-picker">
            <legend>Scenes to show &amp; copy</legend>
            {STUDIO_SCENE_IDS.map((id) => (
              <label key={id}>
                <input type="checkbox" checked={selectedScenes.has(id)} onChange={() => setSelectedScenes((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })} />
                <span>{STUDIO_SCENE_LABELS[id]}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="preview-tools">
            <legend>Preview tools</legend>
            <p>Apply to all scene previews. Each scene also has its own controls.</p>
            <button type="button" onClick={() => changeSceneView("profile")} disabled={selectedScenes.size === 0} aria-pressed={sceneView === "profile"}>Profile view</button>
            <button type="button" onClick={() => changeSceneView("profile")} disabled={selectedScenes.size === 0}>Replay</button>
            <button type="button" onClick={() => changeSceneView("reduced")} disabled={selectedScenes.size === 0} aria-pressed={sceneView === "reduced"}>Reduced-motion view</button>
            <button type="button" onClick={() => changeSceneView("frame-zero")} disabled={selectedScenes.size === 0} aria-pressed={sceneView === "frame-zero"}>Frame zero</button>
          </fieldset>

'''),
    (543, 543, r'''            {STUDIO_SCENE_IDS.filter((id) => previewConfiguration.scenes.includes(id)).map((id) => (
              <StudioScenePreview
                key={scenePreviewToken(previewConfigurationKey, id, sceneView, sceneReplay)}
                id={id}
                title={STUDIO_SCENE_LABELS[id]}
                pack={previewConfiguration.pack}
                url={buildStudioSceneUrl(id, { ...sceneRouteOptions, motion: previewConfiguration.motion })}
                stillUrl={buildStudioSceneUrl(id, { ...sceneRouteOptions, motion: "none" })}
                view={sceneView}
                token={scenePreviewToken(previewConfigurationKey, id, sceneView, sceneReplay)}
                onRendered={markSceneRendered}
              />
            ))}
'''),
])
edit('app/studio/studio-markdown.test.ts', 'c4d292b43e31706f97909d7f8dfc03e06ffc7a11', [
    (157, 157, r'''  assert.match(markdown, /Reduced-motion source omitted/);
  assert.doesNotMatch(markdown, /prefers-reduced-motion/);
});

test("scene Markdown is emitted only after that scene has rendered", () => {
  const base = {
    baseUrl: "https://atlas.example",
    owner: "octocat",
    theme: "ember",
    demo: true,
    projects,
    selectedCards: new Set<never>(),
    hasCurrentContributions: true,
    hasCurrentLanguages: true,
    motion: "none" as const,
    pack: "survey" as const,
    selectedScenes: new Set(["evidence-coverage"]),
  };
  assert.equal(buildStudioMarkdown(base), "");
  const rendered = buildStudioMarkdown({ ...base, renderedSceneIds: new Set(["evidence-coverage"]) });
  assert.match(rendered, /<picture>/);
  assert.match(rendered, /\/api\/v1\/scenes\/evidence-coverage\.svg/);
  assert.match(rendered, /alt="CommitAtlas Evidence coverage"/);
  assert.doesNotMatch(rendered, /Reduced-motion source omitted/);
  assert.doesNotMatch(rendered, /pack=/);
  const withheld = buildStudioMarkdown({
    ...base,
    selectedScenes: new Set(["evidence-coverage", "not-a-scene"]),
    renderedSceneIds: new Set(["not-a-scene"]),
  });
  assert.equal(withheld, "");
'''),
])
edit('app/studio/studio-markdown.ts', 'f276dcbcfa288198fb864c88d3c75c11be9fd644', [
    (4, 4, r'''  buildStudioSceneUrl,
'''),
    (5, 5, r'''  STUDIO_SCENE_IDS,
  STUDIO_SCENE_LABELS,
'''),
    (8, 8, r'''import type { ScenePack } from "@/packages/svg/src/index";
'''),
    (42, 42, r'''  pack?: ScenePack;
  selectedScenes?: ReadonlySet<string>;
  renderedSceneIds?: ReadonlySet<string>;
'''),
    (68, 69, r'''  const renderedScenes = options.renderedSceneIds ?? new Set<string>();
  const scenes = STUDIO_SCENE_IDS.filter((id) => options.selectedScenes?.has(id) && renderedScenes.has(id));
  const blocks = [
    ...STUDIO_CARD_KINDS
'''),
    (101, 103, r'''    }),
    ...scenes.map((id) => {
      const label = `CommitAtlas ${STUDIO_SCENE_LABELS[id]}`;
      const urlFor = (theme: string) => `${options.baseUrl}${buildStudioSceneUrl(id, {
        owner: options.owner,
        projects: options.projects,
        theme,
        demo: options.demo,
        days: STUDIO_PREVIEW_DAYS,
        motion: options.motion ?? "none",
        layout: options.layout,
        pack: options.pack,
      })}`;
      if (!partner) return `![${label}](${urlFor(chosen)})`;
      const darkUrl = chosenIsLight ? urlFor(partner) : urlFor(chosen);
      const lightUrl = chosenIsLight ? urlFor(chosen) : urlFor(partner);
      return [
        "<picture>",
        `  <source media="(prefers-color-scheme: dark)" srcset="${darkUrl}">`,
        `  <source media="(prefers-color-scheme: light)" srcset="${lightUrl}">`,
        `  <img alt="${label}" src="${urlFor(chosen)}">`,
        "</picture>",
      ].join("\n");
    }),
  ];
  const markdown = blocks.join("\n\n");
  if (!markdown || (options.motion !== "subtle" && options.motion !== "ambient")) return markdown;
  return `${markdown}\n\n<!-- Reduced-motion source omitted: GitHub sanitizer survival is unmeasured. The still twin is the motion=none URL. -->`;
'''),
])
