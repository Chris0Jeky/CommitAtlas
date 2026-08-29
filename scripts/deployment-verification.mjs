/**
 * Post-deployment smoke checks and their bounded request helper.
 *
 * Every probe uses the deterministic synthetic mode, so this proves the
 * deployment itself rather than GitHub's anonymous availability. A failure
 * here means the deployed Worker is wrong, not that GitHub rate-limited us.
 */

export const RETRY_DELAYS_MS = [5_000, 10_000, 15_000, 20_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

const REQUEST_HEADERS = { "user-agent": "CommitAtlas-deployment-check" };

/**
 * Fetch a deployment route with one shared attempt budget.
 *
 * Transport errors are retryable for every route. A received 404 is retryable
 * only when the caller opts into the fixed motion-probe exception. Every
 * other response is returned to the route assertion immediately.
 *
 * @param {URL} target
 * @param {{fetchImpl?: typeof fetch, sleep?: (milliseconds: number) => Promise<void>, report?: (message: string) => void, retryNotFound?: boolean}} [options]
 */
export async function fetchWithBoundedRetry(
  target,
  {
    fetchImpl = globalThis.fetch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    report = (message) => console.log(`  RETRY ${message}`),
    retryNotFound = false,
  } = {},
) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(target, { headers: REQUEST_HEADERS });
    } catch (cause) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`could not reach ${target.href} after ${MAX_ATTEMPTS} attempts: ${cause}`);
      }

      await scheduleRetry({
        target,
        attempt,
        reason: `transport error: ${cause instanceof Error ? cause.message : String(cause)}`,
        sleep,
        report,
      });
      continue;
    }

    if (!(retryNotFound && response.status === 404)) return response;
    if (attempt === MAX_ATTEMPTS) {
      throw new Error(
        `${target.href} returned HTTP 404 after ${MAX_ATTEMPTS} attempts (motion probe propagation did not complete)`,
      );
    }

    await scheduleRetry({
      target,
      attempt,
      reason: "HTTP 404 for the fixed motion probe",
      sleep,
      report,
    });
  }

  throw new Error("unreachable");
}

async function scheduleRetry({ target, attempt, reason, sleep, report }) {
  const delay = RETRY_DELAYS_MS[attempt - 1];
  report(`${target.href} — ${reason}; attempt ${attempt + 1}/${MAX_ATTEMPTS} in ${delay / 1_000}s`);
  await sleep(delay);
}

