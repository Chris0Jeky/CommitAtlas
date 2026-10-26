// Vite replaces this token with a validated checkout SHA or null while building.
// Source-only development has no compiled identity. Runtime bindings are never consulted.
declare const __COMMIT_ATLAS_BUILD_SHA__: unknown;
const candidate = typeof __COMMIT_ATLAS_BUILD_SHA__ === "undefined" ? null : __COMMIT_ATLAS_BUILD_SHA__;
export const BUILD_SHA: string | null = typeof candidate === "string"
  && candidate.length === 40 && /^[a-f\d]+$/.test(candidate) ? candidate : null;
