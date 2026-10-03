/** Canonical, bounded bytes for the proposed recovery store. No I/O or authenticity guarantee. */
import {
  validatePublicationJournal,
  validatePublicationStatus,
  type PublicationJournal,
  type PublicationStatus,
} from "./publication-protocol.js";

export const MAX_PUBLICATION_JOURNAL_BYTES = 64 * 1024;
export const MAX_PUBLICATION_STATUS_BYTES = 512;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype), "byteLength",
)!.get!;

function recordByteLength(value: Uint8Array, label: string): number {
  try { return typedArrayByteLength.call(value) as number; }
  catch { throw new Error(`publication ${label} bytes must be a real Uint8Array`); }
}

/** Validators construct fresh records in a fixed field order; one LF terminates every record. */
function canonicalText(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function encodeRecord<T>(value: unknown, validate: (value: unknown) => T, limit: number, label: string): Uint8Array {
  const text = canonicalText(validate(value));
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > limit) throw new Error(`publication ${label} exceeds its byte limit`);
  // Array holes serialize as null. Reject any in-memory value that would emit an unreadable
  // record rather than relying on object-only validation or silently dropping a destination.
  const roundTrip = validate(JSON.parse(text));
  if (canonicalText(roundTrip) !== text) throw new Error(`publication ${label} is not canonical`);
  return bytes;
}

function decodeRecord<T>(value: unknown, validate: (value: unknown) => T, limit: number, label: string): T {
  if (!(value instanceof Uint8Array)) throw new Error(`publication ${label} bytes must be a Uint8Array`);
  const length = recordByteLength(value, label);
  if (length === 0) throw new Error(`publication ${label} bytes must be nonempty`);
  if (length > limit) throw new Error(`publication ${label} exceeds its byte limit`);
  let text: string;
  try {
    // Retain, rather than silently strip, a leading BOM so JSON parsing rejects it.
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(value);
  } catch {
    throw new Error(`publication ${label} contains invalid UTF-8`);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new Error(`publication ${label} contains invalid JSON`); }
  const record = validate(parsed);
  // A single representation refuses duplicate keys, trailing whitespace, alternate number
  // spellings and reordered fields even where JSON.parse would accept or normalize them.
  if (canonicalText(record) !== text) throw new Error(`publication ${label} is not canonical`);
  return record;
}

export function encodePublicationJournal(value: unknown): Uint8Array {
  return encodeRecord(value, validatePublicationJournal, MAX_PUBLICATION_JOURNAL_BYTES, "journal");
}
export function decodePublicationJournal(value: unknown): PublicationJournal {
  return decodeRecord(value, validatePublicationJournal, MAX_PUBLICATION_JOURNAL_BYTES, "journal");
}
export function encodePublicationStatus(value: unknown): Uint8Array {
  return encodeRecord(value, validatePublicationStatus, MAX_PUBLICATION_STATUS_BYTES, "status");
}
export function decodePublicationStatus(value: unknown): PublicationStatus {
  return decodeRecord(value, validatePublicationStatus, MAX_PUBLICATION_STATUS_BYTES, "status");
}
