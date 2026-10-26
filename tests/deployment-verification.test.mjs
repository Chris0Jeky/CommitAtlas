import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createDeploymentChecks,
  SITEMAP_PATHS,
  fetchWithBoundedRetry,
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  parseVerificationArgs,
  verifyDeployment,
} from "../scripts/deployment-verification.mjs";

const TARGET = new URL("https://example.test/api/v1/probes/motion/css-enter.svg");
const EXPECTED_SHA = "a".repeat(40);

async function verifyHealthResponses(sequence, { expectedSha } = { expectedSha: EXPECTED_SHA }) {
  const calls = [];
  const delays = [];
  const reports = [];
  let healthPassed = false;
  let healthError;
  const fetchHealth = sequenceFetch(sequence, calls);
  const result = await verifyDeployment("https://example.test", {
    expectedSha,
    fetchImpl: (target, init) => target.pathname === "/api/v1/health"
      ? fetchHealth(target, init)
      : Promise.resolve(new Response("unavailable fixture", { status: 500 })),
    sleep: async (milliseconds) => delays.push(milliseconds),
    report: (message) => reports.push(message),
    onPass: (name) => { if (name.startsWith("health endpoint")) healthPassed = true; },
    onFailure: (name, error) => { if (name.startsWith("health endpoint")) healthError = error; },
  });
  return { ...result, calls, delays, reports, healthPassed, healthError };
}

for (const [label, buildSha] of [
  ["old", "b".repeat(40)], ["missing", undefined], ["unknown", null],
  ["malformed", "not-a-sha"], ["overlong", "b".repeat(1_000)],
]) {
  test(`health ${label} identity can propagate to the exact expected build`, async () => {
    const result = await verifyHealthResponses([
      Response.json({ status: "ok", buildSha }),
      Response.json({ status: "ok", buildSha: EXPECTED_SHA }),
    ]);
    assert.equal(result.healthPassed, true, result.healthError?.message);
    assert.equal(result.healthError, undefined);
    assert.equal(result.calls.length, 2);
    assert.deepEqual(result.delays, [5_000]);
    assert.equal(result.reports.length, 1);
    assert.match(result.reports[0], /build SHA.*attempt 2\/5 in 5s/);
    assert.ok(result.reports[0].length < 300, "malformed identity must not enter retry output");
    assert.equal(result.calls.every(({ target }) => new URL(target).search === ""), true);
  });

  test(`permanent ${label} identity never passes and exhausts only the shared five attempts`, async () => {
    const result = await verifyHealthResponses(Array.from({ length: MAX_ATTEMPTS },
      () => Response.json({ status: "ok", buildSha })));
    assert.equal(result.healthPassed, false);
    assert.match(result.healthError.message, /build SHA.*after 5 attempts/);
    assert.equal(result.calls.length, MAX_ATTEMPTS);
    assert.deepEqual(result.delays, RETRY_DELAYS_MS);
    assert.equal(result.reports.length, MAX_ATTEMPTS - 1);
    assert.ok(result.healthError.message.length < 300, "malformed identity must not enter failure output");
  });
}

test("transport failures and health identity propagation share one five-attempt budget", async () => {
  const result = await verifyHealthResponses([
    new TypeError("connection reset"),
    Response.json({ status: "ok", buildSha: "b".repeat(40) }),
    new TypeError("DNS lookup failed"),
    Response.json({ status: "ok" }),
    Response.json({ status: "ok", buildSha: EXPECTED_SHA }),
  ]);
  assert.equal(result.healthPassed, true, result.healthError?.message);
  assert.equal(result.calls.length, MAX_ATTEMPTS);
  assert.deepEqual(result.delays, RETRY_DELAYS_MS);
  assert.equal(result.reports.filter((message) => message.includes("transport error")).length, 2);
  assert.equal(result.reports.filter((message) => message.includes("build SHA")).length, 2);
});

test("transport failures cannot grant a stale build a fresh identity retry budget", async () => {
  const result = await verifyHealthResponses([
    new TypeError("connection reset"),
    Response.json({ status: "ok", buildSha: "b".repeat(40) }),
    new TypeError("DNS lookup failed"),
    Response.json({ status: "ok" }),
    Response.json({ status: "ok", buildSha: "b".repeat(40) }),
  ]);
  assert.equal(result.healthPassed, false);
  assert.match(result.healthError.message, /after 5 attempts/);
  assert.equal(result.calls.length, MAX_ATTEMPTS);
  assert.deepEqual(result.delays, RETRY_DELAYS_MS);
});

