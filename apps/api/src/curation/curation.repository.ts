import { Inject, Injectable } from "@nestjs/common";
import { ACTIVE_CURATION_STATUSES, type Curation, type CurationStatus, type Id, type ModelId } from "@helpmegethired/shared";
import { sql } from "kysely";

import { lockAccount } from "../database/account-lock";
import { DATABASE, type Database } from "../database/database";
import type { CurationSubjects, NewCurationUnit } from "./curation-units";
import { toCuration } from "./curation.mapper";
import type { CurationOrigin } from "./rerun-gate";

const RESUME_SOURCE = "upload";

// A Curation of the same Ingestion in any other state is the one the Candidate has, so a second
// one would only duplicate it; these two free the Ingestion for a new one.
const REPLACEABLE_STATUSES = ["failed", "cancelled"] as const satisfies readonly CurationStatus[];

const updatedNow = { updated_at: sql<Date>`now()` };

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

// The Account's current Curation, the one retrieval reads (ADR-0024): the latest completed one. A
// completing re-run supersedes the one before it, so a second completed one never stays behind.
export const currentCompletedCurationOf = (database: Database, accountId: Id) =>
  database
    .selectFrom("curations")
    .select("id")
    .where("account_id", "=", accountId)
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

export interface CurationRecord extends CurationOrigin {
  id: Id;
  status: CurationStatus;
  maxAttempts: number;
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

  // The newest Curation of the Ingestion that is not superseded: an in-flight re-run, or the one a
  // retry resumes.
  findLatestOf(accountId: Id, ingestionId: Id, database: Database = this.database): Promise<CurationRecord | undefined> {
    return this.records(database)
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", ingestionId)
      .where("status", "!=", "superseded")
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .executeTakeFirst();
  }

  findCurrentCompleted(accountId: Id, database: Database = this.database): Promise<CurationRecord | undefined> {
    return this.records(database).where("account_id", "=", accountId).where("id", "=", currentCompletedCurationOf(database, accountId)).executeTakeFirst();
  }

  // A cancel, a retry, or a re-run changes the Account's Curations: their rows are locked before the
  // Account row, in id order, the order the resume observer and a runner saving a unit take them in.
  async lockForChange(accountId: Id, transaction: Database): Promise<void> {
    await transaction.selectFrom("curations").select("id").where("account_id", "=", accountId).where("status", "!=", "superseded").orderBy("id").forUpdate().execute();
    await lockAccount(accountId, transaction);
  }

  // The units left running are pending again, so progress never shows a unit no one works on.
  async cancel(accountId: Id, curationId: Id, transaction: Database): Promise<void> {
    await transaction
      .updateTable("curations")
      .set({ status: "cancelled", resume_after: null, ...updatedNow })
      .where("account_id", "=", accountId)
      .where("id", "=", curationId)
      .where("status", "in", ACTIVE_CURATION_STATUSES)
      .execute();
    await this.releaseUnits(curationId, transaction);
  }

  // Saved units stay saved, so the runner resumes at the first unsaved one.
  async requeue(accountId: Id, curationId: Id, transaction: Database): Promise<void> {
    await transaction
      .updateTable("curations")
      .set({ status: "queued", attempts: 0, failure_reason: null, resume_after: null, ...updatedNow })
      .where("account_id", "=", accountId)
      .where("id", "=", curationId)
      .where("status", "in", REPLACEABLE_STATUSES)
      .execute();
    await this.releaseUnits(curationId, transaction);
  }

  // A new Ingestion replaces the Profile these Curations cite (ADR-0024). Their rows are locked
  // before the Account row because a runner saving a unit holds its Curation's row and then needs
  // the Account row for the Statements' foreign key; the other order would deadlock the two. The
  // Account lock keeps a confirm of the replaced Profile from starting a Curation beside them.
  async supersedeEarlierThan(accountId: Id, keptIngestionId: Id, transaction: Database): Promise<Id[]> {
    await transaction
      .selectFrom("curations")
      .select("id")
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "!=", keptIngestionId)
      .where("status", "!=", "superseded")
      .orderBy("id")
      .forUpdate()
      .execute();
    await lockAccount(accountId, transaction);

    const superseded = await transaction
      .updateTable("curations")
      .set({ status: "superseded", ...updatedNow })
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "!=", keptIngestionId)
      .where("status", "!=", "superseded")
      .returning("id")
      .execute();

    await transaction.deleteFrom("statements").where("account_id", "=", accountId).where("source_ingestion_id", "!=", keptIngestionId).execute();

    return superseded.map((row) => row.id);
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

  private records(database: Database) {
    return database
      .selectFrom("curations")
      .select(["id", "status", "source_ingestion_id as sourceIngestionId", "model_id as modelId", "prompt_version as promptVersion", "max_attempts as maxAttempts"]);
  }

  private async releaseUnits(curationId: Id, transaction: Database): Promise<void> {
    await transaction
      .updateTable("curation_units")
      .set({ status: "pending", failure_reason: null, ...updatedNow })
      .where("curation_id", "=", curationId)
      .where("status", "in", ["running", "failed"])
      .execute();
  }
}
