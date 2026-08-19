import { demoProfile } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import { parseDemo, parseGitHubHandle, rejectUnknownParameters } from "@/lib/github/validation";
import { apiErrorResponse, jsonResponse, optionsResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    rejectUnknownParameters(url.searchParams, ["user", "demo"]);
    const user = parseGitHubHandle(url.searchParams.get("user"));
    const demo = parseDemo(url.searchParams.get("demo"));
    const snapshot = demo
      ? demoProfile(user)
      : await new GitHubClient({ token: process.env.GITHUB_TOKEN }).fetchProfile(user);
    return jsonResponse(snapshot, 900);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
