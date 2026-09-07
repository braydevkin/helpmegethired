import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type { ConnectionOptions, Queue } from "bullmq";

import { addBounded } from "../queue/bounded-add";
import { BullMqConsumer } from "../queue/bullmq-consumer";
import { retryingJobOptions } from "../queue/job-options";
import { CONSUMER_CONNECTION, RESUME_EXTRACTION_QUEUE } from "../queue/queues";
import { WORKER_SETTINGS, type WorkerSettings } from "../queue/worker-settings";
import { ResumeExtractionQueue, type ResumeExtractionJob, type ResumeExtractionJobHandler } from "./resume-extraction-queue";
import { EXTRACTION_MAX_ATTEMPTS } from "./uploaded-resume.service";

export const EXTRACTION_JOB_NAME = "extract";

@Injectable()
export class BullMqResumeExtractionQueue extends ResumeExtractionQueue implements OnModuleDestroy {
  private readonly consumer: BullMqConsumer<ResumeExtractionJob>;

  constructor(
    @Inject(RESUME_EXTRACTION_QUEUE) private readonly queue: Queue<ResumeExtractionJob>,
    @Inject(CONSUMER_CONNECTION) connection: ConnectionOptions,
    @Inject(WORKER_SETTINGS) settings: WorkerSettings,
  ) {
    super();
    this.consumer = new BullMqConsumer(
      queue,
      connection,
      settings,
      EXTRACTION_MAX_ATTEMPTS,
      new Logger(BullMqResumeExtractionQueue.name),
    );
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

  work(handler: ResumeExtractionJobHandler): Promise<void> {
    return this.consumer.start(handler);
  }

  onModuleDestroy(): Promise<void> {
    return this.consumer.close();
  }
}
