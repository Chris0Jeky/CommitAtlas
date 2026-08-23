#!/usr/bin/env node
/**
 * Post-deployment smoke check for a hosted CommitAtlas surface.
 *
 * Every probe uses the deterministic synthetic mode, so this proves the
 * deployment itself rather than GitHub's anonymous availability. A failure
 * here means the deployed Worker is wrong, not that GitHub rate-limited us.
 */
const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("usage: node scripts/verify-deployment.mjs <base-url>");
  process.exit(2);
}

const base = new URL(baseUrl);
if (base.protocol !== "https:") {
  console.error(`refusing to verify a non-HTTPS origin: ${base.origin}`);
  process.exit(2);
}

// Each route declares its own allowed parameters (lib/svg-routes.ts), so a
// single shared query string would be rejected as an unknown parameter. Probe
// every card with a query its own contract actually accepts.
const BASE = "demo=true&theme=ember&motion=subtle";
const SVG_CARDS = [
  `/api/v1/cards/atlas.svg?user=octocat&days=365&layout=wide&${BASE}`,
  `/api/v1/cards/profile.svg?user=octocat&${BASE}`,
  `/api/v1/cards/streak.svg?user=octocat&${BASE}`,
  `/api/v1/cards/breakdown.svg?user=octocat&days=365&${BASE}`,
  `/api/v1/cards/rhythm.svg?user=octocat&days=365&${BASE}`,
  `/api/v1/cards/activity.svg?user=octocat&days=90&${BASE}`,
  `/api/v1/cards/languages.svg?user=octocat&${BASE}`,
  `/api/v1/projects.svg?owner=octocat&repos=commitatlas,hello-world&states=commitatlas:active,hello-world:maintenance&${BASE}`,
];

/** @type {{name: string, run: (fetchPath: (p: string) => Promise<Response>) => Promise<void>}[]} */
const checks = [
  {
    name: "health endpoint reports ok",
    async run(get) {
      const response = await get("/api/v1/health");
      assert(response.status === 200, `expected 200, got ${response.status}`);
      const body = await response.json();
      assert(body.status === "ok", `expected status "ok", got ${JSON.stringify(body.status)}`);
    },
  },
  {
    name: "landing page server-renders the product surface",
    async run(get) {
      const response = await get("/");
      assert(response.status === 200, `expected 200, got ${response.status}`);
      const html = await response.text();
      assert(/<title>CommitAtlas/.test(html), "landing page is missing its CommitAtlas title");
    },
  },
  {
    name: "Studio server-renders its own page, not the landing page",
    async run(get) {
      const response = await get("/studio");
      assert(response.status === 200, `expected 200, got ${response.status}`);
      const html = await response.text();
      // The landing page also contains the word "Studio", so match the title
      // the Studio route alone sets (app/studio/page.tsx).
      assert(/<title>Studio\s*—\s*CommitAtlas/.test(html), "the /studio response is not the Studio page");
    },
  },
  ...SVG_CARDS.map((path) => ({
    name: `synthetic ${path.split("?")[0]} renders a safe SVG`,
    /** @param {(p: string) => Promise<Response>} get */
    async run(get) {
      const response = await get(path);
      assert(response.status === 200, `expected 200, got ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      assert(/image\/svg\+xml/.test(contentType), `expected an SVG content type, got "${contentType}"`);
      assertSafeSvgMarkup(await response.text());
    },
  })),
  {
    name: "an out-of-range parameter value is rejected as bounded, uncached JSON",
    async run(get) {
      await assertBoundedRejection(get, "/api/v1/cards/atlas.svg?user=octocat&demo=true&theme=not-a-theme");
    },
  },
  {
    name: "an unknown parameter is rejected as bounded, uncached JSON",
    async run(get) {
      await assertBoundedRejection(get, "/api/v1/cards/atlas.svg?user=octocat&demo=true&nonsense=1");
    },
  },
  {
    name: "motion=none still renders a safe SVG with its own security headers",
    async run(get) {
      // Every other probe uses motion=subtle, which takes the inline-style CSP
      // branch. This exercises the other one.
      const response = await get("/api/v1/cards/atlas.svg?user=octocat&demo=true&theme=ember&days=365&motion=none&layout=wide");
      assert(response.status === 200, `expected 200, got ${response.status}`);
      const svg = await response.text();
      assert(!/@keyframes/.test(svg), "motion=none must not emit animation keyframes");
      assertSafeSvgMarkup(svg);
      const csp = response.headers.get("content-security-policy");
      assert(csp !== null && /script-src\s+'none'/.test(csp), `expected a script-blocking CSP, got "${csp}"`);
    },
  },
];

async function assertBoundedRejection(get, path) {
  const response = await get(path);
  assert(response.status === 400, `expected 400, got ${response.status}`);
  assert(
    response.headers.get("cache-control") === "no-store",
    `expected no-store, got "${response.headers.get("cache-control")}"`,
  );
  const contentType = response.headers.get("content-type") ?? "";
  assert(/application\/json/.test(contentType), `expected JSON, got "${contentType}"`);
  const body = await response.json();
  assert(body?.status === "error", `expected an error envelope, got ${JSON.stringify(body).slice(0, 120)}`);
}

function assertSafeSvgMarkup(svg) {
  assert(svg.trimStart().startsWith("<svg") || svg.trimStart().startsWith("<?xml"), "response is not SVG markup");
  for (const forbidden of ["<script", "<foreignObject", "<iframe", 'href="http://', " onload=", " onclick="]) {
    assert(!svg.toLowerCase().includes(forbidden.toLowerCase()), `rendered SVG contains forbidden markup: ${forbidden}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const TRANSPORT_RETRIES = 5;

async function get(path) {
  const target = new URL(path, base);
  for (let attempt = 1; attempt <= TRANSPORT_RETRIES; attempt += 1) {
    try {
      return await fetch(target, { headers: { "user-agent": "CommitAtlas-deployment-check" } });
    } catch (cause) {
      // A newly created workers.dev hostname can take up to a minute to resolve
      // everywhere, so back off generously. Only a transport failure is retried:
      // any response we actually received is the answer, including an error.
      if (attempt === TRANSPORT_RETRIES) throw new Error(`could not reach ${target.href}: ${cause}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    }
  }
  throw new Error("unreachable");
}

let failed = 0;
console.log(`Verifying ${base.origin}\n`);
for (const check of checks) {
  try {
    await check.run(get);
    console.log(`  PASS  ${check.name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${check.name}\n        ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
