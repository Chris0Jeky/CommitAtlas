import assert from "node:assert/strict";
import test from "node:test";

import { formatDeploymentIdentity } from "../scripts/deploy-identity.mjs";

const SHA = "a".repeat(40);
const VERSION = "168ef4e0-0862-4eed-b9ba-d144fe281832";

test("formats the commit and Wrangler version for the log and step summary", () => {
  assert.equal(
    formatDeploymentIdentity(` ${SHA}\n`, `Uploaded commit-atlas\r\n\u001b[32mCurrent Version ID: ${VERSION}\u001b[0m\r\n`),
    `Commit SHA: ${SHA}\nWorker version ID: ${VERSION}\n`,
  );
});

test("reports missing identity as unknown rather than guessing from unrelated output", () => {
  assert.equal(
    formatDeploymentIdentity(undefined, `notice: ${VERSION}\nCurrent Version ID: invalid`),
    "Commit SHA: unknown\nWorker version ID: unknown\n",
  );
  assert.equal(
    formatDeploymentIdentity("bad\nInjected summary", ""),
    "Commit SHA: unknown\nWorker version ID: unknown\n",
  );
});
