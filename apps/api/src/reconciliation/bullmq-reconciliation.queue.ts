import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type { ConnectionOptions, Queue } from "bullmq";

import { BullMqConsumer } from "../queue/bullmq-consumer";
import { CONSUMER_CONNECTION, RECONCILIATION_QUEUE } from "../queue/queues";
import { WORKER_SETTINGS, type WorkerSettings } from "../queue/worker-settings";
import { ReconciliationQueue, type ReconciliationRunHandler } from "./reconciliation-queue";

// One fixed scheduler id: every worker upserts the same scheduler, so one job exists per
// interval however many replicas run.
export const RECONCILIATION_SCHEDULER_ID = "reconciliation";
export const RECONCILIATION_JOB_NAME = "reconcile";

const RUN_ATTEMPTS = 1;
const COMPLETED_RUN_RETENTION_SECONDS = 24 * 60 * 60;
const FAILED_RUNS_KEPT = 20;

@Injectable()
export class BullMqReconciliationQueue extends ReconciliationQueue implements OnModuleDestroy {
  private readonly consumer: BullMqConsumer<undefined>;

  constructor(
    @Inject(RECONCILIATION_QUEUE) private readonly queue: Queue,
    @Inject(CONSUMER_CONNECTION) connection: ConnectionOptions,
    @Inject(WORKER_SETTINGS) settings: WorkerSettings,
  ) {
    super();
    this.consumer = new BullMqConsumer(
      queue,
      connection,
      { ...settings, concurrency: 1 },
      RUN_ATTEMPTS,
      new Logger(BullMqReconciliationQueue.name),
    );
  }

  async schedule(everyMs: number): Promise<void> {
    await this.queue.upsertJobScheduler(
      RECONCILIATION_SCHEDULER_ID,
      { every: everyMs },
      {
        name: RECONCILIATION_JOB_NAME,
        opts: { removeOnComplete: { age: COMPLETED_RUN_RETENTION_SECONDS }, removeOnFail: { count: FAILED_RUNS_KEPT } },
      },
    );
  }

  work(handler: ReconciliationRunHandler): Promise<void> {
    return this.consumer.start(() => handler());
  }

  onModuleDestroy(): Promise<void> {
    return this.consumer.close();
  }
}
