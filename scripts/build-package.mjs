import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  removePackageDist,
  resolvePackageContext,
  withPackageBuildLock,
} from "./package-build-utils.mjs";

const context = resolvePackageContext();
const result = withPackageBuildLock(context.repositoryRoot, () => {
  removePackageDist(context);
  const compiler = path.join(context.repositoryRoot, "node_modules", "typescript", "bin", "tsc");
  if (!fs.statSync(compiler).isFile()) {
    throw new Error(`TypeScript compiler is unavailable: ${compiler}`);
  }
  return spawnSync(process.execPath, [compiler, "-p", "tsconfig.json"], {
    cwd: context.packageRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
});

if (result.error) throw result.error;
if (result.signal) throw new Error(`TypeScript compiler exited after signal ${result.signal}`);
process.exitCode = result.status ?? 1;
