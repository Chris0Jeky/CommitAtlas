import { apiErrorResponse, optionsResponse, svgResponse } from "@/lib/http";
import { GitHubApiError } from "@/lib/github/client";
import { InputError } from "@/lib/github/validation";
import { MOTION_PROBES } from "@/tests/fixtures/motion-probes";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ probe: string }> },
): Promise<Response> {
  try {
    if (request.url.includes("?")) throw new InputError("motion probes do not accept query parameters");

    const { probe } = await context.params;
    if (!probe.endsWith(".svg")) throw new InputError("unknown motion probe");

    const probeId = probe.slice(0, -4);
    if (!Object.prototype.hasOwnProperty.call(MOTION_PROBES, probeId)) {
      throw new GitHubApiError("github_not_found", "unknown motion probe", 404);
    }

    const body = MOTION_PROBES[probeId as keyof typeof MOTION_PROBES];
    return svgResponse(request, body, { edgeSeconds: 300, publicData: true, inlineStyles: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
