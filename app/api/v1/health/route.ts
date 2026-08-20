import { jsonResponse, optionsResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";

export async function GET(request: Request): Promise<Response> {
  const tokenConfigured = Boolean(getGitHubToken());
  return jsonResponse(request,
    {
      version: 1,
      service: "CommitAtlas",
      status: "ok",
      capabilities: {
        publicProfile: true,
        contributions: tokenConfigured
          ? { status: "unverified", mode: "configured-credential" }
          : { status: "available", mode: "public-profile" },
        projectBoard: true,
      },
      generatedAt: new Date().toISOString(),
    },
    { edgeSeconds: 60, publicData: !tokenConfigured },
  );
}

export function OPTIONS(): Response {
  return optionsResponse();
}
