import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const enableVectorAndCreateAccounts: Migration = {
  async up(database: Kysely<unknown>) {
    await sql`create extension if not exists vector`.execute(database);

    await database.schema
      .createTable("accounts")
      .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn("email", "text", (column) => column.notNull().unique())
      .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("accounts").execute();

    await sql`drop extension if exists vector`.execute(database);
  },
};
