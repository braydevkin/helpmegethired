import { Inject, Injectable } from "@nestjs/common";
import { ACTIVE_CURATION_STATUSES, type Curation, type CurationStatus, type Id, type ModelId } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import type { CurationSubjects, NewCurationUnit } from "./curation-units";
import { toCuration } from "./curation.mapper";

const RESUME_SOURCE = "upload";

// A Curation of the same Ingestion in any other state is the one the Candidate has, so a second
// one would only duplicate it; these two free the Ingestion for a new one.
const REPLACEABLE_STATUSES = ["failed", "cancelled"] as const satisfies readonly CurationStatus[];

export const PROFILE_ORDER = ["segment_position", "position"] as const;

// The Ingestion whose rows are the Profile on screen; an older one's rows are already replaced.
export const latestProfileIngestionOf = (database: Database, accountId: Id) =>
  database
    .selectFrom("ingestions")
    .select("id")
    .where("account_id", "=", accountId)
    .where("source", "=", RESUME_SOURCE)
    .where("status", "=", "completed")
    .orderBy("completed_at", "desc")
    .orderBy("id", "desc")
    .limit(1);

export interface CurationReadiness {
  ingestionId: Id;
  modelId: ModelId;
}

export interface NewCuration {
  sourceIngestionId: Id;
  modelId: ModelId;
  promptVersion: string;
  maxAttempts: number;
  units: readonly NewCurationUnit[];
}

// Every method takes the Account first, so another Account's rows answer as absent.
@Injectable()
export class CurationRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // Both halves of the trigger (ADR-0024): the Profile the Account last built is confirmed, and a
  // Model Key is stored. An earlier confirmed Profile does not count once a newer one exists.
  async readinessOf(accountId: Id, database: Database = this.database): Promise<CurationReadiness | undefined> {
    return database
      .selectFrom("basic_profiles")
      .innerJoin("account_model_choices", "account_model_choices.account_id", "basic_profiles.account_id")
      .select(["basic_profiles.source_ingestion_id as ingestionId", "account_model_choices.model_id as modelId"])
      .where("basic_profiles.account_id", "=", accountId)
      .where("basic_profiles.source_ingestion_id", "=", latestProfileIngestionOf(database, accountId))
      .where("basic_profiles.confirmed_at", "is not", null)
      .where("account_model_choices.sealed_key", "is not", null)
      .executeTakeFirst();
  }

  async subjectsOf(accountId: Id, ingestionId: Id, database: Database = this.database): Promise<CurationSubjects> {
    const experiences = await database
      .selectFrom("experiences")
      .select(["id", "role", "company"])
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", ingestionId)
      .orderBy(PROFILE_ORDER)
      .execute();
    const projects = await database
      .selectFrom("projects")
      .select(["id", "name"])
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", ingestionId)
      .orderBy(PROFILE_ORDER)
      .execute();

    return { experiences, projects };
  }

  async findCurrentFor(accountId: Id, ingestionId: Id, database: Database = this.database): Promise<Curation | undefined> {
    const row = await database
      .selectFrom("curations")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", ingestionId)
      .where("status", "not in", REPLACEABLE_STATUSES)
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    return row && toCuration(row);
  }

  async findActive(accountId: Id, database: Database = this.database): Promise<Curation | undefined> {
    const row = await database
      .selectFrom("curations")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("status", "in", ACTIVE_CURATION_STATUSES)
      .executeTakeFirst();

    return row && toCuration(row);
  }

  async create(accountId: Id, curation: NewCuration, database: Database = this.database): Promise<Curation> {
    const row = await database
      .insertInto("curations")
      .values({
        account_id: accountId,
        source_ingestion_id: curation.sourceIngestionId,
        status: "queued",
        max_attempts: curation.maxAttempts,
        prompt_version: curation.promptVersion,
        model_id: curation.modelId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await database
      .insertInto("curation_units")
      .values(curation.units.map(({ kind, position, subjectId, title }) => ({ curation_id: row.id, kind, position, subject_id: subjectId, title })))
      .execute();

    return toCuration(row);
  }
}
