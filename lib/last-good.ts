const RETENTION_SECONDS = 7 * 24 * 60 * 60;
const MAX_ENTRY_BYTES = 128 * 1024;

const ELIGIBLE_PATHS = new Set([
  "/api/v1/profile",
  "/api/v1/contributions",
  "/api/v1/projects",
  "/api/v1/projects.svg",
  "/api/v1/cards/profile.svg",
  "/api/v1/cards/streak.svg",
  "/api/v1/cards/breakdown.svg",
  "/api/v1/cards/rhythm.svg",
  "/api/v1/cards/activity.svg",
  "/api/v1/cards/languages.svg",
  "/api/v1/cards/atlas.svg",
]);

const STORED_HEADERS = [
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "content-security-policy",
  "content-type",
  "cross-origin-resource-policy",
  "etag",
  "referrer-policy",
  "x-content-type-options",
] as const;

export interface LastGoodStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { readonly expirationTtl: number }): Promise<void>;
}

export interface LastGoodRuntime {
  readonly publicOnly: boolean;
  readonly store?: LastGoodStore;
  readonly waitUntil: (promise: Promise<unknown>) => void;
  readonly now?: () => Date;
  readonly logError?: (message: string) => void;
}

interface LastGoodEntry {
  readonly version: 1;
  readonly body: string;
  readonly storedAt: string;
  readonly observedAt: string;
  readonly validatedAt?: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Preserve a validated, public-only API representation across anonymous GitHub
 * upstream refusals, quota and deadline failures. Synthetic and token-backed requests never enter
 * this path, and a cold miss keeps the route's original bounded error.
 */
export async function withPublicLastGood(
  request: Request,
  operation: () => Promise<Response>,
  runtime: LastGoodRuntime,
): Promise<Response> {
  const response = await operation();
  if (!runtime.publicOnly || !runtime.store || !isEligiblePublicRequest(request)) return response;

  const now = runtime.now?.() ?? new Date();
  const key = await publicLastGoodKey(request);

  if (isValidatedSuccess(response, request)) {
    const persistence = persistLastGood(runtime.store, key, response.clone(), now)
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "unknown error";
        (runtime.logError ?? console.error)(JSON.stringify({
          message: "last-good persistence failed",
          path: new URL(request.url).pathname,
          detail,
        }));
      });
    runtime.waitUntil(persistence);
    return responseWithHeader(response, "X-CommitAtlas-Data-State", "live");
  }

  if (isValidatedNotModified(response, request)) {
    const refresh = refreshLastGoodRetention(runtime.store, key, request, response, now)
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "unknown error";
        try {
          (runtime.logError ?? console.error)(JSON.stringify({
            message: "last-good retention refresh failed",
            path: new URL(request.url).pathname,
            detail,
          }));
        } catch {
          // Diagnostics must not replace the route's original 304 response.
        }
      });
    runtime.waitUntil(refresh);
    return response;
  }

  const fallbackReason = await upstreamFallbackReason(response);
  if (!fallbackReason) return response;

  let stored: string | null;
  try {
    stored = await runtime.store.get(key);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown error";
    try {
      (runtime.logError ?? console.error)(JSON.stringify({
        message: "last-good lookup failed",
        path: new URL(request.url).pathname,
        detail,
      }));
    } catch {
      // Diagnostics must not replace the route's original bounded error.
    }
    return response;
  }
  const entry = parseEntry(stored, request, now);
  if (!entry) return response;

  return staleResponse(request, entry, fallbackReason, now);
}

