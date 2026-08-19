import { demoContributions } from "@/lib/github/demo";
import { GitHubClient } from "@/lib/github/client";
import { InputError, parseDemo, parseGitHubHandle, rejectUnknownParameters } from "@/lib/github/validation";
import { apiErrorResponse, jsonResponse, optionsResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    rejectUnknownParameters(url.searchParams, ["user", "demo", "days"]);
    const user = parseGitHubHandle(url.searchParams.get("user"));
    const demo = parseDemo(url.searchParams.get("demo"));
    const days = parseDays(url.searchParams.get("days"));
    const snapshot = demo
      ? demoContributions(user)
      : await new GitHubClient({ token: process.env.GITHUB_TOKEN }).fetchContributions(user, days);
    return jsonResponse(snapshot, 3600);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}

function parseDays(value: string | null): number {
  if (value === null) return 365;
  if (!/^\d{1,3}$/.test(value)) throw new InputError("days must be an integer from 7 to 365");
  const days = Number(value);
  if (days < 7 || days > 365) throw new InputError("days must be an integer from 7 to 365");
  return days;
}
