import { demoProjects } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import { parseSvgProjectsQuery } from "@/lib/svg-routes";
import { toProjectBoard } from "@/lib/svg-adapters";
import { apiErrorResponse, canonicalSvgRedirect, optionsResponse, svgResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";
import { renderProjectBoard } from "@/packages/svg/src/index";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseSvgProjectsQuery(new URL(request.url).searchParams);
    const token = getGitHubToken();
    const publicData = query.demo || !token;
    const redirect = canonicalSvgRedirect(request, query.canonical, publicData);
    if (redirect) return redirect;
    const snapshot = query.demo
      ? demoProjects(query.owner, query.repos, query.states, query.workflows)
      : await new GitHubClient({ token }).fetchProjects(query.owner, query.repos, query.states, query.workflows);
    const body = renderProjectBoard(toProjectBoard(snapshot), {
      theme: query.theme,
      title: `${query.owner} project signals`,
      description: "Project lifecycle and configured CI signals for selected public GitHub repositories.",
    });
    return svgResponse(request, body, { edgeSeconds: 300, publicData });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
