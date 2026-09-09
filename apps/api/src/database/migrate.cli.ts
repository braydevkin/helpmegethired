import type { MigrationResultSet } from "kysely/migration";

import { loadLocalEnvironment } from "../config/load-local-environment";
import { validateDatabaseEnvironment } from "../config/validate-environment";
import { createDatabase, type Database } from "./database";
import { isMigrateCommand, type MigrateCommand, migrateCommands } from "./migrate-command";
import { migrateDown, migrateToLatest } from "./migrator";

function migrate(command: MigrateCommand, database: Database): Promise<MigrationResultSet> {
  switch (command) {
    case "up":
      return migrateToLatest(database);
    case "down":
      return migrateDown(database);
  }
}

function report({ results = [], error }: MigrationResultSet): void {
  for (const result of results) {
    console.log(`${result.direction.padEnd(4)} ${result.migrationName}: ${result.status}`);
  }

  if (results.length === 0 && !error) {
    console.log("Nothing to migrate.");
  }
}

async function main(command: string | undefined): Promise<void> {
  if (!isMigrateCommand(command)) {
    throw new Error(`Usage: migrate <${migrateCommands.join("|")}>`);
  }

  loadLocalEnvironment();

  const { DATABASE_URL } = validateDatabaseEnvironment(process.env);
  const database = createDatabase(DATABASE_URL);

  try {
    const resultSet = await migrate(command, database);

    report(resultSet);

    if (resultSet.error) {
      throw resultSet.error;
    }
  } finally {
    await database.destroy();
  }
}

main(process.argv[2]).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
