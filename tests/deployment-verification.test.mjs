import assert from "node:assert/strict";
import test from "node:test";

import {
  createDeploymentChecks,
  fetchWithBoundedRetry,
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
} from "../scripts/deployment-verification.mjs";

const TARGET = new URL("https://example.test/api/v1/probes/motion/css-enter.svg");

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

test("the ordered verifier surface has eighteen checks", () => {
  assert.equal(createDeploymentChecks().length, 18);
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