export async function publicLastGoodKey(request: Request): Promise<string> {
  const url = new URL(request.url);
  const entries = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    const keyOrder = leftKey.localeCompare(rightKey);
    return keyOrder === 0 ? leftValue.localeCompare(rightValue) : keyOrder;
  });
  const canonical = `${url.pathname}?${new URLSearchParams(entries).toString()}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `public-last-good:v1:${hash}`;
}

const SCENE_PATH = /^\/api\/v1\/scenes\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.svg$/u;

function isEligiblePublicRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  const hostedScene = SCENE_PATH.test(url.pathname);
  return (ELIGIBLE_PATHS.has(url.pathname) || hostedScene) && url.searchParams.get("demo") !== "true";
}

function isValidatedSuccess(response: Response, request: Request): boolean {
  if (response.status !== 200) return false;
  if (!/^public\b/i.test(response.headers.get("cache-control") ?? "")) return false;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return isSvgPath(request) ? contentType.startsWith("image/svg+xml") : contentType.startsWith("application/json");
}

function isValidatedNotModified(response: Response, request: Request): boolean {
  if (response.status !== 304) return false;
  if (!/^public\b/i.test(response.headers.get("cache-control") ?? "")) return false;
  const etag = response.headers.get("etag");
  return /^W\/"[a-f\d]{64}"$/i.test(etag ?? "")
    && ifNoneMatch(request.headers.get("if-none-match"), etag);
}

async function persistLastGood(
  store: LastGoodStore,
  key: string,
  response: Response,
  now: Date,
): Promise<void> {
  const body = await response.text();
  if (!isSafeBody(body, response.headers.get("content-type") ?? "")) {
    throw new Error("response body did not pass the last-good boundary");
  }
  const storedAt = now.toISOString();
  const entry: LastGoodEntry = {
    version: 1,
    body,
    storedAt,
    observedAt: observationTime(body, response.headers.get("content-type") ?? "") ?? storedAt,
    headers: Object.fromEntries(
      STORED_HEADERS.flatMap((name) => {
        const value = response.headers.get(name);
        return value === null ? [] : [[name, value]];
      }),
    ),
  };
  const serialized = JSON.stringify(entry);
  if (new TextEncoder().encode(serialized).byteLength > MAX_ENTRY_BYTES) {
    throw new Error("response exceeded the last-good entry limit");
  }
  await store.put(key, serialized, { expirationTtl: RETENTION_SECONDS });
}

async function refreshLastGoodRetention(
  store: LastGoodStore,
  key: string,
  request: Request,
  response: Response,
  now: Date,
): Promise<void> {
  const etag = response.headers.get("etag");
  const entry = parseEntry(await store.get(key), request, now);
  if (!entry || etag !== entry.headers.etag) return;
  // Re-read immediately before the retention put. Persist this snapshot only when it still parses
  // and its etag still matches. A write that lands after this read can still win.
  const current = parseEntry(await store.get(key), request, now);
  if (!current || etag !== current.headers.etag) return;
  // Retention follows validation; storage and observation still describe the original body.
  await store.put(key, JSON.stringify({ ...current, validatedAt: now.toISOString() }), { expirationTtl: RETENTION_SECONDS });
}

async function upstreamFallbackReason(response: Response): Promise<"rate-limited" | "unavailable" | null> {
  if (response.status !== 429 && response.status !== 502) return null;
  try {
    const payload = await response.clone().json() as { error?: { code?: unknown } };
    if (payload.error?.code === "github_rate_limited") return "rate-limited";
    if (["github_unavailable", "github_timeout", "github_auth_required", "github_forbidden"].includes(String(payload.error?.code))) return "unavailable";
  } catch {
    return null;
  }
  return null;
}

function parseEntry(raw: string | null, request: Request, now: Date): LastGoodEntry | null {
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_ENTRY_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1 || typeof value.body !== "string"
      || typeof value.storedAt !== "string" || typeof value.observedAt !== "string"
      || !isRecord(value.headers)) return null;

  const storedAt = Date.parse(value.storedAt);
  const observedAt = Date.parse(value.observedAt);
  if (value.validatedAt !== undefined && typeof value.validatedAt !== "string") return null;
  const validatedAt = value.validatedAt === undefined ? storedAt : Date.parse(value.validatedAt);
  const ageMs = now.getTime() - validatedAt;
  if (!Number.isFinite(storedAt) || !Number.isFinite(observedAt) || !Number.isFinite(validatedAt)
      || validatedAt < storedAt || ageMs < -300_000
      || ageMs > RETENTION_SECONDS * 1000 || observedAt > storedAt + 300_000
      || observedAt < storedAt - RETENTION_SECONDS * 1000) return null;

  const headers: Record<string, string> = {};
  for (const name of STORED_HEADERS) {
    const header = value.headers[name];
    if (header !== undefined && typeof header !== "string") return null;
    if (typeof header === "string") {
      if (header.length > 2048 || /[\r\n]/.test(header)) return null;
      headers[name] = header;
    }
  }
  try {
    // Stored strings must also be usable HTTP header values in this runtime.
    new Headers(headers);
  } catch {
    return null;
  }
  const contentType = headers["content-type"] ?? "";
  if (isSvgPath(request) !== contentType.toLowerCase().startsWith("image/svg+xml")) return null;
  if (!isSafeBody(value.body, contentType)) return null;
  if (!/^W\/"[a-f\d]{64}"$/i.test(headers.etag ?? "")) return null;

  return {
    version: 1,
    body: value.body,
    storedAt: new Date(storedAt).toISOString(),
    observedAt: new Date(observedAt).toISOString(),
    ...(value.validatedAt === undefined ? {} : { validatedAt: new Date(validatedAt).toISOString() }),
    headers,
  };
}

async function staleResponse(
  request: Request,
  entry: LastGoodEntry,
  reason: "rate-limited" | "unavailable",
  now: Date,
): Promise<Response> {
  const svg = entry.headers["content-type"]?.toLowerCase().startsWith("image/svg+xml") ?? false;
  const body = svg ? markSvgStale(entry.body, entry.observedAt) : markJsonStale(entry.body);
  const headers = new Headers(entry.headers);
  headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
  headers.set("Warning", '110 - "Response is stale"');
  headers.set("X-CommitAtlas-Data-State", "stale");
  headers.set("X-CommitAtlas-Fallback-Reason", reason);
  headers.set("X-CommitAtlas-Last-Good-At", entry.storedAt);
  headers.set("X-CommitAtlas-Observed-At", entry.observedAt);
  headers.set("X-CommitAtlas-Last-Good-Age", String(Math.max(0, Math.floor((now.getTime() - Date.parse(entry.storedAt)) / 1000))));
  if (body !== entry.body) headers.set("ETag", await bodyEtag(body));

  if (ifNoneMatch(request.headers.get("if-none-match"), headers.get("etag"))) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { status: 200, headers });
}

function markSvgStale(body: string, observedAt: string): string {
  const viewBox = body.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!viewBox || /<svg\b[^>]*\bdata-commitatlas-state="stale"/i.test(body)) return body;
  const width = Number(viewBox[1]);
  const height = Number(viewBox[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 240 || height < 100) return body;
  const bannerHeight = Math.min(22, Math.max(16, Math.round(height * 0.07)));
  const fontSize = Math.min(10, Math.max(8, Math.round(width / 80)));
  const label = `STALE SNAPSHOT \u00b7 OBSERVED ${observedAt}`;
  const extendedHeight = height + bannerHeight;
  const marker = `<g role="note" aria-label="${label}" data-commitatlas-stale-banner="true"><rect x="0" y="${height}" width="${width}" height="${bannerHeight}" fill="#111827"/><text x="${width / 2}" y="${height + bannerHeight - Math.max(5, Math.round(bannerHeight * 0.3))}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="${fontSize}" font-weight="700" fill="#FCD34D">${label}</text></g>`;
  let marked = body.replace(/^<svg\b([^>]*)>/i, (opening) => {
    const sized = opening
      .replace(viewBox[0], `viewBox="0 0 ${width} ${extendedHeight}"`)
      .replace(/\bheight="[\d.]+"/i, `height="${extendedHeight}"`);
    return sized.replace(/^<svg\b/i, '<svg data-commitatlas-state="stale"');
  });
  marked = marked.replace(/<desc>([\s\S]*?)<\/desc>/i, `<desc>$1 ${label}.</desc>`);
  return marked.replace(/<\/svg>\s*$/, `${marker}</svg>`);
}

