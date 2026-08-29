import { apiErrorResponse, optionsResponse, svgResponse } from "@/lib/http";
import { InputError } from "@/lib/github/validation";
import { MOTION_PROBES } from "@/tests/fixtures/motion-probes";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ probe: string }> },
): Promise<Response> {
  try {
    const { probe } = await context.params;
    const body = MOTION_PROBES[probe as keyof typeof MOTION_PROBES];
    if (typeof body !== "string") throw new InputError("unknown motion probe");
    return svgResponse(request, body, { edgeSeconds: 300, publicData: true, inlineStyles: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function OPTIONS(): Response {
  return optionsResponse();
}
