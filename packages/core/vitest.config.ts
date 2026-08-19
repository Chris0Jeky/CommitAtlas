import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/core/core.test.ts"],
    pool: "forks",
    maxWorkers: 2,
  },
});
