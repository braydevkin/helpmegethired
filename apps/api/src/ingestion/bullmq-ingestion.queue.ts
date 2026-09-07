import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type { Id } from "@helpmegethired/shared";
import type { ConnectionOptions, Queue } from "bullmq";

import { addBounded } from "../queue/bounded-add";
import { BullMqConsumer } from "../queue/bullmq-consumer";
import { hasPendingJob } from "../queue/job-presence";
import { CONSUMER_CONNECTION, PROFILE_INGESTION_QUEUE } from "../queue/queues";
import { WORKER_SETTINGS, type WorkerSettings } from "../queue/worker-settings";
import { INGESTION_JOB_NAME, jobOptionsFor } from "./ingestion-job-options";
import { IngestionQueue, type IngestionJob, type IngestionJobHandler } from "./ingestion-queue";
import { MAX_ATTEMPTS } from "./ingestion.service";

@Injectable()
export class BullMqIngestionQueue extends IngestionQueue implements OnModuleDestroy {
  private readonly consumer: BullMqConsumer<IngestionJob>;

  constructor(
    @Inject(PROFILE_INGESTION_QUEUE) private readonly queue: Queue<IngestionJob>,
    @Inject(CONSUMER_CONNECTION) connection: ConnectionOptions,
    @Inject(WORKER_SETTINGS) settings: WorkerSettings,
  ) {
    super();
    this.consumer = new BullMqConsumer(queue, connection, settings, MAX_ATTEMPTS, new Logger(BullMqIngestionQueue.name));
  }

  async enqueue(job: IngestionJob): Promise<void> {
    await addBounded(this.queue, INGESTION_JOB_NAME, job, jobOptionsFor(job), `Ingestion ${job.ingestionId}`);
  }

  work(handler: IngestionJobHandler): Promise<void> {
    return this.consumer.start(handler);
  }

  hasPendingJob(ingestionId: Id): Promise<boolean> {
    return hasPendingJob(this.queue, ingestionId);
  }

  onModuleDestroy(): Promise<void> {
    return this.consumer.close();
  }
}
