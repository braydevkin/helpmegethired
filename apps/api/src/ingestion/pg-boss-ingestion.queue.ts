import { Inject, Injectable } from "@nestjs/common";
import { PgBoss, fromKysely } from "pg-boss";

import type { Database } from "../database/database";
import { IngestionQueue, type IngestionJob, type IngestionJobHandler } from "./ingestion-queue";

export const INGESTION_QUEUE_NAME = "profile-ingestion";

const RETRY_DELAY_SECONDS = 1;
const POLLING_INTERVAL_SECONDS = 1;

@Injectable()
export class PgBossIngestionQueue extends IngestionQueue {
  private queueReady?: Promise<void>;

  constructor(@Inject(PgBoss) private readonly boss: PgBoss) {
    super();
  }

  async enqueue(job: IngestionJob, transaction: Database): Promise<void> {
    await this.ensureQueue();
    await this.boss.send(INGESTION_QUEUE_NAME, job, { retryLimit: job.maxAttempts - 1, db: fromKysely(transaction) });
  }

  async work(handler: IngestionJobHandler): Promise<void> {
    await this.ensureQueue();
    await this.boss.work<IngestionJob>(
      INGESTION_QUEUE_NAME,
      { pollingIntervalSeconds: POLLING_INTERVAL_SECONDS },
      async (jobs) => {
        for (const job of jobs) {
          await handler(job.data);
        }
      },
    );
  }

  private ensureQueue(): Promise<void> {
    this.queueReady ??= this.boss.createQueue(INGESTION_QUEUE_NAME, {
      retryDelay: RETRY_DELAY_SECONDS,
      retryBackoff: true,
    });

    return this.queueReady;
  }
}
