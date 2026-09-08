import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import type { Id, Ingestion, SegmentStep } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { asJson, toIngestion, toSegment } from "./ingestion.mapper";
import type { Segment } from "./segment";
import { statusAfter } from "./segment-state";

const updatedNow = { updated_at: sql<Date>`now()` };

// An attempt that ends without completing is queued again while one is left, otherwise failed.
const queuedAgainOrFailed = (error: string) => ({
  status: sql<Ingestion["status"]>`case when attempts < max_attempts then 'queued' else 'failed' end`,
  last_error: error,
  ...updatedNow,
});

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

// The runner acts for the queue, not for a Candidate, so this is the one repository that
// addresses Ingestions by id alone. Every Candidate-facing read goes through IngestionRepository.
@Injectable()
export class IngestionRunRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

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

  async completeAttempt(id: Id, executor: Database = this.database): Promise<Ingestion> {
    const row = await executor
      .updateTable("ingestions")
      .set({ status: "completed", last_error: null, completed_at: sql<Date>`now()`, ...updatedNow })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return toIngestion(row);
  }

  async failAttempt(id: Id, error: string): Promise<Ingestion | undefined> {
    const row = await this.database
      .updateTable("ingestions")
      .set(queuedAgainOrFailed(error))
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row && toIngestion(row);
  }

  async findActiveUpdatedBefore(cutoff: Date): Promise<Ingestion[]> {
    const rows = await this.database
      .selectFrom("ingestions")
      .selectAll()
      .where("status", "in", ["queued", "running"])
      .where("updated_at", "<", cutoff)
      .orderBy("updated_at")
      .execute();

    return rows.map(toIngestion);
  }

  // One conditional write, so two reconciliation runs cannot both act on a stale Ingestion.
  async settleStale(id: Id, message: string): Promise<Ingestion | undefined> {
    const row = await this.database
      .updateTable("ingestions")
      .set(queuedAgainOrFailed(message))
      .where("id", "=", id)
      .where("status", "in", ["queued", "running"])
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
}
