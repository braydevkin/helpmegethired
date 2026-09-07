import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker, type ConnectionOptions } from "bullmq";

import { withTimeout } from "../common/with-timeout";
import { CONSUMER_CONNECTION, PROFILE_INGESTION_QUEUE } from "../queue/queues";
import { INGESTION_JOB_NAME, jobOptionsFor } from "./ingestion-job-options";
import { IngestionQueue, type IngestionJob, type IngestionJobHandler } from "./ingestion-queue";
import { INGESTION_WORKER_SETTINGS, type IngestionWorkerSettings } from "./ingestion-worker-settings";
import { MAX_ATTEMPTS } from "./ingestion.service";

// Every re-delivery of a stalled job counts as an attempt on the Ingestion row, so the queue
// recovers a stalled job one time fewer than the row allows attempts.
const STALLED_RECOVERIES = MAX_ATTEMPTS - 1;

// The row is already committed when the job is added, so a Redis outage must cost the request
// a bounded wait and a log line, never a hang.
export const ENQUEUE_TIMEOUT_MS = 5_000;

@Injectable()
export class BullMqIngestionQueue extends IngestionQueue implements OnModuleDestroy {
  private readonly logger = new Logger(BullMqIngestionQueue.name);
  private worker?: Worker<IngestionJob>;

  constructor(
    @Inject(PROFILE_INGESTION_QUEUE) private readonly queue: Queue<IngestionJob>,
    @Inject(CONSUMER_CONNECTION) private readonly connection: ConnectionOptions,
    @Inject(INGESTION_WORKER_SETTINGS) private readonly settings: IngestionWorkerSettings,
  ) {
    super();
  }

  async enqueue(job: IngestionJob): Promise<void> {
    await withTimeout(
      this.queue.add(INGESTION_JOB_NAME, job, jobOptionsFor(job)),
      ENQUEUE_TIMEOUT_MS,
      `Adding the job of Ingestion ${job.ingestionId} to ${this.queue.name}`,
    );
  }

  async work(handler: IngestionJobHandler): Promise<void> {
    if (this.worker) {
      throw new Error(`A worker is already consuming the ${this.queue.name} queue in this process`);
    }

    this.worker = new Worker<IngestionJob>(this.queue.name, (job) => handler(job.data), {
      connection: this.connection,
      prefix: this.queue.opts.prefix,
      concurrency: this.settings.concurrency,
      lockDuration: this.settings.lockDurationMs,
      stalledInterval: this.settings.stalledIntervalMs,
      maxStalledCount: STALLED_RECOVERIES,
    });
    this.worker.on("error", (error) => this.logger.error(error));

    await this.worker.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
