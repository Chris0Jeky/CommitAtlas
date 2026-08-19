import { GitHubApiError } from "./github/client";
import { InputError } from "./github/validation";

const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, If-None-Match",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export function jsonResponse(value: unknown, edgeSeconds: number): Response {
  const body = JSON.stringify(value);
  const etag = `W/"${fnv1a(body)}-${body.length}"`;
  return new Response(body, {
    headers: {
      ...BASE_HEADERS,
      "Cache-Control": `public, max-age=60, s-maxage=${edgeSeconds}`,
      "Content-Type": "application/json; charset=utf-8",
      ETag: etag,
    },
  });
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
  return new Response(null, { status: 204, headers: BASE_HEADERS });
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

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
