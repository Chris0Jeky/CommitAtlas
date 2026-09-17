import assert from "node:assert/strict";
import test from "node:test";
import {
  directReducedMotionEvidence,
  frameTimes,
  validateCompletedDirectReport,
} from "./motion-probes/capture.mjs";

const directRow = (probe, embed, overrides = {}) => ({
  probe,
  embed,
  engine: "playwright-chromium",
  captures: frameTimes.map((timeMs) => ({
    timeMs,
    targetTimeMs: timeMs,
    file: `${probe}--${embed}/${timeMs}.png`,
  })),
  differences: frameTimes.slice(1).map((toMs, index) => ({
    fromMs: frameTimes[index],
    toMs,
    changedPixels: 0,
    totalChannelDelta: 0,
  })),
  selectedSource: `https://motion.example.test/probes/${probe}.svg`,
  reducedMotionControlPixels: null,
  reducedMotionControlVerified: false,
  verdict: "no motion detected",
  video: null,
  ...overrides,
});

const completeReport = () => ({
  selectedProbes: ["css-enter"],
  selectedEmbeds: ["img", "picture"],
  reducedMotion: false,
  recordVideo: false,
  rows: [
    directRow("css-enter", "img"),
    directRow("css-enter", "picture"),
  ],
});

test("direct report completion requires every selected probe/embed row exactly once", () => {
  assert.doesNotThrow(() => validateCompletedDirectReport(completeReport()));

  const missing = completeReport();
  missing.rows.pop();
  assert.throws(
    () => validateCompletedDirectReport(missing),
    /every selected probe\/embed row/,
  );

  const duplicate = completeReport();
  duplicate.rows[1] = directRow("css-enter", "img");
  assert.throws(
    () => validateCompletedDirectReport(duplicate),
    /duplicate direct capture row/,
  );

  const unplanned = completeReport();
  unplanned.rows[1] = directRow("css-breathe", "picture");
  assert.throws(
    () => validateCompletedDirectReport(unplanned),
    /unselected direct capture row/,
  );
});

test("direct report completion rejects missing frames and unmeasured verdicts", () => {
  const missingFrame = completeReport();
  missingFrame.rows[0].captures.pop();
  assert.throws(
    () => validateCompletedDirectReport(missingFrame),
    /retain every target frame/,
  );

  const unmeasured = completeReport();
  unmeasured.rows[0].verdict = "not tested";
  assert.throws(
    () => validateCompletedDirectReport(unmeasured),
    /measured verdict/,
  );
});

test("recorded direct reports require a retained video path and digest per row", () => {
  const report = completeReport();
  report.recordVideo = true;
  assert.throws(
    () => validateCompletedDirectReport(report),
    /video path/,
  );

  report.rows = report.rows.map((row) => ({
    ...row,
    video: {
      path: `${row.probe}--${row.embed}/motion.webm`,
      sha256: "a".repeat(64),
    },
  }));
  assert.doesNotThrow(() => validateCompletedDirectReport(report));
});

test("reduced-motion evidence fails closed when currentSrc cannot be read", () => {
  assert.throws(
    () => directReducedMotionEvidence(true, "", 12),
    /currentSrc/,
  );
  assert.throws(
    () => directReducedMotionEvidence(true, null, 12),
    /currentSrc/,
  );

  assert.deepEqual(
    directReducedMotionEvidence(
      true,
      "https://motion.example.test/probes/reduced-motion-control.svg",
      12,
    ),
    {
      reducedMotionControlPixels: 12,
      reducedMotionControlVerified: true,
    },
  );
  assert.deepEqual(
    directReducedMotionEvidence(
      true,
      "https://motion.example.test/probes/css-enter.svg",
      12,
    ),
    {
      reducedMotionControlPixels: 12,
      reducedMotionControlVerified: false,
    },
  );
  assert.deepEqual(
    directReducedMotionEvidence(false, null, null),
    {
      reducedMotionControlPixels: null,
      reducedMotionControlVerified: false,
    },
  );
});
