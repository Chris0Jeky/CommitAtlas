/** Cloudflare Worker entry point for CommitAtlas. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { InputError } from "@/lib/github/validation";
import { apiErrorResponse } from "@/lib/http";
import { stampGalleryResponse } from "@/lib/gallery";
import { withPublicLastGood, type LastGoodStore } from "@/lib/last-good";
import { getGitHubToken, withWorkerEnv, type CommitAtlasWorkerEnv } from "@/lib/runtime-env";

interface Env extends CommitAtlasWorkerEnv, CloudflareBindings {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

// Production HTML has inline Vinext hydration/pre-paint scripts and inline
// React/SDK styles. This is a bounded source allowlist, not a nonce-based XSS
// boundary. Keep eval and event-handler attributes disabled. Fonts and scripts
// are bundled locally; Studio decodes fetched SVGs through blob: image URLs.
const HTML_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://pulseboard-observatory.commit-atlas.workers.dev",
  "worker-src 'none'",
].join("; ");

function withHtmlSecurityHeaders(response: Response): Response {
  if (!/^text\/html(?:\s*;|\s*$)/i.test(response.headers.get("content-type") ?? "")) return response;
  const headers = new Headers(response.headers);
  // Do not weaken an explicit policy supplied by a route/framework. Development
  // uses Vite HMR and Google CDN fonts; never enable those sources in production.
  if (!headers.has("Content-Security-Policy") && process.env.NODE_ENV !== "development") {
    headers.set("Content-Security-Policy", HTML_CONTENT_SECURITY_POLICY);
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  // Preserve the original stream, status, cache policy and validators, including
  // the gallery's bodyless 304. Never buffer or rewrite hydration payloads here.
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Vinext reconstructs route requests from URLSearchParams, which discards a
    // bare query delimiter and separator-only variants before the route runs.
    // Reject them at the Worker boundary so every fixed probe has one cache key.
    if (/^\/api\/v1\/probes\/motion\/[^/]+$/.test(url.pathname) && request.url.includes("?")) {
      return apiErrorResponse(new InputError("motion probes do not accept query parameters"));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      // No images binding is configured (wrangler.jsonc declares only LAST_GOOD),
      // so pass no transform: vinext serves the source with the same
      // security/cache headers instead of throwing inside the transform.
      const images = env.IMAGES;
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        ...(images ? {
          transformImage: async (body, { width, format, quality }) => {
            const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
            return result.response();
          },
        } : {}),
      }, allowedWidths);
    }

    const response = await withWorkerEnv(env, async () => {
      if (url.pathname === "/gallery") {
        return stampGalleryResponse(request, await handler.fetch(request, env, ctx));
      }
      const binding = (env as Partial<CloudflareBindings>).LAST_GOOD;
      const store: LastGoodStore | undefined = binding ? {
        get: (key) => binding.get(key, "text"),
        put: (key, value, options) => binding.put(key, value, options),
      } : undefined;
      return withPublicLastGood(
        request,
        () => handler.fetch(request, env, ctx),
        {
          publicOnly: !getGitHubToken(),
          store,
          waitUntil: (promise) => ctx.waitUntil(promise),
        },
      );
    });
    return withHtmlSecurityHeaders(response);
  },
};

export default worker;
