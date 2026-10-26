// Ported without compatibility aliases from Developer Lens at the contract pin below.
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { DATE_TOKEN, DENIED_TOKEN, canonicalizeJson } from './lens-canonical.js'

/**
 * `PublicLensProjection.v1` — the producer-owned, strict projection of a `PortableExportPayload`
 * that CommitAtlas renders on a profile. The zod schema below is the single source: the published
 * JSON Schema is generated from it (`scripts/generateLensProjection.ts`), and every semantic,
 * provenance and privacy rule that JSON Schema cannot express runs in `superRefine`, so parsing
 * with `PublicLensProjectionSchema` is the complete acceptance check.
 */

export const LENS_PROJECTION_SCHEMA_VERSION = 'PublicLensProjection.v1' as const
export const LENS_PROJECTION_PRODUCER = 'developer-lens' as const
export const LENS_PROJECTION_SHOWCASE_URL = 'https://chris0jeky.github.io/developer-lens/' as const

/**
 * The tracked C0 fixture pins its provenance instead of reading the clock or HEAD, so it does not
 * churn per commit. `producerCommit` anchors the Developer Lens main commit whose synthetic showcase
 * generator the fixture is projected from; it is not a self-reference. Consumers pin the commit
 * that publishes the fixture externally, exactly as the ResearchFinding seam does.
 */
export const LENS_PROJECTION_FIXTURE_PRODUCER_COMMIT = 'd05533bbe17b3db524f9d404ef6c4a95a482e4bd' as const
export const LENS_PROJECTION_FIXTURE_GENERATED_AT = '2026-09-01T12:00:00Z' as const
export const LENS_PROJECTION_FIXTURE_RANGE = '12m' as const

export const DNA_KEYS = ['focus', 'shipping', 'collaboration', 'consistency', 'breadth', 'stewardship'] as const
export type LensDnaKey = (typeof DNA_KEYS)[number]

/** Registry order is also the tie-break order when two themes carry the same share. */
export const THEME_KEYS = ['feat', 'fix', 'docs', 'test', 'refactor', 'chore', 'perf', 'revert', 'other'] as const
export type LensThemeKey = (typeof THEME_KEYS)[number]

/**
 * The closed v1 `CoverageWarningCode` registry. Exactly eight codes, so a de-duplicated warning
 * list can never exceed the eight-item bound. Each code has exactly one display text.
 */
export const COVERAGE_WARNINGS = {
  synthetic_showcase: 'Synthetic showcase data; these statistics do not describe a person.',
  commit_detail_partial: 'Commit detail was incomplete or reconstructed for some repositories.',
  search_detail_capped: 'Pull-request or issue detail was capped; totals keep the larger count.',
  review_detail_partial: 'Review detail was capped, so review coverage may be partial.',
  line_changes_partial: 'Authored line statistics were unavailable for some repositories.',
  private_activity_aggregated: 'Some restricted private contributions are counted only in aggregate.',
  local_git_partial: 'Local Git enrichment was unavailable or excluded some repositories.',
  unrecognized_warning: 'Another collection warning was recorded; its detail stays local.',
} as const
export type CoverageWarningCode = keyof typeof COVERAGE_WARNINGS
export const COVERAGE_WARNING_CODES = Object.keys(COVERAGE_WARNINGS) as CoverageWarningCode[]

/**
 * Free-text `DashboardMeta.warnings` → code. The warning text itself never crosses this boundary:
 * the producer's templates interpolate repository names and counts, so only the matched code is
 * exported. A warning no rule recognizes maps deterministically to `unrecognized_warning` rather
 * than being dropped or copied.
 */
