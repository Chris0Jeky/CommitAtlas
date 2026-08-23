import assert from "node:assert/strict";
import test from "node:test";

import { extractDeployedOrigin } from "../scripts/deployed-origin.mjs";

const SUCCESSFUL_DEPLOY = `
Total Upload: 1054.74 KiB / gzip: 299.60 KiB
Worker Startup Time: 22 ms
Uploaded commit-atlas (14.45 sec)
Deployed commit-atlas triggers (4.54 sec)
  https://commit-atlas.commit-atlas.workers.dev
Current Version ID: 168ef4e0-0862-4eed-b9ba-d144fe281832
`;

test("reads the workers.dev origin Wrangler reports", () => {
  assert.equal(extractDeployedOrigin(SUCCESSFUL_DEPLOY), "https://commit-atlas.commit-atlas.workers.dev");
});

test("prefers a bound custom domain over the workers.dev fallback", () => {
  const output = `
Deployed commit-atlas triggers (4.54 sec)
  https://commit-atlas.commit-atlas.workers.dev
  https://atlas.example.com/*
Current Version ID: 168ef4e0
`;
  assert.equal(extractDeployedOrigin(output), "https://atlas.example.com");
});

test("ignores unrelated URLs printed elsewhere in the stream", () => {
  // Every one of these was observed or is plausible in a real run, and a
  // whole-stream URL scan would return the wrong origin for each.
  for (const noise of [
    "npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.0.0",
    "▲ [WARNING] The route https://old.example.com/* is no longer attached.",
    "Need help? https://workers.cloudflare.com/",
    "  https://preview-alias.commit-atlas.workers.dev",
  ]) {
    assert.equal(
      extractDeployedOrigin(`${noise}\n${SUCCESSFUL_DEPLOY}`),
      "https://commit-atlas.commit-atlas.workers.dev",
      `noise line leaked into the result: ${noise}`,
    );
  }
});

test("stops at the first non-URL line after the marker", () => {
  const output = `
Deployed commit-atlas triggers (4.54 sec)
  https://commit-atlas.commit-atlas.workers.dev
Current Version ID: 168ef4e0
  https://not-a-route.example.com
`;
  assert.equal(extractDeployedOrigin(output), "https://commit-atlas.commit-atlas.workers.dev");
});

test("returns null rather than guessing when there is no deployment report", () => {
  for (const output of [
    "",
    "   ",
    "npm notice Changelog: https://github.com/npm/cli/releases",
    "Deployed commit-atlas triggers (4.54 sec)\nCurrent Version ID: 168ef4e0",
    "Deployed commit-atlas triggers (4.54 sec)\n  http://insecure.example.com",
    "Deployed commit-atlas triggers (4.54 sec)\n  https://[not a url",
  ]) {
    assert.equal(extractDeployedOrigin(output), null, `expected null for: ${JSON.stringify(output)}`);
  }
  assert.equal(extractDeployedOrigin(undefined), null);
});
