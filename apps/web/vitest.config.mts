import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const integrationTests = "src/**/*.integration.test.ts";

export default defineConfig({
  plugins: [react()],
  test: {
    css: { modules: { classNameStrategy: "non-scoped" } },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}", "eslint/**/*.test.mjs"],
          exclude: [...configDefaults.exclude, integrationTests],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: [integrationTests],
          fileParallelism: false,
        },
      },
    ],
  },
});