const WARNING_RULES: ReadonlyArray<{ code: CoverageWarningCode; pattern: RegExp }> = [
  { code: 'synthetic_showcase', pattern: /hosted showcase demonstrates the analytical engine|this is illustrative data/i },
  { code: 'commit_detail_partial', pattern: /more than 100 active commit days|could not be queried for detailed authored commits/i },
  { code: 'search_detail_capped', pattern: /capped authored (?:pull-request|issue) detail/i },
  { code: 'review_detail_partial', pattern: /review records were inspected|capped reviewed pull requests/i },
  { code: 'line_changes_partial', pattern: /could not be queried for authored line statistics/i },
  { code: 'private_activity_aggregated', pattern: /restricted by GitHub privacy rules/i },
  { code: 'local_git_partial', pattern: /local Git enrichment was skipped|excluded from local enrichment/i },
]

export function coverageWarningCode(warning: string): CoverageWarningCode {
  return WARNING_RULES.find((rule) => rule.pattern.test(warning))?.code ?? 'unrecognized_warning'
}

/** De-duplicated, registry-ordered warning entries for a list of free-text warnings. */
export function mapCoverageWarnings(warnings: readonly string[]): Array<{ code: CoverageWarningCode; displayText: string }> {
  const codes = new Set(warnings.map(coverageWarningCode))
  return COVERAGE_WARNING_CODES.filter((code) => codes.has(code)).map((code) => ({ code, displayText: COVERAGE_WARNINGS[code] }))
}

export interface LensCoverageCounts {
  complete: number
  partial: number
  unavailable: number
  total: number
}

function scorePercentFor(counts: LensCoverageCounts, scoredSources: number): number {
  if (scoredSources <= 0) return 0
  const ratio = Math.round(((counts.complete + 0.65 * counts.partial) / scoredSources) * 100) / 100
  return Math.round(ratio * 100)
}

/**
 * The `scorePercent` values the counts admit, mirroring `calculateCoverage` in
 * `server/analytics.ts`: complete sources weigh 1, partial 0.65, unavailable 0; the ratio is
 * rounded to two decimals and then expressed as an integer percent. The denominator is `total`,
 * or `total - 1` when the one optional source analytics excludes (an unavailable local Git
 * enrichment) is among the unavailable sources — the counts alone cannot say which, so both are
 * admitted when `unavailable >= 1`.
 */
export function coverageScorePercentCandidates(counts: LensCoverageCounts): number[] {
  const candidates = new Set([scorePercentFor(counts, counts.total)])
  if (counts.unavailable >= 1) candidates.add(scorePercentFor(counts, counts.total - 1))
  return [...candidates].sort((left, right) => left - right)
}

const ALIAS_LABEL = /^Project [A-Z][a-z]+(?: [1-9][0-9]{0,2})?$/
const NARRATIVE_EXTRA_DENIED = /#\d|\bhttps?:|\bwww\./i
const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
const WORDED_DATE = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)? ${MONTHS},? \\d{4}|${MONTHS}\\.? \\d{1,2}(?:st|nd|rd|th)?,? \\d{4}|${MONTHS} \\d{4})\\b`, 'i')

/**
 * Denied content. Reuses the ResearchFinding `DENIED_TOKEN` (handles — including digit-,
 * underscore- and non-ASCII-leading ones — emails, paths and `owner/repo` tokens) and
 * `DATE_TOKEN` unchanged, adds worded absolute dates, and additionally denies `#number`, URL
 * schemes and `www.` inside narratives. `generatedAt` is the only admitted date and
 * `provenance.showcaseUrl` the only admitted URL.
 */
export function lensProjectionPrivacyViolations(value: unknown): string[] {
  const violations: string[] = []
  const visit = (item: unknown, path: string): void => {
    if (typeof item === 'string') {
      if (path === '$.provenance.showcaseUrl') {
        if (item !== LENS_PROJECTION_SHOWCASE_URL) violations.push('non-allowlisted showcaseUrl')
        return
      }
      if (path === '$.generatedAt') return
      if (DATE_TOKEN.test(item) || WORDED_DATE.test(item)) violations.push('absolute date outside generatedAt')
      if (DENIED_TOKEN.test(item)) violations.push('denied identity, email, handle, path, URL, or repository token')
      if (path.startsWith('$.narratives[') && NARRATIVE_EXTRA_DENIED.test(item)) violations.push('URL, www, or #number in a narrative')
    } else if (Array.isArray(item)) item.forEach((nested, index) => visit(nested, `${path}[${index}]`))
    else if (item && typeof item === 'object') Object.entries(item).forEach(([key, nested]) => visit(nested, `${path}.${key}`))
  }
  visit(value, '$')
  return [...new Set(violations)]
}

