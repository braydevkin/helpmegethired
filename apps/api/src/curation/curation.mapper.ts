import type { Curation } from "@helpmegethired/shared";

import type { CurationRow } from "../database/database.schema";

export function toCuration(row: CurationRow): Curation {
  return {
    id: row.id,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    sourceIngestionId: row.source_ingestion_id,
    createdAt: row.created_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    failureReason: row.failure_reason,
    resumeAfter: row.resume_after?.toISOString() ?? null,
  };
}
