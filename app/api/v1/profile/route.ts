import { demoProfile } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import { parseDemo, parseGitHubHandle, rejectUnknownParameters } from "@/lib/github/validation";
import { apiErrorResponse, jsonResponse, optionsResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    rejectUnknownParameters(url.searchParams, ["user", "demo"]);
    const user = parseGitHubHandle(url.searchParams.get("user"));
    const demo = parseDemo(url.searchParams.get("demo"));
    const snapshot = demo
      ? demoProfile(user)
      : await new GitHubClient({ token: getGitHubToken() }).fetchProfile(user);
    return jsonResponse(request, snapshot, { edgeSeconds: 900, publicData: demo || !getGitHubToken() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
