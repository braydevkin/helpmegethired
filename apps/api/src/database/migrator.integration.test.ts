import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateDatabaseEnvironment } from "../config/validate-environment";
import { createDatabase, type Database } from "./database";
import { migrateDown, migrateToLatest } from "./migrator";

const applicationTables = ["accounts", "sessions", "ingestions", "ingestion_segments"];

interface ExtensionRow {
  extname: string;
}

async function installedExtensions(database: Database): Promise<string[]> {
  const { rows } = await sql<ExtensionRow>`select extname from pg_extension`.execute(database);

  return rows.map((row) => row.extname);
}

async function tables(database: Database): Promise<string[]> {
  const found = await database.introspection.getTables();

  return found.map((table) => table.name);
}

async function revertEveryMigration(database: Database): Promise<void> {
  let reverted = await migrateDown(database);

  while (reverted.results?.length) {
    expect(reverted.error).toBeUndefined();
    reverted = await migrateDown(database);
  }
}

describe("migrations", () => {
  let database: Database;

  beforeAll(() => {
    database = createDatabase(validateDatabaseEnvironment(process.env).DATABASE_URL);
  });

  afterAll(async () => {
    await database.destroy();
  });

  it("enable the vector extension and create every application table", async () => {
    expect(await installedExtensions(database)).toContain("vector");
    expect(await tables(database)).toEqual(expect.arrayContaining(applicationTables));
  });

  it("revert every migration and apply them all again", async () => {
    await revertEveryMigration(database);

    expect(await tables(database)).toEqual(expect.not.arrayContaining(applicationTables));
    expect(await installedExtensions(database)).not.toContain("vector");

    const reapplied = await migrateToLatest(database);

    expect(reapplied.error).toBeUndefined();
    expect(await tables(database)).toEqual(expect.arrayContaining(applicationTables));
    expect(await installedExtensions(database)).toContain("vector");
  });
});
