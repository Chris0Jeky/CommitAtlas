import { demoProfile } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import { parseSvgProfileQuery } from "@/lib/svg-routes";
import { toProfileCard } from "@/lib/svg-adapters";
import { apiErrorResponse, optionsResponse, svgResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";
import { renderProfileCard } from "@/packages/svg/src/index";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseSvgProfileQuery(new URL(request.url).searchParams);
    const token = getGitHubToken();
    const snapshot = query.demo
      ? demoProfile(query.user)
      : await new GitHubClient({ token }).fetchProfile(query.user);
    const body = renderProfileCard(toProfileCard(snapshot), {
      theme: query.theme,
      title: `${snapshot.login} profile`,
      description: `Public GitHub profile summary for ${snapshot.login}.`,
    });
    return svgResponse(request, body, { edgeSeconds: 900, publicData: query.demo || !token });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}

