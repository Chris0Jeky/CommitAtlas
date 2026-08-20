import { ProjectLifecycleSchema, type ProjectLifecycle } from "@/packages/core/src/index";
import type { ProjectWorkflow } from "./types";

const HANDLE = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const REPOSITORY = /^(?!\.\.?$)[a-z\d._-]{1,100}$/i;
const MAX_WORKFLOW_CODE_POINTS = 200;
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

export function parseLifecycleMap(
  value: string | null,
  repositories: readonly string[],
): ReadonlyMap<string, ProjectLifecycle> {
  if (!value) throw new InputError("states must declare a lifecycle for every repository");
  if (value.length > 500) throw new InputError("states is too long");

  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const result = new Map<string, ProjectLifecycle>();
  for (const entry of entries) {
    const separator = entry.lastIndexOf(":");
    if (separator <= 0) throw new InputError("states must use repo:lifecycle entries");
    const repo = entry.slice(0, separator);
    const lifecycleValue = entry.slice(separator + 1);
    const lifecycle = ProjectLifecycleSchema.safeParse(lifecycleValue);
    if (!REPOSITORY.test(repo) || !lifecycle.success) {
      throw new InputError("states contains an invalid repository or lifecycle");
    }
    if (result.has(repo.toLowerCase())) throw new InputError("states contains duplicate repositories");
    result.set(repo.toLowerCase(), lifecycle.data);
  }
  if (result.size !== repositories.length || repositories.some((repository) => !result.has(repository.toLowerCase()))) {
    throw new InputError("states must declare exactly one lifecycle for every repository");
  }
  return result;
}

/**
 * An optional, repository-aligned subset. Omitted repositories deliberately
 * have no configured CI workflow and must not trigger a broad runs lookup.
 */
export function parseWorkflowMap(
  value: string | null,
  repositories: readonly string[],
): ReadonlyMap<string, ProjectWorkflow> {
  const result = new Map<string, ProjectWorkflow>();
  if (value === null || value === "") return result;
  if (value.length > 1_500) throw new InputError("workflows is too long");

  const requested = new Set(repositories.map((repository) => repository.toLowerCase()));
  const entries = value.split(",");
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    const separator = entry.lastIndexOf(":");
    if (separator <= 0) throw new InputError("workflows must use repo:workflow entries");
    const repo = entry.slice(0, separator);
    const workflow = entry.slice(separator + 1);
    if (!REPOSITORY.test(repo) || !isWorkflowIdentity(workflow)) {
      throw new InputError("workflows contains an invalid repository or workflow");
    }
    const key = repo.toLowerCase();
    if (!requested.has(key)) throw new InputError("workflows may only declare requested repositories");
    if (result.has(key)) throw new InputError("workflows contains duplicate repositories");
    result.set(key, workflow);
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
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
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

function isWorkflowIdentity(value: string): value is ProjectWorkflow {
  return value === value.trim()
    && [...value].length >= 1
    && [...value].length <= MAX_WORKFLOW_CODE_POINTS
    && !/[\u0000-\u001f\u007f]/.test(value);
}