test("health HTTP, status, JSON and body-read failures remain immediate", async () => {
  for (const response of [
    new Response("unavailable", { status: 503 }),
    Response.json({ status: "error", buildSha: EXPECTED_SHA }),
    new Response("not JSON"),
    new Response(new ReadableStream({ start(controller) { controller.error(new Error("body read failed")); } })),
  ]) {
    const result = await verifyHealthResponses([response]);
    assert.equal(result.healthPassed, false);
    assert.ok(result.healthError);
    assert.equal(result.calls.length, 1);
    assert.deepEqual(result.delays, []);
  }
});

test("health identity retries consume each response once without cloning its body", async () => {
  const reads = [0, 0];
  const responses = ["b".repeat(40), EXPECTED_SHA].map((buildSha, index) => {
    const response = Response.json({ status: "ok", buildSha });
    const readJson = response.json.bind(response);
    response.json = () => { reads[index] += 1; return readJson(); };
    response.clone = () => { throw new Error("health must not clone its response stream"); };
    return response;
  });
  const result = await verifyHealthResponses([...responses]);
  assert.equal(result.healthPassed, true, result.healthError?.message);
  assert.deepEqual(reads, [1, 1]);
  assert.equal(responses.every((response) => response.bodyUsed), true);
});

test("status-only verification does not retry or require health identity", async () => {
  const result = await verifyHealthResponses([Response.json({ status: "ok" })], { expectedSha: undefined });
  assert.equal(result.healthPassed, true, result.healthError?.message);
  assert.equal(result.calls.length, 1);
  assert.deepEqual(result.delays, []);
});

function healthCheck(options) {
  const check = createDeploymentChecks(options).find(({ name }) => name.startsWith("health endpoint"));
  return {
    ...check,
    run: (fetchImpl) => check.run((path, requestOptions) => fetchWithBoundedRetry(new URL(path, TARGET), {
      ...requestOptions, fetchImpl, sleep: async () => {}, report: () => {},
    })),
  };
}

test("the health probe verifies the exact expected build", async () => {
  await healthCheck({ expectedSha: EXPECTED_SHA }).run(async () => new Response(JSON.stringify({
    status: "ok", buildSha: EXPECTED_SHA,
  })));
});

for (const [label, buildSha] of [
  ["missing", undefined], ["unknown", null], ["malformed", "not-a-sha"],
  ["overlong", `${EXPECTED_SHA}a`], ["another build", "b".repeat(40)],
]) {
  test(`the health probe rejects ${label} build identity despite status ok`, async () => {
    await assert.rejects(healthCheck({ expectedSha: EXPECTED_SHA }).run(async () => new Response(JSON.stringify({
      status: "ok", buildSha,
    }))), /build (?:SHA|identity)/i);
  });
}

test("status-only health checks preserve standalone verification without an expected SHA", async () => {
  await healthCheck().run(async () => new Response(JSON.stringify({ status: "ok" })));
});

test("invalid expected build identity fails before any network request", async () => {
  for (const expectedSha of [null, "", "unknown", "a".repeat(39), `${EXPECTED_SHA}\n`]) {
    let calls = 0;
    await assert.rejects(verifyDeployment("https://example.test", {
      expectedSha,
      fetchImpl: async () => { calls++; return new Response('{}'); },
      sleep: async () => {},
    }), /expected build SHA/i);
    assert.equal(calls, 0);
  }
});

test("verification arguments retain explicit status-only and expected-SHA modes", () => {
  assert.deepEqual(parseVerificationArgs(["https://example.test"]), {
    baseUrl: "https://example.test", expectedSha: undefined,
  });
  assert.deepEqual(parseVerificationArgs(["https://example.test", "--status-only"]), {
    baseUrl: "https://example.test", expectedSha: undefined,
  });
  assert.deepEqual(parseVerificationArgs(["https://example.test", "--expected-sha", EXPECTED_SHA]), {
    baseUrl: "https://example.test", expectedSha: EXPECTED_SHA,
  });
});

test("verification arguments reject missing or malformed identity and conflicting modes", () => {
  for (const args of [
    [], ["https://example.test", "--expected-sha"],
    ["https://example.test", "--expected-sha", "invalid"],
    ["https://example.test", "--expected-sha", EXPECTED_SHA, "--status-only"],
    ["https://example.test", "--unknown"],
  ]) {
    assert.throws(() => parseVerificationArgs(args), /usage:|expected build SHA/i);
  }
});

