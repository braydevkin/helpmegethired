import type { JobState, Queue } from "bullmq";

// A job in one of these states will still be delivered; a completed, failed, or unknown one
// will not, so its row needs the reconciliation job.
const PENDING_STATES: ReadonlySet<JobState | "unknown"> = new Set<JobState>([
  "waiting",
  "active",
  "delayed",
  "prioritized",
  "waiting-children",
]);

export async function hasPendingJob(queue: Queue, jobId: string): Promise<boolean> {
  const job = await queue.getJob(jobId);

  return job !== undefined && PENDING_STATES.has(await job.getState());
}
