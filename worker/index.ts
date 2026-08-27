/** Cloudflare Worker entry point for CommitAtlas. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { withPublicLastGood, type LastGoodStore } from "@/lib/last-good";
import { getGitHubToken, withWorkerEnv, type CommitAtlasWorkerEnv } from "@/lib/runtime-env";

interface Env extends CommitAtlasWorkerEnv, CloudflareBindings {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  IMAGES: {
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

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return withWorkerEnv(env, async () => {
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
  },
};

export default worker;
