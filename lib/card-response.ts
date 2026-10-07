import { measureCardMotion } from "@/packages/svg/src/index";
import { svgResponse } from "./http";
import { CARD_METADATA_HEADER, parseCardResponseMetadata, type CardId } from "./card-metadata";

/** Add metadata without changing image bytes, ETag, cache policy or the collection boundary. */
export async function cardSvgResponse(request: Request, body: string, options: Parameters<typeof svgResponse>[2], card: CardId, mode: string): Promise<Response> {
  const state = mode === "live" || mode === "demo" ? "ready" : mode === "partial" || mode === "stale" ? mode : "unavailable";
  const counters = measureCardMotion(body, card);
  const metadata = parseCardResponseMetadata(JSON.stringify({ version: 1, card, ...counters, state }), card, counters.bytes);
  const response = await svgResponse(request, body, options);
  response.headers.set(CARD_METADATA_HEADER, JSON.stringify(metadata));
  response.headers.set("Access-Control-Expose-Headers", `ETag, ${CARD_METADATA_HEADER}`);
  return response;
}