/** Build the ordered deployment checks for one verifier run. */
export function createDeploymentChecks() {
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

  /**
   * The sitemap URL robots.txt advertised, captured by the robots probe and cross-checked by the
   * sitemap probe. Deliberately not compared against the origin under test: the served files name
   * the canonical origin, which differs from a fork's own subdomain or a custom domain.
   */
  let advertisedSitemap = null;

  return [
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
      name: "robots.txt is served and keeps crawlers off the render endpoints",
      async run(get) {
        const response = await get("/robots.txt");
        assert(response.status === 200, `expected 200, got ${response.status}`);
        const contentType = response.headers.get("content-type") ?? "";
        assert(/^text\/plain\b/i.test(contentType), `expected text/plain, got "${contentType}"`);
        const body = await response.text();
        assert(/^Disallow: \/api\/$/m.test(body), "robots.txt does not disallow the render endpoints");
        assert(!/^Disallow: \/$/m.test(body), "robots.txt deindexes the whole site");
        // Deliberately NOT `new URL("/sitemap.xml", base)`. The served robots.txt names the
        // canonical SITE_ORIGIN by design, so on a fork's own workers.dev subdomain, or behind a
        // custom domain reached via DEPLOY_BASE_URL, `base` and the canonical origin differ and an
        // equality check would fail a perfectly healthy deployment. That is the exact inverse of
        // the false pass this script exists to prevent. Assert the shape, then cross-check that
        // robots.txt and the sitemap agree with each other, which is origin-independent and is the
        // property that actually matters.
        const sitemapLine = /^Sitemap: (https:[^\s]+\/sitemap\.xml)$/m.exec(body);
        assert(sitemapLine, "robots.txt names no https sitemap");
        advertisedSitemap = sitemapLine[1];
      },
    },
    {
      name: "sitemap.xml lists the canonical pages and nothing dynamic",
      async run(get) {
        const response = await get("/sitemap.xml");
        assert(response.status === 200, `expected 200, got ${response.status}`);
        const contentType = response.headers.get("content-type") ?? "";
        assert(/^application\/xml\b/i.test(contentType), `expected application/xml, got "${contentType}"`);
        const body = await response.text();
        const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
        assert(locations.length === 2, `expected 2 sitemap entries, got ${locations.length}`);
        assert(!/\/api\//.test(body), "sitemap advertises a dynamic render endpoint as a document");
        // Every entry must be absolute and on one origin, or a crawler reads the set as duplicates.
        for (const location of locations) {
          assert(
            location.startsWith(new URL(locations[0]).origin),
            `sitemap mixes origins: ${location}`,
          );
        }
        // And that origin must be the one robots.txt advertised. This is the real invariant: the
        // two files must describe the same site as each other, whatever origin that is.
        if (advertisedSitemap) {
          assert(
            locations[0].startsWith(new URL(advertisedSitemap).origin),
            `robots.txt advertises ${advertisedSitemap} but the sitemap lists ${locations[0]}`,
          );
        }
      },
    },
    {
      name: "the landing page carries structured data with no invented rating",
      async run(get) {
        const response = await get("/");
        assert(response.status === 200, `expected 200, got ${response.status}`);
        const html = await response.text();
        const block = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html);
        assert(block, "no JSON-LD block was rendered");
        const graph = JSON.parse(block[1]);
        assert(graph["@context"] === "https://schema.org", "JSON-LD is not schema.org");
        const software = graph["@graph"].find((node) => node["@type"] === "SoftwareApplication");
        assert(software, "JSON-LD has no SoftwareApplication node");
        assert(
          software.aggregateRating === undefined && software.review === undefined,
          "JSON-LD claims a rating or review the project cannot evidence",
        );
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
        // Both branches block script; only the no-motion branch also blocks
        // inline style, so assert that or the probe cannot tell them apart.
        assert(/style-src\s+'none'/.test(csp), `expected motion=none to block inline style, got "${csp}"`);
      },
    },
    {
      name: "the fixed synthetic motion probe uses the production SVG response contract",
      async run(get) {
        const path = "/api/v1/probes/motion/css-enter.svg";
        const response = await get(path, { retryNotFound: true });
        assert(response.status === 200, `expected 200, got ${response.status}`);
        assert(
          response.headers.get("content-type") === "image/svg+xml; charset=utf-8",
          `expected SVG content type, got "${response.headers.get("content-type")}"`,
        );
        assert(
          response.headers.get("cache-control") === "public, max-age=60, s-maxage=300",
          `expected public probe cache, got "${response.headers.get("cache-control")}"`,
        );
        assert(/^W\/"[a-f\d]{64}"$/.test(response.headers.get("etag") ?? ""), "probe is missing its weak ETag");
        const csp = response.headers.get("content-security-policy") ?? "";
        assert(/script-src\s+'none'/.test(csp), `expected a script-blocking CSP for CSS probe, got "${csp}"`);
        assert(/style-src\s+'unsafe-inline'/.test(csp), `expected inline-style CSP for CSS probe, got "${csp}"`);
        const svg = await response.text();
        assertSafeSvgMarkup(svg);
        assert(/<title id="title">CSS enter probe<\/title>/.test(svg), "motion probe identity is not CSS enter probe");
      },
    },
  ];
}

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

export function assertSafeSvgMarkup(svg) {
  assert(svg.trimStart().startsWith("<svg") || svg.trimStart().startsWith("<?xml"), "response is not SVG markup");
  for (const forbidden of ["<script", "<foreignObject", "<iframe", 'href="http://', " onload=", " onclick="]) {
    assert(!svg.toLowerCase().includes(forbidden.toLowerCase()), `rendered SVG contains forbidden markup: ${forbidden}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Run all checks against one HTTPS origin. */
export async function verifyDeployment(
  baseUrl,
  { fetchImpl = globalThis.fetch, sleep, report = () => {}, onPass = () => {}, onFailure = () => {} } = {},
) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:") {
    throw new Error(`refusing to verify a non-HTTPS origin: ${base.origin}`);
  }

  const get = (path, { retryNotFound = false } = {}) =>
    fetchWithBoundedRetry(new URL(path, base), { fetchImpl, sleep, report, retryNotFound });
  const checks = createDeploymentChecks();
  let failed = 0;

  for (const check of checks) {
    try {
      await check.run(get);
      onPass(check.name);
    } catch (error) {
      failed += 1;
      onFailure(check.name, error);
    }
  }

  return { total: checks.length, failed };
}
