import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

const PROFILE_TABLES = ["basic_profiles", "experiences", "education", "projects", "skills", "languages", "certifications"] as const;

// The Candidate corrects what the recognition got wrong, on the row the Ingestion wrote (#177).
// An entry they add themselves came from no Segment, so segment_id stops being required, and
// edited_at is what tells the review notice to stop asking about an entry they have decided on.
export const allowCandidateCorrections: Migration = {
  async up(database: Kysely<unknown>) {
    for (const table of PROFILE_TABLES) {
      await database.schema
        .alterTable(table)
        .alterColumn("segment_id", (column) => column.dropNotNull())
        .execute();
      await database.schema.alterTable(table).addColumn("edited_at", "timestamptz").execute();
    }
  },

  // segment_id can only be required again once the rows that never had one are gone, so going
  // back drops the entries the Candidate added by hand.
  async down(database: Kysely<unknown>) {
    for (const table of PROFILE_TABLES) {
      await database.schema.alterTable(table).dropColumn("edited_at").execute();
      await sql`delete from ${sql.table(table)} where segment_id is null`.execute(database);
      await database.schema
        .alterTable(table)
        .alterColumn("segment_id", (column) => column.setNotNull())
        .execute();
    }
  },
};
