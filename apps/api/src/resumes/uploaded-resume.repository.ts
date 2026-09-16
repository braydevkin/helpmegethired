import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import type { Id, ResumeUpload, UploadedResumeStatus } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { isUniqueViolation } from "../database/database-errors";
import { UploadInFlightError } from "./resume-errors";
import { toStoredResume, type StoredResume } from "./uploaded-resume.mapper";

const ONE_LIVE_PER_FILE_INDEX = "uploaded_resumes_one_live_per_file_idx";
const ONE_IN_FLIGHT_PER_ACCOUNT_INDEX = "uploaded_resumes_one_in_flight_per_account_idx";

const LIVE_STATUSES: readonly UploadedResumeStatus[] = ["pending", "uploaded", "processing", "done"];
const SETTLED_STATUSES: readonly UploadedResumeStatus[] = ["done", "failed"];

export interface NewUploadedResume extends ResumeUpload {
  id: Id;
  objectKey: string;
  maxAttempts: number;
}

export class DuplicateUploadError extends Error {
  constructor(sha256: string) {
    super(`The Account already has a live Uploaded Resume with the checksum ${sha256}`);
    this.name = "DuplicateUploadError";
  }
}

// Every method takes the Account first: a record of another Account answers as absent.
@Injectable()
export class UploadedResumeRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(accountId: Id, upload: NewUploadedResume): Promise<StoredResume> {
    try {
      const row = await this.database
        .insertInto("uploaded_resumes")
        .values({
          id: upload.id,
          account_id: accountId,
          sha256: upload.sha256,
          file_name: upload.fileName,
          size_bytes: upload.sizeBytes,
          object_key: upload.objectKey,
          max_attempts: upload.maxAttempts,
          error_code: null,
          error_message: null,
          raw_text: null,
          extractor_version: null,
          ingestion_id: null,
          finished_at: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return toStoredResume(row);
    } catch (error) {
      if (isUniqueViolation(error, ONE_LIVE_PER_FILE_INDEX)) {
        throw new DuplicateUploadError(upload.sha256);
      }

      throw error;
    }
  }

  async findById(accountId: Id, id: Id): Promise<StoredResume | undefined> {
    const row = await this.database
      .selectFrom("uploaded_resumes")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("id", "=", id)
      .executeTakeFirst();

    return row && toStoredResume(row);
  }

  async findByIngestionId(accountId: Id, ingestionId: Id): Promise<StoredResume | undefined> {
    const row = await this.database
      .selectFrom("uploaded_resumes")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("ingestion_id", "=", ingestionId)
      .executeTakeFirst();

    return row && toStoredResume(row);
  }

  // Reading the stored text again links the record to the new Ingestion, so the record behind an
  // earlier one is found through its Segments, which name the Uploaded Resume they read.
  async findReadBy(accountId: Id, ingestionId: Id): Promise<StoredResume | undefined> {
    const linked = await this.findByIngestionId(accountId, ingestionId);

    if (linked) {
      return linked;
    }

    const row = await this.database
      .selectFrom("uploaded_resumes")
      .selectAll()
      .where("account_id", "=", accountId)
      .where(({ exists, selectFrom }) =>
        exists(
          selectFrom("ingestion_segments")
            .select("ingestion_segments.id")
            .where("ingestion_segments.ingestion_id", "=", ingestionId)
            .where(sql<string>`ingestion_segments.input->>'uploadedResumeId'`, "=", sql<string>`uploaded_resumes.id::text`),
        ),
      )
      .executeTakeFirst();

    return row && toStoredResume(row);
  }

  async extractedTextOf(accountId: Id, id: Id): Promise<string | undefined> {
    const row = await this.database
      .selectFrom("uploaded_resumes")
      .select("raw_text")
      .where("account_id", "=", accountId)
      .where("id", "=", id)
      .executeTakeFirst();

    return row?.raw_text ?? undefined;
  }

  // The record goes back to processing linked to the Ingestion that reads its text again, as the
  // extraction hand-over leaves a new one, so its progress, completion, and failure follow that
  // Ingestion. Answers undefined when the record is not settled or has no text; a record
  // in flight, or the same file uploaded again meanwhile, refuses it.
  async restartReading(accountId: Id, id: Id, ingestionId: Id, executor: Database): Promise<StoredResume | undefined> {
    try {
      const row = await executor
        .updateTable("uploaded_resumes")
        .set({ status: "processing", ingestion_id: ingestionId, error_code: null, error_message: null, finished_at: null, updated_at: sql<Date>`now()` })
        .where("account_id", "=", accountId)
        .where("id", "=", id)
        .where("status", "in", SETTLED_STATUSES)
        .where("raw_text", "is not", null)
        .returningAll()
        .executeTakeFirst();

      return row && toStoredResume(row);
    } catch (error) {
      if (isUniqueViolation(error, ONE_IN_FLIGHT_PER_ACCOUNT_INDEX) || isUniqueViolation(error, ONE_LIVE_PER_FILE_INDEX)) {
        throw new UploadInFlightError(accountId);
      }

      throw error;
    }
  }

  async findLiveBySha256(accountId: Id, sha256: string): Promise<StoredResume | undefined> {
    const row = await this.database
      .selectFrom("uploaded_resumes")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("sha256", "=", sha256)
      .where("status", "in", LIVE_STATUSES)
      .executeTakeFirst();

    return row && toStoredResume(row);
  }

  async list(accountId: Id, status?: UploadedResumeStatus): Promise<StoredResume[]> {
    let query = this.database.selectFrom("uploaded_resumes").selectAll().where("account_id", "=", accountId);

    if (status) {
      query = query.where("status", "=", status);
    }

    const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc").execute();

    return rows.map(toStoredResume);
  }

  // Answers undefined when the record is no longer pending, so a concurrent completion is
  // noticed instead of repeated.
  async markUploaded(accountId: Id, id: Id, executor: Database = this.database): Promise<StoredResume | undefined> {
    try {
      const row = await executor
        .updateTable("uploaded_resumes")
        .set({ status: "uploaded", updated_at: sql<Date>`now()` })
        .where("account_id", "=", accountId)
        .where("id", "=", id)
        .where("status", "=", "pending")
        .returningAll()
        .executeTakeFirst();

      return row && toStoredResume(row);
    } catch (error) {
      if (isUniqueViolation(error, ONE_IN_FLIGHT_PER_ACCOUNT_INDEX)) {
        throw new UploadInFlightError(accountId);
      }

      throw error;
    }
  }
}
