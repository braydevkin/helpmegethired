import { Inject, Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";

import { addBounded } from "../queue/bounded-add";
import { retryingJobOptions } from "../queue/job-options";
import { RESUME_EXTRACTION_QUEUE } from "../queue/queues";
import { ResumeExtractionQueue, type ResumeExtractionJob } from "./resume-extraction-queue";

export const EXTRACTION_JOB_NAME = "extract";

@Injectable()
export class BullMqResumeExtractionQueue extends ResumeExtractionQueue {
  constructor(@Inject(RESUME_EXTRACTION_QUEUE) private readonly queue: Queue<ResumeExtractionJob>) {
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
}
