import { readFile } from "node:fs/promises";

const bundleUrl = new URL("../dist/server/index.js", import.meta.url);
const source = await readFile(bundleUrl, "utf8");
const matches = [...source.matchAll(/cloudflare:[a-zA-Z0-9_./-]+/g)];
const allowed = new Set(["cloudflare:workers"]);
const unsupported = matches.filter((match) => !allowed.has(match[0]));

if (unsupported.length > 0) {
  const details = unsupported.map((match) => {
    const offset = match.index ?? 0;
    const start = Math.max(0, offset - 120);
    const end = Math.min(source.length, offset + match[0].length + 120);
    const context = source.slice(start, end).replaceAll("\n", "\\n");
    return `- ${match[0]} at byte ${offset}\n  ${context}`;
  });
  throw new Error(
    `Built server bundle contains ${unsupported.length} unsupported cloudflare: specifier occurrence(s). ` +
    `The Node contract harness shims only cloudflare:workers.\n${details.join("\n")}`,
  );
}

const workerImports = matches.filter((match) => match[0] === "cloudflare:workers").length;
process.stdout.write(
  workerImports === 0
    ? "Built server bundle contains no cloudflare: runtime imports.\n"
    : `Built server bundle contains ${workerImports} allowlisted cloudflare:workers import occurrence(s).\n`,
);
