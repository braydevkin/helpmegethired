import swc from "unplugin-swc";
import { configDefaults, defineConfig } from "vitest/config";

const decoratorMetadata = swc.vite({
  jsc: {
    target: "es2022",
    transform: { legacyDecorator: true, decoratorMetadata: true },
  },
  module: { type: "es6" },
});

const integrationTests = "src/**/*.integration.test.ts";

export default defineConfig({
  plugins: [decoratorMetadata],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, integrationTests],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: [integrationTests],
          fileParallelism: false,
          globalSetup: ["./vitest.integration.global-setup.ts"],
          setupFiles: ["./vitest.integration.setup.ts"],
          env: {
            NODE_ENV: "test",
            WEB_ORIGIN: "http://localhost:3000",
          },
        },
      },
    ],
  },
});
