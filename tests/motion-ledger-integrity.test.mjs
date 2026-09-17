import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ledgerUrl = new URL(
  "./fixtures/motion-probes/evidence/2026-08-29-worker-direct.json",
  import.meta.url,
);

const measuredRowsSha256 = (rows) => createHash("sha256")
  .update(JSON.stringify(rows.map(({ engine, probe, embed, pairs, verdict }) => ({
    engine,
    probe,
    embed,
    pairs,
    verdict,
  }))))
  .digest("hex");

test("legacy direct Worker motion ledger pins every measured row", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const rows = ledger.pixelMatrix?.results;

  assert.ok(Array.isArray(rows), "the legacy ledger must expose measured pixel rows");
  assert.equal(rows.length, 48, "the authoritative matrix must keep all 48 measured rows");
  assert.equal(rows.length, ledger.pixelMatrix.rowCount, "the declared row count must match the matrix");
  assert.equal(
    measuredRowsSha256(rows),
    "0000000000000000000000000000000000000000000000000000000000000000",
    "the measured pair magnitudes and recorded verdicts must stay pinned",
  );
});
