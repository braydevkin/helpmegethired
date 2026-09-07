import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker, type ConnectionOptions } from "bullmq";

import { addBounded } from "../queue/bounded-add";
import { retryingJobOptions } from "../queue/job-options";
import { CONSUMER_CONNECTION, RESUME_EXTRACTION_QUEUE } from "../queue/queues";
import { WORKER_SETTINGS, type WorkerSettings } from "../queue/worker-settings";
import { ResumeExtractionQueue, type ResumeExtractionJob, type ResumeExtractionJobHandler } from "./resume-extraction-queue";
import { EXTRACTION_MAX_ATTEMPTS } from "./uploaded-resume.service";

export const EXTRACTION_JOB_NAME = "extract";

// Every re-delivery of a stalled job counts as an attempt on the record, so the queue recovers
// a stalled job one time fewer than the record allows attempts.
const STALLED_RECOVERIES = EXTRACTION_MAX_ATTEMPTS - 1;

@Injectable()
export class BullMqResumeExtractionQueue extends ResumeExtractionQueue implements OnModuleDestroy {
  private readonly logger = new Logger(BullMqResumeExtractionQueue.name);
  private worker?: Worker<ResumeExtractionJob>;

  constructor(
    @Inject(RESUME_EXTRACTION_QUEUE) private readonly queue: Queue<ResumeExtractionJob>,
    @Inject(CONSUMER_CONNECTION) private readonly connection: ConnectionOptions,
    @Inject(WORKER_SETTINGS) private readonly settings: WorkerSettings,
  ) {
    super();
  }

  enqueue(job: ResumeExtractionJob): Promise<void> {
    return addBounded(
      this.queue,
      EXTRACTION_JOB_NAME,
      job,
      retryingJobOptions(job.uploadedResumeId, job.maxAttempts),
      `Uploaded Resume ${job.uploadedResumeId}`,
    );
  }

  async work(handler: ResumeExtractionJobHandler): Promise<void> {
    if (this.worker) {
      throw new Error(`A worker is already consuming the ${this.queue.name} queue in this process`);
    }

    this.worker = new Worker<ResumeExtractionJob>(this.queue.name, (job) => handler(job.data), {
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
