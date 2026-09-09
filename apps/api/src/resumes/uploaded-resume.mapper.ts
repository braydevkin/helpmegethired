import { PDF_CONTENT_TYPE, type Id, type IngestionProgress, type UploadedResume } from "@helpmegethired/shared";

import type { UploadedResumeRow } from "../database/database.schema";

export interface StoredResume extends Omit<UploadedResume, "progress"> {
  objectKey: string;
  ingestionId: Id | null;
  maxAttempts: number;
}

export function toStoredResume(row: UploadedResumeRow): StoredResume {
  return {
    id: row.id,
    accountId: row.account_id,
    createdAt: row.created_at.toISOString(),
    source: "upload",
    fileName: row.file_name,
    contentType: PDF_CONTENT_TYPE,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    status: row.status,
    errorCode: row.error_code,
    finishedAt: row.finished_at?.toISOString() ?? null,
    objectKey: row.object_key,
    ingestionId: row.ingestion_id,
    maxAttempts: row.max_attempts,
  };
}

export function toUploadedResume(resume: StoredResume, progress: IngestionProgress | null): UploadedResume {
  return {
    id: resume.id,
    accountId: resume.accountId,
    createdAt: resume.createdAt,
    source: resume.source,
    fileName: resume.fileName,
    contentType: resume.contentType,
    sizeBytes: resume.sizeBytes,
    sha256: resume.sha256,
    status: resume.status,
    errorCode: resume.errorCode,
    finishedAt: resume.finishedAt,
    progress,
  };
}