function markJsonStale(body: string): string {
  try {
    const payload = JSON.parse(body) as unknown;
    if (!isRecord(payload) || !isRecord(payload.freshness)) return body;
    return JSON.stringify({
      ...payload,
      freshness: { ...payload.freshness, mode: "stale" },
    });
  } catch {
    return body;
  }
}

function isSafeBody(body: string, contentType: string): boolean {
  if (new TextEncoder().encode(body).byteLength > MAX_ENTRY_BYTES) return false;
  if (contentType.toLowerCase().startsWith("image/svg+xml")) {
    return /^<svg\s/i.test(body)
      && /<\/svg>\s*$/i.test(body)
      && !/<(?:script|foreignObject|iframe)\b/i.test(body)
      && !/\son[a-z]+\s*=/i.test(body)
      && !/\b(?:href|src)\s*=\s*["']\s*(?:https?:|data:)/i.test(body);
  }
  if (!contentType.toLowerCase().startsWith("application/json")) return false;
  try {
    const payload = JSON.parse(body) as unknown;
    return isRecord(payload) && payload.version === 1;
  } catch {
    return false;
  }
}

const ISO_STAMP = "(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z)";

function lastIsoStamp(body: string, pattern: RegExp): string | null {
  let found: string | null = null;
  for (const match of body.matchAll(pattern)) {
    const parsed = Date.parse(match[1] ?? "");
    if (Number.isFinite(parsed)) found = new Date(parsed).toISOString();
  }
  return found;
}

function observationTime(body: string, contentType: string): string | null {
  if (contentType.toLowerCase().startsWith("application/json")) {
    try {
      const payload = JSON.parse(body) as unknown;
      if (isRecord(payload)) {
        const freshness = payload.freshness;
        const candidate = isRecord(freshness) ? freshness.generatedAt : payload.generatedAt;
        if (typeof candidate === "string" && Number.isFinite(Date.parse(candidate))) {
          return new Date(candidate).toISOString();
        }
      }
    } catch {
      return null;
    }
    // A public string inside the JSON body is not a renderer stamp.
    return null;
  }
  // The atlas footer (`Generated <time> ·`) and a desc whose whole text is that
  // stamp are renderer output. Public biography or location text can contain the
  // same words earlier in the body and must not become the observation time.
  const footer = lastIsoStamp(body, new RegExp(`Generated\\s+${ISO_STAMP}\\s+·`, "g"));
  const described = lastIsoStamp(body, new RegExp(`<desc>\\s*Generated\\s+${ISO_STAMP}\\s*</desc>`, "g"));
  return footer ?? described;
}

function responseWithHeader(response: Response, name: string, value: string): Response {
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function bodyEtag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `W/"${hash}"`;
}

function ifNoneMatch(header: string | null, etag: string | null): boolean {
  if (!header || !etag) return false;
  return header.split(",").map((value) => value.trim()).some((candidate) => {
    if (candidate === "*") return true;
    return candidate.replace(/^W\//, "") === etag.replace(/^W\//, "");
  });
}

function isSvgPath(request: Request): boolean {
  return new URL(request.url).pathname.endsWith(".svg");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
