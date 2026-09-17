import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type { Id } from "@helpmegethired/shared";
import type { ConnectionOptions, Queue } from "bullmq";

import { addBounded } from "../queue/bounded-add";
import { BullMqConsumer } from "../queue/bullmq-consumer";
import { hasPendingJob, removeFinishedJob } from "../queue/job-presence";
import { CONSUMER_CONNECTION, PROFILE_CURATION_QUEUE } from "../queue/queues";
import { WORKER_SETTINGS, type WorkerSettings } from "../queue/worker-settings";
import { CURATION_JOB_NAME, CURATION_MAX_ATTEMPTS, jobOptionsFor } from "./curation-job-options";
import { CurationQueue, type CurationJob, type CurationJobHandler } from "./curation-queue";

@Injectable()
export class BullMqCurationQueue extends CurationQueue implements OnModuleDestroy {
  private readonly consumer: BullMqConsumer<CurationJob>;

  constructor(
    @Inject(PROFILE_CURATION_QUEUE) private readonly queue: Queue<CurationJob>,
    @Inject(CONSUMER_CONNECTION) connection: ConnectionOptions,
    @Inject(WORKER_SETTINGS) settings: WorkerSettings,
  ) {
    super();
    this.consumer = new BullMqConsumer(queue, connection, settings, CURATION_MAX_ATTEMPTS, new Logger(BullMqCurationQueue.name));
  }

  // A Curation paused by a rate limit or reset after a dead worker runs again under the id of a job
  // that already completed or failed.
  async enqueue(job: CurationJob): Promise<void> {
    await removeFinishedJob(this.queue, job.curationId);
    await addBounded(this.queue, CURATION_JOB_NAME, job, jobOptionsFor(job), `Curation ${job.curationId}`);
  }

  work(handler: CurationJobHandler): Promise<void> {
    return this.consumer.start(handler);
  }

  hasPendingJob(curationId: Id): Promise<boolean> {
    return hasPendingJob(this.queue, curationId);
  }

  onModuleDestroy(): Promise<void> {
    return this.consumer.close();
  }
}
