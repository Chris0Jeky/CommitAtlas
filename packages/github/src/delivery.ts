const DELIVERY_WINDOW_DAYS = [7, 30, 90, 365] as const;
const MAX_DELIVERY_REPOSITORIES = 6;
const HANDLE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export type DeliveryWindowDays = (typeof DELIVERY_WINDOW_DAYS)[number];

export interface DeliveryWindowRange {
  readonly days: DeliveryWindowDays;
  readonly from: string;
  readonly to: string;
}

export interface DeliveryCountQuery {
  readonly alias: string;
  readonly search: string;
  readonly repository?: string;
}

export interface DeliveryQueryPlan {
  readonly version: 1;
  readonly login: string;
  readonly repositories: readonly string[];
  readonly asOf: string;
  readonly generatedAt: string;
  readonly windows: readonly DeliveryWindowRange[];
  readonly queries: readonly DeliveryCountQuery[];
}

export interface DeliveryBenchmark {
  readonly version: 1;
  readonly id: string;
  readonly label: string;
  readonly publisher: string;
  readonly metric: string;
  readonly value: number;
  readonly unit: "merged-pull-requests-per-engineer-week";
  readonly sourceUrl: string;
  readonly publishedAt: string;
  readonly population: string;
  readonly cohort: string;
  readonly caveats: readonly string[];
}

export interface DeliveryWindowSnapshot extends DeliveryWindowRange {
  readonly opened: number;
  readonly merged: number;
  readonly mergedPerWeek: number;
}

export interface DeliveryRepositoryWindow {
  readonly repository: string;
  readonly opened30: number;
}

export interface DeliveryDerivedSignals {
  readonly resolvedMergeConversion: number | null;
  readonly integrationBalance30: number | null;
  readonly wipMergeWeeks: number | null;
  readonly topTwoConcentration30: number | null;
  readonly topSixConcentration30: number | null;
  readonly benchmarkMultiple7: number | null;
}

export interface DeliverySnapshot {
  readonly version: 1;
  readonly login: string;
  readonly scope: {
    readonly kind: "configured-public-repositories";
    readonly repositories: readonly string[];
  };
  readonly asOf: string;
  readonly generatedAt: string;
  readonly source: {
    readonly provider: "github-graphql";
    readonly metric: "pull-request-search-counts";
    readonly queryCount: number;
  };
  readonly lifetime: {
    readonly authored: number;
    readonly merged: number;
    readonly closed: number;
    readonly closedWithoutMerge: number;
    readonly open: number;
    readonly drafts: number;
  };
  readonly windows: readonly DeliveryWindowSnapshot[];
  readonly repositories: readonly DeliveryRepositoryWindow[];
  readonly derived: DeliveryDerivedSignals;
  readonly benchmark: DeliveryBenchmark | null;
  readonly formulas: Readonly<Record<string, string>>;
  readonly limitations: readonly string[];
}

export function buildDeliveryQueryPlan(input: {
  readonly login: string;
  readonly repositories: readonly string[];
  readonly asOf: Date;
}): DeliveryQueryPlan {
  const login = parseLogin(input.login);
  const generatedAt = parseDate(input.asOf);
  const repositories = parseRepositories(login, input.repositories);
  const asOf = generatedAt.slice(0, 10);
  const windows = DELIVERY_WINDOW_DAYS.map((days) => ({
    days,
    from: shiftUtcDate(asOf, -(days - 1)),
    to: asOf,
  }));
  const scope = repositoryScope(repositories);
  const base = `is:pr is:public author:${login} ${scope}`;
  const queries: DeliveryCountQuery[] = [
    { alias: "lifetimeAuthored", search: base },
    { alias: "lifetimeMerged", search: `${base} is:merged` },
    { alias: "lifetimeClosed", search: `${base} is:closed` },
    { alias: "lifetimeOpen", search: `${base} is:open` },
    { alias: "lifetimeDrafts", search: `${base} is:open draft:true` },
  ];
  for (const window of windows) {
    queries.push(
      { alias: `opened${window.days}`, search: `${base} created:${window.from}..${window.to}` },
      { alias: `merged${window.days}`, search: `${base} merged:${window.from}..${window.to}` },
    );
  }
  const thirtyDayWindow = windows.find(({ days }) => days === 30)!;
  repositories.forEach((repository, index) => {
    queries.push({
      alias: `repoOpened30_${index}`,
      search: `is:pr is:public author:${login} repo:${repository} created:${thirtyDayWindow.from}..${thirtyDayWindow.to}`,
      repository,
    });
  });
  return {
    version: 1,
    login,
    repositories,
    asOf,
    generatedAt,
    windows,
    queries,
  };
}

