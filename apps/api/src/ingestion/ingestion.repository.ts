import { Inject, Injectable } from "@nestjs/common";
import type { Id, Ingestion, IngestionProgress, IngestionSource } from "@helpmegethired/shared";

import { lockAccount } from "../database/account-lock";
import { DATABASE, type Database } from "../database/database";
import { isUniqueViolation } from "../database/database-errors";
import { IngestionAlreadyActiveError } from "./ingestion-errors";
import { asJson, toIngestion, toSegment } from "./ingestion.mapper";
import type { NewSegment, Segment } from "./segment";
import { progressOf } from "./segment-state";

const ONE_ACTIVE_PER_ACCOUNT_INDEX = "ingestions_one_active_per_account_idx";

@Injectable()
export class IngestionRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(
    accountId: Id,
    source: IngestionSource,
    segments: readonly NewSegment[],
    maxAttempts: number,
    transaction: Database,
  ): Promise<Ingestion> {
    try {
      await lockAccount(accountId, transaction);

      const row = await transaction
        .insertInto("ingestions")
        .values({ account_id: accountId, source, status: "queued", max_attempts: maxAttempts, last_error: null, completed_at: null })
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

  async findById(accountId: Id, id: Id): Promise<Ingestion | undefined> {
    const row = await this.database
      .selectFrom("ingestions")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("id", "=", id)
      .executeTakeFirst();

    return row && toIngestion(row);
  }

  // The Profile reads the rows of the latest completed Ingestion per source.
  async findLatestCompleted(accountId: Id, source: IngestionSource): Promise<Ingestion | undefined> {
    const row = await this.database
      .selectFrom("ingestions")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("source", "=", source)
      .where("status", "=", "completed")
      .orderBy("completed_at", "desc")
      .orderBy("id", "desc")
      .executeTakeFirst();

    return row && toIngestion(row);
  }

  // The Segments' recognized output is where the Confidence of every field lives.
  async segmentsOf(accountId: Id, ingestionId: Id): Promise<Segment[]> {
    const rows = await this.database
      .selectFrom("ingestion_segments")
      .innerJoin("ingestions", "ingestions.id", "ingestion_segments.ingestion_id")
      .selectAll("ingestion_segments")
      .where("ingestions.account_id", "=", accountId)
      .where("ingestion_segments.ingestion_id", "=", ingestionId)
      .orderBy("ingestion_segments.position")
      .execute();

    return rows.map(toSegment);
  }

  async hasActive(accountId: Id, executor: Database = this.database): Promise<boolean> {
    const active = await executor
      .selectFrom("ingestions")
      .select("id")
      .where("account_id", "=", accountId)
      .where("status", "in", ["queued", "running"])
      .executeTakeFirst();

    return active !== undefined;
  }

  async progressOf(accountId: Id, id: Id): Promise<IngestionProgress | undefined> {
    return (await this.progressOfEach(accountId, [id])).get(id);
  }

  async progressOfEach(accountId: Id, ids: readonly Id[]): Promise<Map<Id, IngestionProgress>> {
    if (ids.length === 0) {
      return new Map();
    }

    const ingestions = await this.database
      .selectFrom("ingestions")
      .select(["id", "status"])
      .where("account_id", "=", accountId)
      .where("id", "in", ids)
      .execute();

    if (ingestions.length === 0) {
      return new Map();
    }

    const segments = await this.database
      .selectFrom("ingestion_segments")
      .select(["ingestion_id", "status"])
      .where(
        "ingestion_id",
        "in",
        ingestions.map((ingestion) => ingestion.id),
      )
      .execute();

    return new Map(
      ingestions.map((ingestion) => [
        ingestion.id,
        progressOf(
          ingestion.id,
          ingestion.status,
          segments.filter((segment) => segment.ingestion_id === ingestion.id).map((segment) => segment.status),
        ),
      ]),
    );
  }
}
