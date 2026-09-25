import type { DeliverySnapshot } from "@commit-atlas/github";
import { themes, type MotionProfile, type ThemeName } from "@commit-atlas/svg";

export interface DeliveryCardOptions {
  readonly theme?: ThemeName;
  readonly width?: number;
  readonly motion?: MotionProfile;
}

export function renderDeliveryEvidence(snapshot: DeliverySnapshot): string {
  const evidence = {
    schemaVersion: 1,
    kind: "commitatlas-delivery-evidence",
    version: snapshot.version,
    login: snapshot.login,
    scope: snapshot.scope,
    asOf: snapshot.asOf,
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    lifetime: snapshot.lifetime,
    windows: snapshot.windows,
    repositories: [...snapshot.repositories].sort((left, right) => (
      left.repository.toLowerCase().localeCompare(right.repository.toLowerCase())
      || left.repository.localeCompare(right.repository)
    )),
    derived: snapshot.derived,
    benchmark: snapshot.benchmark,
    formulas: snapshot.formulas,
    limitations: snapshot.limitations,
  } as const;
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

export function renderDeliveryCard(
  snapshot: DeliverySnapshot,
  options: DeliveryCardOptions = {},
): string {
  const themeName = options.theme ?? "aurora";
  const theme = themes[themeName];
  const width = normalizeWidth(options.width ?? 860);
  const compact = width < 620;
  const height = compact ? 520 : 360;
  const seven = snapshot.windows.find(({ days }) => days === 7);
  if (!seven) throw new Error("Delivery card requires a 7-day window");

  const rate = formatRate(seven.mergedPerWeek);
  const benchmarkMultiple = `${formatOne(snapshot.derived.benchmarkMultiple7)}×`;
  const conversion = formatPercent(snapshot.derived.resolvedMergeConversion);
  const balance = formatPercent(snapshot.derived.integrationBalance30);
  const concentration = formatPercent(snapshot.derived.topTwoConcentration30);
  const wip = snapshot.derived.wipMergeWeeks === null
    ? `${formatInteger(snapshot.lifetime.open)} OPEN · UNAVAILABLE`
    : `${formatInteger(snapshot.lifetime.open)} OPEN · ${formatTwo(snapshot.derived.wipMergeWeeks)} MERGE-WEEKS`;
  const scope = `${formatInteger(snapshot.scope.repositories.length)} CONFIGURED PUBLIC REPOS`;
  const window = `${seven.from} → ${seven.to}`;
  const refreshed = snapshot.generatedAt.slice(0, 10);
  const title = `Delivery evidence for ${snapshot.login}`;
  const description = [
    `${rate} merged pull requests per week during ${window}.`,
    `${benchmarkMultiple} the dated ${snapshot.benchmark.label} reference of ${snapshot.benchmark.value} merged pull requests per engineer-week, published ${snapshot.benchmark.publishedAt}.`,
    `Population: ${snapshot.benchmark.population}`,
    `Resolved merge conversion ${spoken(conversion)}; 30-day integration balance ${spoken(balance)}; open work in progress ${spoken(wip)}; top-two repository concentration ${spoken(concentration)}.`,
    `Scope: ${scope.toLowerCase()}. Source: GitHub GraphQL aggregate pull-request search counts. Activity flow, not quality or impact.`,
  ].join(" ");

  return compact
    ? renderCompact({
      snapshot,
      width,
      height,
      rate,
      benchmarkMultiple,
      conversion,
      balance,
      concentration,
      wip,
      scope,
      window,
      refreshed,
      title,
      description,
      theme,
    })
    : renderWide({
      snapshot,
      width,
      height,
      rate,
      benchmarkMultiple,
      conversion,
      balance,
      concentration,
      wip,
      scope,
      window,
      refreshed,
      title,
      description,
      theme,
    });
}

type Theme = (typeof themes)[ThemeName];

interface RenderState {
  readonly snapshot: DeliverySnapshot;
  readonly width: number;
  readonly height: number;
  readonly rate: string;
  readonly benchmarkMultiple: string;
  readonly conversion: string;
  readonly balance: string;
  readonly concentration: string;
  readonly wip: string;
  readonly scope: string;
  readonly window: string;
  readonly refreshed: string;
  readonly title: string;
  readonly description: string;
  readonly theme: Theme;
}

function renderWide(state: RenderState): string {
  const { theme } = state;
  const innerWidth = state.width - 48;
  const focalWidth = Math.min(300, Math.floor(innerWidth * 0.38));
  const metricsX = 24 + focalWidth + 16;
  const metricsWidth = state.width - metricsX - 24;
  const metricWidth = (metricsWidth - 12) / 2;
  const metric = (
    x: number,
    y: number,
    label: string,
    value: string,
    note: string,
  ): string => `
    <rect x="${x}" y="${y}" width="${metricWidth}" height="88" rx="10" fill="${theme.surface}" stroke="${theme.border}" />
    <text x="${x + 16}" y="${y + 24}" class="label">${escapeXml(label)}</text>
    <text x="${x + 16}" y="${y + 55}" class="metric">${escapeXml(value)}</text>
    <text x="${x + 16}" y="${y + 75}" class="note">${escapeXml(note)}</text>`;

  return svgShell(state, `
  <text x="24" y="34" class="eyebrow">DELIVERY EVIDENCE</text>
  <text x="${state.width - 24}" y="34" text-anchor="end" class="source">PUBLIC GRAPHQL COUNTS</text>
  <line x1="24" y1="54" x2="${state.width - 24}" y2="54" stroke="${theme.border}" />

  <rect x="24" y="72" width="${focalWidth}" height="202" rx="12" fill="${theme.surface}" stroke="${theme.border}" />
  <text x="44" y="99" class="label">7-DAY MERGED RATE</text>
  <text x="44" y="160" class="focal">${escapeXml(state.rate)}</text>
  <text x="44" y="184" class="unit">PRs / WEEK</text>
  <rect x="44" y="199" width="${Math.min(focalWidth - 40, 226)}" height="31" rx="15.5" fill="${theme.track}" />
  <text x="56" y="220" class="benchmark">${escapeXml(state.benchmarkMultiple)} DATED BENCHMARK</text>
  <text x="44" y="249" class="note">${escapeXml(state.window)}</text>
  <text x="44" y="267" class="note">${escapeXml(state.scope)}</text>

  ${metric(metricsX, 72, "MERGE CONVERSION", state.conversion, "merged / closed")}
  ${metric(metricsX + metricWidth + 12, 72, "30D INTEGRATION", state.balance, "merged / opened")}
  ${metric(metricsX, 174, "OPEN WIP", state.wip, "current queue at 7d rate")}
  ${metric(metricsX + metricWidth + 12, 174, "TOP-2 FOCUS", state.concentration, "share of 30d openings")}

  <line x1="24" y1="294" x2="${state.width - 24}" y2="294" stroke="${theme.border}" />
  <text x="24" y="319" class="footer">GITHUB GRAPHQL · ${state.snapshot.source.queryCount} AGGREGATE QUERIES · REFRESHED ${escapeXml(state.refreshed)}</text>
  <text x="${state.width - 24}" y="341" text-anchor="end" class="nonclaim">ACTIVITY FLOW · NOT QUALITY OR IMPACT</text>`);
}

function renderCompact(state: RenderState): string {
  const { theme } = state;
  const cardWidth = (state.width - 48) / 2;
  const metric = (
    x: number,
    y: number,
    label: string,
    value: string,
  ): string => `
    <rect x="${x}" y="${y}" width="${cardWidth}" height="88" rx="10" fill="${theme.surface}" stroke="${theme.border}" />
    <text x="${x + 13}" y="${y + 25}" class="label">${escapeXml(label)}</text>
    <text x="${x + 13}" y="${y + 58}" class="compact-metric">${escapeXml(value)}</text>`;

  return svgShell(state, `
  <text x="18" y="33" class="eyebrow">DELIVERY EVIDENCE</text>
  <text x="${state.width - 18}" y="33" text-anchor="end" class="source">PUBLIC COUNTS</text>
  <line x1="18" y1="54" x2="${state.width - 18}" y2="54" stroke="${theme.border}" />

  <rect x="18" y="70" width="${state.width - 36}" height="136" rx="12" fill="${theme.surface}" stroke="${theme.border}" />
  <text x="34" y="96" class="label">7-DAY MERGED RATE</text>
  <text x="34" y="151" class="compact-focal">${escapeXml(state.rate)}</text>
  <text x="140" y="151" class="unit">PRs / WEEK</text>
  <text x="34" y="181" class="benchmark">${escapeXml(state.benchmarkMultiple)} DATED BENCHMARK</text>
  <text x="${state.width - 34}" y="181" text-anchor="end" class="note">${escapeXml(state.window)}</text>

  ${metric(18, 222, "MERGE CONVERSION", state.conversion)}
  ${metric(30 + cardWidth, 222, "30D INTEGRATION", state.balance)}
  ${metric(18, 322, "OPEN WIP", state.wip)}
  ${metric(30 + cardWidth, 322, "TOP-2 FOCUS", state.concentration)}

  <text x="18" y="438" class="footer">${escapeXml(state.scope)}</text>
  <text x="18" y="462" class="footer">GITHUB GRAPHQL · ${state.snapshot.source.queryCount} QUERIES · REFRESHED ${escapeXml(state.refreshed)}</text>
  <line x1="18" y1="480" x2="${state.width - 18}" y2="480" stroke="${theme.border}" />
  <text x="${state.width / 2}" y="505" text-anchor="middle" class="nonclaim">ACTIVITY FLOW · NOT QUALITY OR IMPACT</text>`);
}

function svgShell(state: RenderState, body: string): string {
  const { theme } = state;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${state.width}" height="${state.height}" viewBox="0 0 ${state.width} ${state.height}" role="img" aria-labelledby="delivery-title delivery-desc">
<title id="delivery-title">${escapeXml(state.title)}</title>
<desc id="delivery-desc">${escapeXml(state.description)}</desc>
<style>
  text { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; fill: ${theme.text}; }
  .eyebrow { font-size: 13px; font-weight: 800; letter-spacing: 1.8px; fill: ${theme.chrome}; }
  .source, .footer { font-size: 10px; font-weight: 650; letter-spacing: .5px; fill: ${theme.muted}; }
  .label { font-size: 10px; font-weight: 750; letter-spacing: 1.1px; fill: ${theme.muted}; }
  .focal { font-size: 62px; font-weight: 850; fill: ${theme.accent}; }
  .compact-focal { font-size: 52px; font-weight: 850; fill: ${theme.accent}; }
  .unit { font-size: 13px; font-weight: 800; letter-spacing: .8px; fill: ${theme.text}; }
  .benchmark { font-size: 11px; font-weight: 800; letter-spacing: .35px; fill: ${theme.chrome}; }
  .metric { font-size: 23px; font-weight: 820; fill: ${theme.text}; }
  .compact-metric { font-size: 16px; font-weight: 820; fill: ${theme.text}; }
  .note { font-size: 9.5px; font-weight: 600; fill: ${theme.muted}; }
  .nonclaim { font-size: 10px; font-weight: 850; letter-spacing: 1.1px; fill: ${theme.warning}; }
</style>
<rect x="1" y="1" width="${state.width - 2}" height="${state.height - 2}" rx="14" fill="${theme.background}" stroke="${theme.border}" stroke-width="2" />${body}
</svg>`;
}

function normalizeWidth(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Delivery card width must be finite");
  return Math.min(960, Math.max(480, Math.round(value)));
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatOne(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function formatTwo(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number | null): string {
  return value === null ? "UNAVAILABLE" : `${formatOne(value * 100)}%`;
}

function spoken(value: string): string {
  return value === "UNAVAILABLE" ? "unavailable" : value.toLowerCase();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
