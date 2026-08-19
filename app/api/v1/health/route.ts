import { jsonResponse, optionsResponse } from "@/lib/http";

export function GET(): Response {
  return jsonResponse(
    {
      version: 1,
      service: "CommitAtlas",
      status: "ok",
      capabilities: {
        publicProfile: true,
        contributions: Boolean(process.env.GITHUB_TOKEN),
        projectBoard: true,
      },
      generatedAt: new Date().toISOString(),
    },
    60,
  );
}

export function OPTIONS(): Response {
  return optionsResponse();
}
