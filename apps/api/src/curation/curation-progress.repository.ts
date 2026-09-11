import { Inject, Injectable } from "@nestjs/common";
import type { CurationUnitSummary, Id } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import type { CountedProfile } from "./curation-metrics";
import type { ProgressedCuration } from "./curation-progress";
import { PROFILE_ORDER, latestProfileIngestionOf } from "./curation.repository";

export interface CurrentCuration {
  curation: ProgressedCuration;
  units: CurationUnitSummary[];
  profile: CountedProfile;
}

// Every method takes the Account first, so another Account's rows answer as absent.
@Injectable()
export class CurationProgressRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // The newest Curation of the Profile on screen. A superseded one no longer describes it, and a
  // Curation of an earlier Profile is not the one the page is about.
  async currentOf(accountId: Id): Promise<CurrentCuration | undefined> {
    const row = await this.database
      .selectFrom("curations")
      .select(["id", "status", "model_id", "failure_reason", "resume_after", "source_ingestion_id"])
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", latestProfileIngestionOf(this.database, accountId))
      .where("status", "<>", "superseded")
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!row) {
      return undefined;
    }

    const [units, profile] = await Promise.all([this.unitsOf(row.id), this.countedProfileOf(accountId, row.source_ingestion_id)]);

    return {
      curation: { id: row.id, status: row.status, modelId: row.model_id, failureReason: row.failure_reason, resumeAfter: row.resume_after },
      units,
      profile,
    };
  }

  private unitsOf(curationId: Id): Promise<CurationUnitSummary[]> {
    return this.database
      .selectFrom("curation_units")
      .select(["id", "kind", "title", "status", "failure_reason as failureReason"])
      .where("curation_id", "=", curationId)
      .orderBy("position")
      .execute();
  }

  private async countedProfileOf(accountId: Id, ingestionId: Id): Promise<CountedProfile> {
    const idsOf = (table: "projects" | "certifications" | "languages" | "education") =>
      this.database.selectFrom(table).select("id").where("account_id", "=", accountId).where("source_ingestion_id", "=", ingestionId).execute();
    const [experiences, projects, certifications, languages, education] = await Promise.all([
      this.database
        .selectFrom("experiences")
        .select(["company", "period_start", "period_end"])
        .where("account_id", "=", accountId)
        .where("source_ingestion_id", "=", ingestionId)
        .orderBy(PROFILE_ORDER)
        .execute(),
      idsOf("projects"),
      idsOf("certifications"),
      idsOf("languages"),
      idsOf("education"),
    ]);

    return {
      experiences: experiences.map(({ company, period_start, period_end }) => ({
        company,
        period: period_start === null ? null : { start: period_start, end: period_end },
      })),
      projects,
      certifications,
      languages,
      education,
    };
  }
}
