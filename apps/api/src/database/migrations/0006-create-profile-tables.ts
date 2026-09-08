import { sql, type CreateTableBuilder, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { IngestionSourceSchema, SkillCategorySchema } from "@helpmegethired/shared";

const quoted = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));

const knownSources = quoted(IngestionSourceSchema.options);
const knownCategories = quoted(SkillCategorySchema.options);
const yearMonth = (column: string) => sql`${sql.ref(column)} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`;

const PROFILE_PART_TABLES = ["experiences", "education", "projects", "skills", "languages", "certifications"] as const;

// Every Profile row names its Account, the Ingestion that wrote it, and the Segment it came
// from, so a completed Ingestion replaces the earlier ones of its source and a Segment's save
// can run again after a crash without doubling rows.
const withProfileRowColumns = <Table extends string>(builder: CreateTableBuilder<Table>) =>
  builder
    .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("account_id", "uuid", (column) => column.notNull().references("accounts.id").onDelete("cascade"))
    .addColumn("source_ingestion_id", "uuid", (column) => column.notNull().references("ingestions.id").onDelete("cascade"))
    .addColumn("segment_id", "uuid", (column) => column.notNull().references("ingestion_segments.id").onDelete("cascade"))
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`));

const withOrder = <Table extends string>(builder: CreateTableBuilder<Table>) =>
  builder
    .addColumn("segment_position", "integer", (column) => column.notNull())
    .addColumn("position", "integer", (column) => column.notNull());

const withPeriod = <Table extends string>(builder: CreateTableBuilder<Table>) =>
  builder
    .addColumn("period_start", "text", (column) => column.check(yearMonth("period_start")))
    .addColumn("period_end", "text", (column) => column.check(yearMonth("period_end")));

export const createProfileTables: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .alterTable("ingestions")
      .addColumn("source", "text", (column) => column.notNull().defaultTo("upload").check(sql`source in (${knownSources})`))
      .addColumn("completed_at", "timestamptz")
      .execute();
    await database.schema.alterTable("ingestions").alterColumn("source", (column) => column.dropDefault()).execute();
    await database.schema
      .createIndex("ingestions_completed_per_source_idx")
      .on("ingestions")
      .columns(["account_id", "source", "completed_at"])
      .execute();

    await withProfileRowColumns(database.schema.createTable("basic_profiles"))
      .addColumn("headline", "text")
      .addColumn("summary", "text")
      .addColumn("linkedin_url", "text")
      .addColumn("github_url", "text")
      .addColumn("confirmed_at", "timestamptz")
      .addUniqueConstraint("basic_profiles_one_per_ingestion_key", ["source_ingestion_id"])
      .execute();

    await withPeriod(withOrder(withProfileRowColumns(database.schema.createTable("experiences"))))
      .addColumn("company", "text")
      .addColumn("role", "text", (column) => column.notNull())
      .addColumn("description", "text")
      .addColumn("skills", "jsonb", (column) => column.notNull())
      .execute();

    await withPeriod(withOrder(withProfileRowColumns(database.schema.createTable("education"))))
      .addColumn("institution", "text", (column) => column.notNull())
      .addColumn("degree", "text")
      .addColumn("field_of_study", "text")
      .execute();

    await withOrder(withProfileRowColumns(database.schema.createTable("projects")))
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("description", "text")
      .addColumn("url", "text")
      .addColumn("skills", "jsonb", (column) => column.notNull())
      .execute();

    await withOrder(withProfileRowColumns(database.schema.createTable("skills")))
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("category", "text", (column) => column.notNull().check(sql`category in (${knownCategories})`))
      .execute();

    await withOrder(withProfileRowColumns(database.schema.createTable("languages")))
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("level", "text")
      .execute();

    await withOrder(withProfileRowColumns(database.schema.createTable("certifications")))
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("issuer", "text")
      .addColumn("year", "integer", (column) => column.check(sql`year between 1900 and 2100`))
      .execute();

    for (const table of ["basic_profiles", ...PROFILE_PART_TABLES]) {
      await database.schema
        .createIndex(`${table}_account_ingestion_idx`)
        .on(table)
        .columns(["account_id", "source_ingestion_id"])
        .execute();
    }
  },

  async down(database: Kysely<unknown>) {
    for (const table of [...PROFILE_PART_TABLES, "basic_profiles"]) {
      await database.schema.dropTable(table).execute();
    }

    await database.schema.dropIndex("ingestions_completed_per_source_idx").execute();
    await database.schema.alterTable("ingestions").dropColumn("completed_at").dropColumn("source").execute();
  },
};
