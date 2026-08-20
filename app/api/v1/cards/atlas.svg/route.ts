import { svgResponse, apiErrorResponse, optionsResponse } from "@/lib/http";
import { fetchPortfolioSnapshot, toAtlasCard } from "@/lib/portfolio";
import { getGitHubToken } from "@/lib/runtime-env";
import { parseSvgAtlasQuery } from "@/lib/svg-routes";
import { renderAtlasCard } from "@/packages/svg/src/index";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseSvgAtlasQuery(new URL(request.url).searchParams);
    const token = getGitHubToken();
    const snapshot = await fetchPortfolioSnapshot({
      user: query.user,
      days: query.days,
      demo: query.demo,
      token,
      repositories: query.repos,
      lifecycles: query.states,
      workflows: query.workflows,
    });
    const body = renderAtlasCard(toAtlasCard(snapshot), {
      theme: query.theme,
      motion: query.motion,
      width: query.layout === "compact" ? 480 : 860,
      title: `${query.user} · CommitAtlas developer atlas`,
      description: "Public GitHub contribution rhythm, density, collaboration mix, languages, and configured project health.",
    });
    return svgResponse(request, body, {
      edgeSeconds: 300,
      publicData: query.demo || !token,
      inlineStyles: query.motion === "subtle",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
