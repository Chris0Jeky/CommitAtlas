import { stripVTControlCharacters } from "node:util";

/** Format public deployment identity for both stdout and GITHUB_STEP_SUMMARY. */
export function formatDeploymentIdentity(sha, output) {
  const commit = sha?.trim();
  const version = stripVTControlCharacters(output ?? "").match(
    /^\s*Current Version ID:\s*([a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\s*$/im,
  )?.[1];
  return `Commit SHA: ${/^[a-f\d]{40}$/i.test(commit ?? "") ? commit : "unknown"}\n` +
    `Worker version ID: ${version ?? "unknown"}\n`;
}
