import type { TestProject } from "vitest/node";

import { loadLocalEnvironment } from "./src/config/load-local-environment";
import { validateDatabaseEnvironment } from "./src/config/validate-environment";
import { createIsolatedDatabase } from "./src/database/testing/isolated-database";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function provideIsolatedDatabase(project: TestProject): Promise<() => Promise<void>> {
  loadLocalEnvironment();

  const { DATABASE_URL } = validateDatabaseEnvironment(process.env);
  const database = await createIsolatedDatabase(DATABASE_URL);

  project.provide("databaseUrl", database.connectionString);

  return database.drop;
}
