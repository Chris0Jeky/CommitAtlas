import { createHash } from "node:crypto";

function quote(value: string): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError("canonical JSON string encoding failed");
  return encoded;
}

/**
 * Serialize finite JSON data with recursively sorted object keys and no insignificant whitespace.
 * Values that JSON would silently discard or reinterpret are rejected instead of weakening a seed.
 */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();

  const serialize = (current: unknown, path: string): string => {
    if (current === null) return "null";
    if (typeof current === "string") return quote(current);
    if (typeof current === "boolean") return current ? "true" : "false";
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new TypeError(`canonical JSON requires finite numbers at ${path}`);
      return Object.is(current, -0) ? "0" : String(current);
    }
    if (typeof current === "undefined") throw new TypeError(`canonical JSON cannot contain undefined at ${path}`);
    if (typeof current === "function") throw new TypeError(`canonical JSON cannot contain a function at ${path}`);
    if (typeof current === "symbol") throw new TypeError(`canonical JSON cannot contain a symbol at ${path}`);
    if (typeof current === "bigint") throw new TypeError(`canonical JSON cannot contain a bigint at ${path}`);

    if (ancestors.has(current)) throw new TypeError(`canonical JSON cannot contain a cyclic reference at ${path}`);
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        const items: string[] = [];
        for (let index = 0; index < current.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, index);
          if (!descriptor) {
            throw new TypeError(`canonical JSON cannot contain a sparse array entry at ${path}[${index}]`);
          }
          if (!("value" in descriptor)) {
            throw new TypeError(`canonical JSON cannot evaluate an accessor at ${path}[${index}]`);
          }
          items.push(serialize(descriptor.value, `${path}[${index}]`));
        }
        return `[${items.join(",")}]`;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`canonical JSON requires a plain object at ${path}`);
      }
      if (Object.getOwnPropertySymbols(current).length > 0) {
        throw new TypeError(`canonical JSON cannot contain symbol keys at ${path}`);
      }

      const record = current as Record<string, unknown>;
      const descriptors = Object.getOwnPropertyDescriptors(record);
      const entries = Object.keys(record).sort().map((key) => {
        const descriptor = descriptors[key];
        if (!descriptor || !("value" in descriptor)) {
          throw new TypeError(`canonical JSON cannot evaluate an accessor at ${path}.${key}`);
        }
        return `${quote(key)}:${serialize(descriptor.value, `${path}.${key}`)}`;
      });
      return `{${entries.join(",")}}`;
    } finally {
      ancestors.delete(current);
    }
  };

  return serialize(value, "$");
}

/** Return the lowercase SHA-256 digest of the exact UTF-8 input. */
export function stableHash(text: string): string {
  if (typeof text !== "string") throw new TypeError("stableHash requires a string");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Create a deterministic Mulberry32 stream from the first 32 bits of a SHA-256 digest. */
export function seededRandom(seed: string): () => number {
  if (typeof seed !== "string" || !/^[a-f0-9]{64}$/iu.test(seed)) {
    throw new TypeError("seededRandom requires a 64-character hexadecimal SHA-256 seed");
  }
  let state = Number.parseInt(seed.slice(0, 8), 16) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
