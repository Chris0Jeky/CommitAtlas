/** Browser-safe receipt schema. Renderer implementation belongs in card-response.ts. */
export const CARD_METADATA_HEADER = "X-CommitAtlas-Card-Metadata";
export const CARD_IDS = ["atlas", "profile", "streak", "activity", "breakdown", "rhythm", "languages", "projects"] as const;
export type CardId = typeof CARD_IDS[number];
export type CardEvidenceState = "ready" | "partial" | "stale" | "unavailable";
export interface CardResponseMetadata {
  readonly version: 1;
  readonly card: CardId;
  readonly bytes: number;
  readonly animatedElements: number;
  readonly loopingGroups: number;
  readonly state: CardEvidenceState;
}
export function parseCardResponseMetadata(header: string, card: string, bytes: number): CardResponseMetadata {
  const invalid = () => new Error("Card response metadata does not match this preview");
  if (header.length > 512 || !(CARD_IDS as readonly string[]).includes(card)) throw invalid();
  let value: Record<string, unknown>;
  try { value = JSON.parse(header) as Record<string, unknown>; } catch { throw invalid(); }
  const keys = ["version", "card", "bytes", "animatedElements", "loopingGroups", "state"];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length ||
      Object.keys(value).some(key => !keys.includes(key))) throw invalid();
  if (value.version !== 1 || value.card !== card || value.bytes !== bytes || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > 128 * 1024 ||
      typeof value.animatedElements !== "number" || !Number.isSafeInteger(value.animatedElements) || value.animatedElements < 0 || value.animatedElements > 96 ||
      value.loopingGroups !== 0 || !["ready", "partial", "stale", "unavailable"].includes(value.state as string)) throw invalid();
  return Object.freeze({ version: 1, card: card as CardId, bytes, animatedElements: value.animatedElements,
    loopingGroups: 0, state: value.state as CardEvidenceState });
}
