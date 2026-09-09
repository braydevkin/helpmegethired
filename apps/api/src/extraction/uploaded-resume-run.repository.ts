import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import type { Id, ResumeUploadErrorCode, UploadedResumeStatus } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { isUniqueViolation } from "../database/database-errors";
import type { UploadedResumeRow } from "../database/database.schema";
import type { ExtractedText } from "./text-extractor";

export interface ExtractionRecord {
  id: Id;
  accountId: Id;
  objectKey: string;
  sizeBytes: number;
  status: UploadedResumeStatus;
  attempts: number;
  maxAttempts: number;
  rawText: string | null;
  extractorVersion: string | null;
  ingestionId: Id | null;
  createdAt: Date;
}

const AWAITING_EXTRACTION: readonly UploadedResumeStatus[] = ["uploaded", "processing"];
const ONE_IN_FLIGHT_PER_ACCOUNT_INDEX = "uploaded_resumes_one_in_flight_per_account_idx";

const updatedNow = { updated_at: sql<Date>`now()` };

const toRecord = (row: UploadedResumeRow): ExtractionRecord => ({
  id: row.id,
  accountId: row.account_id,
  objectKey: row.object_key,
  sizeBytes: row.size_bytes,
  status: row.status,
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
  rawText: row.raw_text,
  extractorVersion: row.extractor_version,
  ingestionId: row.ingestion_id,
  createdAt: row.created_at,
});

// The processor acts for the queue, not for a Candidate, so this is the one repository that
// addresses Uploaded Resumes by id alone. Every Candidate-facing read goes through
// UploadedResumeRepository.
@Injectable()
export class UploadedResumeRunRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async findById(id: Id): Promise<ExtractionRecord | undefined> {
    const row = await this.database.selectFrom("uploaded_resumes").selectAll().where("id", "=", id).executeTakeFirst();

