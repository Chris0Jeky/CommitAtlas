import { z } from "zod";

/** The public contract version used by every core value. */
export const CORE_VERSION = 1 as const;

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HANDLE_PATTERN = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const REPO_NAME_PATTERN = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._-]{1,100}$/;

function isUtcDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const UtcDateSchema = z.string().refine(isUtcDate, "Expected an ISO UTC date (YYYY-MM-DD)");
const VersionSchema = z.literal(CORE_VERSION);

export const GitHubHandleInputSchema = z.object({
  version: VersionSchema,
  handle: z.string().trim().regex(HANDLE_PATTERN, "Invalid GitHub handle"),
}).strict();
export type GitHubHandleInput = z.infer<typeof GitHubHandleInputSchema>;
export const GitHubHandleSchema = GitHubHandleInputSchema;

export const GitHubRepoInputSchema = z.object({
  version: VersionSchema,
  owner: z.string().trim().regex(HANDLE_PATTERN, "Invalid GitHub owner"),
  name: z.string().trim().regex(REPO_NAME_PATTERN, "Invalid GitHub repository name"),
}).strict();
export type GitHubRepoInput = z.infer<typeof GitHubRepoInputSchema>;
export const GitHubRepoSchema = GitHubRepoInputSchema;

export function parseHandle(input: unknown): GitHubHandleInput {
  const parsed = GitHubHandleInputSchema.parse(input);
  return { ...parsed, handle: parsed.handle.toLowerCase() };
}

export function parseRepo(input: unknown): GitHubRepoInput {
  const parsed = GitHubRepoInputSchema.parse(input);
  return { ...parsed, owner: parsed.owner.toLowerCase() };
}

export function repoSlug(repo: GitHubRepoInput): string {
  const parsed = parseRepo(repo);
  return `${parsed.owner}/${parsed.name}`;
}

/** Hosts used by documented project actions. Links are displayed, never fetched by core. */
export const ALLOWED_LINK_HOSTS = [
  "bitbucket.org",
  "cloudflare.com",
  "crates.io",
  "docs.github.com",
  "github.com",
  "gitlab.com",
  "npmjs.com",
  "pypi.org",
  "raw.githubusercontent.com",
  "readthedocs.io",
  "vercel.com",
  "www.github.com",
  "www.npmjs.com",
] as const;

const ProjectLinkSchema = z.string().trim().max(2_048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_LINK_HOSTS.includes(url.hostname.toLowerCase() as (typeof ALLOWED_LINK_HOSTS)[number]) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Link must be an HTTPS URL on an allowed host");

export const ProjectLifecycleSchema = z.enum(["planned", "active", "maintenance", "paused", "archived"]);
export type ProjectLifecycle = z.infer<typeof ProjectLifecycleSchema>;

export const ProjectLinksSchema = z.object({
  docs: ProjectLinkSchema.optional(),
  install: ProjectLinkSchema.optional(),
  download: ProjectLinkSchema.optional(),
}).strict();
export type ProjectLinks = z.infer<typeof ProjectLinksSchema>;

const ProjectManifestEntrySchema = z.object({
  repo: z.string().trim().regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/, "Expected owner/repository"),
  label: z.string().trim().min(1).max(80),
  lifecycle: ProjectLifecycleSchema,
  workflow: z.string().trim().max(200).optional(),
  links: ProjectLinksSchema.default({}),
}).strict();

export const ProjectManifestSchema = z.object({
  version: VersionSchema,
  projects: z.array(ProjectManifestEntrySchema).min(1).max(6),
}).strict();
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
export type ProjectManifestEntry = ProjectManifest["projects"][number];
export const GitHubManifestInputSchema = ProjectManifestSchema;
export type GitHubManifestInput = ProjectManifest;

export function parseManifest(input: unknown): ProjectManifest {
  const parsed = ProjectManifestSchema.parse(input);
  return {
    version: CORE_VERSION,
    projects: parsed.projects.map((project) => ({
      ...project,
      repo: project.repo.split("/").map((part, index) => index === 0 ? part.toLowerCase() : part).join("/"),
      label: project.label.trim(),
    })),
  };
}

export const ContributionDaySchema = z.object({
  date: UtcDateSchema,
  count: z.number().int().min(0).max(100_000),
  level: z.number().int().min(0).max(4).default(0),
}).strict();
export type ContributionDay = z.infer<typeof ContributionDaySchema>;

export const ContributionCalendarSchema = z.object({
  version: VersionSchema,
  days: z.array(ContributionDaySchema).min(1).max(400),
}).strict();
export type ContributionCalendar = z.infer<typeof ContributionCalendarSchema>;

