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
