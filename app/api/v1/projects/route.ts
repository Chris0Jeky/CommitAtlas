import { demoProjects } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import {
  parseDemo,
  parseGitHubHandle,
  parseLifecycleMap,
  parseRepositoryNames,
  rejectUnknownParameters,
} from "@/lib/github/validation";
import { apiErrorResponse, jsonResponse, optionsResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    rejectUnknownParameters(url.searchParams, ["owner", "repos", "states", "demo"]);
    const owner = parseGitHubHandle(url.searchParams.get("owner"), "owner");
    const repos = parseRepositoryNames(url.searchParams.get("repos"));
    const states = parseLifecycleMap(url.searchParams.get("states"));
    const demo = parseDemo(url.searchParams.get("demo"));
    const snapshot = demo
      ? demoProjects(owner, repos, states)
      : await new GitHubClient({ token: process.env.GITHUB_TOKEN }).fetchProjects(owner, repos, states);
    return jsonResponse(snapshot, 300);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
