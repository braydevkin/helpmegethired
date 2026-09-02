import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const unverifiablePasswordHash = "";

export const addAccountCredentialsAndSessions: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .alterTable("accounts")
      .addColumn("password_hash", "text", (column) => column.notNull().defaultTo(unverifiablePasswordHash))
      .execute();

    await database.schema
      .alterTable("accounts")
      .alterColumn("password_hash", (column) => column.dropDefault())
      .execute();

    await database.schema
      .createTable("sessions")
      .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn("account_id", "uuid", (column) =>
        column.notNull().references("accounts.id").onDelete("cascade"),
      )
      .addColumn("token_hash", "text", (column) => column.notNull().unique())
      .addColumn("expires_at", "timestamptz", (column) => column.notNull())
      .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createIndex("sessions_account_id_idx")
      .on("sessions")
      .column("account_id")
      .execute();
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("sessions").execute();

    await database.schema.alterTable("accounts").dropColumn("password_hash").execute();
  },
};
