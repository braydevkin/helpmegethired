import { Injectable } from "@nestjs/common";
import type { Id, Ingestion, IngestionProgress } from "@helpmegethired/shared";

import { TransactionRunner } from "../database/transaction-runner";
import { IngestionNotFoundError } from "./ingestion-errors";
import { IngestionQueue } from "./ingestion-queue";
import { IngestionRepository } from "./ingestion.repository";
import type { NewSegment } from "./segment";

export const MAX_ATTEMPTS = 3;

@Injectable()
export class IngestionService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repository: IngestionRepository,
    private readonly queue: IngestionQueue,
  ) {}

  start(accountId: Id, segments: readonly NewSegment[]): Promise<Ingestion> {
    return this.transactions.run(async (transaction) => {
      const ingestion = await this.repository.create(accountId, segments, MAX_ATTEMPTS, transaction);

      await this.queue.enqueue({ ingestionId: ingestion.id, maxAttempts: ingestion.maxAttempts }, transaction);

      return ingestion;
    });
  }

  async progressOf(ingestionId: Id): Promise<IngestionProgress> {
    const progress = await this.repository.progressOf(ingestionId);

    if (!progress) {
      throw new IngestionNotFoundError(ingestionId);
    }

    return progress;
  }
}