const count = z.number().int().min(0).max(1_000_000)
const share = z.number().finite().min(0).max(1)
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const boundedText = (max: number) => z.string().min(1).max(max).regex(/\S/)
const canonicalUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/).superRefine((value, ctx) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString().replace('.000Z', 'Z') !== value) {
    ctx.addIssue({ code: 'custom', message: 'generatedAt must be a valid canonical UTC instant' })
  }
})

const dnaEntry = (key: LensDnaKey) => z.strictObject({ key: z.literal(key), value: share })
const warningEntries = COVERAGE_WARNING_CODES.map((code) => z.strictObject({ code: z.literal(code), displayText: z.literal(COVERAGE_WARNINGS[code]) }))
const warning = z.discriminatedUnion('code', warningEntries as unknown as [typeof warningEntries[number], ...typeof warningEntries[number][]])

const repository = z.strictObject({
  label: boundedText(40),
  disclosure: z.enum(['synthetic', 'public-name', 'private-alias', 'masked-alias']),
  primaryLanguage: boundedText(32).optional(),
  attentionShare: share,
  activeWeeks: count,
  momentum: z.number().finite().min(-1).max(1),
  mergedPullRequests: count,
  reviews: count,
})

const PublicLensProjectionContentSchema = z.strictObject({
  schemaVersion: z.literal(LENS_PROJECTION_SCHEMA_VERSION),
  dataClass: z.enum(['C0', 'C1']),
  scope: z.enum(['public-demo', 'redacted-local']),
  generatedAt: canonicalUtc,
  range: z.enum(['6m', '12m']),
  rangeLabel: boundedText(40),
  repositoryRedaction: z.enum(['synthetic', 'private-aliases', 'all-aliases']),
  privacyNote: boundedText(240),
  summary: z.strictObject({
    commits: count,
    mergedPullRequests: count,
    reviews: count,
    issues: count,
    activeDays: count,
    activeWeeks: count,
    repositories: count,
  }),
  dna: z.tuple([dnaEntry('focus'), dnaEntry('shipping'), dnaEntry('collaboration'), dnaEntry('consistency'), dnaEntry('breadth'), dnaEntry('stewardship')]),
  archetype: z.strictObject({ name: boundedText(40), description: boundedText(160) }),
  repositories: z.array(repository).max(12),
  themes: z.array(z.strictObject({ key: z.enum(THEME_KEYS), share })).max(9),
  delivery: z.strictObject({
    mergedSamples: z.number().int().min(1).max(1_000_000),
    medianMergeHours: z.number().finite().min(0).max(100_000),
    openAtRangeEnd: count,
    censored: z.boolean(),
  }).optional(),
  narratives: z.array(z.strictObject({
    order: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    title: boundedText(80),
    body: boundedText(280),
    limitation: boundedText(200),
  })).max(3),
  coverage: z.strictObject({
    complete: count,
    partial: count,
    unavailable: count,
    total: count,
    scorePercent: z.number().int().min(0).max(100),
    warnings: z.array(warning).max(8),
  }),
  provenance: z.strictObject({
    producer: z.literal(LENS_PROJECTION_PRODUCER),
    producerVersion: z.string().max(32).regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/),
    producerCommit: z.string().regex(/^[0-9a-f]{40}$/),
    inputHash: sha256,
    projectionHash: sha256,
    showcaseUrl: z.literal(LENS_PROJECTION_SHOWCASE_URL).optional(),
  }),
}).superRefine((value, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })
  const c0 = value.dataClass === 'C0'
  if (c0 !== (value.scope === 'public-demo')) issue(['scope'], 'dataClass C0 requires scope public-demo and C1 requires redacted-local')
  if (c0 !== (value.repositoryRedaction === 'synthetic')) issue(['repositoryRedaction'], 'repositoryRedaction synthetic is exactly the C0 redaction')
  if (!c0 && value.provenance.showcaseUrl !== undefined) issue(['provenance', 'showcaseUrl'], 'showcaseUrl is admitted only on the C0 showcase projection')
  const allowedDisclosures: Record<typeof value.repositoryRedaction, readonly string[]> = {
    synthetic: ['synthetic'],
    'private-aliases': ['public-name', 'private-alias'],
    'all-aliases': ['masked-alias'],
  }
  value.repositories.forEach((item, index) => {
    if (!allowedDisclosures[value.repositoryRedaction].includes(item.disclosure)) issue(['repositories', index, 'disclosure'], `disclosure ${item.disclosure} is not admitted under ${value.repositoryRedaction}`)
    if ((item.disclosure === 'private-alias' || item.disclosure === 'masked-alias') && !ALIAS_LABEL.test(item.label)) issue(['repositories', index, 'label'], 'an aliased repository label must match the alias pattern')
    if (index > 0 && item.attentionShare > value.repositories[index - 1].attentionShare) issue(['repositories', index, 'attentionShare'], 'repositories must be ordered by attentionShare descending')
  })
  const labels = value.repositories.map((item) => item.label)
  if (new Set(labels).size !== labels.length) issue(['repositories'], 'repository labels must be unique')
  if (value.repositories.reduce((sum, item) => sum + item.attentionShare, 0) > 1.0001) issue(['repositories'], 'attentionShare sum must not exceed 1.0001')
  const themeKeys = value.themes.map((item) => item.key)
  if (new Set(themeKeys).size !== themeKeys.length) issue(['themes'], 'theme keys must be unique')
  if (value.themes.reduce((sum, item) => sum + item.share, 0) > 1.0001) issue(['themes'], 'theme share sum must not exceed 1.0001')
  value.themes.forEach((item, index) => {
    if (index > 0 && item.share > value.themes[index - 1].share) issue(['themes', index, 'share'], 'themes must be ordered by share descending')
  })
  value.narratives.forEach((item, index) => {
    if (index > 0 && item.order <= value.narratives[index - 1].order) issue(['narratives', index, 'order'], 'narrative orders must be unique and ascending')
  })
  const coverage = value.coverage
  if (coverage.complete + coverage.partial + coverage.unavailable !== coverage.total) issue(['coverage', 'total'], 'coverage total must equal complete + partial + unavailable')
  else if (!coverageScorePercentCandidates(coverage).includes(coverage.scorePercent)) issue(['coverage', 'scorePercent'], 'scorePercent is not the integer 0..100 percent the coverage counts admit')
  const warningCodes = coverage.warnings.map((item) => item.code)
  const orderedCodes = COVERAGE_WARNING_CODES.filter((code) => warningCodes.includes(code))
  if (new Set(warningCodes).size !== warningCodes.length || warningCodes.some((code, index) => code !== orderedCodes[index])) issue(['coverage', 'warnings'], 'warning codes must be unique and in registry order')
  if (value.delivery) {
    if (value.delivery.mergedSamples !== value.summary.mergedPullRequests) issue(['delivery', 'mergedSamples'], 'mergedSamples must equal summary.mergedPullRequests')
    if (value.delivery.censored !== value.delivery.openAtRangeEnd > 0) issue(['delivery', 'censored'], 'censored must be true exactly when open work is excluded from the median')
  }
  for (const violation of lensProjectionPrivacyViolations(value)) issue([], `privacy boundary: ${violation}`)
})