function parseDays(input: unknown): ContributionDay[] {
  const days = Array.isArray(input) ? input : ContributionCalendarSchema.parse(input).days;
  const parsed = z.array(ContributionDaySchema).max(400).parse(days);
  const sorted = [...parsed].sort((a, b) => a.date.localeCompare(b.date));
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1]?.date === sorted[index]?.date) throw new Error(`Duplicate contribution date: ${sorted[index]?.date}`);
  }
  return sorted;
}

export function parseContributionCalendar(input: unknown): ContributionCalendar {
  const parsed = ContributionCalendarSchema.parse(input);
  return { version: CORE_VERSION, days: parseDays(parsed.days) };
}

export function contributionCalendarDays(input: unknown): ContributionDay[] {
  return parseContributionCalendar(input).days;
}

function addUtcDays(date: string, offset: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}

function dateDistance(left: string, right: string): number {
  return Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / 86_400_000);
}

export const StreakOptionsSchema = z.object({ asOf: UtcDateSchema }).strict();
export type StreakOptions = z.infer<typeof StreakOptionsSchema>;

export interface StreakSummary {
  version: typeof CORE_VERSION;
  asOf: string;
  current: number;
  longest: number;
}

export function calculateStreaks(input: unknown, options: StreakOptions): StreakSummary {
  const days = parseDays(input);
  const { asOf } = StreakOptionsSchema.parse(options);
  const boundedDays = days.filter((day) => day.date <= asOf);
  const counts = new Map(boundedDays.map((day) => [day.date, day.count]));
  let current = 0;
  for (let date = asOf; (counts.get(date) ?? 0) > 0; date = addUtcDays(date, -1)) current += 1;

  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (const day of boundedDays) {
    if (day.count > 0 && previous !== undefined && dateDistance(previous, day.date) === 1) run += 1;
    else run = day.count > 0 ? 1 : 0;
    if (run > longest) longest = run;
    previous = day.date;
  }
  return { version: CORE_VERSION, asOf, current, longest };
}

export const ActivityOptionsSchema = z.object({
  asOf: UtcDateSchema,
  days: z.number().int().min(1).max(366).default(30),
}).strict();
export type ActivityOptions = z.infer<typeof ActivityOptionsSchema>;

export interface ActivityPoint {
  date: string;
  count: number;
  level: number;
}

export interface ActivitySeries {
  version: typeof CORE_VERSION;
  from: string;
  to: string;
  total: number;
  points: ActivityPoint[];
}

export function calculateActivitySeries(input: unknown, options: ActivityOptions): ActivitySeries {
  const days = parseDays(input);
  const { asOf, days: window } = ActivityOptionsSchema.parse(options);
  const from = addUtcDays(asOf, -(window - 1));
  const values = new Map(days.map((day) => [day.date, day]));
  const points: ActivityPoint[] = [];
  for (let offset = 0; offset < window; offset += 1) {
    const date = addUtcDays(from, offset);
    const value = values.get(date);
    points.push({ date, count: value?.count ?? 0, level: value?.level ?? 0 });
  }
  return { version: CORE_VERSION, from, to: asOf, total: points.reduce((sum, point) => sum + point.count, 0), points };
}

export const buildActivitySeries = calculateActivitySeries;

const LanguageBytesSchema = z.record(z.string().trim().min(1).max(80), z.number().finite().int().min(0).max(MAX_SAFE_INTEGER)).superRefine((value, context) => {
  if (Object.keys(value).length > 50) context.addIssue({ code: "custom", message: "A repository may contain at most 50 languages" });
});
export const LanguageRepositorySchema = z.object({
  repo: z.string().trim().regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/),
  languages: LanguageBytesSchema,
}).strict();
export type LanguageRepository = z.infer<typeof LanguageRepositorySchema>;

export interface LanguageShare {
  language: string;
  bytes: number;
  percentage: number;
}

export interface LanguageAggregation {
  version: typeof CORE_VERSION;
  basis: "repository-language-bytes";
  notProficiency: true;
  totalBytes: number;
  languages: LanguageShare[];
}

export function aggregateLanguages(input: unknown): LanguageAggregation {
  const repositories = z.array(LanguageRepositorySchema).max(100).parse(input);
  const totals = new Map<string, number>();
  for (const repository of repositories) {
    for (const [language, bytes] of Object.entries(repository.languages)) {
      const key = language.trim();
      const total = (totals.get(key) ?? 0) + bytes;
      if (total > MAX_SAFE_INTEGER) throw new Error("Language byte totals exceed the safe integer bound");
      totals.set(key, total);
    }
  }
  const totalBytes = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const languages = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .sort(([, left], [, right]) => right - left)
    .map(([language, bytes]) => ({ language, bytes, percentage: totalBytes === 0 ? 0 : Number(((bytes / totalBytes) * 100).toFixed(2)) }));
  return { version: CORE_VERSION, basis: "repository-language-bytes", notProficiency: true, totalBytes, languages };
}

