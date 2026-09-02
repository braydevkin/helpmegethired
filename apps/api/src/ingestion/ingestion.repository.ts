import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import type { Id, Ingestion, IngestionProgress, SegmentStep } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { isUniqueViolation } from "../database/database-errors";
import type { IngestionRow, IngestionSegmentRow } from "../database/database.schema";
import { IngestionAlreadyActiveError } from "./ingestion-errors";
import type { NewSegment, Segment } from "./segment";
import { progressOf, statusAfter } from "./segment-state";

const ONE_ACTIVE_PER_ACCOUNT_INDEX = "ingestions_one_active_per_account_idx";

const updatedNow = { updated_at: sql<Date>`now()` };

function toIngestion(row: IngestionRow): Ingestion {
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

function toSegment(row: IngestionSegmentRow): Segment {
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

const asJson = (value: unknown) => JSON.stringify(value ?? null);

function outputColumnsOf(step: SegmentStep, output: unknown) {
  switch (step) {
    case "read":
      return { content: asJson(output) };
    case "recognize":
      return { recognized: asJson(output) };
    case "save":
      return {};
  }
}

@Injectable()
export class IngestionRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(
    accountId: Id,
    segments: readonly NewSegment[],
    maxAttempts: number,
    transaction: Database,
  ): Promise<Ingestion> {
    try {
      const row = await transaction
        .insertInto("ingestions")
        .values({ account_id: accountId, status: "queued", max_attempts: maxAttempts, last_error: null })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (segments.length > 0) {
        await transaction
          .insertInto("ingestion_segments")
          .values(
            segments.map((segment, position) => ({
              ingestion_id: row.id,
              position,
              kind: segment.kind,
              input: asJson(segment.input),
              content: null,
              recognized: null,
              last_error: null,
            })),
          )
          .execute();
      }

      return toIngestion(row);
    } catch (error) {
      if (isUniqueViolation(error, ONE_ACTIVE_PER_ACCOUNT_INDEX)) {
        throw new IngestionAlreadyActiveError(accountId);
      }

      throw error;
    }
  }

  async findById(id: Id): Promise<Ingestion | undefined> {
    const row = await this.database.selectFrom("ingestions").selectAll().where("id", "=", id).executeTakeFirst();

    return row && toIngestion(row);
  }

  async segmentsOf(ingestionId: Id): Promise<Segment[]> {
    const rows = await this.database
      .selectFrom("ingestion_segments")
      .selectAll()
      .where("ingestion_id", "=", ingestionId)
      .orderBy("position")
      .execute();

    return rows.map(toSegment);
  }

  async beginAttempt(id: Id): Promise<Ingestion | undefined> {
    const row = await this.database
      .updateTable("ingestions")
      .set({ status: "running", attempts: sql<number>`attempts + 1`, ...updatedNow })
      .where("id", "=", id)
      .where("status", "!=", "completed")
      .returningAll()
      .executeTakeFirst();

    return row && toIngestion(row);
  }

  async completeAttempt(id: Id): Promise<void> {
    await this.database
      .updateTable("ingestions")
      .set({ status: "completed", last_error: null, ...updatedNow })
      .where("id", "=", id)
      .execute();
  }

  async failAttempt(id: Id, error: string): Promise<Ingestion | undefined> {
    const row = await this.database
      .updateTable("ingestions")
      .set({
        status: sql<Ingestion["status"]>`case when attempts < max_attempts then 'queued' else 'failed' end`,
        last_error: error,
        ...updatedNow,
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row && toIngestion(row);
  }

  async recordStep(segmentId: Id, step: SegmentStep, output: unknown): Promise<Segment> {
    const row = await this.database
      .updateTable("ingestion_segments")
      .set({ status: statusAfter(step), last_error: null, ...outputColumnsOf(step, output), ...updatedNow })
      .where("id", "=", segmentId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return toSegment(row);
  }

  async recordSegmentError(segmentId: Id, error: string): Promise<void> {
    await this.database
      .updateTable("ingestion_segments")
      .set({ last_error: error, ...updatedNow })
      .where("id", "=", segmentId)
      .execute();
  }

  async progressOf(id: Id): Promise<IngestionProgress | undefined> {
    const ingestion = await this.findById(id);

    if (!ingestion) {
      return undefined;
    }

    const segments = await this.database
      .selectFrom("ingestion_segments")
      .select("status")
      .where("ingestion_id", "=", id)
      .execute();

    return progressOf(
      ingestion.id,
      ingestion.status,
      segments.map((segment) => segment.status),
    );
  }
}
