import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";

test("SVG determinism lint rejects clock and unseeded random sources", async () => {
  const eslint = new ESLint({ cwd: fileURLToPath(new URL("../../../", import.meta.url)) });
  for (const expression of ["Math.random()", "Math['random']()", "Date.now()", "Date['now']()", "new Date()", "crypto.randomUUID()", "crypto['randomUUID']()", "globalThis.Math.random()", "globalThis.Date.now()", "new globalThis.Date()", "globalThis.crypto.randomUUID()", "globalThis['Math']['random']()", "globalThis['Date']['now']()", "new globalThis['Date']()", "globalThis['crypto']['randomUUID']()", "Date()"] ) {
    const [result] = await eslint.lintText(`export const value = ${expression};`, { filePath: "packages/svg/src/determinism-probe.ts" });
    assert.ok(result.messages.some(message => message.ruleId === "no-restricted-syntax"), `missed ${expression}`);
  }
  const [stable] = await eslint.lintText("export const value = new Date('2026-01-01T00:00:00Z').getUTCFullYear();", { filePath: "packages/svg/src/determinism-probe.ts" });
  assert.equal(stable.errorCount, 0);
  const [outside] = await eslint.lintText("export const value = Math.random();", { filePath: "lib/determinism-probe.ts" });
  assert.equal(outside.errorCount, 0);
});
