import { Inject, Injectable } from "@nestjs/common";
import {
  ModelIdSchema,
  type CurationFailureReason,
  type CurationStatus,
  type CurationUnitFailureReason,
  type Evidence,
  type Id,
  type ModelId,
  type Period,
} from "@helpmegethired/shared";
import { sql } from "kysely";

import { DATABASE, type Database } from "../database/database";
import type { CurationRow, CurationUnitRow } from "../database/database.schema";
import type { CuratedExperience, CuratedProject } from "./unit-input";
import { toVectorLiteral } from "./vector";

const updatedNow = { updated_at: sql<Date>`now()` };
const ACTIVE = ["queued", "running"] as const satisfies readonly CurationStatus[];
const PROFILE_ORDER = ["segment_position", "position"] as const;

const queuedAgainOrFailed = {
  status: sql<CurationStatus>`case when attempts < max_attempts then 'queued' else 'failed' end`,
  failure_reason: sql<CurationFailureReason | null>`case when attempts < max_attempts then null else 'attempts_exhausted' end`,
  ...updatedNow,
};

export type SettledCuration = Pick<CurationRow, "id" | "status" | "max_attempts">;

export interface CurationRun {
  id: Id;
  accountId: Id;
  sourceIngestionId: Id;
  modelId: ModelId;
  attempts: number;
  maxAttempts: number;
}

export interface CuratedProfile {
  experiences: (CuratedExperience & { period: Period | null })[];
  projects: CuratedProject[];
  certifications: Id[];
  languages: Id[];
  education: Id[];
  uploadedResume: { id: Id; text: string } | undefined;
}

export interface NewStatement {
  text: string;
  labels: readonly string[];
  evidence: readonly Evidence[];
}

const toRun = (row: CurationRow): CurationRun => ({
  id: row.id,
  accountId: row.account_id,
  sourceIngestionId: row.source_ingestion_id,
  modelId: ModelIdSchema.parse(row.model_id),
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
});

// The runner acts for the queue, not for a Candidate, so this repository addresses a Curation by
// id alone, as IngestionRunRepository does. Every write that ends or saves work is conditional on
// the status, so a run that lost the race to a cancel or a supersede writes nothing (ADR-0024).
@Injectable()
export class CurationRunRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  findById(id: Id): Promise<CurationRow | undefined> {
    return this.database.selectFrom("curations").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async statusOf(id: Id): Promise<CurationStatus | undefined> {
    return (await this.database.selectFrom("curations").select("status").where("id", "=", id).executeTakeFirst())?.status;
  }

  // The attempt is counted in the write that starts it, before any call, so a run killed without
  // reporting still counts. A paused Curation is not started before its resume_after.
  async beginAttempt(id: Id): Promise<CurationRun | undefined> {
    const row = await this.database
      .updateTable("curations")
      .set({ status: "running", attempts: sql<number>`attempts + 1`, started_at: sql<Date>`coalesce(started_at, now())`, resume_after: null, ...updatedNow })
      .where("id", "=", id)
      .where("status", "in", ACTIVE)
      .where(sql<boolean>`attempts < max_attempts`)
      .where((eb) => eb.or([eb("resume_after", "is", null), eb("resume_after", "<=", sql<Date>`now()`)]))
      .returningAll()
      .executeTakeFirst();

    return row && toRun(row);
  }

  // An attempt that ends with a failed unit is queued again while one is left, otherwise failed
  // with a reason the Candidate can read.
  async failAttempt(id: Id): Promise<CurationStatus | undefined> {
    const row = await this.database
      .updateTable("curations")
      .set(queuedAgainOrFailed)
      .where("id", "=", id)
      .where("status", "=", "running")
      .returning("status")
      .executeTakeFirst();

    return row?.status;
  }

  findQueuedDueBy(now: Date): Promise<CurationRow[]> {
    return this.database
      .selectFrom("curations")
      .selectAll()
      .where("status", "=", "queued")
      .where((eb) => eb.or([eb("resume_after", "is", null), eb("resume_after", "<=", now)]))
      .orderBy("updated_at")
      .execute();
  }

