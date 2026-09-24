import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import {
  ACTIVE_JOB_ANALYSIS_STATUSES,
  JOB_DESCRIPTION_MAX_CHARACTERS,
  JobAnalysisFailureReasonSchema,
  JobAnalysisPauseReasonSchema,
  JobAnalysisStatusSchema,
  LayerFailureReasonSchema,
  LayerKindSchema,
  LayerStatusSchema,
} from "@helpmegethired/shared";

const quoted = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));
const oneOf = (column: string, values: readonly string[]) => sql<boolean>`${sql.ref(column)} in (${quoted(values)})`;

// Kept as pasted and never edited, so the row has no updated_at. The same text pasted again by
// the same Account is the same Job Description: the text is too long for a plain unique index,
// so the uniqueness rides on its digest, which the paste route uses for its upsert (#199).
async function createJobDescriptions(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable("job_descriptions")
    .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("account_id", "uuid", (column) => column.notNull().references("accounts.id").onDelete("cascade"))
    .addColumn("text", "text", (column) => column.notNull().check(sql`char_length(text) between 1 and ${sql.lit(JOB_DESCRIPTION_MAX_CHARACTERS)}`))
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`create unique index job_descriptions_account_text_key on job_descriptions (account_id, md5(text))`.execute(database);
}

// A Job Analysis records the Curation, the Model, and the versions it ran on, which is what the
// re-analysis gate compares against (ADR-0026). A failed one names the Layer that stopped.
async function createJobAnalyses(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable("job_analyses")
    .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("account_id", "uuid", (column) => column.notNull().references("accounts.id").onDelete("cascade"))
    .addColumn("job_description_id", "uuid", (column) => column.notNull().references("job_descriptions.id").onDelete("cascade"))
    .addColumn("curation_id", "uuid", (column) => column.notNull().references("curations.id").onDelete("cascade"))
    .addColumn("status", "text", (column) => column.notNull().defaultTo("queued").check(oneOf("status", JobAnalysisStatusSchema.options)))
    .addColumn("attempts", "integer", (column) => column.notNull().defaultTo(0).check(sql`attempts >= 0`))
    .addColumn("max_attempts", "integer", (column) => column.notNull().check(sql`max_attempts > 0`))
    .addColumn("model_id", "text", (column) => column.notNull())
    .addColumn("requirement_match_prompt_version", "text", (column) => column.notNull())
    .addColumn("resume_builder_prompt_version", "text", (column) => column.notNull())
    .addColumn("ats_rule_set_version", "text", (column) => column.notNull())
    .addColumn("failure_reason", "text", (column) => column.check(oneOf("failure_reason", JobAnalysisFailureReasonSchema.options)))
    .addColumn("failed_layer", "text", (column) => column.check(oneOf("failed_layer", LayerKindSchema.options)))
    .addColumn("pause_reason", "text", (column) => column.check(oneOf("pause_reason", JobAnalysisPauseReasonSchema.options)))
    .addColumn("resume_after", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("started_at", "timestamptz")
    .addColumn("completed_at", "timestamptz")
    .addCheckConstraint("job_analyses_failed_layer_names_reason_check", sql`failed_layer is null or failure_reason is not null`)
    .execute();

  await database.schema
    .createIndex("job_analyses_one_active_per_account_idx")
    .unique()
    .on("job_analyses")
    .column("account_id")
    .where(oneOf("status", ACTIVE_JOB_ANALYSIS_STATUSES))
    .execute();

  await database.schema.createIndex("job_analyses_job_description_created_idx").on("job_analyses").columns(["job_description_id", "created_at"]).execute();
  await database.schema.createIndex("job_analyses_account_idx").on("job_analyses").column("account_id").execute();
}

// One row per Layer in the fixed order. The output is the Layer's persisted result, there exactly
// when it completed; only the Resume Builder is ever skipped (ADR-0026).
async function createJobAnalysisLayers(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable("job_analysis_layers")
    .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("job_analysis_id", "uuid", (column) => column.notNull().references("job_analyses.id").onDelete("cascade"))
    .addColumn("kind", "text", (column) => column.notNull().check(oneOf("kind", LayerKindSchema.options)))
    .addColumn("position", "integer", (column) => column.notNull().check(sql`position >= 0`))
    .addColumn("status", "text", (column) => column.notNull().defaultTo("pending").check(oneOf("status", LayerStatusSchema.options)))
    .addColumn("attempts", "integer", (column) => column.notNull().defaultTo(0).check(sql`attempts >= 0`))
    .addColumn("failure_reason", "text", (column) => column.check(oneOf("failure_reason", LayerFailureReasonSchema.options)))
    .addColumn("output", "jsonb")
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn("started_at", "timestamptz")
    .addColumn("completed_at", "timestamptz")
    .addCheckConstraint("job_analysis_layers_output_check", sql`(status = 'completed') = (output is not null)`)
    .addCheckConstraint("job_analysis_layers_skipped_check", sql`status <> 'skipped' or kind = 'resume_builder'`)
    .addUniqueConstraint("job_analysis_layers_kind_key", ["job_analysis_id", "kind"])
    .addUniqueConstraint("job_analysis_layers_position_key", ["job_analysis_id", "position"])
    .execute();
}

export const createJobAnalysisTables: Migration = {
  async up(database: Kysely<unknown>) {
    await createJobDescriptions(database);
    await createJobAnalyses(database);
    await createJobAnalysisLayers(database);
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("job_analysis_layers").execute();
    await database.schema.dropTable("job_analyses").execute();
    await database.schema.dropTable("job_descriptions").execute();
  },
};
