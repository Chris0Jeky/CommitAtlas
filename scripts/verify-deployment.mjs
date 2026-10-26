#!/usr/bin/env node
import { parseVerificationArgs, verifyDeployment } from "./deployment-verification.mjs";

try {
  const { baseUrl, expectedSha } = parseVerificationArgs(process.argv.slice(2));
  console.log(`Verifying ${new URL(baseUrl).origin}`);
  console.log(expectedSha ? `Expected build SHA: ${expectedSha}\n` : "Status-only checks: build identity is not verified.\n");
  const { total, failed } = await verifyDeployment(baseUrl, {
    expectedSha,
    report: (message) => console.log(`  RETRY ${message}`),
    onPass: (name) => console.log(`  PASS  ${name}`),
    onFailure: (name, error) => console.log(`  FAIL  ${name}\n        ${error instanceof Error ? error.message : String(error)}`),
  });
  console.log(`\n${total - failed}/${total} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