  findRunningUpdatedBefore(cutoff: Date): Promise<CurationRow[]> {
    return this.database.selectFrom("curations").selectAll().where("status", "=", "running").where("updated_at", "<", cutoff).orderBy("updated_at").execute();
  }

  // A run whose worker died: queued again while an attempt is left, otherwise failed, which frees
  // the Account. The units it left running are pending again, so progress never shows a unit no
  // one is working on. Conditional on the row still being stale, so two runs cannot both act.
  settleStale(id: Id, cutoff: Date): Promise<SettledCuration | undefined> {
    return this.database.transaction().execute(async (transaction) => {
      const settled = await transaction
        .updateTable("curations")
        .set(queuedAgainOrFailed)
        .where("id", "=", id)
        .where("status", "=", "running")
        .where("updated_at", "<", cutoff)
        .returning(["id", "status", "max_attempts"])
        .executeTakeFirst();

      if (settled) {
        await transaction.updateTable("curation_units").set({ status: "pending", ...updatedNow }).where("curation_id", "=", id).where("status", "=", "running").execute();
      }

      return settled;
    });
  }

  async failWith(id: Id, reason: CurationFailureReason): Promise<void> {
    await this.database
      .updateTable("curations")
      .set({ status: "failed", failure_reason: reason, ...updatedNow })
      .where("id", "=", id)
      .where("status", "in", ACTIVE)
      .execute();
  }

  // A rate limit says nothing about the input, so the attempt is given back and the Curation waits
  // for resume_after (ADR-0024).
  async pause(id: Id, resumeAfter: Date): Promise<void> {
    await this.database
      .updateTable("curations")
      .set({ status: "queued", attempts: sql<number>`attempts - 1`, resume_after: resumeAfter, ...updatedNow })
      .where("id", "=", id)
      .where("status", "=", "running")
      .execute();
  }

  statementsToEmbed(curationId: Id): Promise<{ id: Id; text: string }[]> {
    return this.database.selectFrom("statements").select(["id", "text"]).where("curation_id", "=", curationId).orderBy("id").execute();
  }

  // Every vector and `completed` are one transaction, written only while the Curation still runs:
  // a Curation is never half indexed, and the queue never finishes a job whose row says running.
  // The completed one becomes current, so every other Curation of the Account, the one a re-run
  // replaces included, is superseded with its Statements in the same transaction.
  completeWithEmbeddings(id: Id, vectors: readonly { statementId: Id; embedding: readonly number[] }[]): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      const owner = await transaction.selectFrom("curations").select("account_id").where("id", "=", id).executeTakeFirst();

      if (!owner) {
        return false;
      }

      const locked = await this.lockAccountCurations(owner.account_id, transaction);

      if (locked.find((curation) => curation.id === id)?.status !== "running") {
        return false;
      }

      for (const { statementId, embedding } of vectors) {
        await transaction
          .updateTable("statements")
          .set({ embedding: toVectorLiteral(embedding), ...updatedNow })
          .where("id", "=", statementId)
          .where("curation_id", "=", id)
          .execute();
      }

      await transaction
        .updateTable("curations")
        .set({ status: "completed", failure_reason: null, completed_at: sql<Date>`now()`, ...updatedNow })
        .where("id", "=", id)
        .execute();
      await this.supersedeAllBut(owner.account_id, id, transaction);

