import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.E2E_BASE_URL;
const builtWebAppPort = 3100;
const builtWebAppUrl = `http://localhost:${builtWebAppPort}`;
const isCi = Boolean(process.env.CI);

const builtWebApp = {
  command: `pnpm --filter web start --port ${builtWebAppPort}`,
  cwd: "..",
  url: builtWebAppUrl,
  reuseExistingServer: !isCi,
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL: externalBaseUrl ?? builtWebAppUrl,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl ? undefined : builtWebApp,
});
