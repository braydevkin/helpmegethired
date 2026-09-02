import type { MigrationResultSet } from "kysely/migration";

import { loadLocalEnvironment } from "../config/load-local-environment";
import { validateDatabaseEnvironment } from "../config/validate-environment";
import { createDatabase } from "./database";
import { migrateDown, migrateToLatest } from "./migrator";

const commands = { up: migrateToLatest, down: migrateDown };

type Command = keyof typeof commands;

function isCommand(value: string | undefined): value is Command {
  return value !== undefined && value in commands;
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
  if (!isCommand(command)) {
    throw new Error(`Usage: migrate <${Object.keys(commands).join("|")}>`);
  }

  loadLocalEnvironment();

  const { DATABASE_URL } = validateDatabaseEnvironment(process.env);
  const database = createDatabase(DATABASE_URL);

  try {
    const resultSet = await commands[command](database);

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
