import { stripVTControlCharacters } from "node:util";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Read this checkout, never a workflow environment claim or an enclosing repository. */
export function readCheckoutSha(directory = fileURLToPath(new URL("../", import.meta.url))) {
  try {
    // Git's repository/config overrides can point HEAD at unrelated source even with cwd set.
    // Keep normal .git/worktree discovery and leave the caller's environment untouched.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
    const options = { cwd: directory, encoding: "utf8", env };
    const root = spawnSync("git", ["rev-parse", "--show-toplevel"], options);
    if (root.status !== 0 || realpathSync(root.stdout.trim()) !== realpathSync(directory)) return null;
    const revision = spawnSync("git", ["rev-parse", "--verify", "HEAD"], options);
    const sha = revision.stdout?.trim();
    return revision.status === 0 && /^[a-f\d]{40}$/i.test(sha ?? "") ? sha.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Format public deployment identity for both stdout and GITHUB_STEP_SUMMARY. */
export function formatDeploymentIdentity(sha, output) {
  const commit = sha?.trim();
  const version = stripVTControlCharacters(output ?? "").match(
    /^\s*Current Version ID:\s*([a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\s*$/im,
  )?.[1];
  return `Commit SHA: ${/^[a-f\d]{40}$/i.test(commit ?? "") ? commit : "unknown"}\n` +
    `Worker version ID: ${version ?? "unknown"}\n`;
}
