import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { ResumeUploadErrorCodeSchema, UploadedResumeStatusSchema } from "@helpmegethired/shared";

const quoted = (values: readonly string[]) => sql.join(values.map((value) => sql.lit(value)));

const knownStatuses = quoted(UploadedResumeStatusSchema.options);
const knownErrorCodes = quoted(ResumeUploadErrorCodeSchema.options);

const liveStatuses = sql<boolean>`status not in ('failed', 'expired')`;
const inFlightStatuses = sql<boolean>`status in ('uploaded', 'processing')`;

export const createUploadedResumes: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .createTable("uploaded_resumes")
      .addColumn("id", "uuid", (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn("account_id", "uuid", (column) =>
        column.notNull().references("accounts.id").onDelete("cascade"),
      )
      .addColumn("sha256", "text", (column) => column.notNull().check(sql`length(sha256) = 64`))
      .addColumn("file_name", "text", (column) => column.notNull())
      .addColumn("size_bytes", "integer", (column) => column.notNull().check(sql`size_bytes > 0`))
      .addColumn("object_key", "text", (column) => column.notNull().unique())
      .addColumn("status", "text", (column) =>
        column.notNull().defaultTo("pending").check(sql`status in (${knownStatuses})`),
      )
      .addColumn("error_code", "text", (column) => column.check(sql`error_code in (${knownErrorCodes})`))
      .addColumn("error_message", "text")
      .addColumn("raw_text", "text")
      .addColumn("extractor_version", "text")
      .addColumn("attempts", "integer", (column) => column.notNull().defaultTo(0))
      .addColumn("max_attempts", "integer", (column) => column.notNull().check(sql`max_attempts > 0`))
      .addColumn("ingestion_id", "uuid", (column) => column.references("ingestions.id").onDelete("set null"))
      .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn("finished_at", "timestamptz")
      .execute();

    await database.schema
      .createIndex("uploaded_resumes_one_live_per_file_idx")
      .unique()
      .on("uploaded_resumes")
      .columns(["account_id", "sha256"])
      .where(liveStatuses)
      .execute();

    await database.schema
      .createIndex("uploaded_resumes_one_in_flight_per_account_idx")
      .unique()
      .on("uploaded_resumes")
      .column("account_id")
      .where(inFlightStatuses)
      .execute();

    await database.schema
      .createIndex("uploaded_resumes_status_created_at_idx")
      .on("uploaded_resumes")
      .columns(["status", "created_at"])
      .execute();
  },

  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("uploaded_resumes").execute();
  },
};
