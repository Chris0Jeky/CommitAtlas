import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LOCK_TIMEOUT_MS = 120_000;
const INVALID_LOCK_GRACE_MS = 30_000;
const WAIT_MS = 50;

export function resolvePackageContext(packageJsonInput = process.env.npm_package_json) {
  if (!packageJsonInput) {
    throw new Error("npm_package_json is required to operate on a package build");
  }

  const packageJsonPath = path.resolve(packageJsonInput);
  const packageRoot = path.dirname(packageJsonPath);
  const packagesDirectory = path.dirname(packageRoot);
  const repositoryRoot = path.dirname(packagesDirectory);
  const expectedPackageRoot = path.join(repositoryRoot, "packages", path.basename(packageRoot));

  if (path.basename(packagesDirectory) !== "packages" || !samePath(packageRoot, expectedPackageRoot)) {
    throw new Error(`Refusing to operate on package outside repository packages/: ${packageRoot}`);
  }
  if (!fs.statSync(packageJsonPath).isFile()) {
    throw new Error(`Refusing to operate from unexpected package metadata path: ${packageJsonPath}`);
  }

  const realRepositoryRoot = fs.realpathSync.native(repositoryRoot);
  const realPackagesDirectory = fs.realpathSync.native(packagesDirectory);
  if (!samePath(realPackagesDirectory, path.join(realRepositoryRoot, "packages"))) {
    throw new Error(`Refusing to operate through a linked packages directory: ${packagesDirectory}`);
  }
  const realPackageRoot = fs.realpathSync.native(packageRoot);
  const expectedRealPackageRoot = path.join(realPackagesDirectory, path.basename(packageRoot));
  if (!samePath(realPackageRoot, expectedRealPackageRoot)) {
    throw new Error(`Refusing to operate on a linked package root: ${packageRoot}`);
  }
  const expectedRealPackageJson = path.join(realPackageRoot, "package.json");
  if (!samePath(fs.realpathSync.native(packageJsonPath), expectedRealPackageJson)) {
    throw new Error(`Refusing to operate through linked package metadata: ${packageJsonPath}`);
  }

  return {
    packageJsonPath,
    packageRoot,
    packagesDirectory,
    realPackageRoot,
    repositoryRoot: realRepositoryRoot,
  };
}

export function removePackageDist(context) {
  const distDirectory = path.join(context.packageRoot, "dist");
  if (!samePath(path.dirname(distDirectory), context.packageRoot)) {
    throw new Error(`Refusing to clean unexpected dist path: ${distDirectory}`);
  }
  if (fs.existsSync(distDirectory)) {
    const stat = fs.lstatSync(distDirectory);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to clean linked dist directory: ${distDirectory}`);
    }
    const realDistDirectory = fs.realpathSync.native(distDirectory);
    if (!samePath(path.dirname(realDistDirectory), context.realPackageRoot)) {
      throw new Error(`Refusing to clean dist outside its package root: ${realDistDirectory}`);
    }
  }
  fs.rmSync(distDirectory, { force: true, recursive: true });
}

export function withPackageBuildLock(repositoryRoot, operation) {
  const canonicalRoot = fs.realpathSync.native(repositoryRoot);
  const key = createHash("sha256").update(canonicalRoot).digest("hex").slice(0, 20);
  const lockPath = path.join(os.tmpdir(), `commitatlas-package-build-${key}.lock`);
  const token = randomUUID();
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (!tryAcquireLock(lockPath, token, canonicalRoot)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for the CommitAtlas package build lock: ${lockPath}`);
    }
    wait(WAIT_MS);
  }

  try {
    return operation();
  } finally {
    releaseOwnedLock(lockPath, token);
  }
}

function tryAcquireLock(lockPath, token, repositoryRoot) {
  try {
    const descriptor = fs.openSync(lockPath, "wx");
    try {
      fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, repositoryRoot, token }));
    } finally {
      fs.closeSync(descriptor);
    }
    return true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  if (lockOwnerIsGone(lockPath)) {
    throw new Error(`A stale CommitAtlas package build lock needs manual removal: ${lockPath}`);
  }
  return false;
}

function lockOwnerIsGone(lockPath) {
  let payload;
  try {
    const stat = fs.lstatSync(lockPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to use a linked package build lock: ${lockPath}`);
    }
    payload = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (!Number.isSafeInteger(payload.pid) || payload.pid <= 0) {
      return Date.now() - stat.mtimeMs > INVALID_LOCK_GRACE_MS;
    }
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    if (error instanceof SyntaxError) {
      try {
        return Date.now() - fs.statSync(lockPath).mtimeMs > INVALID_LOCK_GRACE_MS;
      } catch (statError) {
        if (statError?.code === "ENOENT") return false;
        throw statError;
      }
    }
    throw error;
  }

  try {
    process.kill(payload.pid, 0);
    return false;
  } catch (error) {
    return error?.code === "ESRCH";
  }
}

function releaseOwnedLock(lockPath, token) {
  try {
    const payload = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (payload.token === token) fs.rmSync(lockPath, { force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function samePath(left, right) {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
