import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateDatabaseEnvironment } from "../config/validate-environment";
import { createDatabase, type Database } from "./database";
import { migrateDown, migrateToLatest } from "./migrator";

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

describe("migrations", () => {
  let database: Database;

  beforeAll(() => {
    database = createDatabase(validateDatabaseEnvironment(process.env).DATABASE_URL);
  });

  afterAll(async () => {
    await database.destroy();
  });

  it("enable the vector extension and create the accounts table", async () => {
    expect(await installedExtensions(database)).toContain("vector");
    expect(await tables(database)).toContain("accounts");
  });

  it("revert the last migration and apply it again", async () => {
    const reverted = await migrateDown(database);

    expect(reverted.error).toBeUndefined();
    expect(await tables(database)).not.toContain("accounts");
    expect(await installedExtensions(database)).not.toContain("vector");

    const reapplied = await migrateToLatest(database);

    expect(reapplied.error).toBeUndefined();
    expect(await tables(database)).toContain("accounts");
    expect(await installedExtensions(database)).toContain("vector");
  });
});
