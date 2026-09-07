import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import type { Id, ResumeUploadErrorCode, UploadedResumeStatus } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
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
}

const AWAITING_EXTRACTION: readonly UploadedResumeStatus[] = ["uploaded", "processing"];

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

  async markDone(id: Id): Promise<void> {
    await this.database
      .updateTable("uploaded_resumes")
      .set({ status: "done", error_code: null, error_message: null, finished_at: sql<Date>`now()`, ...updatedNow })
      .where("id", "=", id)
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
}
