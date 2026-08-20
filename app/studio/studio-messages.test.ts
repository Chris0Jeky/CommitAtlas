import assert from "node:assert/strict";
import test from "node:test";
import { retainedPreviewNotice } from "./studio-messages";

test("labels retained preview data after an upstream failure", () => {
  assert.equal(
    retainedPreviewNotice("GitHub data is currently unavailable", "octocat"),
    "GitHub data is currently unavailable. Existing preview @octocat remains visible and was not replaced.",
  );
});

test("normalizes terminal punctuation without creating a doubled stop", () => {
  assert.equal(
    retainedPreviewNotice("Enter a valid GitHub handle before previewing.", "octocat"),
    "Enter a valid GitHub handle before previewing. Existing preview @octocat remains visible and was not replaced.",
  );
});
