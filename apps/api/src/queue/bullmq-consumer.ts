import type { Logger } from "@nestjs/common";
import { Worker, type ConnectionOptions, type Queue, type WorkerOptions } from "bullmq";

import type { WorkerSettings } from "./worker-settings";

export type JobHandler<Data> = (data: Data) => Promise<void>;

// Every re-delivery of a stalled job counts as an attempt on the row, so the queue recovers a
// stalled job one time fewer than the row allows attempts.
export function workerOptionsFor(
  queue: Queue,
  connection: ConnectionOptions,
  settings: WorkerSettings,
  maxAttempts: number,
): WorkerOptions {
  return {
    connection,
    prefix: queue.opts.prefix,
    concurrency: settings.concurrency,
    lockDuration: settings.lockDurationMs,
    stalledInterval: settings.stalledIntervalMs,
    maxStalledCount: maxAttempts - 1,
  };
}

// The consuming side of a BullMQ queue: one Worker per process, started on the worker
// entrypoint only and closed with the module.
export class BullMqConsumer<Data> {
  private worker?: Worker<Data>;

  constructor(
    private readonly queue: Queue<Data>,
    private readonly connection: ConnectionOptions,
    private readonly settings: WorkerSettings,
    private readonly maxAttempts: number,
    private readonly logger: Logger,
  ) {}

  async start(handler: JobHandler<Data>): Promise<void> {
    if (this.worker) {
      throw new Error(`A worker is already consuming the ${this.queue.name} queue in this process`);
    }

    this.worker = new Worker<Data>(
      this.queue.name,
      (job) => handler(job.data),
      workerOptionsFor(this.queue, this.connection, this.settings, this.maxAttempts),
    );
    this.worker.on("error", (error) => this.logger.error(error));

    await this.worker.waitUntilReady();
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
