import type { TestProject } from "vitest/node";

import { loadLocalEnvironment } from "./src/config/load-local-environment";
import {
  validateDatabaseEnvironment,
  validateQueueEnvironment,
  validateStorageEnvironment,
} from "./src/config/validate-environment";
import { createIsolatedDatabase } from "./src/database/testing/isolated-database";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
    storageEnvironment: Record<string, string>;
  }
}

const asVariables = (values: Record<string, string | number>): Record<string, string> =>
  Object.fromEntries(Object.entries(values).map(([name, value]) => [name, String(value)]));

export default async function provideBackingServices(project: TestProject): Promise<() => Promise<void>> {
  loadLocalEnvironment();

  const { DATABASE_URL } = validateDatabaseEnvironment(process.env);
  const { REDIS_URL } = validateQueueEnvironment(process.env);
  const storageEnvironment = validateStorageEnvironment(process.env);
  const database = await createIsolatedDatabase(DATABASE_URL);

  project.provide("databaseUrl", database.connectionString);
  project.provide("redisUrl", REDIS_URL);
  project.provide("storageEnvironment", asVariables(storageEnvironment));

  return database.drop;
}
