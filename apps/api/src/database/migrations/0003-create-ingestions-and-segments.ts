import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const activeIngestionStatuses = sql<boolean>`status in ('queued', 'running')`;

export const createIngestionsAndSegments: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .createTable("ingestions")
      .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn("account_id", "uuid", (column) =>
        column.notNull().references("accounts.id").onDelete("cascade"),
      )
      .addColumn("status", "text", (column) =>
        column.notNull().check(sql`status in ('queued', 'running', 'failed', 'completed')`),
      )
      .addColumn("attempts", "integer", (column) => column.notNull().defaultTo(0))
      .addColumn("max_attempts", "integer", (column) => column.notNull().check(sql`max_attempts > 0`))
      .addColumn("last_error", "text")
      .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createIndex("ingestions_one_active_per_account_idx")
      .unique()
      .on("ingestions")
      .column("account_id")
      .where(activeIngestionStatuses)
      .execute();

    await database.schema
      .createTable("ingestion_segments")
      .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn("ingestion_id", "uuid", (column) =>
        column.notNull().references("ingestions.id").onDelete("cascade"),
      )
      .addColumn("position", "integer", (column) => column.notNull())
      .addColumn("kind", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) =>
        column
          .notNull()
          .defaultTo("pending")
          .check(sql`status in ('pending', 'read', 'recognized', 'saved')`),
      )
      .addColumn("input", "jsonb", (column) => column.notNull())
      .addColumn("content", "jsonb")
      .addColumn("recognized", "jsonb")
      .addColumn("last_error", "text")
      .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint("ingestion_segments_position_key", ["ingestion_id", "position"])
      .execute();
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("ingestion_segments").execute();
    await database.schema.dropTable("ingestions").execute();
  },
};
