#!/usr/bin/env node
import { verifyDeployment } from "./deployment-verification.mjs";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("usage: node scripts/verify-deployment.mjs <base-url>");
  process.exit(2);
}

console.log(`Verifying ${new URL(baseUrl).origin}\n`);

try {
  const { total, failed } = await verifyDeployment(baseUrl, {
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
