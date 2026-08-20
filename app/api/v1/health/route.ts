import { jsonResponse, optionsResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";

export async function GET(request: Request): Promise<Response> {
  return jsonResponse(request,
    {
      version: 1,
      service: "CommitAtlas",
      status: "ok",
      capabilities: {
        publicProfile: true,
        contributions: Boolean(getGitHubToken()),
        projectBoard: true,
      },
      generatedAt: new Date().toISOString(),
    },
    { edgeSeconds: 60, publicData: !getGitHubToken() },
  );
}

export function OPTIONS(): Response {
  return optionsResponse();
}
