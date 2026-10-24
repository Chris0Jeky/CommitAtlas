export const MAX_WORKFLOW_CODE_POINTS = 200;

/**
 * The single workflow-identity rule shared by the projects API and the Studio form:
 * already trimmed, 1-200 code points, no `.`/`..` path segments, no C0/DEL/C1 controls.
 * Pure on purpose so browser code can import it without pulling in server modules.
 */
export function isWorkflowIdentity(value: string): boolean {
  return value === value.trim()
    && [...value].length >= 1
    && [...value].length <= MAX_WORKFLOW_CODE_POINTS
    && !value.split(/[\\/]/).some((segment) => segment === "." || segment === "..")
    && ![...value].some((character) => {
      const code = character.codePointAt(0)!;
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    });
}

/**
 * Escape the two route-map delimiters without changing ordinary workflow identities.
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
