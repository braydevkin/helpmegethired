import { Migrator, type Migration, type MigrationProvider, type MigrationResultSet } from "kysely/migration";

import type { Database } from "./database";
import { migrations } from "./migrations";

class RegisteredMigrations implements MigrationProvider {
  constructor(private readonly registry: Record<string, Migration>) {}

  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve(this.registry);
  }
}

export function createMigrator(database: Database): Migrator {
  return new Migrator({ db: database, provider: new RegisteredMigrations(migrations) });
}

export function migrateToLatest(database: Database): Promise<MigrationResultSet> {
  return createMigrator(database).migrateToLatest();
}

export function migrateDown(database: Database): Promise<MigrationResultSet> {
  return createMigrator(database).migrateDown();
}