export function deriveDeliverySnapshot(input: {
  readonly plan: DeliveryQueryPlan;
  readonly counts: Readonly<Record<string, number>>;
  readonly benchmark?: DeliveryBenchmark | null;
}): DeliverySnapshot {
  // No built-in reference is enabled until its exact primary datum is verified.
  const benchmark = input.benchmark == null ? null : validateBenchmark(input.benchmark);
  const aliases = new Set<string>();
  for (const query of input.plan.queries) {
    if (aliases.has(query.alias)) throw new Error(`Delivery query plan contains duplicate alias ${query.alias}`);
    aliases.add(query.alias);
  }
  const read = (alias: string): number => {
    if (!Object.prototype.hasOwnProperty.call(input.counts, alias)) {
      throw new Error(`Delivery count evidence is missing ${alias}`);
    }
    const value = input.counts[alias];
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Delivery count ${alias} must be a safe non-negative integer`);
    }
    return value;
  };
  for (const alias of aliases) read(alias);

  const authored = read("lifetimeAuthored");
  const merged = read("lifetimeMerged");
  const closed = read("lifetimeClosed");
  const open = read("lifetimeOpen");
  const drafts = read("lifetimeDrafts");
  if (authored !== closed + open) {
    throw new Error("Delivery lifetime authored count must equal closed plus open counts");
  }
  if (merged > closed) {
    throw new Error("Delivery lifetime merged count cannot exceed closed count");
  }
  if (drafts > open) {
    throw new Error("Delivery lifetime draft count cannot exceed open count");
  }

  const windows = input.plan.windows.map((window): DeliveryWindowSnapshot => {
    const opened = read(`opened${window.days}`);
    const windowMerged = read(`merged${window.days}`);
    return {
      ...window,
      opened,
      merged: windowMerged,
      mergedPerWeek: round4((windowMerged / window.days) * 7),
    };
  });
  // A shorter inclusive window is a subset of every longer window. Contradictory
  // search counts are unavailable evidence, not a valid throughput comparison.
  for (const metric of ["opened", "merged"] as const) {
    const lifetime = metric === "opened" ? authored : merged;
    for (let index = 0; index < DELIVERY_WINDOW_DAYS.length; index += 1) {
      const days = DELIVERY_WINDOW_DAYS[index]!;
      const nextDays = DELIVERY_WINDOW_DAYS[index + 1];
      const upper = nextDays === undefined ? lifetime : read(`${metric}${nextDays}`);
      if (read(`${metric}${days}`) > upper) {
        throw new Error(`Delivery ${metric}${days} count cannot exceed ${nextDays === undefined ? "the lifetime count" : `${metric}${nextDays}`}`);
      }
    }
  }
  const repositoryQueries = input.plan.queries.filter((query): query is DeliveryCountQuery & { repository: string } => (
    typeof query.repository === "string"
  ));
  if (repositoryQueries.length !== input.plan.repositories.length) {
    throw new Error("Delivery query plan must contain one 30-day repository query per configured repository");
  }
  const repositories = repositoryQueries.map((query): DeliveryRepositoryWindow => ({
    repository: query.repository,
    opened30: read(query.alias),
  }));
  const opened30 = read("opened30");
  const repositoryOpened30 = repositories.reduce((total, repository) => total + repository.opened30, 0);
  if (repositoryOpened30 !== opened30) {
    throw new Error("Delivery repository opened30 counts must equal the portfolio opened30 count");
  }

  const merged7 = read("merged7");
  const merged30 = read("merged30");
  const sortedOpened30 = repositories.map(({ opened30: count }) => count).sort((left, right) => right - left);
  const concentration = (take: number): number | null => opened30 === 0
    ? null
    : round4(sortedOpened30.slice(0, take).reduce((total, count) => total + count, 0) / opened30);
  const mergedPerWeek7 = windows.find(({ days }) => days === 7)?.mergedPerWeek;
  if (mergedPerWeek7 === undefined) throw new Error("Delivery query plan is missing the 7-day window");

  return {
    version: 1,
    login: input.plan.login,
    scope: {
      kind: "configured-public-repositories",
      repositories: [...input.plan.repositories],
    },
    asOf: input.plan.asOf,
    generatedAt: input.plan.generatedAt,
    source: {
      provider: "github-graphql",
      metric: "pull-request-search-counts",
      queryCount: input.plan.queries.length,
    },
    lifetime: {
      authored,
      merged,
      closed,
      closedWithoutMerge: closed - merged,
      open,
      drafts,
    },
    windows,
    repositories,
    derived: {
      resolvedMergeConversion: closed === 0 ? null : round4(merged / closed),
      integrationBalance30: opened30 === 0 ? null : round4(merged30 / opened30),
      wipMergeWeeks: merged7 === 0 ? null : round4(open / merged7),
      topTwoConcentration30: concentration(2),
      topSixConcentration30: concentration(6),
      benchmarkMultiple7: benchmark === null ? null : round4(mergedPerWeek7 / benchmark.value),
    },
    benchmark,
    formulas: {
      resolvedMergeConversion: "lifetime.merged / lifetime.closed",
      mergedPerWeek: "window.merged / window.days * 7",
      integrationBalance30: "merged30 / opened30",
      wipMergeWeeks: "lifetime.open / merged7",
      topTwoConcentration30: "sum(two largest repository opened30 values) / opened30",
      topSixConcentration30: "sum(six largest repository opened30 values) / opened30",
      benchmarkMultiple7: "mergedPerWeek7 / benchmark.value",
    },
    limitations: [
      "Pull-request count is activity flow, not a measure of code quality, effort, impact, or delivered user value.",
      "The snapshot covers only the configured public repositories and may exclude other public or private work.",
      benchmark === null
        ? "No external benchmark is configured; the benchmark comparison is unavailable."
        : "The external benchmark is a caller-supplied dated reference, not a global percentile or equivalent-headcount estimate.",
      "Pull-request size, automation, review policy, stacking, ownership, and repository architecture can materially change counts.",
    ],
  };
}

function parseLogin(value: string): string {
  const login = value.trim();
  if (!HANDLE_PATTERN.test(login) || login.includes("--")) {
    throw new Error("Delivery login must be a safe GitHub handle");
  }
  return login;
}

function parseRepositories(login: string, values: readonly string[]): string[] {
  if (values.length === 0) throw new Error("Delivery requires at least one configured repository");
  if (values.length > MAX_DELIVERY_REPOSITORIES) {
    throw new Error("Delivery supports at most six configured repositories");
  }
  const repositories: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (raw !== raw.trim()) throw new Error("Delivery repository names must not contain surrounding whitespace");
    const parts = raw.split("/");
    if (parts.length !== 2) throw new Error("Delivery repository must use owner/name form");
    const [owner, name] = parts;
    if (!owner || !name || !HANDLE_PATTERN.test(owner) || owner.includes("--") || !REPOSITORY_NAME_PATTERN.test(name)) {
      throw new Error("Delivery repository must be a safe GitHub owner/name identifier");
    }
    if (owner.toLowerCase() !== login.toLowerCase()) {
      throw new Error("Every delivery repository must be owned by the configured login");
    }
    const key = raw.toLowerCase();
    if (seen.has(key)) throw new Error("Delivery repositories must not contain duplicates");
    seen.add(key);
    repositories.push(raw);
  }
  return repositories.sort((left, right) => (
    left.toLowerCase().localeCompare(right.toLowerCase()) || left.localeCompare(right)
  ));
}

function parseDate(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Delivery asOf must be a valid date");
  }
  return value.toISOString();
}

function shiftUtcDate(value: string, offsetDays: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function repositoryScope(repositories: readonly string[]): string {
  if (repositories.length === 1) return `repo:${repositories[0]}`;
  return `(${repositories.map((repository) => `repo:${repository}`).join(" OR ")})`;
}

function validateBenchmark(value: DeliveryBenchmark): DeliveryBenchmark {
  if (value.version !== 1 || !value.id || !value.label || !value.publisher || !value.metric) {
    throw new Error("Delivery benchmark identity is invalid");
  }
  if (!Number.isFinite(value.value) || value.value <= 0) {
    throw new Error("Delivery benchmark value must be a finite positive number");
  }
  if (value.unit !== "merged-pull-requests-per-engineer-week") {
    throw new Error("Delivery benchmark unit is unsupported");
  }
  let source: URL;
  try {
    if (typeof value.sourceUrl !== "string" || !/^https:\/\/[^/]/.test(value.sourceUrl)
      || /[\s\\]/.test(value.sourceUrl)
      || [...value.sourceUrl].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error();
    source = new URL(value.sourceUrl);
    if (source.protocol !== "https:" || !source.hostname || source.username || source.password) throw new Error();
  } catch {
    throw new Error("Delivery benchmark provenance is invalid");
  }
  const publishedAt = typeof value.publishedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.publishedAt)
    ? Date.parse(`${value.publishedAt}T00:00:00.000Z`) : NaN;
  if (!Number.isFinite(publishedAt) || new Date(publishedAt).toISOString().slice(0, 10) !== value.publishedAt) {
    throw new Error("Delivery benchmark provenance is invalid");
  }
  if (!value.population || !value.cohort || value.caveats.length === 0) {
    throw new Error("Delivery benchmark population and caveats are required");
  }
  return value;
}

function round4(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}
