import { existsSync } from "node:fs";

const localEnvironmentFile = ".env";

export function loadLocalEnvironment(): void {
  if (existsSync(localEnvironmentFile)) {
    process.loadEnvFile(localEnvironmentFile);
  }
}
