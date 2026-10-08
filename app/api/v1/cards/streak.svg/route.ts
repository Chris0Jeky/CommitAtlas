import { cardSvgResponse } from "@/lib/card-response";
import { demoContributions } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import { parseSvgStreakQuery } from "@/lib/svg-routes";
import { toStreakCard } from "@/lib/svg-adapters";
import { apiErrorResponse, canonicalSvgRedirect, optionsResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";
import { motionRenderMetadata, renderStreakCard } from "@/packages/svg/src/index";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseSvgStreakQuery(new URL(request.url).searchParams);
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
    const body = renderStreakCard(toStreakCard(snapshot, query.days === "auto" ? snapshot.days.length : query.days), {
      theme: query.theme,
      motion: query.motion,
      title: `${snapshot.login} contribution streak`,
      description: `Current and longest public contribution streaks for ${snapshot.login}.`,
    });
    return await cardSvgResponse(request, body, { edgeSeconds: 3600, publicData, inlineStyles: motionRenderMetadata(query.motion).inlineStyles }, "streak", snapshot.freshness.mode);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
