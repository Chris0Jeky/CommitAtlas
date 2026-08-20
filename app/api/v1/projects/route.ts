import { demoProjects } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import {
  parseDemo,
  parseGitHubHandle,
  parseLifecycleMap,
  parseRepositoryNames,
  parseWorkflowMap,
  rejectUnknownParameters,
} from "@/lib/github/validation";
import { apiErrorResponse, jsonResponse, optionsResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    rejectUnknownParameters(url.searchParams, ["owner", "repos", "states", "workflows", "demo"]);
    const owner = parseGitHubHandle(url.searchParams.get("owner"), "owner");
    const repos = parseRepositoryNames(url.searchParams.get("repos"));
    const states = parseLifecycleMap(url.searchParams.get("states"), repos);
    const workflows = parseWorkflowMap(url.searchParams.get("workflows"), repos);
    const demo = parseDemo(url.searchParams.get("demo"));
    const snapshot = demo
      ? demoProjects(owner, repos, states, workflows)
      : await new GitHubClient({ token: getGitHubToken() }).fetchProjects(owner, repos, states, workflows);
    return jsonResponse(request, snapshot, { edgeSeconds: 300, publicData: demo || !getGitHubToken() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