test("the verifier CLI forwards expected identity and labels standalone status checks", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "commitatlas-verifier-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const preload = path.join(directory, "fetch-fixture.mjs");
  writeFileSync(preload, `const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, _delay, ...args) => realSetTimeout(callback, 0, ...args);
globalThis.fetch = async (input) => new URL(input).pathname === "/api/v1/health"
    ? Response.json({ status: "ok", buildSha: "${"b".repeat(40)}" })
    : new Response("unavailable fixture", { status: 500 });\n`);
  const invoke = (args) => spawnSync(process.execPath, ["--import", pathToFileURL(preload).href,
    fileURLToPath(new URL("../scripts/verify-deployment.mjs", import.meta.url)), "https://example.test", ...args],
  { encoding: "utf8", timeout: 10_000 });

  const strict = invoke(["--expected-sha", EXPECTED_SHA]);
  assert.equal(strict.status, 1, strict.stderr);
  assert.match(strict.stdout, /FAIL\s+health endpoint/);
  assert.match(strict.stdout, new RegExp(`expected build SHA ${EXPECTED_SHA}, got ${"b".repeat(40)}`));
  assert.doesNotMatch(strict.stdout, /Status-only/);

  const standalone = invoke([]);
  assert.match(standalone.stdout, /Status-only checks: build identity is not verified/);
  assert.match(standalone.stdout, /PASS\s+health endpoint/);
});

function svgResponse(body = '<svg><title id="title">CSS enter probe</title></svg>', headers = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      etag: `W/"${"a".repeat(64)}"`,
      "content-security-policy": "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'",
      ...headers,
    },
  });
}

function sequenceFetch(sequence, calls) {
  return async (target, init) => {
    calls.push({ target: target.href, init });
    const next = sequence.shift();
    if (next instanceof Error) throw next;
    return next;
  };
}

function motionCheck() {
  const check = createDeploymentChecks().at(-1);
  assert.equal(check.name, "the fixed synthetic motion probe uses the production SVG response contract");
  return check;
}

async function runMotion(sequence) {
  const calls = [];
  const delays = [];
  const reports = [];
  const get = (path, { retryNotFound = false } = {}) =>
    fetchWithBoundedRetry(new URL(path, TARGET), {
      fetchImpl: sequenceFetch(sequence, calls),
      retryNotFound,
      sleep: async (milliseconds) => delays.push(milliseconds),
      report: (message) => reports.push(message),
    });
  await motionCheck().run(get);
  return { calls, delays, reports };
}

test("the ordered verifier surface has twenty-one checks", () => {
  assert.equal(createDeploymentChecks().length, 21);
});

