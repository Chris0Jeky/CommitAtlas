import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  expectedHostedAssetName,
  frameTimes,
  fulfillValidatedHostedAssetRoute,
  summarizeBrowserHostedAssetObservations,
  validateCompletedDirectReport,
} from "./motion-probes/capture.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const assetBase = "https://motion.example.test/probes/";
const targetUrl = `${assetBase}css-enter.svg`;
const body = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120"></svg>');
const bodySha256 = sha256(body);

function compactObservation(overrides = {}) {
  return {
    asset: "css-enter",
    url: targetUrl,
    status: 200,
    contentType: "image/svg+xml; charset=utf-8",
    bodySha256,
    ...overrides,
  };
}

function completeHostedReport(overrides = {}) {
  return {
    selectedProbes: ["css-enter"],
    selectedEmbeds: ["img"],
    reducedMotion: false,
    recordVideo: false,
    assetBase,
    hostedAssetObservations: [{
      probe: "css-enter",
      status: 200,
      contentType: "image/svg+xml; charset=utf-8",
      bodySha256,
      width: 360,
      height: 120,
    }],
    rows: [{
      probe: "css-enter",
      embed: "img",
      engine: "playwright-chromium",
      captures: frameTimes.map((timeMs) => ({
        timeMs,
        targetTimeMs: timeMs,
        file: `css-enter--img/${timeMs}.png`,
      })),
      differences: frameTimes.slice(1).map((toMs, index) => ({
        fromMs: frameTimes[index],
        toMs,
        changedPixels: 0,
        totalChannelDelta: 0,
      })),
      selectedSource: targetUrl,
      browserHostedAssetObservation: {
        ...compactObservation(),
        interceptionCount: frameTimes.length,
      },
      reducedMotionControlPixels: null,
      reducedMotionControlVerified: false,
      verdict: "no motion detected",
      video: null,
    }],
    ...overrides,
  };
}

test("hosted asset selection follows the browser-selected reduced-motion source", () => {
  assert.equal(expectedHostedAssetName("css-enter", "img", false), "css-enter");
  assert.equal(expectedHostedAssetName("css-enter", "picture", false), "css-enter");
  assert.equal(expectedHostedAssetName("css-enter", "img", true), "css-enter");
  assert.equal(expectedHostedAssetName("css-enter", "picture", true), "reduced-motion-control");
});

test("browser route validation forwards the exact hashed body and returns compact evidence", async () => {
  let fetchOptions;
  let fulfillOptions;
  const response = {
    url: () => targetUrl,
    status: () => 200,
    headerValue: async (name) => name.toLowerCase() === "content-type" ? "image/svg+xml; charset=utf-8" : null,
    body: async () => body,
  };
  const route = {
    fetch: async (options) => {
      fetchOptions = options;
      return response;
    },
    fulfill: async (options) => {
      fulfillOptions = options;
    },
  };

  const observation = await fulfillValidatedHostedAssetRoute(route, {
    asset: "css-enter",
    targetUrl,
    expectedBodySha256: bodySha256,
  });

  assert.deepEqual(fetchOptions, { maxRedirects: 0 });
  assert.equal(fulfillOptions.response, response);
  assert.deepEqual(fulfillOptions.body, body);
  assert.deepEqual(observation, compactObservation());
  assert.equal(Object.hasOwn(observation, "headers"), false);
});

test("browser route validation fails closed before fulfillment on identity drift", async () => {
  let fulfilled = false;
  const response = {
    url: () => targetUrl,
    status: () => 200,
    headerValue: async () => "image/svg+xml",
    body: async () => Buffer.from("different body"),
  };
  const route = {
    fetch: async () => response,
    fulfill: async () => {
      fulfilled = true;
    },
  };

  await assert.rejects(
    fulfillValidatedHostedAssetRoute(route, {
      asset: "css-enter",
      targetUrl,
      expectedBodySha256: bodySha256,
    }),
    /browser-rendered body must match the synthetic fixture SHA-256/,
  );
  assert.equal(fulfilled, false);
});

test("browser route validation rejects URL, status, and MIME drift before fulfillment", async () => {
  const scenarios = [
    {
      responseUrl: `${targetUrl}?redirected=1`,
      status: 200,
      contentType: "image/svg+xml",
      expected: /response URL must match/,
    },
    {
      responseUrl: targetUrl,
      status: 503,
      contentType: "image/svg+xml",
      expected: /must return 200/,
    },
    {
      responseUrl: targetUrl,
      status: 200,
      contentType: "text/html; charset=utf-8",
      expected: /must be image\/svg\+xml/,
    },
  ];

  for (const scenario of scenarios) {
    let fulfilled = false;
    const response = {
      url: () => scenario.responseUrl,
      status: () => scenario.status,
      headerValue: async () => scenario.contentType,
      body: async () => body,
    };
    await assert.rejects(
      fulfillValidatedHostedAssetRoute({
        fetch: async () => response,
        fulfill: async () => { fulfilled = true; },
      }, { asset: "css-enter", targetUrl, expectedBodySha256: bodySha256 }),
      scenario.expected,
    );
    assert.equal(fulfilled, false);
  }
});

test("browser observations summarize only an identical per-row response identity", () => {
  const first = compactObservation();
  assert.deepEqual(
    summarizeBrowserHostedAssetObservations([first, { ...first }]),
    { ...first, interceptionCount: 2 },
  );
  assert.throws(
    () => summarizeBrowserHostedAssetObservations([]),
    /at least one browser response/,
  );
  assert.throws(
    () => summarizeBrowserHostedAssetObservations([
      first,
      compactObservation({ bodySha256: "b".repeat(64) }),
    ]),
    /same response identity/,
  );
});

test("completed hosted reports require browser-bound evidence for every rendered request", () => {
  const report = completeHostedReport();
  assert.doesNotThrow(() => validateCompletedDirectReport(report));

  const missing = structuredClone(report);
  delete missing.rows[0].browserHostedAssetObservation;
  assert.throws(
    () => validateCompletedDirectReport(missing),
    /browser-bound hosted asset observation/,
  );

  const mismatched = structuredClone(report);
  mismatched.rows[0].browserHostedAssetObservation.bodySha256 = "b".repeat(64);
  assert.throws(
    () => validateCompletedDirectReport(mismatched),
    /must match the preflight fixture SHA-256/,
  );

  const undercounted = structuredClone(report);
  undercounted.rows[0].browserHostedAssetObservation.interceptionCount = 1;
  assert.throws(
    () => validateCompletedDirectReport(undercounted),
    /must bind every rendered request/,
  );
});
