import { Inject, Injectable } from "@nestjs/common";
import type { Id, Ingestion, IngestionProgress } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { isUniqueViolation } from "../database/database-errors";
import { IngestionAlreadyActiveError } from "./ingestion-errors";
import { asJson, toIngestion } from "./ingestion.mapper";
import type { NewSegment } from "./segment";
import { progressOf } from "./segment-state";

const ONE_ACTIVE_PER_ACCOUNT_INDEX = "ingestions_one_active_per_account_idx";

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

  async findById(accountId: Id, id: Id): Promise<Ingestion | undefined> {
    const row = await this.database
      .selectFrom("ingestions")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("id", "=", id)
      .executeTakeFirst();

    return row && toIngestion(row);
  }

  async hasActive(accountId: Id): Promise<boolean> {
    const active = await this.database
      .selectFrom("ingestions")
      .select("id")
      .where("account_id", "=", accountId)
      .where("status", "in", ["queued", "running"])
      .executeTakeFirst();

    return active !== undefined;
  }

  async progressOf(accountId: Id, id: Id): Promise<IngestionProgress | undefined> {
    const ingestion = await this.findById(accountId, id);

    if (!ingestion) {
      return undefined;
    }

    const segments = await this.database
      .selectFrom("ingestion_segments")
      .select("status")
      .where("ingestion_id", "=", ingestion.id)
      .execute();

    return progressOf(
      ingestion.id,
      ingestion.status,
      segments.map((segment) => segment.status),
    );
  }
}
