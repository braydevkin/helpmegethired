import { Injectable, Logger } from "@nestjs/common";
import type { Id, Ingestion, IngestionProgress, IngestionSource } from "@helpmegethired/shared";

import type { Database } from "../database/database";
import { TransactionRunner } from "../database/transaction-runner";
import { IngestionNotFoundError } from "./ingestion-errors";
import { IngestionQueue } from "./ingestion-queue";
import { IngestionRepository } from "./ingestion.repository";
import type { NewSegment } from "./segment";

export const MAX_ATTEMPTS = 3;

export interface NewIngestion {
  accountId: Id;
  source: IngestionSource;
  segments: readonly NewSegment[];
}

// Work the caller wants committed together with the new Ingestion, such as linking it to
// the Uploaded Resume it came from.
export type WithNewIngestion = (ingestion: Ingestion, transaction: Database) => Promise<void>;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repository: IngestionRepository,
    private readonly queue: IngestionQueue,
  ) {}

  async start({ accountId, source, segments }: NewIngestion, withIngestion?: WithNewIngestion): Promise<Ingestion> {
    const ingestion = await this.transactions.run(async (transaction) => {
      const created = await this.repository.create(accountId, source, segments, MAX_ATTEMPTS, transaction);

      await withIngestion?.(created, transaction);

      return created;
    });

    await this.enqueue(ingestion);

    return ingestion;
  }

  async progressOf(accountId: Id, ingestionId: Id): Promise<IngestionProgress> {
    const progress = await this.repository.progressOf(accountId, ingestionId);

    if (!progress) {
      throw new IngestionNotFoundError(ingestionId);
    }

    return progress;
  }

  // The row is committed before the job is added, so a queue outage leaves a queued Ingestion
  // without a job; the reconciliation job enqueues it instead of the request failing.
  private async enqueue(ingestion: Ingestion): Promise<void> {
    try {
      await this.queue.enqueue({ ingestionId: ingestion.id, maxAttempts: ingestion.maxAttempts });
    } catch (error) {
      this.logger.error(`Ingestion ${ingestion.id} is queued but its job could not be added`, error);
    }
  }
}