test("retries an eligible 404 once, with the shared delay and report", async () => {
  const calls = [];
  const delays = [];
  const reports = [];
  const response = await fetchWithBoundedRetry(TARGET, {
    fetchImpl: sequenceFetch([new Response("stale", { status: 404 }), svgResponse()], calls),
    retryNotFound: true,
    sleep: async (milliseconds) => delays.push(milliseconds),
    report: (message) => reports.push(message),
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(delays, [5_000]);
  assert.equal(reports.length, 1);
  assert.match(reports[0], /HTTP 404/);
  assert.match(reports[0], /attempt 2\/5 in 5s/);
  assert.equal(calls[0].target, TARGET.href);
  assert.equal(new URL(calls[1].target).search, "", "retry must not add cache-busting query parameters");
});

test("fails explicitly after five eligible 404s and schedules only four delays", async () => {
  const calls = [];
  const delays = [];
  await assert.rejects(
    fetchWithBoundedRetry(TARGET, {
      fetchImpl: sequenceFetch(Array.from({ length: MAX_ATTEMPTS }, () => new Response("stale", { status: 404 })), calls),
      retryNotFound: true,
      sleep: async (milliseconds) => delays.push(milliseconds),
      report: () => {},
    }),
    /HTTP 404 after 5 attempts.*motion probe propagation did not complete/,
  );
  assert.equal(calls.length, MAX_ATTEMPTS);
  assert.deepEqual(delays, RETRY_DELAYS_MS);
});

test("a generic 404 is returned immediately without the motion exception", async () => {
  const calls = [];
  const delays = [];
  const response = await fetchWithBoundedRetry(TARGET, {
    fetchImpl: sequenceFetch([new Response("missing", { status: 404 })], calls),
    sleep: async (milliseconds) => delays.push(milliseconds),
    report: () => {},
  });
  assert.equal(response.status, 404);
  assert.equal(calls.length, 1);
  assert.deepEqual(delays, []);
});

test("non-404 HTTP failures remain immediate", async () => {
  for (const status of [400, 401, 403, 500]) {
    const calls = [];
    const delays = [];
    const response = await fetchWithBoundedRetry(TARGET, {
      fetchImpl: sequenceFetch([new Response("failure", { status })], calls),
      retryNotFound: true,
      sleep: async (milliseconds) => delays.push(milliseconds),
      report: () => {},
    });
    assert.equal(response.status, status);
    assert.equal(calls.length, 1);
    assert.deepEqual(delays, [], `HTTP ${status} must not sleep`);
  }
});

test("transport errors retry and then share the budget with eligible 404s", async () => {
  const calls = [];
  const delays = [];
  const reports = [];
  const response = await fetchWithBoundedRetry(TARGET, {
    fetchImpl: sequenceFetch([
      new TypeError("DNS lookup failed"),
      new Response("stale", { status: 404 }),
      new TypeError("connection reset"),
      new Response("stale", { status: 404 }),
      svgResponse(),
    ], calls),
    retryNotFound: true,
    sleep: async (milliseconds) => delays.push(milliseconds),
    report: (message) => reports.push(message),
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 5);
  assert.deepEqual(delays, RETRY_DELAYS_MS);
  assert.equal(reports.length, 4);
  assert.equal(reports.filter((message) => message.includes("transport error")).length, 2);
  assert.equal(reports.filter((message) => message.includes("HTTP 404")).length, 2);
});

test("the motion contract rejects wrong successful responses without retrying", async (t) => {
  const variants = [
    ["HTML body", new Response("<html>wrong</html>", { status: 200, headers: svgResponse().headers }), /not SVG markup/],
    ["wrong content type", svgResponse(undefined, { "content-type": "text/html" }), /expected SVG content type/],
    ["unsafe markup", svgResponse('<svg><script>alert(1)</script></svg>'), /forbidden markup/],
    ["wrong identity", svgResponse('<svg><title id="title">SMIL enter probe</title></svg>'), /identity is not CSS enter probe/],
  ];

  for (const [name, response, expected] of variants) {
    await t.test(name, async () => {
      const calls = [];
      const delays = [];
      const get = (path, { retryNotFound = false } = {}) =>
        fetchWithBoundedRetry(new URL(path, TARGET), {
          fetchImpl: sequenceFetch([response], calls),
          retryNotFound,
          sleep: async (milliseconds) => delays.push(milliseconds),
          report: () => {},
        });
      await assert.rejects(motionCheck().run(get), expected);
      assert.equal(calls.length, 1, `${name} must fail on the first response`);
      assert.deepEqual(delays, [], `${name} must not sleep`);
    });
  }
});

test("a successful motion response preserves the exact route identity and request", async () => {
  const result = await runMotion([svgResponse()]);
  assert.equal(result.calls.length, 1);
  assert.equal(new URL(result.calls[0].target).pathname, TARGET.pathname);
  assert.equal(new URL(result.calls[0].target).search, "");
  assert.deepEqual(result.delays, []);
  assert.deepEqual(result.reports, []);
});

function sitemapCheck() {
  const check = createDeploymentChecks().find(({ name }) => name.startsWith("sitemap.xml"));
  assert.ok(check);
  return check;
}

function sitemapResponse(paths) {
  const urls = paths.map((path) => `  <url><loc>https://commitatlas.example${path}</loc></url>`).join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset>\n${urls}\n</urlset>\n`, {
    status: 200,
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}

test("SITEMAP_PATHS matches INDEXABLE_PAGES in lib/site.ts", () => {
  const source = readFileSync(new URL("../lib/site.ts", import.meta.url), "utf8");
  const declared = /export const INDEXABLE_PAGES[^=]*=\s*\[([^\]]*)\]/.exec(source);
  assert.ok(declared, "INDEXABLE_PAGES not found in lib/site.ts");
  const pages = [...declared[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...SITEMAP_PATHS], pages);
});

test("the sitemap check accepts exactly the declared pages", async () => {
  await sitemapCheck().run(async () => sitemapResponse([...SITEMAP_PATHS].reverse()));
});

for (const [label, paths, message] of [
  ["a missing page", SITEMAP_PATHS.slice(1), /expected sitemap pages/],
  ["an unexpected page", [...SITEMAP_PATHS, "/extra"], /expected sitemap pages/],
  ["a repeated page", [...SITEMAP_PATHS, SITEMAP_PATHS[1]], /repeats an entry/],
]) {
  test(`the sitemap check rejects ${label}`, async () => {
    await assert.rejects(sitemapCheck().run(async () => sitemapResponse(paths)), message);
  });
}

test("the sitemap check rejects query strings and fragments", async () => {
  for (const suffix of ["?preview=1", "#section"]) {
    const paths = [...SITEMAP_PATHS.slice(0, -1), `${SITEMAP_PATHS.at(-1)}${suffix}`];
    await assert.rejects(sitemapCheck().run(async () => sitemapResponse(paths)), /not a canonical page URL/);
  }
});

test("the sitemap check decodes XML entities in <loc>", async () => {
  const body = `<urlset>${SITEMAP_PATHS.map((path) => `<url><loc>https://commitatlas.example${path}</loc></url>`).join("")}` +
    "<url><loc>https://commitatlas.example/a&amp;b</loc></url></urlset>";
  const response = new Response(body, { status: 200, headers: { "content-type": "application/xml" } });
  await assert.rejects(sitemapCheck().run(async () => response), /got \/, \/studio, \/gallery, \/a&b$/);
});
