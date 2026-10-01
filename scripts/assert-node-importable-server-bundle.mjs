import { readFile } from "node:fs/promises";

const bundleUrl = new URL("../dist/server/index.js", import.meta.url);
const source = await readFile(bundleUrl, "utf8");
const matches = [...source.matchAll(/cloudflare:[a-zA-Z0-9_./-]+/g)];

if (matches.length > 0) {
  const details = matches.map((match) => {
    const offset = match.index ?? 0;
    const start = Math.max(0, offset - 120);
    const end = Math.min(source.length, offset + match[0].length + 120);
    const context = source.slice(start, end).replaceAll("\n", "\\n");
    return `- ${match[0]} at byte ${offset}\n  ${context}`;
  });
  throw new Error(
    `Built server bundle contains ${matches.length} unsupported cloudflare: specifier occurrence(s). ` +
    `Stock Node must be able to import dist/server/index.js for the rendered contract tests.\n${details.join("\n")}`,
  );
}

process.stdout.write("Built server bundle contains no cloudflare: specifiers.\n");
