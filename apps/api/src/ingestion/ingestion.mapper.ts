import type { Ingestion } from "@helpmegethired/shared";

import type { IngestionRow, IngestionSegmentRow } from "../database/database.schema";
import type { Segment } from "./segment";

export function toIngestion(row: IngestionRow): Ingestion {
  return {
    id: row.id,
    accountId: row.account_id,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toSegment(row: IngestionSegmentRow): Segment {
  return {
    id: row.id,
    ingestionId: row.ingestion_id,
    position: row.position,
    kind: row.kind,
    status: row.status,
    input: row.input,
    content: row.content,
    recognized: row.recognized,
    lastError: row.last_error,
  };
}

export const asJson = (value: unknown) => JSON.stringify(value ?? null);
