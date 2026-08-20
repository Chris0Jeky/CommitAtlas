import { demoProfile } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import { parseSvgLanguagesQuery } from "@/lib/svg-routes";
import { toLanguagesCard } from "@/lib/svg-adapters";
import { apiErrorResponse, optionsResponse, svgResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";
import { renderLanguagesCard } from "@/packages/svg/src/index";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseSvgLanguagesQuery(new URL(request.url).searchParams);
    const token = getGitHubToken();
    const snapshot = query.demo
      ? demoProfile(query.user)
      : await new GitHubClient({ token }).fetchProfile(query.user);
    const body = renderLanguagesCard(toLanguagesCard(snapshot), {
      theme: query.theme,
      title: `${snapshot.login} languages`,
      description: "Public repository-language distribution by repository count; this is not a measure of proficiency.",
    });
    return svgResponse(request, body, { edgeSeconds: 900, publicData: query.demo || !token });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
