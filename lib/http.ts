import { GitHubApiError } from "./github/client";
import { InputError } from "./github/validation";

const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, If-None-Match",
  "Content-Security-Policy": "default-src 'none'; script-src 'none'; style-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function jsonResponse(
  request: Request,
  value: unknown,
  options: { edgeSeconds: number; publicData: boolean },
): Promise<Response> {
  const body = JSON.stringify(value);
  const etag = await canonicalEtag(value);
  const headers = successHeaders(etag, options);
  if (ifNoneMatch(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, {
    headers,
  });
}

export async function svgResponse(
  request: Request,
  body: string,
  options: { edgeSeconds: number; publicData: boolean; inlineStyles?: boolean },
): Promise<Response> {
  const etag = await bodyEtag(body);
  const headers = successHeaders(etag, options, "image/svg+xml; charset=utf-8");
  if (options.inlineStyles) {
    headers.set("Content-Security-Policy", "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; sandbox");
  }
  if (ifNoneMatch(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { headers });
}

export function apiErrorResponse(error: unknown): Response {
  const generatedAt = new Date().toISOString();
  if (error instanceof InputError) {
    return errorJson(error.code, error.message, 400, generatedAt);
  }
  if (error instanceof GitHubApiError) {
    const response = errorJson(error.code, error.message, error.status, generatedAt);
    if (error.retryAfter) response.headers.set("Retry-After", error.retryAfter);
    return response;
  }
  console.error(JSON.stringify({ message: "unhandled API error", error: error instanceof Error ? error.message : "unknown" }));
  return errorJson("internal_error", "CommitAtlas could not complete the request", 500, generatedAt);
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: { ...BASE_HEADERS, "Cache-Control": "no-store" } });
}

function errorJson(code: string, message: string, status: number, generatedAt: string): Response {
  return new Response(JSON.stringify({ version: 1, status: "error", error: { code, message }, generatedAt }), {
    status,
    headers: {
      ...BASE_HEADERS,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function successHeaders(
  etag: string,
  options: { edgeSeconds: number; publicData: boolean; inlineStyles?: boolean },
  contentType = "application/json; charset=utf-8",
): Headers {
  return new Headers({
    ...BASE_HEADERS,
    "Cache-Control": options.publicData
      ? `public, max-age=60, s-maxage=${options.edgeSeconds}`
      : "private, no-store",
    "Content-Type": contentType,
    ETag: etag,
  });
}

async function bodyEtag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `W/"${hash}"`;
}

async function canonicalEtag(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonicalize(value))),
  );
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `W/"${hash}"`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        // Freshness timestamps change on every live read, but do not change
        // the semantic representation validated by this weak ETag.
        .filter(([key]) => key !== "generatedAt")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function ifNoneMatch(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").map((value) => value.trim()).some((candidate) => {
    if (candidate === "*") return true;
    return candidate.replace(/^W\//, "") === etag.replace(/^W\//, "");
  });
}
