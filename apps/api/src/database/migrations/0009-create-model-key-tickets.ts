import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

// A ticket is kept only as its SHA-256. Redeeming it deletes the row, and an Account's expired
// rows go when it asks for another ticket.
export const createModelKeyTickets: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .createTable("model_key_tickets")
      .addColumn("token_hash", "text", (column) => column.primaryKey())
      .addColumn("account_id", "uuid", (column) => column.notNull().references("accounts.id").onDelete("cascade"))
      .addColumn("expires_at", "timestamptz", (column) => column.notNull())
      .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema.createIndex("model_key_tickets_account_id_idx").on("model_key_tickets").column("account_id").execute();
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("model_key_tickets").execute();
  },
};
