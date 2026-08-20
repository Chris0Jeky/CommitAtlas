/**
 * Escape the two map delimiters without changing ordinary workflow identities.
 * Percent is escaped first so literal escape-looking text round-trips unchanged.
 */
export function encodeWorkflowMapComponent(value: string): string {
  return value
    .replace(/%/g, "%25")
    .replace(/,/g, "%2C")
    .replace(/:/g, "%3A");
}

export function decodeWorkflowMapComponent(value: string): string {
  return value
    .replace(/%2c/gi, ",")
    .replace(/%3a/gi, ":")
    .replace(/%25/gi, "%");
}
