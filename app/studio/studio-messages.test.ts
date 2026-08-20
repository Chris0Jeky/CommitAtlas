import assert from "node:assert/strict";
import test from "node:test";
import { configurationChangedNotice, contributionUnavailableNotice, retainedPreviewNotice } from "./studio-messages";

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

test("describes unavailable contributions without inventing a failure cause", () => {
  const notice = contributionUnavailableNotice();
  assert.match(notice, /Streak and Activity are unavailable/);
  assert.match(notice, /omitted from README Markdown/);
  assert.doesNotMatch(notice, /token|rate limit|outage/i);
});

test("asks for a refresh when route-affecting configuration changes", () => {
  assert.equal(
    configurationChangedNotice(),
    "Configuration changed. Run Preview to refresh the evidence and generated URLs.",
  );
});
