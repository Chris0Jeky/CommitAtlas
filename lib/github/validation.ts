import type { ProjectLifecycle } from "./types";

const HANDLE = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const REPOSITORY = /^(?!\.\.?$)[a-z\d._-]{1,100}$/i;
const LIFECYCLES = new Set<ProjectLifecycle>([
  "active",
  "maintenance",
  "paused",
  "archived",
  "unknown",
]);

export class InputError extends Error {
  readonly code = "invalid_input";
}

export function parseGitHubHandle(value: string | null, label = "user"): string {
  const candidate = value?.trim() ?? "";
  if (!HANDLE.test(candidate)) {
    throw new InputError(`${label} must be a valid GitHub handle`);
  }
  return candidate;
}

export function parseRepositoryNames(value: string | null): string[] {
  const values = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0 || values.length > 6) {
    throw new InputError("repos must contain between one and six repository names");
  }
  if (values.some((name) => !REPOSITORY.test(name))) {
    throw new InputError("repos contains an invalid repository name");
  }
  const deduplicated = [...new Map(values.map((name) => [name.toLowerCase(), name])).values()];
  if (deduplicated.length !== values.length) {
    throw new InputError("repos must not contain duplicates");
  }
  return deduplicated;
}

export function parseLifecycleMap(value: string | null): ReadonlyMap<string, ProjectLifecycle> {
  if (!value) return new Map();
  if (value.length > 500) throw new InputError("states is too long");

  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const result = new Map<string, ProjectLifecycle>();
  for (const entry of entries) {
    const separator = entry.lastIndexOf(":");
    if (separator <= 0) throw new InputError("states must use repo:lifecycle entries");
    const repo = entry.slice(0, separator);
    const lifecycle = entry.slice(separator + 1) as ProjectLifecycle;
    if (!REPOSITORY.test(repo) || !LIFECYCLES.has(lifecycle)) {
      throw new InputError("states contains an invalid repository or lifecycle");
    }
    if (result.has(repo.toLowerCase())) throw new InputError("states contains duplicate repositories");
    result.set(repo.toLowerCase(), lifecycle);
  }
  return result;
}

export function parseDemo(value: string | null): boolean {
  if (value === null || value === "false") return false;
  if (value === "true") return true;
  throw new InputError("demo must be true or false");
}

export function rejectUnknownParameters(
  parameters: URLSearchParams,
  allowed: readonly string[],
): void {
  const allowlist = new Set(allowed);
  for (const key of parameters.keys()) {
    if (!allowlist.has(key)) throw new InputError(`unknown query parameter: ${key}`);
  }
}

export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

export function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
