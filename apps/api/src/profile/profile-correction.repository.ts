import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import type { BasicProfile, Id, ProfileListPart } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { PROFILE_ENTRY_WRITERS, type EntryPlacement } from "./profile-entry-writers";

interface PlacementRow {
  segment_position: number;
  position: number;
}

// The Candidate's own writes on the Profile the Ingestion built. Every one names the Account,
// so an entry of another Account answers as absent and nothing of theirs is ever touched.
@Injectable()
export class ProfileCorrectionRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async isConfirmed(accountId: Id, ingestionId: Id): Promise<boolean> {
    const row = await this.database
      .selectFrom("basic_profiles")
      .select("confirmed_at")
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", ingestionId)
      .executeTakeFirst();

    return row?.confirmed_at !== null && row?.confirmed_at !== undefined;
  }

  async updateBasicProfile(accountId: Id, ingestionId: Id, basicProfile: BasicProfile): Promise<boolean> {
    const result = await this.database
      .updateTable("basic_profiles")
      .set({
        edited_at: sql<Date>`now()`,
        headline: basicProfile.headline,
        summary: basicProfile.summary,
        linkedin_url: basicProfile.linkedinUrl,
        github_url: basicProfile.githubUrl,
      })
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", ingestionId)
      .executeTakeFirst();

    return result.numUpdatedRows > 0n;
  }

  // A new entry goes to the end of its part, in one transaction with the reading of where the
  // end is, so two entries added at once never land on the same place.
  addEntry(accountId: Id, ingestionId: Id, part: ProfileListPart, body: unknown): Promise<void> {
    return this.database.transaction().execute(async (transaction) => {
      const placement = await endOfPart(transaction, accountId, ingestionId, part);

      await PROFILE_ENTRY_WRITERS[part].add(transaction, placement, body);
    });
  }

  replaceEntry(accountId: Id, part: ProfileListPart, entryId: Id, body: unknown): Promise<boolean> {
    return PROFILE_ENTRY_WRITERS[part].replace(this.database, accountId, entryId, body);
  }

  async removeEntry(accountId: Id, part: ProfileListPart, entryId: Id): Promise<boolean> {
    const result = await this.database.deleteFrom(part).where("id", "=", entryId).where("account_id", "=", accountId).executeTakeFirst();

    return result.numDeletedRows > 0n;
  }
}

async function endOfPart(database: Database, accountId: Id, ingestionId: Id, part: ProfileListPart): Promise<EntryPlacement> {
  const { rows } = await sql<PlacementRow>`
    select coalesce(max(segment_position), 0) as segment_position, coalesce(max(position) + 1, 0) as position
    from ${sql.table(part)}
    where account_id = ${accountId} and source_ingestion_id = ${ingestionId}
  `.execute(database);

  return { account_id: accountId, source_ingestion_id: ingestionId, ...(rows[0] ?? { segment_position: 0, position: 0 }) };
}
