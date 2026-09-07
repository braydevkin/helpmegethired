import type { JobsOptions } from "bullmq";

const FIRST_RETRY_DELAY_MS = 1_000;
const COMPLETED_JOB_RETENTION_SECONDS = 24 * 60 * 60;

// The job id is the record id, so adding the same record twice is a no-op, and a failed job
// stays in Redis for the queue dashboard.
export function retryingJobOptions(jobId: string, maxAttempts: number): JobsOptions {
  return {
    jobId,
    attempts: maxAttempts,
    backoff: { type: "exponential", delay: FIRST_RETRY_DELAY_MS },
    removeOnComplete: { age: COMPLETED_JOB_RETENTION_SECONDS },
    removeOnFail: false,
  };
}