export type PublicLensProjection = z.infer<typeof PublicLensProjectionContentSchema>

export function computeLensProjectionHash(value: PublicLensProjection): string {
  const body = JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  delete (body.provenance as Record<string, unknown>).projectionHash
  return `sha256:${createHash('sha256').update(canonicalizeJson(body), 'utf8').digest('hex')}`
}

/** SHA-256 over the RFC 8785 canonical form of the projection's input (an already-redacted payload). */
export function computeLensInputHash(input: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalizeJson(JSON.parse(JSON.stringify(input))), 'utf8').digest('hex')}`
}

export const PublicLensProjectionSchema = PublicLensProjectionContentSchema.superRefine((value, ctx) => {
  let expected: string
  try {
    expected = computeLensProjectionHash(value)
  } catch {
    ctx.addIssue({ code: 'custom', path: ['provenance', 'projectionHash'], message: 'projection body is not valid canonical JSON' })
    return
  }
  if (value.provenance.projectionHash !== expected) ctx.addIssue({ code: 'custom', path: ['provenance', 'projectionHash'], message: 'projectionHash does not match the canonical projection body' })
})
export { PublicLensProjectionContentSchema }

/** Schema publishing revision, distinct from the fixture's showcase-input anchor. */
export const LENS_PROJECTION_CONTRACT_COMMIT = "bae3bddf7295b767d57196887bd648ba1cfe2ab3";
export const LENS_PROJECTION_FIXTURE_SHA256 = "sha256:dfea3cd8f62e4eef17af433690cf586335fff6346bc37ac2638a0580b9cc3b78";
export const LENS_PROJECTION_SCHEMA_SHA256 = "sha256:89c4e36d7fea2e17f20f0ffc27c422ff2fa72c4bee59d5d45cad41256a54d67e";

export type LensProjectionErrorCode = "LENS_INVALID_PROJECTION" | "LENS_INVALID_CLOCK" | "LENS_FUTURE_PROJECTION" | "LENS_ALIAS_COLLISION" | "LENS_C1_PUBLICATION_DISABLED" | "LENS_INVALID_FILE" | "LENS_UNTRACKED_FILE" | "LENS_FILE_TOO_LARGE";
export class LensProjectionError extends Error {
  constructor(readonly code: LensProjectionErrorCode) { super(code); this.name = "LensProjectionError"; }
}
export interface LensProjectionClock {
  readonly generatedAt: string;
  /** Real repository names and display labels already present in the public snapshot. */
  readonly repositoryNames?: readonly string[];
}
export interface LensProjectionFreshness {
  readonly status: "fresh" | "stale" | "expired";
  readonly ageDays: number;
  readonly maxAgeDays: number;
}
function instant(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new LensProjectionError("LENS_INVALID_CLOCK");
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value.replace(/(?<=:\d{2})Z$/, ".000Z")) throw new LensProjectionError("LENS_INVALID_CLOCK");
  return time;
}
export function lensProjectionFreshness(generatedAt: string, snapshotGeneratedAt: string, maxAgeDays = 45): LensProjectionFreshness {
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 3650) throw new LensProjectionError("LENS_INVALID_CLOCK");
  const elapsed = instant(snapshotGeneratedAt) - instant(generatedAt);
  if (elapsed < 0) throw new LensProjectionError("LENS_FUTURE_PROJECTION");
  const days = elapsed / 86_400_000;
  return Object.freeze({ status: days > maxAgeDays * 2 ? "expired" : days > maxAgeDays ? "stale" : "fresh", ageDays: Math.floor(days), maxAgeDays });
}
function freezeProjection<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freezeProjection); Object.freeze(value); }
  return value;
}
/** Consumer boundary: discard Zod issues/input text and expose content-free codes only. */
export function parseLensProjection(input: unknown, clock: LensProjectionClock): PublicLensProjection {
  let value: PublicLensProjection;
  try { value = PublicLensProjectionSchema.parse(input); } catch { throw new LensProjectionError("LENS_INVALID_PROJECTION"); }
  lensProjectionFreshness(value.generatedAt, clock.generatedAt);
  const names = new Set((clock.repositoryNames ?? []).map(name => name.toLowerCase()));
  if (value.repositories.some(repo => (repo.disclosure === "private-alias" || repo.disclosure === "masked-alias") && names.has(repo.label.toLowerCase()))) throw new LensProjectionError("LENS_ALIAS_COLLISION");
  return freezeProjection(value);
}