      return true;
    });
  }

  // In id order, the order the resume observer and a Candidate's cancel, retry, or re-run take
  // them in, so none of them can deadlock with a completion.
  private lockAccountCurations(accountId: Id, transaction: Database): Promise<Pick<CurationRow, "id" | "status">[]> {
    return transaction
      .selectFrom("curations")
      .select(["id", "status"])
      .where("account_id", "=", accountId)
      .where("status", "!=", "superseded")
      .orderBy("id")
      .forUpdate()
      .execute();
  }

  private async supersedeAllBut(accountId: Id, keptId: Id, transaction: Database): Promise<void> {
    const superseded = await transaction
      .updateTable("curations")
      .set({ status: "superseded", ...updatedNow })
      .where("account_id", "=", accountId)
      .where("id", "!=", keptId)
      .where("status", "!=", "superseded")
      .returning("id")
      .execute();

    if (superseded.length > 0) {
      await transaction
        .deleteFrom("statements")
        .where(
          "curation_id",
          "in",
          superseded.map((row) => row.id),
        )
        .execute();
    }
  }

  unitsOf(curationId: Id): Promise<CurationUnitRow[]> {
    return this.database.selectFrom("curation_units").selectAll().where("curation_id", "=", curationId).orderBy("position").execute();
  }

  async beginUnit(unitId: Id, truncated: boolean): Promise<void> {
    await this.database
      .updateTable("curation_units")
      .set({ status: "running", attempts: sql<number>`attempts + 1`, failure_reason: null, truncated, ...updatedNow })
      .where("id", "=", unitId)
      .execute();
  }

  async failUnit(unitId: Id, reason: CurationUnitFailureReason): Promise<void> {
    await this.database.updateTable("curation_units").set({ status: "failed", failure_reason: reason, ...updatedNow }).where("id", "=", unitId).execute();
  }

  async releaseUnit(unitId: Id): Promise<void> {
    await this.database
      .updateTable("curation_units")
      .set({ status: "pending", attempts: sql<number>`attempts - 1`, ...updatedNow })
      .where("id", "=", unitId)
      .execute();
  }

  // A unit's Statements are replaced, never doubled, and written only while the Curation is still
  // running, in the same transaction that marks the unit saved.
  saveUnit(run: CurationRun, unitId: Id, statements: readonly NewStatement[], promptVersion: string): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      const current = await transaction.selectFrom("curations").select("status").where("id", "=", run.id).forUpdate().executeTakeFirst();

      if (current?.status !== "running") {
        return false;
      }

      await transaction.deleteFrom("statements").where("unit_id", "=", unitId).execute();

      if (statements.length > 0) {
        await transaction
          .insertInto("statements")
          .values(
            statements.map(({ text, labels, evidence }) => ({
              curation_id: run.id,
              unit_id: unitId,
              account_id: run.accountId,
              source_ingestion_id: run.sourceIngestionId,
              text,
              labels: JSON.stringify(labels),
              evidence: JSON.stringify(evidence),
              prompt_version: promptVersion,
              model_id: run.modelId,
            })),
          )
          .execute();
      }

      await transaction.updateTable("curation_units").set({ status: "saved", failure_reason: null, ...updatedNow }).where("id", "=", unitId).execute();

      return true;
    });
  }

  async savedStatementsOf(curationId: Id): Promise<string[]> {
    const rows = await this.database.selectFrom("statements").select("text").where("curation_id", "=", curationId).orderBy("created_at").orderBy("id").execute();

    return rows.map((row) => row.text);
  }

  async profileOf(run: CurationRun): Promise<CuratedProfile> {
    const { accountId, sourceIngestionId } = run;
    const experiences = await this.database
      .selectFrom("experiences")
      .select(["id", "role", "company", "description", "period_start", "period_end"])
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", sourceIngestionId)
      .orderBy(PROFILE_ORDER)
      .execute();
    const projects = await this.database
      .selectFrom("projects")
      .select(["id", "name", "description"])
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", sourceIngestionId)
      .orderBy(PROFILE_ORDER)
      .execute();
    const idsOf = async (table: "certifications" | "languages" | "education") =>
      (
        await this.database.selectFrom(table).select("id").where("account_id", "=", accountId).where("source_ingestion_id", "=", sourceIngestionId).execute()
      ).map((row) => row.id);
    const resume = await this.database
      .selectFrom("uploaded_resumes")
      .select(["id", "raw_text"])
      .where("account_id", "=", accountId)
      .where("ingestion_id", "=", sourceIngestionId)
      .executeTakeFirst();

    return {
      experiences: experiences.map(({ period_start, period_end, ...experience }) => ({
        ...experience,
        period: period_start === null ? null : { start: period_start, end: period_end },
      })),
      projects,
      certifications: await idsOf("certifications"),
      languages: await idsOf("languages"),
      education: await idsOf("education"),
      uploadedResume: resume?.raw_text ? { id: resume.id, text: resume.raw_text } : undefined,
    };
  }
}
