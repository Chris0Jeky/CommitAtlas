import assert from "node:assert/strict";
import test from "node:test";
import { calculateGitHubCiState, toJsonCiSignal, toSvgCiState, toSvgLifecycle } from "./adapters";

const NOW = new Date("2026-08-19T00:00:00.000Z");

test("adapts every core lifecycle and CI state without inventing health", () => {
  assert.equal(toSvgLifecycle("planned"), "experimental");
  assert.equal(toSvgLifecycle("maintenance"), "maintained");
  assert.equal(toSvgLifecycle("archived"), "archived");
  assert.equal(toSvgCiState("pending"), "pending");
  assert.equal(toSvgCiState("unavailable"), "unavailable");
  assert.deepEqual(
    toJsonCiSignal({ state: "unconfigured", reason: "No CI workflow is configured" }, null, null),
    { state: "unconfigured", label: "Not configured", url: null, checkedAt: null, headSha: null },
  );
});

test("delegates stale, future, and unknown workflow evidence to core", () => {
  assert.equal(calculateGitHubCiState({ available: true, configured: true, conclusion: "success", updatedAt: "2026-08-15T00:00:00Z" }, NOW).state, "stale");
  assert.equal(calculateGitHubCiState({ available: true, configured: true, conclusion: "success", updatedAt: "2026-08-19T00:00:01Z" }, NOW).state, "unavailable");
  assert.equal(calculateGitHubCiState({ available: true, configured: true }, NOW).state, "unavailable");
});
