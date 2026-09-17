import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import {
  ACTIVE_CURATION_STATUSES,
  CurationFailureReasonSchema,
  CurationStatusSchema,
  CurationUnitFailureReasonSchema,
  CurationUnitKindSchema,
  CurationUnitStatusSchema,
  StatementReviewStateSchema,
} from "@helpmegethired/shared";

const quoted = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));
const oneOf = (column: string, values: readonly string[]) => sql<boolean>`${sql.ref(column)} in (${quoted(values)})`;

// Written into the column for its whole life (ADR-0023): a second dimension is a new column and
// a re-embedding, never an edit to this migration.
const EMBEDDING_DIMENSIONS = 1536;

// Retrieval never reads a rejected Statement (#119), so both retrieval indexes leave them out.
const retrievable = sql<boolean>`review_state <> 'rejected'`;

async function createCurations(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable("curations")
    .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("account_id", "uuid", (column) => column.notNull().references("accounts.id").onDelete("cascade"))
    .addColumn("source_ingestion_id", "uuid", (column) => column.notNull().references("ingestions.id").onDelete("cascade"))
    .addColumn("status", "text", (column) => column.notNull().defaultTo("queued").check(oneOf("status", CurationStatusSchema.options)))
    .addColumn("attempts", "integer", (column) => column.notNull().defaultTo(0).check(sql`attempts >= 0`))
    .addColumn("max_attempts", "integer", (column) => column.notNull().check(sql`max_attempts > 0`))
    .addColumn("prompt_version", "text", (column) => column.notNull())
    .addColumn("model_id", "text", (column) => column.notNull())
    .addColumn("failure_reason", "text", (column) => column.check(oneOf("failure_reason", CurationFailureReasonSchema.options)))
    .addColumn("resume_after", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("started_at", "timestamptz")
    .addColumn("completed_at", "timestamptz")
    .execute();

  await database.schema
    .createIndex("curations_one_active_per_account_idx")
    .unique()
    .on("curations")
    .column("account_id")
    .where(oneOf("status", ACTIVE_CURATION_STATUSES))
    .execute();

  await database.schema
    .createIndex("curations_account_ingestion_idx")
    .on("curations")
    .columns(["account_id", "source_ingestion_id"])
    .execute();
}

// A unit's subject is the Experience or Project it reads. It carries no foreign key because it
// names one of two tables, and the Profile rows it names only disappear with a new Ingestion,
// which supersedes the Curation first.
async function createCurationUnits(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable("curation_units")
    .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("curation_id", "uuid", (column) => column.notNull().references("curations.id").onDelete("cascade"))
    .addColumn("kind", "text", (column) => column.notNull().check(oneOf("kind", CurationUnitKindSchema.options)))
    .addColumn("position", "integer", (column) => column.notNull().check(sql`position >= 0`))
    .addColumn("status", "text", (column) => column.notNull().defaultTo("pending").check(oneOf("status", CurationUnitStatusSchema.options)))
    .addColumn("attempts", "integer", (column) => column.notNull().defaultTo(0).check(sql`attempts >= 0`))
    .addColumn("failure_reason", "text", (column) => column.check(oneOf("failure_reason", CurationUnitFailureReasonSchema.options)))
    .addColumn("truncated", "boolean", (column) => column.notNull().defaultTo(false))
    .addColumn("subject_id", "uuid")
    .addColumn("title", "text", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("curation_units_subject_check", sql`(kind in ('experience', 'project')) = (subject_id is not null)`)
    .addUniqueConstraint("curation_units_position_key", ["curation_id", "position"])
    .execute();
}

async function createStatements(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable("statements")
    .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("curation_id", "uuid", (column) => column.notNull().references("curations.id").onDelete("cascade"))
    .addColumn("unit_id", "uuid", (column) => column.notNull().references("curation_units.id").onDelete("cascade"))
    .addColumn("account_id", "uuid", (column) => column.notNull().references("accounts.id").onDelete("cascade"))
    .addColumn("source_ingestion_id", "uuid", (column) => column.notNull().references("ingestions.id").onDelete("cascade"))
    .addColumn("text", "text", (column) => column.notNull())
    .addColumn("labels", "jsonb", (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("evidence", "jsonb", (column) => column.notNull())
    .addColumn("prompt_version", "text", (column) => column.notNull())
    .addColumn("model_id", "text", (column) => column.notNull())
    .addColumn("review_state", "text", (column) =>
      column.notNull().defaultTo("unreviewed").check(oneOf("review_state", StatementReviewStateSchema.options)),
    )
    .addColumn("reviewed_at", "timestamptz")
    .addColumn("embedding", sql`vector(${sql.raw(String(EMBEDDING_DIMENSIONS))})`)
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("statements_review_time_check", sql`(review_state = 'unreviewed') = (reviewed_at is null)`)
    .execute();

  await database.schema.createIndex("statements_curation_idx").on("statements").column("curation_id").execute();
  await database.schema.createIndex("statements_unit_idx").on("statements").column("unit_id").execute();
  await database.schema
    .createIndex("statements_retrievable_per_account_idx")
    .on("statements")
    .column("account_id")
    .where(retrievable)
    .execute();
  await sql`create index statements_retrievable_embedding_idx on statements using hnsw (embedding vector_cosine_ops) where ${retrievable}`.execute(
    database,
  );
}

export const createCurationTables: Migration = {
  async up(database: Kysely<unknown>) {
    await createCurations(database);
    await createCurationUnits(database);
    await createStatements(database);
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("statements").execute();
    await database.schema.dropTable("curation_units").execute();
    await database.schema.dropTable("curations").execute();
  },
};
