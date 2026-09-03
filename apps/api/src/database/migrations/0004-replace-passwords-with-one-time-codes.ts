import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const unverifiablePasswordHash = "";

export const replacePasswordsWithOneTimeCodes: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema.alterTable("accounts").dropColumn("password_hash").execute();

    await database.schema
      .alterTable("accounts")
      .addColumn("name", "text")
      .addColumn("last_name", "text")
      .addColumn("phone_country_code", "text")
      .addColumn("phone_number", "text")
      .addColumn("address", "text")
      .addColumn("email_verified_at", "timestamptz")
      .execute();

    await database.schema
      .createTable("verification_tokens")
      .addColumn("identifier", "text", (column) => column.notNull())
      .addColumn("token_hash", "text", (column) => column.notNull())
      .addColumn("expires_at", "timestamptz", (column) => column.notNull())
      .addPrimaryKeyConstraint("verification_tokens_pkey", ["identifier", "token_hash"])
      .execute();
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("verification_tokens").execute();

    await database.schema
      .alterTable("accounts")
      .dropColumn("name")
      .dropColumn("last_name")
      .dropColumn("phone_country_code")
      .dropColumn("phone_number")
      .dropColumn("address")
      .dropColumn("email_verified_at")
      .execute();

    await database.schema
      .alterTable("accounts")
      .addColumn("password_hash", "text", (column) => column.notNull().defaultTo(unverifiablePasswordHash))
      .execute();

    await database.schema
      .alterTable("accounts")
      .alterColumn("password_hash", (column) => column.dropDefault())
      .execute();
  },
};
