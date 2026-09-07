import type { JobsOptions } from "bullmq";

import type { IngestionJob } from "./ingestion-queue";

export const INGESTION_JOB_NAME = "run";

const FIRST_RETRY_DELAY_MS = 1_000;
const COMPLETED_JOB_RETENTION_SECONDS = 24 * 60 * 60;

// The job id is the Ingestion id, so adding the same Ingestion twice is a no-op, and a failed
// job stays in Redis for the queue dashboard.
export function jobOptionsFor(job: IngestionJob): JobsOptions {
  return {
    jobId: job.ingestionId,
    attempts: job.maxAttempts,
    backoff: { type: "exponential", delay: FIRST_RETRY_DELAY_MS },
    removeOnComplete: { age: COMPLETED_JOB_RETENTION_SECONDS },
    removeOnFail: false,
  };
}
