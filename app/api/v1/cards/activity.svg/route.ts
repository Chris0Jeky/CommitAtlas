import { demoContributions } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import { parseSvgActivityQuery } from "@/lib/svg-routes";
import { toActivityCard } from "@/lib/svg-adapters";
import { apiErrorResponse, canonicalSvgRedirect, optionsResponse, svgResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";
import { renderActivityCard } from "@/packages/svg/src/index";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseSvgActivityQuery(new URL(request.url).searchParams);
    const token = getGitHubToken();
    const publicData = query.demo || !token;
    const redirect = canonicalSvgRedirect(request, query.canonical, publicData);
    if (redirect) return redirect;
    const client = new GitHubClient({ token });
    const snapshot = query.demo
      ? demoContributions(query.user, query.days)
      : token
        ? await client.fetchContributions(query.user, query.days)
        : await client.fetchPublicProfileContributions(query.user, query.days);
    const body = renderActivityCard(toActivityCard(snapshot, query.days), {
      theme: query.theme,
      title: `${snapshot.login} contribution activity`,
      description: `Public contribution activity for ${snapshot.login}.`,
    });
    return svgResponse(request, body, { edgeSeconds: 3600, publicData });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
