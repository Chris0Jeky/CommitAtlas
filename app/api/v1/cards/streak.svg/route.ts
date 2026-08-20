import { demoContributions } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import { parseSvgStreakQuery } from "@/lib/svg-routes";
import { toStreakCard } from "@/lib/svg-adapters";
import { apiErrorResponse, optionsResponse, svgResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";
import { renderStreakCard } from "@/packages/svg/src/index";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseSvgStreakQuery(new URL(request.url).searchParams);
    const token = getGitHubToken();
    const client = new GitHubClient({ token });
    const snapshot = query.demo
      ? demoContributions(query.user, 365)
      : token
        ? await client.fetchContributions(query.user, 365)
        : await client.fetchPublicProfileContributions(query.user, 365);
    const body = renderStreakCard(toStreakCard(snapshot, 365), {
      theme: query.theme,
      title: `${snapshot.login} contribution streak`,
      description: `Current and longest public contribution streaks for ${snapshot.login}.`,
    });
    return svgResponse(request, body, { edgeSeconds: 3600, publicData: query.demo || !token });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
