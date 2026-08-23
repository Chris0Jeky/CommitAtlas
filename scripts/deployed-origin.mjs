/**
 * Read the origin a `wrangler deploy` actually published to, out of its own
 * report.
 *
 * A `workers.dev` hostname is `<worker-name>.<account-subdomain>.workers.dev`,
 * so it differs per Cloudflare account and cannot be hard-coded. Wrangler's
 * output is also noisy — npm update notices, route warnings, and help links all
 * carry https URLs — so this deliberately does NOT scan the whole stream for
 * anything URL-shaped. It anchors on the `Deployed <name> triggers` line and
 * reads only the bound routes Wrangler lists immediately after it.
 *
 * This lives in its own module so it can be imported by a test without running
 * a deployment as a side effect.
 */

const DEPLOYED_MARKER = /^\s*(?:[^\w\s]\s*)?Deployed\s+\S+\s+triggers?\b/i;
const URL_ONLY_LINE = /^\s*(?:[-*]\s*)?(https:\/\/\S+?)\/?\s*$/;

/**
 * @param {string} output combined stdout and stderr from `wrangler deploy`
 * @returns {string | null} the deployed origin, or null if none could be read
 */
export function extractDeployedOrigin(output) {
  const lines = String(output ?? "").split(/\r?\n/);
  const marker = lines.findIndex((line) => DEPLOYED_MARKER.test(line));
  if (marker === -1) return null;

  const routes = [];
  // Wrangler lists each bound route on its own line directly beneath the
  // marker. Stop at the first line that is not a bare URL, so a later
  // "Current Version ID:" or an unrelated notice can never be mistaken for one.
  for (let index = marker + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    const match = URL_ONLY_LINE.exec(line);
    if (!match) break;
    routes.push(match[1]);
  }
  if (routes.length === 0) return null;

  // A custom domain is the real public origin when one is bound; the
  // workers.dev hostname is the fallback.
  const custom = routes.find((url) => !url.includes(".workers.dev"));
  try {
    const origin = new URL(custom ?? routes[0]).origin;
    return origin.startsWith("https://") ? origin : null;
  } catch {
    return null;
  }
}
