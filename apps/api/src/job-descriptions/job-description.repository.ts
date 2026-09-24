import { Inject, Injectable } from "@nestjs/common";
import type { Id, JobAnalysisStatus, JobDescriptionOverview } from "@helpmegethired/shared";
import { sql } from "kysely";

import { DATABASE, type Database } from "../database/database";

export interface KeptJobDescription {
  id: Id;
  created: boolean;
}

interface OverviewRow {
  id: Id;
  text: string;
  created_at: Date;
  analysis_id: Id | null;
  analysis_status: JobAnalysisStatus | null;
  analysis_created_at: Date | null;
  analysis_completed_at: Date | null;
  ats_score: number | null;
}

const toOverview = (row: OverviewRow): JobDescriptionOverview => ({
  id: row.id,
  text: row.text,
  createdAt: row.created_at.toISOString(),
  newestAnalysis:
    row.analysis_id === null || row.analysis_status === null || row.analysis_created_at === null
      ? null
      : {
          id: row.analysis_id,
          status: row.analysis_status,
          atsScore: row.ats_score,
          createdAt: row.analysis_created_at.toISOString(),
          completedAt: row.analysis_completed_at?.toISOString() ?? null,
        },
});

// The score of a Job Analysis is what its ATS Score Layer persisted, so it is read from there
// once that Layer completed and is null before.
const atsScoreOf = sql<number | null>`(select (l.output ->> 'score')::int from job_analysis_layers l where l.job_analysis_id = ja.id and l.kind = 'ats_score' and l.status = 'completed')`;

// Every method takes the Account first, so another Account's rows answer as absent.
@Injectable()
export class JobDescriptionRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // The same text pasted again by the same Account is the same Job Description: the unique index
  // on the text's digest turns the second insert into a no-op, and the row it kept is read back.
  async keep(accountId: Id, text: string): Promise<KeptJobDescription> {
    const inserted = await this.database
      .insertInto("job_descriptions")
      .values({ account_id: accountId, text })
      .onConflict((conflict) => conflict.expression(sql`account_id, md5(text)`).doNothing())
      .returning("id")
      .executeTakeFirst();

    if (inserted) {
      return { id: inserted.id, created: true };
    }

    const kept = await this.database
      .selectFrom("job_descriptions")
      .select("id")
      .where("account_id", "=", accountId)
      .where(sql<boolean>`md5(text) = md5(${text})`)
      .executeTakeFirstOrThrow();

    return { id: kept.id, created: false };
  }

  async findOverview(accountId: Id, id: Id): Promise<JobDescriptionOverview | undefined> {
    const row = await this.overviews(accountId).where("jd.id", "=", id).executeTakeFirst();

    return row && toOverview(row);
  }

  async overviewsOf(accountId: Id): Promise<JobDescriptionOverview[]> {
    const rows = await this.overviews(accountId).orderBy("jd.created_at", "desc").orderBy("jd.id", "desc").execute();

    return rows.map(toOverview);
  }

  // Each Job Description with where its newest Job Analysis stands, joined laterally so the list
  // is one query however many analyses a Job Description has had.
  private overviews(accountId: Id) {
    return this.database
      .selectFrom("job_descriptions as jd")
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom("job_analyses as ja")
            .select(["ja.id as analysis_id", "ja.status as analysis_status", "ja.created_at as analysis_created_at", "ja.completed_at as analysis_completed_at", atsScoreOf.as("ats_score")])
            .whereRef("ja.job_description_id", "=", "jd.id")
            .orderBy("ja.created_at", "desc")
            .orderBy("ja.id", "desc")
            .limit(1)
            .as("newest"),
        (join) => join.onTrue(),
      )
      .select(["jd.id", "jd.text", "jd.created_at", "newest.analysis_id", "newest.analysis_status", "newest.analysis_created_at", "newest.analysis_completed_at", "newest.ats_score"])
      .where("jd.account_id", "=", accountId);
  }
}
