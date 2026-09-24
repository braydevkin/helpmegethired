import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { FactKindSchema } from "@helpmegethired/shared";

const quoted = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));

// A Fact restates one Education, Certification, Language, or Skill row, or counts the years of
// experience across every Experience (ADR-0026). It carries no foreign key to its source because
// the source names one of four tables, and the Profile rows it names only disappear with a new
// Ingestion, which supersedes the Curation and deletes its Facts first.
export const createFacts: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .createTable("facts")
      .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn("curation_id", "uuid", (column) => column.notNull().references("curations.id").onDelete("cascade"))
      .addColumn("account_id", "uuid", (column) => column.notNull().references("accounts.id").onDelete("cascade"))
      .addColumn("kind", "text", (column) => column.notNull().check(sql<boolean>`kind in (${quoted(FactKindSchema.options)})`))
      .addColumn("text", "text", (column) => column.notNull())
      .addColumn("source_id", "uuid")
      .addColumn("position", "integer", (column) => column.notNull().check(sql`position >= 0`))
      .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint("facts_source_check", sql`(kind <> 'years_of_experience') = (source_id is not null)`)
      .addUniqueConstraint("facts_position_key", ["curation_id", "position"])
      .execute();

    await database.schema.createIndex("facts_account_curation_idx").on("facts").columns(["account_id", "curation_id"]).execute();
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("facts").execute();
  },
};
