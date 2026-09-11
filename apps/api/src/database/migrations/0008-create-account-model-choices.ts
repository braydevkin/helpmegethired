import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { ModelIdSchema, ProviderSchema } from "@helpmegethired/shared";

const quoted = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));

// One row per Account. A revoked key leaves the row with no sealed key, so the Model Choice
// survives the revocation.
export const createAccountModelChoices: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .createTable("account_model_choices")
      .addColumn("account_id", "uuid", (column) => column.primaryKey().references("accounts.id").onDelete("cascade"))
      .addColumn("provider", "text", (column) => column.notNull().check(sql`provider in (${quoted(ProviderSchema.options)})`))
      .addColumn("model_id", "text", (column) => column.notNull().check(sql`model_id in (${quoted(ModelIdSchema.options)})`))
      .addColumn("sealed_key", "bytea")
      .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("account_model_choices").execute();
  },
};