export const CiStateSchema = z.enum(["unavailable", "unconfigured", "stale", "passing", "failing", "pending"]);
export type CiState = z.infer<typeof CiStateSchema>;
const CiConclusionSchema = z.enum(["success", "failure", "cancelled", "neutral", "timed_out", "action_required", "in_progress", "queued"]);
const CiObservationSchema = z.object({
  available: z.boolean(),
  configured: z.boolean(),
  conclusion: CiConclusionSchema.optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export type CiObservation = z.infer<typeof CiObservationSchema>;

export interface CiStatus {
  state: CiState;
  updatedAt?: string;
  reason: string;
}

export function calculateCiState(input: unknown, now: string, staleAfterHours = 72): CiStatus {
  const observation = CiObservationSchema.parse(input);
  const current = z.string().datetime({ offset: true }).parse(now);
  if (!Number.isInteger(staleAfterHours) || staleAfterHours < 1 || staleAfterHours > 8_760) throw new Error("staleAfterHours must be between 1 and 8760");
  if (!observation.available) return { state: "unavailable", reason: "CI data is unavailable" };
  if (!observation.configured) return { state: "unconfigured", reason: "No CI workflow is configured" };
  if (!observation.updatedAt || Date.parse(current) - Date.parse(observation.updatedAt) > staleAfterHours * 3_600_000) {
    return { state: observation.updatedAt ? "stale" : "unavailable", ...(observation.updatedAt ? { updatedAt: observation.updatedAt } : {}), reason: observation.updatedAt ? "CI data is older than the freshness window" : "CI has no observed run" };
  }
  const state: CiState = observation.conclusion === "success" ? "passing" : observation.conclusion === "failure" || observation.conclusion === "cancelled" || observation.conclusion === "timed_out" ? "failing" : observation.conclusion === "in_progress" || observation.conclusion === "queued" ? "pending" : "unavailable";
  return { state, updatedAt: observation.updatedAt, reason: state === "unavailable" ? "CI conclusion is unknown" : `CI is ${state}` };
}

export interface ProjectState {
  version: typeof CORE_VERSION;
  repo: string;
  label: string;
  lifecycle: ProjectLifecycle;
  links: ProjectLinks;
  ci: CiStatus;
}

export function calculateProjectState(input: unknown, ci: unknown, now: string, staleAfterHours = 72): ProjectState {
  const entry = ProjectManifestEntrySchema.parse(input);
  const parsedRepo = entry.repo.split("/");
  return { version: CORE_VERSION, repo: `${parsedRepo[0]?.toLowerCase()}/${parsedRepo[1]}`, label: entry.label, lifecycle: entry.lifecycle, links: entry.links, ci: calculateCiState(ci, now, staleAfterHours) };
}

const BooleanOptionSchema = z.union([z.boolean(), z.enum(["true", "false"]) ]);
function optionInteger(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  throw new Error(`${name} must be an integer`);
}

export interface CoreOptions {
  version: typeof CORE_VERSION;
  theme: "light" | "dark";
  locale: string;
  showTitle: boolean;
  days: number;
  limit: number;
  staleAfterHours: number;
}

export function parseOptions(input: unknown = {}): CoreOptions {
  const raw = z.record(z.string(), z.unknown()).parse(input);
  const known = ["version", "theme", "locale", "showTitle", "days", "limit", "staleAfterHours"];
  for (const key of Object.keys(raw)) if (!known.includes(key)) throw new Error(`Unknown option: ${key}`);
  const version = raw.version === undefined || raw.version === "1" ? CORE_VERSION : raw.version;
  if (version !== CORE_VERSION) throw new Error("Unsupported core contract version");
  const theme = raw.theme === undefined ? "dark" : z.enum(["light", "dark"]).parse(raw.theme);
  const locale = raw.locale === undefined ? "en" : z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).parse(raw.locale);
  const showTitle = raw.showTitle === undefined ? true : BooleanOptionSchema.parse(raw.showTitle) === true || raw.showTitle === "true";
  const days = optionInteger(raw.days, "days") ?? 30;
  const limit = optionInteger(raw.limit, "limit") ?? 6;
  const staleAfterHours = optionInteger(raw.staleAfterHours, "staleAfterHours") ?? 72;
  if (days < 1 || days > 366) throw new Error("days must be between 1 and 366");
  if (limit < 1 || limit > 6) throw new Error("limit must be between 1 and 6");
  if (staleAfterHours < 1 || staleAfterHours > 8_760) throw new Error("staleAfterHours must be between 1 and 8760");
  return { version: CORE_VERSION, theme, locale, showTitle, days, limit, staleAfterHours };
}

export type { z };
