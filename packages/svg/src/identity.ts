/** Static owner-supplied text only; this adapter grants no projection or hosted-input authority. */
declare const identityBrand: unique symbol;
export interface IdentityConfig {
  readonly name: string;
  readonly tagline?: string;
  readonly focus: readonly string[];
  readonly [identityBrand]: true;
}
const identities = new WeakSet<object>();

function identityText(value: unknown, maximum: number, label: string): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > maximum) {
    throw new Error(`invalid identity ${label}`);
  }
  return value;
}

/** Closed data-only schema. Never evaluate caller getters, retain arrays, or accept sparse lists. */
export function createIdentityConfig(value: unknown): IdentityConfig {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error("identity must be a plain object");
  }
  const fields: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !["name", "tagline", "focus"].includes(key)) throw new Error("unknown identity field");
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor)) throw new Error("identity accessors are forbidden");
    fields[key] = descriptor.value;
  }
  const name = identityText(fields.name, 40, "name");
  const tagline = fields.tagline === undefined ? undefined : identityText(fields.tagline, 80, "tagline");
  const inputFocus: unknown = fields.focus === undefined ? [] : fields.focus;
  if (!Array.isArray(inputFocus) || inputFocus.length > 3) throw new Error("invalid identity focus");
  for (const key of Reflect.ownKeys(inputFocus)) {
    if (key !== "length" && !["0", "1", "2"].slice(0, inputFocus.length).includes(key as string)) {
      throw new Error("unknown identity focus field");
    }
  }
  const focus: string[] = [];
  for (let i = 0; i < inputFocus.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(inputFocus, i);
    if (!descriptor || !("value" in descriptor)) throw new Error("identity focus must contain data entries, not accessors or holes");
    focus.push(identityText(descriptor.value, 24, "focus entry"));
  }
  const result = Object.freeze({ name, ...(tagline !== undefined ? { tagline } : {}), focus: Object.freeze(focus) }) as IdentityConfig;
  identities.add(result);
  return result;
}

/** Internal engine provenance check. Cloning a validated identity does not retain its authority. */
export function isIdentityConfig(value: unknown): value is IdentityConfig {
  return typeof value === "object" && value !== null && identities.has(value);
}