    return row && toRecord(row);
  }

  // The attempt is counted in the write that marks the record processing, so a run killed
  // without reporting still counts. Answers undefined when the record is not waiting for
  // extraction or has no attempt left.
  async beginAttempt(id: Id): Promise<ExtractionRecord | undefined> {
    const row = await this.database
      .updateTable("uploaded_resumes")
      .set({ status: "processing", attempts: sql<number>`attempts + 1`, ...updatedNow })
      .where("id", "=", id)
      .where("status", "in", AWAITING_EXTRACTION)
      .where(sql<boolean>`attempts < max_attempts`)
      .returningAll()
      .executeTakeFirst();

    return row && toRecord(row);
  }

  async saveText(id: Id, extracted: ExtractedText): Promise<ExtractionRecord> {
    const row = await this.database
      .updateTable("uploaded_resumes")
      .set({ raw_text: extracted.text, extractor_version: extracted.extractorVersion, error_message: null, ...updatedNow })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return toRecord(row);
  }

  async attachIngestion(id: Id, ingestionId: Id, executor: Database = this.database): Promise<void> {
    await executor.updateTable("uploaded_resumes").set({ ingestion_id: ingestionId, ...updatedNow }).where("id", "=", id).execute();
  }

  // The record is done once the Ingestion built from its text has completed.
  async markDoneByIngestion(ingestionId: Id, executor: Database = this.database): Promise<void> {
    await executor
      .updateTable("uploaded_resumes")
      .set({ status: "done", error_code: null, error_message: null, finished_at: sql<Date>`now()`, ...updatedNow })
      .where("ingestion_id", "=", ingestionId)
      .where("status", "=", "processing")
      .execute();
  }

  async markFailed(id: Id, code: ResumeUploadErrorCode, message: string): Promise<void> {
    await this.database
      .updateTable("uploaded_resumes")
      .set({ status: "failed", error_code: code, error_message: message, finished_at: sql<Date>`now()`, ...updatedNow })
      .where("id", "=", id)
      .execute();
  }

  async recordError(id: Id, message: string): Promise<void> {
    await this.database
      .updateTable("uploaded_resumes")
      .set({ error_message: message, ...updatedNow })
      .where("id", "=", id)
      .execute();
  }

  async findPendingCreatedBefore(cutoff: Date): Promise<ExtractionRecord[]> {
    const rows = await this.database
      .selectFrom("uploaded_resumes")
      .selectAll()
      .where("status", "=", "pending")
      .where("created_at", "<", cutoff)
      .orderBy("created_at")
      .execute();

    return rows.map(toRecord);
  }

  async findUploaded(): Promise<ExtractionRecord[]> {
    const rows = await this.database
      .selectFrom("uploaded_resumes")
      .selectAll()
      .where("status", "=", "uploaded")
      .orderBy("created_at")
      .execute();

    return rows.map(toRecord);
  }

  // A processing record with an Ingestion is the Ingestion's to settle.
  async findProcessingWithoutIngestionUpdatedBefore(cutoff: Date): Promise<ExtractionRecord[]> {
    const rows = await this.database
      .selectFrom("uploaded_resumes")
      .selectAll()
      .where("status", "=", "processing")
      .where("ingestion_id", "is", null)
      .where("updated_at", "<", cutoff)
      .orderBy("updated_at")
      .execute();

    return rows.map(toRecord);
  }

  async statusesByObjectKey(keys: readonly string[]): Promise<Map<string, UploadedResumeStatus>> {
    if (keys.length === 0) {
      return new Map();
    }

    const rows = await this.database
      .selectFrom("uploaded_resumes")
      .select(["object_key", "status"])
      .where("object_key", "in", keys)
      .execute();

    return new Map(rows.map((row) => [row.object_key, row.status]));
  }

  // Answers undefined when the record is no longer pending or when the Account already has
  // an upload in flight; the next run looks again.
  async promote(id: Id): Promise<ExtractionRecord | undefined> {
    try {
      const row = await this.database
        .updateTable("uploaded_resumes")
        .set({ status: "uploaded", ...updatedNow })
        .where("id", "=", id)
        .where("status", "=", "pending")
        .returningAll()
        .executeTakeFirst();

      return row && toRecord(row);
    } catch (error) {
      if (isUniqueViolation(error, ONE_IN_FLIGHT_PER_ACCOUNT_INDEX)) {
        return undefined;
      }

      throw error;
    }
  }

  async expire(id: Id): Promise<ExtractionRecord | undefined> {
    const row = await this.database
      .updateTable("uploaded_resumes")
      .set({ status: "expired", finished_at: sql<Date>`now()`, ...updatedNow })
      .where("id", "=", id)
      .where("status", "=", "pending")
      .returningAll()
      .executeTakeFirst();

    return row && toRecord(row);
  }

  // A stale processing record goes back to uploaded while it has an attempt left, otherwise
  // it fails; both in one write, so two runs cannot both act on it.
  async settleStale(id: Id, message: string): Promise<ExtractionRecord | undefined> {
    const row = await this.database
      .updateTable("uploaded_resumes")
      .set({
        status: sql<UploadedResumeStatus>`case when attempts < max_attempts then 'uploaded' else 'failed' end`,
        error_code: sql<ResumeUploadErrorCode | null>`case when attempts < max_attempts then null else 'extraction_failed' end`,
        error_message: message,
        finished_at: sql<Date | null>`case when attempts < max_attempts then null else now() end`,
        ...updatedNow,
      })
      .where("id", "=", id)
      .where("status", "=", "processing")
      .returningAll()
      .executeTakeFirst();

    return row && toRecord(row);
  }

  async failByIngestion(ingestionId: Id, code: ResumeUploadErrorCode, message: string): Promise<ExtractionRecord[]> {
    const rows = await this.database
      .updateTable("uploaded_resumes")
      .set({ status: "failed", error_code: code, error_message: message, finished_at: sql<Date>`now()`, ...updatedNow })
      .where("ingestion_id", "=", ingestionId)
      .where("status", "=", "processing")
      .returningAll()
      .execute();

    return rows.map(toRecord);
  }
}
