#!/usr/bin/env node
/**
 * Build, deploy, and verify — against the origin this deployment actually
 * created.
 *
 * A `workers.dev` hostname is `<worker-name>.<account-subdomain>.workers.dev`,
 * so it differs per Cloudflare account. Hard-coding one origin would make a
 * fork's verification probe someone else's healthy site and report success for
 * a deployment that never worked. This script therefore reads the origin out of
 * Wrangler's own output, and refuses to verify anything if it cannot find one.
 *
 * Usage:
 *   node scripts/deploy.mjs [--skip-build]
 *
 * Environment:
 *   DEPLOY_BASE_URL   verify this origin instead of the one Wrangler reports
 *                     (set it when the Worker answers on a custom domain)
 */
import { spawnSync } from "node:child_process";

const skipBuild = process.argv.includes("--skip-build");

/**
 * `npm` and `npx` are `.cmd` shims on Windows, which Node refuses to spawn
 * without a shell. Passing an args array alongside `shell: true` is deprecated
 * (DEP0190) because the arguments are concatenated rather than escaped — so
 * every command routed through here is a fixed literal with nothing
 * interpolated into it.
 */
function runShell(commandLine, options = {}) {
  const result = spawnSync(commandLine, { shell: true, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}

/**
 * Anything carrying a value from outside this script goes through argv with no
 * shell, so it can never be interpreted as shell syntax.
 */
function runNode(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

function exitOnFailure(label, status) {
  if (status !== 0) {
    console.error(`\n${label} failed with exit code ${status}.`);
    process.exit(status ?? 1);
  }
}

/**
 * Pull the deployed origin out of Wrangler's report. It prints each bound route
 * on its own line, so prefer a custom domain over the workers.dev fallback when
 * both are present.
 */
export function extractDeployedOrigin(output) {
  const urls = [...output.matchAll(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?/gi)]
    .map((match) => match[0].replace(/[).,]+$/, ""))
    .filter((url) => !/(developers|dash|blog|community)\.cloudflare\.com/i.test(url));
  if (urls.length === 0) return null;
  const custom = urls.find((url) => !url.includes(".workers.dev"));
  try {
    return new URL(custom ?? urls[0]).origin;
  } catch {
    return null;
  }
}

if (!skipBuild) {
  console.log("> building the Worker and its assets\n");
  exitOnFailure("npm run build", runShell("npm run build", { stdio: "inherit" }).status);
}

console.log("\n> deploying to Cloudflare Workers\n");
const deploy = runShell("npx wrangler deploy");
process.stdout.write(deploy.stdout ?? "");
process.stderr.write(deploy.stderr ?? "");
exitOnFailure("wrangler deploy", deploy.status);

const reported = extractDeployedOrigin(`${deploy.stdout ?? ""}\n${deploy.stderr ?? ""}`);
const override = process.env.DEPLOY_BASE_URL?.trim();
const baseUrl = override || reported;

if (!baseUrl) {
  console.error(
    "\nDeployment succeeded, but no origin could be read from Wrangler's output, so it was NOT verified." +
      "\nRe-run the check yourself against the correct origin:" +
      "\n  node scripts/verify-deployment.mjs https://<your-worker>.<your-subdomain>.workers.dev" +
      "\nor set DEPLOY_BASE_URL and re-run this script.",
  );
  process.exit(1);
}

if (override && reported && override !== reported) {
  console.log(`\nnote: verifying DEPLOY_BASE_URL (${override}) rather than the reported ${reported}.`);
}

console.log(`\n> verifying ${baseUrl}\n`);
exitOnFailure("deployment verification", runNode(["scripts/verify-deployment.mjs", baseUrl]).status);
