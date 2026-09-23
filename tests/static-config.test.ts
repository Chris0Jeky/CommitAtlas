import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { parseStaticConfig, resolveContainedPath } from "@commit-atlas/static";

const LABEL = "output";

function baseConfig(): Record<string, unknown> {
  return {
    version: 1,
    user: "octocat",
    outputDir: "dist/site",
    projects: [{ repo: "octocat/hello-world", label: "Hello", lifecycle: "active" }],
  };
}

function assertParseMessage(input: unknown, message: string): void {
  assert.throws(
    () => parseStaticConfig(input),
    (error: unknown) => {
      assert.equal((error as Error).message, message);
      return true;
    },
    `expected parseStaticConfig to throw ${JSON.stringify(message)}`,
  );
}

async function assertContainedPathMessage(
  root: string,
  relativePath: string,
  mustExist: boolean,
  message: string,
): Promise<void> {
  await assert.rejects(
    resolveContainedPath(root, relativePath, { mustExist, label: LABEL }),
    (error: unknown) => {
      assert.equal((error as Error).message, message);
      return true;
    },
    `expected resolveContainedPath(${JSON.stringify(relativePath)}) to throw ${JSON.stringify(message)}`,
  );
}

test("parses a minimal config and normalizes backslashes to forward slashes", () => {
  const config = parseStaticConfig({
    ...baseConfig(),
    user: "OctoCat",
    outputDir: "dist\\site",
    themes: [{ theme: "paper", outputDir: "themes\\paper" }],
  });

  assert.equal(config.version, 1);
  assert.equal(config.user, "octocat");
  assert.equal(config.outputDir, "dist/site");
  assert.equal(config.themes.length, 1);
  assert.equal(config.themes[0]?.theme, "paper");
  assert.equal(config.themes[0]?.outputDir, "themes/paper");
  assert.equal(config.projects[0]?.repo, "octocat/hello-world");
});

test("rejects duplicate cards with the exact message", () => {
  assertParseMessage(
    { ...baseConfig(), cards: ["atlas", "atlas"] },
    "cards must not contain duplicates",
  );
});

test("rejects responsiveAtlas without atlas with the exact message", () => {
  assertParseMessage(
    { ...baseConfig(), cards: ["profile"], responsiveAtlas: true },
    "responsiveAtlas requires atlas in cards",
  );
});

test("rejects a duplicate theme variant with the exact message", () => {
  assertParseMessage(
    { ...baseConfig(), themes: [{ theme: "aurora", outputDir: "themes/aurora" }] },
    "themes must not contain duplicate themes",
  );
});

test("rejects a variant with the same colour scheme as the base theme", () => {
  assertParseMessage(
    { ...baseConfig(), themes: [{ theme: "midnight", outputDir: "themes/midnight" }] },
    "themes must use the opposite colour scheme",
  );
});

test("rejects a variant outputDir that collides case-insensitively", () => {
  assertParseMessage(
    { ...baseConfig(), themes: [{ theme: "paper", outputDir: "DIST/SITE" }] },
    "themes must use unique outputDir paths",
  );
});

test("rejects a project whose repo owner differs from the configured user", () => {
  assertParseMessage(
    {
      ...baseConfig(),
      projects: [{ repo: "someone-else/hello-world", label: "Hello", lifecycle: "active" }],
    },
    "Every v1 static project must be owned by the configured user",
  );
});

let rootDir = "";

before(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "commitatlas-static-config-"));
});

after(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

test("rejects an absolute path as non-relative", async () => {
  await assertContainedPathMessage(
    rootDir,
    path.resolve(rootDir, "nested"),
    false,
    `${LABEL} path must be relative`,
  );
});

test("rejects a parent-directory escape", async () => {
  await assertContainedPathMessage(rootDir, "..", false, `${LABEL} path must stay inside the repository`);
});

test("rejects a '.' segment", async () => {
  await assertContainedPathMessage(
    rootDir,
    "nested/./file.txt",
    false,
    `${LABEL} path must stay inside the repository`,
  );
});

test("rejects an empty segment", async () => {
  await assertContainedPathMessage(
    rootDir,
    "nested//file.txt",
    false,
    `${LABEL} path must stay inside the repository`,
  );
});

test("returns the resolved path for a missing nested path when mustExist is false", async () => {
  const relative = "nested/dir/file.txt";
  const actual = await resolveContainedPath(rootDir, relative, { mustExist: false, label: LABEL });
  assert.equal(actual, path.resolve(rootDir, relative));
});

test("rejects a missing final component when mustExist is true", async () => {
  await assertContainedPathMessage(rootDir, "missing-final-component.txt", true, `${LABEL} path does not exist`);
});

test("rejects a missing intermediate component when mustExist is true", async () => {
  await assertContainedPathMessage(rootDir, "missing-dir/file.txt", true, `${LABEL} path does not exist`);
});
