import { GitHubApiError, InputError } from "@/lib/github/client";
import { apiErrorResponse, canonicalSvgRedirect, optionsResponse, svgResponse } from "@/lib/http";
import { fetchPortfolioSnapshot } from "@/lib/portfolio";
import { getGitHubToken } from "@/lib/runtime-env";
import { toSceneInputs } from "@/lib/svg-adapters";
import { parseSvgSceneQuery } from "@/lib/svg-routes";
import { getScene, MOTION_BACKEND_DEFAULTS, renderSceneDefinition } from "@/packages/svg/src/index";

export const dynamic = "force-dynamic";

const HOSTED_FAMILIES = new Set<string>(["instrument", "map"]);
const NOT_FOUND = "No public GitHub resource matched this request";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id: rawId } = await context.params;
    if (!rawId.endsWith(".svg")) throw new GitHubApiError("github_not_found", NOT_FOUND, 404);
    const id = rawId.slice(0, -".svg".length);
    const query = parseSvgSceneQuery(new URL(request.url).searchParams);
    const token = getGitHubToken();
    const publicData = query.demo || !token;
    const redirect = canonicalSvgRedirect(request, query.canonical, publicData);
    if (redirect) return redirect;

    const scene = getScene(id);
    if (!scene) throw new GitHubApiError("github_not_found", NOT_FOUND, 404);
    if (!HOSTED_FAMILIES.has(scene.family)) throw new GitHubApiError("github_not_found", "Scene is not hosted", 404);
    if (!scene.supportedPacks.includes(query.pack)) throw new InputError("pack is not supported for this scene");
    if (!scene.supportedMotion.includes(query.motion)) throw new InputError("motion is not supported for this scene");

    const snapshot = await fetchPortfolioSnapshot({
      user: query.user,
      days: query.days,
      demo: query.demo,
      token,
      repositories: query.repos,
      lifecycles: query.states,
      workflows: query.workflows,
    });
    const rendered = renderSceneDefinition(scene, toSceneInputs(snapshot), {
      theme: query.theme,
      pack: query.pack,
      motion: query.motion,
      backend: MOTION_BACKEND_DEFAULTS["github-readme"],
      layout: query.layout,
      instanceNamespace: "hosted",
      seed: "",
    });
    return svgResponse(request, rendered.svg, {
      edgeSeconds: 300,
      publicData,
      inlineStyles: rendered.inlineStyles,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
