import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEVELOPER_LENS_PRODUCER_COMMIT,
  DEVELOPER_LENS_SUMMARY_SHA256,
  DeveloperLensMethodTrialSummarySchema,
  developerLensMethodTrialSummary,
} from "./research-bridge";

const summaryPath = new URL("../research-contracts/method-trial-summary/v1/wbc1.summary.json", import.meta.url);

test("accepts the pinned, strictly bounded method-trial summary", () => {
  assert.equal(developerLensMethodTrialSummary.schema_version, "DeveloperLensMethodTrialSummary.v1");
  assert.equal(developerLensMethodTrialSummary.classification, "C0");
  assert.equal(developerLensMethodTrialSummary.metrics.detection_rate.baseline.value, 0.75);
  assert.equal(developerLensMethodTrialSummary.metrics.detection_rate.candidate.value, 0.75);
  assert.equal(developerLensMethodTrialSummary.metrics.false_alerts_per_year.baseline.value, 2.966666666666667);
  assert.equal(developerLensMethodTrialSummary.metrics.false_alerts_per_year.candidate.value, 4.2);
  assert.equal(developerLensMethodTrialSummary.threshold_viability.baseline, false);
  assert.equal(developerLensMethodTrialSummary.threshold_viability.candidate, false);
  assert.equal(developerLensMethodTrialSummary.retained_fallback.retained, true);
  assert.equal(developerLensMethodTrialSummary.trial.verdict, "reject");
  assert.throws(() => DeveloperLensMethodTrialSummarySchema.parse({
    ...developerLensMethodTrialSummary,
    unexpected: "not part of the contract",
  }), /unexpected/i);
});

test("pins producer provenance and the vendored summary content", () => {
  const bytes = readFileSync(summaryPath);
  const digest = `sha256:${createHash("sha256").update(bytes.toString("utf8").replaceAll("\r\n", "\n")).digest("hex")}`;

  assert.equal(DEVELOPER_LENS_PRODUCER_COMMIT, "425708e03e7bbc3cf09f64e9c154938989647dbe");
  assert.equal(DEVELOPER_LENS_SUMMARY_SHA256, digest);
  assert.equal(developerLensMethodTrialSummary.provenance.run_id, "wbc1_demo");
  assert.equal(developerLensMethodTrialSummary.provenance.derivation, "MethodTrialViewSchema.parse");
  assert.equal(developerLensMethodTrialSummary.provenance.public_url, "https://chris0jeky.github.io/developer-lens/?view=method-trial");
});

test("rejects summaries whose semantics contradict the frozen verdict", () => {
  const lowerFalseAlerts = structuredClone(developerLensMethodTrialSummary);
  lowerFalseAlerts.metrics.false_alerts_per_year.candidate.value = 2;
  assert.throws(
    () => DeveloperLensMethodTrialSummarySchema.parse(lowerFalseAlerts),
    /candidate must have more false alerts/i,
  );

  const unequalDetection = structuredClone(developerLensMethodTrialSummary);
  unequalDetection.metrics.detection_rate.candidate.value = 0.5;
  assert.throws(
    () => DeveloperLensMethodTrialSummarySchema.parse(unequalDetection),
    /equal baseline and candidate detection/i,
  );

  const duplicateLimitation = structuredClone(developerLensMethodTrialSummary);
  duplicateLimitation.limitations[1] = duplicateLimitation.limitations[0];
  assert.throws(
    () => DeveloperLensMethodTrialSummarySchema.parse(duplicateLimitation),
    /limitations must be unique and complete/i,
  );

  const mismatchedClaim = structuredClone(developerLensMethodTrialSummary);
  mismatchedClaim.unsupported_claims[0] = {
    ...mismatchedClaim.unsupported_claims[0],
    display_text: mismatchedClaim.unsupported_claims[1].display_text,
  };
  assert.throws(
    () => DeveloperLensMethodTrialSummarySchema.parse(mismatchedClaim),
    /unsupported claim text must match its code/i,
  );
});
