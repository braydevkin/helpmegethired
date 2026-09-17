import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { CurationPauseReasonSchema } from "@helpmegethired/shared";

const pauseReasons = sql.join(CurationPauseReasonSchema.options.map((reason) => sql.lit(reason)));

// Embedding is the platform's only AI spend (ADR-0023), so it is counted per Account and UTC day
// (#133). A past day's row stays as the record of what that day spent.
export const createEmbeddingAllowances: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .createTable("embedding_usage")
      .addColumn("account_id", "uuid", (column) => column.notNull().references("accounts.id").onDelete("cascade"))
      .addColumn("period_start", "date", (column) => column.notNull())
      .addColumn("tokens", "integer", (column) => column.notNull().check(sql`tokens >= 0`))
      .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint("embedding_usage_pkey", ["account_id", "period_start"])
      .execute();

    await database.schema
      .createTable("embedding_ceiling_overrides")
      .addColumn("account_id", "uuid", (column) => column.primaryKey().references("accounts.id").onDelete("cascade"))
      .addColumn("tokens_per_day", "integer", (column) => column.notNull().check(sql`tokens_per_day > 0`))
      .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .alterTable("curations")
      .addColumn("pause_reason", "text", (column) => column.check(sql`pause_reason in (${pauseReasons})`))
      .execute();

    // Until now only a Provider rate limit set resume_after.
    await sql`update curations set pause_reason = 'provider_rate_limit' where resume_after is not null`.execute(database);
  },

  async down(database: Kysely<unknown>) {
    await database.schema.alterTable("curations").dropColumn("pause_reason").execute();
    await database.schema.dropTable("embedding_ceiling_overrides").execute();
    await database.schema.dropTable("embedding_usage").execute();
  },
};
