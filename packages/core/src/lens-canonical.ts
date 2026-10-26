// Producer RFC 8785 canonicalizer and privacy tokens, pinned with lens-projection.ts.
function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) return true
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) return true
  }
  return false
}

export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string' && hasLoneSurrogate(value)) throw new Error('JCS rejects lone surrogates')
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS rejects non-finite numbers')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) if (!(index in value)) throw new Error('JCS rejects sparse arrays')
    return `[${value.map(canonicalizeJson).join(',')}]`
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    const prototype = Object.getPrototypeOf(object)
    if (prototype !== Object.prototype && prototype !== null) throw new Error('JCS accepts plain objects only')
    if (Object.prototype.hasOwnProperty.call(object, 'toJSON')) throw new Error('JCS rejects toJSON')
    return `{${Object.keys(object).sort().map((key) => {
      if (hasLoneSurrogate(key)) throw new Error('JCS rejects lone surrogates')
      return `${JSON.stringify(key)}:${canonicalizeJson(object[key])}`
    }).join(',')}}`
  }
  throw new Error('JCS rejects unsupported values')
}
export const DENIED_TOKEN = /(?:@[^\s@]|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}|(?:[A-Za-z]:\\|\/|\\)[^\s"']+|\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b)/u
export const DATE_TOKEN = /\b\d{4}-\d{2}-\d{2}\b/
