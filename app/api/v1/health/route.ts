import { rejectUnknownParameters } from "@/lib/github/validation";
import { apiErrorResponse, jsonResponse, optionsResponse } from "@/lib/http";
import { getGitHubToken } from "@/lib/runtime-env";
import { BUILD_SHA } from "@/lib/build-identity";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    rejectUnknownParameters(url.searchParams, []);
    const tokenConfigured = Boolean(getGitHubToken());
    const response = await jsonResponse(request,
      {
        version: 1,
        service: "CommitAtlas",
        status: "ok",
        buildSha: BUILD_SHA,
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
    response.headers.set("Cache-Control", tokenConfigured ? "private, no-store" : "no-store");
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
