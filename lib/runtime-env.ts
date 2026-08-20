import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Server-only Worker bindings needed by App Router routes. This is the
 * authoritative contract for secrets configured out-of-band with Wrangler.
 */
export interface CommitAtlasWorkerEnv {
  readonly GITHUB_TOKEN?: string;
}

const workerEnvStorage = new AsyncLocalStorage<CommitAtlasWorkerEnv>();

export function withWorkerEnv<T>(env: CommitAtlasWorkerEnv, operation: () => Promise<T>): Promise<T> {
  return workerEnvStorage.run(env, operation);
}

export function getGitHubToken(): string | undefined {
  // Node development uses ignored .env files; deployed Workers use the binding
  // installed by worker/index.ts for this request.
  return workerEnvStorage.getStore()?.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
}
